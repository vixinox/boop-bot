import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useBehaviorStore, dispatchBehaviorEvent } from './behaviorStore'

describe('useBehaviorStore', () => {
  beforeEach(() => useBehaviorStore.getState().resetBehavior())
  afterEach(() => {
    useBehaviorStore.getState().resetBehavior()
    vi.useRealTimers()
  })

  it('publishes reaction intents and stores the corresponding active reaction', () => {
    const intents = dispatchBehaviorEvent({
      type: 'avatar_touch_started',
      region: 'hand',
    })
    expect(intents).toEqual([
      {
        type: 'start_reaction',
        reaction: {
          id: 1,
          kind: 'hand_wave',
          action: 'Wave',
          owner: 'direct_interaction',
        },
      },
    ])
    expect(useBehaviorStore.getState().activeReaction?.id).toBe(1)
  })

  it('assigns unique monotonically increasing IDs to local reactions', () => {
    dispatchBehaviorEvent({ type: 'avatar_touch_started', region: 'head' })
    dispatchBehaviorEvent({ type: 'reaction_completed', reactionId: 1 })
    dispatchBehaviorEvent({ type: 'avatar_touch_started', region: 'torso' })
    expect(useBehaviorStore.getState().activeReaction?.id).toBe(2)
  })

  it('stores semantic emotions while conversation phases continue independently', () => {
    dispatchBehaviorEvent({ type: 'emotion_changed', emotion: 'comfort' })
    dispatchBehaviorEvent({ type: 'conversation_processing' })
    expect(useBehaviorStore.getState()).toMatchObject({
      emotion: 'comfort',
      phase: 'thinking',
    })
    dispatchBehaviorEvent({ type: 'emotion_changed', emotion: 'neutral' })
    expect(useBehaviorStore.getState().emotion).toBe('neutral')
  })

  it('returns from settling to available when its deadline expires', async () => {
    vi.useFakeTimers()
    dispatchBehaviorEvent({ type: 'conversation_turn_finished' })
    expect(useBehaviorStore.getState().phase).toBe('settling')
    await vi.advanceTimersByTimeAsync(900)
    expect(useBehaviorStore.getState()).toMatchObject({
      phase: 'available',
      owner: 'ambient',
    })
  })

  it('pauses the settling deadline while hidden and resumes its remaining time', async () => {
    vi.useFakeTimers()
    dispatchBehaviorEvent({ type: 'conversation_turn_finished' })
    await vi.advanceTimersByTimeAsync(400)
    dispatchBehaviorEvent({ type: 'page_hidden' })
    await vi.advanceTimersByTimeAsync(5000)
    expect(useBehaviorStore.getState().phase).toBe('suspended')
    dispatchBehaviorEvent({ type: 'page_visible' })
    await vi.advanceTimersByTimeAsync(499)
    expect(useBehaviorStore.getState().phase).toBe('settling')
    await vi.advanceTimersByTimeAsync(1)
    expect(useBehaviorStore.getState().phase).toBe('available')
  })
})
