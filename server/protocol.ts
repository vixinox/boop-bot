export type FunctionCallItem = {
  id: string
  call_id: string
  name: string
}

export function makeToolCallEvent(
  item: FunctionCallItem,
  args: { outputIndex: number; arguments: string },
  responseId: string,
) {
  return {
    callId: item.call_id,
    itemId: item.id,
    outputIndex: args.outputIndex,
    name: item.name,
    arguments: args.arguments,
    responseId,
  }
}

export function responseStreamOutcome(
  eventType: string,
  hasFunctionCalls: boolean,
): 'awaiting_tools' | 'message_done' | 'error' | null {
  if (
    eventType === 'response.failed' ||
    eventType === 'response.incomplete' ||
    eventType === 'error'
  )
    return 'error'
  if (eventType !== 'response.completed') return null
  return hasFunctionCalls ? 'awaiting_tools' : 'message_done'
}

export function responseFailureDetails(event: any) {
  const response = event?.response ?? {}
  const error = response.error ?? event?.error ?? {}
  const incomplete = response.incomplete_details ?? {}
  const code = typeof error.code === 'string' ? error.code : undefined
  const type = typeof error.type === 'string' ? error.type : undefined
  const reason = typeof incomplete.reason === 'string' ? incomplete.reason : undefined
  const message = typeof error.message === 'string' ? error.message : undefined
  return {
    ...(code ? { code } : {}),
    ...(type ? { type } : {}),
    ...(reason ? { reason } : {}),
    ...(message ? { upstreamMessage: message.slice(0, 500) } : {}),
  }
}
