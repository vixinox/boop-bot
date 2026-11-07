import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  logBehaviorDiagnostic,
  logDebugEvent,
  useDebugConsoleStore,
} from './debugConsoleStore'

describe('debug console store', () => {
  beforeEach(() => useDebugConsoleStore.getState().clear())
  afterEach(() => vi.useRealTimers())

  it('keeps only the newest 1000 entries', () => {
    for (let index = 0; index < 1001; index += 1) {
      logDebugEvent({ source: 'user', type: 'user_action', summary: `event ${index}` })
    }

    const { entries } = useDebugConsoleStore.getState()
    expect(entries).toHaveLength(1000)
    expect(entries[0]?.summary).toBe('event 1')
    expect(entries.at(-1)?.summary).toBe('event 1000')
  })

  it('clears entries and accepts new events afterward', () => {
    logDebugEvent({ source: 'assistant', type: 'chat_request', summary: 'sent' })
    useDebugConsoleStore.getState().clear()
    logDebugEvent({ source: 'assistant', type: 'assistant_done', summary: 'done' })

    expect(useDebugConsoleStore.getState().entries.map((entry) => entry.summary)).toEqual(
      ['done'],
    )
  })

  it('retains complete detail for JSON export', () => {
    const detail = { text: 'hello', args: { animation: 'Wave' } }
    logDebugEvent({
      source: 'assistant',
      type: 'tool_call',
      summary: 'play_animation_timeline',
      detail,
    })

    expect(
      JSON.parse(JSON.stringify(useDebugConsoleStore.getState().entries))[0].detail,
    ).toEqual(detail)
  })

  it('groups consecutive streamed text deltas without losing their content', () => {
    logDebugEvent({
      source: 'assistant',
      type: 'chat_delta',
      summary: 'delta',
      detail: { text: 'hel' },
    })
    logDebugEvent({
      source: 'assistant',
      type: 'chat_delta',
      summary: 'delta',
      detail: { text: 'lo' },
    })

    expect(useDebugConsoleStore.getState().entries).toHaveLength(1)
    expect(useDebugConsoleStore.getState().entries[0]?.detail).toEqual([
      { text: 'hel' },
      { text: 'lo' },
    ])
  })

  it('records compact behavior lifecycle events with owner and recovery reason', () => {
    logBehaviorDiagnostic({
      event: 'reaction_started',
      phase: 'responding',
      owner: 'conversation',
      reactionId: 7,
      action: 'Wave',
    })
    logBehaviorDiagnostic({
      event: 'interrupted',
      phase: 'responding',
      owner: 'direct_interaction',
      reactionId: 7,
      reason: 'replaced_by_direct_interaction',
    })

    expect(useDebugConsoleStore.getState().entries).toMatchObject([
      {
        type: 'behavior',
        summary: '反应开始',
        detail: { event: 'reaction_started', owner: 'conversation', action: 'Wave' },
      },
      {
        type: 'behavior',
        summary: '行为被打断',
        detail: { event: 'interrupted', owner: 'direct_interaction' },
      },
    ])
  })

  it('throttles small attention changes and stores only quantized direction', () => {
    vi.useFakeTimers()
    logBehaviorDiagnostic({
      event: 'attention_changed',
      attentionDirection: { yawRadians: 0, pitchRadians: 0 },
    })
    vi.advanceTimersByTime(1300)
    logBehaviorDiagnostic({
      event: 'attention_changed',
      attentionDirection: { yawRadians: 0.1, pitchRadians: 0 },
    })
    expect(useDebugConsoleStore.getState().entries).toHaveLength(1)

    vi.advanceTimersByTime(1300)
    logBehaviorDiagnostic({
      event: 'attention_changed',
      attentionDirection: { yawRadians: 0.5, pitchRadians: 0.1 },
    })
    const entry = useDebugConsoleStore.getState().entries.at(-1)
    expect(entry?.detail).toMatchObject({
      event: 'attention_changed',
      attentionDirection: { yawDegrees: 29, pitchDegrees: 6 },
    })
    expect(entry?.detail).not.toHaveProperty('x')
    expect(entry?.detail).not.toHaveProperty('y')
    expect(entry?.detail).not.toHaveProperty('z')
  })

  it('ignores invalid attention directions', () => {
    logBehaviorDiagnostic({
      event: 'attention_changed',
      attentionDirection: { yawRadians: Number.NaN, pitchRadians: 0 },
    })
    expect(useDebugConsoleStore.getState().entries).toHaveLength(0)
  })
})
