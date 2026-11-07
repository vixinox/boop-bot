import http from 'node:http'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import OpenAI from 'openai'
import { robotToolsFor } from './tools.js'
import {
  makeToolCallEvent,
  responseFailureDetails,
  responseStreamOutcome,
} from './protocol.js'
import { responseInstructions } from './persona.js'

dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)) })

const port = Number(process.env.BOOP_API_PORT ?? process.env.PORT ?? 3001)
if (
  !process.env.OPENAI_API_KEY ||
  !process.env.OPENAI_BASE_URL ||
  !process.env.OPENAI_MODEL ||
  !process.env.OPENAI_REASONING_EFFORT
)
  throw new Error(
    'OPENAI_API_KEY, OPENAI_BASE_URL, OPENAI_MODEL, and OPENAI_REASONING_EFFORT must be configured',
  )
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL,
})
const model = process.env.OPENAI_MODEL ?? 'gpt-6.1-sol'
const reasoningEffort = process.env.OPENAI_REASONING_EFFORT
const headers = {
  'Content-Type': 'text/event-stream; charset=utf-8',
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive',
  'Access-Control-Allow-Origin': '*',
}
const send = (res: http.ServerResponse, type: string, data: unknown) =>
  res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`)
async function stream(res: http.ServerResponse, body: any, continuation = false) {
  if (continuation && !Array.isArray(body.input)) {
    res.writeHead(400, { 'Content-Type': 'application/json' })
    return res.end(
      JSON.stringify({ error: 'input is required for stateless continuation' }),
    )
  }
  res.writeHead(200, headers)
  const abort = new AbortController()
  res.on('close', () => {
    if (!res.writableEnded) abort.abort()
  })
  try {
    const instructions = responseInstructions(
      continuation,
      body.capabilities,
      body.toolBudgetExhausted === true,
    )
    const response = await client.responses.create(
      {
        model,
        reasoning: { effort: reasoningEffort as 'low' | 'medium' | 'high' },
        input: body.input,
        instructions,
        tools:
          body.toolBudgetExhausted === true
            ? []
            : (robotToolsFor(body.capabilities) as any),
        stream: true,
      } as any,
      { signal: abort.signal },
    )
    let responseId = ''
    let terminalEventReceived = false
    const calls = new Map<
      string,
      { outputIndex: number; name: string; callId: string; arguments: string }
    >()
    for await (const event of response as any) {
      if (event.type === 'response.created' || event.type === 'response.in_progress') {
        responseId = event.response.id
        send(res, 'message_start', { responseId })
      }
      if (
        event.type === 'response.output_item.added' &&
        event.item.type === 'function_call'
      )
        calls.set(event.item.id, {
          outputIndex: event.output_index,
          name: event.item.name,
          callId: event.item.call_id,
          arguments: '',
        })
      if (event.type === 'response.function_call_arguments.delta') {
        const call = calls.get(event.item_id)
        if (call) call.arguments += event.delta
      }
      if (event.type === 'response.output_text.delta')
        send(res, 'text_delta', { text: event.delta })
      if (event.type === 'response.function_call_arguments.done') {
        const call = calls.get(event.item_id)
        if (!call?.callId) {
          terminalEventReceived = true
          send(res, 'error', {
            message: '工具调用缺少 call_id，无法提交执行结果。',
          })
          break
        }
        send(res, 'tool_call', {
          ...makeToolCallEvent(
            { id: event.item_id, call_id: call.callId, name: call.name ?? event.name },
            { outputIndex: call.outputIndex, arguments: event.arguments },
            responseId,
          ),
        })
      }
      const outcome = responseStreamOutcome(
        event.type,
        event.type === 'response.completed' &&
          event.response.output.some((item: any) => item.type === 'function_call'),
      )
      if (outcome === 'error') {
        terminalEventReceived = true
        send(res, 'error', {
          message: '模型未能完成本轮响应，请重试。',
          upstream: responseFailureDetails(event),
        })
        break
      }
      if (outcome === 'awaiting_tools') {
        terminalEventReceived = true
        send(res, 'tool_context', { items: event.response.output })
        send(res, 'awaiting_tools', { responseId: event.response.id })
      }
      if (outcome === 'message_done') {
        terminalEventReceived = true
        send(res, 'message_done', { responseId: event.response.id })
      }
    }
    if (!terminalEventReceived && !abort.signal.aborted)
      send(res, 'error', { message: 'AI 响应流意外结束，请重试。' })
  } catch (error) {
    if (abort.signal.aborted) return
    send(res, 'error', {
      message: 'AI 服务暂时不可用，请稍后重试。',
      upstream:
        error && typeof error === 'object' && 'status' in error
          ? {
              status: error.status,
              code:
                'code' in error && typeof error.code === 'string'
                  ? error.code
                  : undefined,
              message:
                'message' in error && typeof error.message === 'string'
                  ? error.message.slice(0, 500)
                  : undefined,
            }
          : undefined,
    })
  }
  res.end()
}
const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'content-type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    })
    return res.end()
  }
  if (
    req.method !== 'POST' ||
    !['/api/chat', '/api/chat/continue'].includes(req.url ?? '')
  ) {
    res.writeHead(404)
    return res.end()
  }
  let raw = ''
  req.on('data', (chunk) => {
    raw += chunk
  })
  req.on('end', () => {
    try {
      const body = JSON.parse(raw)
      void stream(res, body, req.url === '/api/chat/continue')
    } catch {
      res.writeHead(400)
      res.end('Invalid JSON')
    }
  })
})
server.listen(port, () => console.log(`Boop Bot API listening on ${port}`))
