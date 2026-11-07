export type ToolOutput = {
  callId: string
  result: unknown
}
export type ChatTurn = {
  responseId?: string
  awaitingTools?: boolean
  outputs: ToolOutput[]
  receivedEvent: boolean
  text?: string
  responseItems?: unknown[]
}

export type ChatBehaviorSignal =
  | 'submitted'
  | 'processing'
  | 'text_started'
  | 'tool_started'
  | 'finished'
  | 'failed'

export function chatBehaviorEvent(signal: ChatBehaviorSignal) {
  const events = {
    submitted: { type: 'conversation_submitted' },
    processing: { type: 'conversation_processing' },
    text_started: { type: 'conversation_text_started' },
    tool_started: { type: 'conversation_tool_started' },
    finished: { type: 'conversation_turn_finished' },
    failed: { type: 'conversation_failed' },
  } as const
  return events[signal]
}

export const MAX_TOOL_CALLS_PER_MESSAGE = 50

export function createToolCallBudget(limit = MAX_TOOL_CALLS_PER_MESSAGE) {
  let executed = 0
  return {
    tryConsume() {
      if (executed >= limit) return false
      executed += 1
      return true
    },
    isExhausted() {
      return executed >= limit
    },
    executed() {
      return executed
    },
  }
}

export async function continueToolRounds(
  initial: ChatTurn,
  consume: (path: string, body: unknown, signal: AbortSignal) => Promise<ChatTurn>,
  signal: AbortSignal,
  capabilities?: unknown | (() => unknown),
  history: unknown[] = [],
  onHistoryChange?: (history: unknown[]) => void,
  isToolBudgetExhausted: () => boolean = () => false,
) {
  let turn = initial
  const transcript = [...history]
  let noToolWrapUpRequested = false
  while (turn.awaitingTools && turn.outputs.length) {
    if (noToolWrapUpRequested)
      throw new Error('工具预算耗尽后的收尾响应仍请求工具，已停止本轮任务。')
    if (!turn.responseItems?.length)
      throw new Error('模型工具调用上下文缺失，无法继续对话。')
    transcript.push(...turn.responseItems)
    for (const output of turn.outputs) {
      transcript.push({
        type: 'function_call_output',
        call_id: output.callId,
        output: JSON.stringify(output.result),
      })
    }
    onHistoryChange?.([...transcript])
    const currentCapabilities =
      typeof capabilities === 'function' ? capabilities() : capabilities
    noToolWrapUpRequested = isToolBudgetExhausted()
    turn = await consume(
      '/api/chat/continue',
      {
        input: [...transcript],
        capabilities: currentCapabilities,
        toolBudgetExhausted: isToolBudgetExhausted(),
      },
      signal,
    )
  }
  if (turn.awaitingTools && !turn.outputs.length)
    throw new Error('工具调用结果缺失，无法继续对话。')
  return { turn, history: transcript }
}
