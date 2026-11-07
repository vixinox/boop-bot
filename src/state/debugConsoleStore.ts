import { create } from 'zustand'

export const DEBUG_EVENT_TYPES = [
  'user_action',
  'chat_request',
  'chat_delta',
  'tool_call',
  'tool_result',
  'tool_error',
  'tool_budget_exhausted',
  'assistant_done',
  'request_error',
  'behavior',
] as const

export type DebugEventType = (typeof DEBUG_EVENT_TYPES)[number]
export type DebugSource = 'user' | 'assistant' | 'system'

export type DebugEntry = {
  id: number
  timestamp: string
  source: DebugSource
  type: DebugEventType
  summary: string
  detail?: unknown
}

type DebugConsoleState = {
  entries: DebugEntry[]
  log: (entry: Omit<DebugEntry, 'id' | 'timestamp'>) => void
  clear: () => void
}

let nextId = 1
let lastAttentionDiagnostic: { at: number; yaw: number; pitch: number } | null = null

export type BehaviorDiagnostic = {
  event:
    | 'phase_changed'
    | 'reaction_started'
    | 'reaction_ended'
    | 'owner_changed'
    | 'attention_changed'
    | 'suppressed'
    | 'interrupted'
    | 'recovered'
    | 'failed'
  phase?: string
  previousPhase?: string
  owner?: string
  reactionId?: number
  action?: string
  reason?: string
  attentionDirection?: { yawRadians: number; pitchRadians: number }
}

const behaviorSummaries: Record<BehaviorDiagnostic['event'], string> = {
  phase_changed: '行为阶段变化',
  reaction_started: '反应开始',
  reaction_ended: '反应结束',
  owner_changed: '控制权变化',
  attention_changed: '注意力目标变化',
  suppressed: '行为被抑制',
  interrupted: '行为被打断',
  recovered: '行为已恢复',
  failed: '行为失败',
}

export const useDebugConsoleStore = create<DebugConsoleState>((set) => ({
  entries: [],
  log: (entry) =>
    set((state) => {
      const timestamp = new Date().toISOString()
      if (entry.type === 'chat_delta' && state.entries.at(-1)?.type === 'chat_delta') {
        const previous = state.entries.at(-1)!
        const previousDetail = Array.isArray(previous.detail)
          ? previous.detail
          : previous.detail === undefined
            ? []
            : [previous.detail]
        return {
          entries: [
            ...state.entries.slice(0, -1),
            {
              ...previous,
              timestamp,
              summary: 'Assistant 流式文本',
              detail: [...previousDetail, entry.detail],
            },
          ],
        }
      }
      return {
        entries: [...state.entries, { ...entry, id: nextId++, timestamp }].slice(-1000),
      }
    }),
  clear: () => {
    lastAttentionDiagnostic = null
    set({ entries: [] })
  },
}))

export function logDebugEvent(entry: Omit<DebugEntry, 'id' | 'timestamp'>) {
  useDebugConsoleStore.getState().log(entry)
}

export function logBehaviorDiagnostic(event: BehaviorDiagnostic) {
  let attention: { yawDegrees: number; pitchDegrees: number } | undefined
  if (event.event === 'attention_changed' && event.attentionDirection) {
    const { yawRadians, pitchRadians } = event.attentionDirection
    if (![yawRadians, pitchRadians].every(Number.isFinite)) return
    const now = Date.now()
    const previous = lastAttentionDiagnostic
    if (
      previous &&
      (now - previous.at < 1200 ||
        Math.hypot(yawRadians - previous.yaw, pitchRadians - previous.pitch) < 0.34)
    )
      return
    lastAttentionDiagnostic = { at: now, yaw: yawRadians, pitch: pitchRadians }
    attention = {
      yawDegrees: Math.round((yawRadians * 180) / Math.PI),
      pitchDegrees: Math.round((pitchRadians * 180) / Math.PI),
    }
  }

  const { attentionDirection: _ignored, ...detail } = event
  logDebugEvent({
    source: 'system',
    type: 'behavior',
    summary: behaviorSummaries[event.event],
    detail: { ...detail, ...(attention ? { attentionDirection: attention } : {}) },
  })
}
