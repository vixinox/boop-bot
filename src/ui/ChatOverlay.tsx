import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { Hand, Moon, Send, ThumbsUp, Sun } from 'lucide-react'
import { Bubble, BubbleContent, BubbleGroup } from '../components/ui/bubble'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Trace, TraceLine, TraceTitle } from '../components/ui/trace'
import { logDebugEvent } from '../state/debugConsoleStore'
import { dispatchBehaviorEvent } from '../state/behaviorStore'
import { useBehaviorStore } from '../state/behaviorStore'
import {
  beginPresentationTurn,
  cancelAllAiPresentations,
  cancelQueuedPresentations,
  executeRobotTool,
} from '../stage/toolExecutor'
import { useCompanionStore } from '../state/companionStore'
import {
  createToolCallBudget,
  continueToolRounds,
  chatBehaviorEvent,
  MAX_TOOL_CALLS_PER_MESSAGE,
  type ChatTurn,
} from './chatFlow'
import { createSceneSnapshot } from '../stage/sceneSnapshot'
import type { SemanticAction } from '../state/behaviorPolicy'
import { routeEmotion } from '../state/emotionRouter'

type Message = {
  role: 'user' | 'assistant'
  content: string
  status?: 'streaming' | 'error' | 'complete'
  trace?: string
}
type ServerEvent = {
  text?: string
  message?: string
  responseId?: string
  name?: string
  arguments?: string
  callId?: string
  itemId?: string
  outputs?: { callId: string; result: unknown }[]
  items?: unknown[]
  type?: string
}

function ChatBubbleMessage({ message }: { message: Message }) {
  const enterRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const element = enterRef.current
    if (!element) return

    const media = gsap.matchMedia()
    media.add(
      {
        reduceMotion: '(prefers-reduced-motion: reduce)',
        animate: '(prefers-reduced-motion: no-preference)',
      },
      (context) => {
        const { reduceMotion } = context.conditions as { reduceMotion: boolean }
        if (reduceMotion) {
          gsap.set(element, { clearProps: 'all' })
          return
        }

        gsap.fromTo(
          element,
          { y: 12, scale: 0.92, autoAlpha: 0 },
          {
            y: 0,
            scale: 1,
            autoAlpha: 1,
            duration: 0.35,
            ease: 'power2.out',
            clearProps: 'transform,opacity,visibility',
          },
        )
      },
    )

    return () => media.revert()
  }, [])

  return (
    <div
      ref={enterRef}
      className={`flex w-full min-w-0 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
    >
      <Bubble
        align={message.role === 'user' ? 'end' : 'start'}
        variant={
          message.status === 'error'
            ? 'destructive'
            : message.role === 'user'
              ? 'default'
              : 'muted'
        }
      >
        <BubbleContent>
          {message.content || (
            <Trace>
              <TraceLine
                status={
                  message.status === 'error'
                    ? 'error'
                    : message.status === 'streaming'
                      ? 'running'
                      : undefined
                }
              >
                <TraceTitle>
                  {message.trace ??
                    (message.status === 'error'
                      ? '请求失败'
                      : message.status === 'complete'
                        ? '已完成'
                        : '正在思考…')}
                </TraceTitle>
              </TraceLine>
            </Trace>
          )}
          {message.trace && (
            <Trace>
              <TraceLine
                status={message.trace.startsWith('工具失败') ? 'error' : 'pending'}
              >
                <TraceTitle>{message.trace}</TraceTitle>
              </TraceLine>
            </Trace>
          )}
        </BubbleContent>
      </Bubble>
    </div>
  )
}

export function ChatOverlay() {
  const [messages, setMessages] = useState<Message[]>([])
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const emotion = useBehaviorStore((state) => state.emotion)
  const behaviorOwner = useBehaviorStore((state) => state.owner)
  const scrollRef = useRef<HTMLDivElement>(null)
  const conversation = useRef<unknown[]>([])
  const assistantText = useRef('')
  const activeAbort = useRef<AbortController | null>(null)
  const toolBudget = useRef(createToolCallBudget())
  const budgetEventLogged = useRef(false)
  useEffect(() => () => activeAbort.current?.abort(), [])
  useLayoutEffect(() => {
    const container = scrollRef.current
    if (container) container.scrollTop = container.scrollHeight
  }, [messages])
  useEffect(() => {
    const container = scrollRef.current
    if (!container) return

    let frame = 0
    const updateBubbleTransforms = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const bounds = container.getBoundingClientRect()
        const fadeHeight = Math.min(88, bounds.height * 0.3)
        container
          .querySelectorAll<HTMLElement>('[data-slot="bubble"]')
          .forEach((bubble) => {
            const bubbleBounds = bubble.getBoundingClientRect()
            const center = bubbleBounds.top + bubbleBounds.height / 2 - bounds.top
            const progress = Math.max(0, Math.min(1, (fadeHeight - center) / fadeHeight))
            bubble.style.setProperty('--bubble-fade-progress', progress.toFixed(3))
          })
      })
    }

    updateBubbleTransforms()
    container.addEventListener('scroll', updateBubbleTransforms, { passive: true })
    const resizeObserver = new ResizeObserver(updateBubbleTransforms)
    resizeObserver.observe(container)

    return () => {
      cancelAnimationFrame(frame)
      container.removeEventListener('scroll', updateBubbleTransforms)
      resizeObserver.disconnect()
    }
  }, [messages])
  const consume = async (
    path: string,
    body: unknown,
    signal: AbortSignal,
  ): Promise<{
    responseId?: string
    awaitingTools?: boolean
    outputs: {
      callId: string
      result: unknown
    }[]
    receivedEvent: boolean
    text: string
    responseItems?: unknown[]
  }> => {
    dispatchBehaviorEvent(chatBehaviorEvent('processing'))
    if (path === '/api/chat/continue') {
      const continuation = body as {
        input?: { type?: string; call_id?: string }[]
      }
      logDebugEvent({
        source: 'assistant',
        type: 'assistant_done',
        summary: '正在续传工具执行结果',
        detail: {
          contextItems: continuation.input?.length ?? 0,
          callIds: continuation.input
            ?.filter((item) => item.type === 'function_call_output')
            .map((item) => item.call_id),
        },
      })
    }
    const response = await fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'text/event-stream' },
      body: JSON.stringify(body),
      signal,
    })
    if (!response.ok || !response.body) throw new Error('聊天服务暂时不可用')
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let responseId: string | undefined
    let awaitingTools = false
    let receivedEvent = false
    let terminalReceived = false
    let responseText = ''
    let textStarted = false
    let responseItems: unknown[] | undefined
    const outputs: {
      callId: string
      result: unknown
    }[] = []
    for (;;) {
      let timeout: ReturnType<typeof setTimeout> | undefined
      const { value: chunk, done } = await Promise.race([
        reader.read(),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(() => reject(new Error('AI 响应超时，请重试。')), 90_000)
        }),
      ]).finally(() => {
        if (timeout) clearTimeout(timeout)
      })
      if (done) break
      buffer += decoder.decode(chunk, { stream: true })
      const events = buffer.split('\n\n')
      buffer = events.pop() ?? ''
      for (const event of events) {
        const eventType = event
          .split('\n')
          .find((line) => line.startsWith('event: '))
          ?.slice(7)
        const data = event
          .split('\n')
          .find((line) => line.startsWith('data: '))
          ?.slice(6)
        if (!data) continue
        receivedEvent = true
        const parsed = JSON.parse(data) as ServerEvent
        if (eventType === 'message_start') responseId = parsed.responseId
        if (eventType === 'message_done') {
          terminalReceived = true
          logDebugEvent({
            source: 'assistant',
            type: 'assistant_done',
            summary: '模型响应段完成',
            detail: parsed,
          })
        }
        if (eventType === 'awaiting_tools') {
          terminalReceived = true
          logDebugEvent({
            source: 'assistant',
            type: 'assistant_done',
            summary: '模型等待工具执行结果',
            detail: parsed,
          })
        }
        if (eventType === 'tool_context' && Array.isArray(parsed.items))
          responseItems = parsed.items
        if (eventType === 'tool_status')
          logDebugEvent({
            source: 'system',
            type: 'tool_result',
            summary: '工具状态更新',
            detail: parsed,
          })
        if (eventType === 'text_delta' && parsed.text) {
          if (!textStarted) {
            textStarted = true
            dispatchBehaviorEvent(chatBehaviorEvent('text_started'))
          }
          responseText += parsed.text
          assistantText.current += parsed.text
          logDebugEvent({
            source: 'assistant',
            type: 'chat_delta',
            summary: '收到 assistant 文本增量',
            detail: { text: parsed.text },
          })
          setMessages((items) =>
            items.map((item, index) =>
              index === items.length - 1
                ? { ...item, content: item.content + parsed.text }
                : item,
            ),
          )
        }
        if (
          eventType === 'tool_call' &&
          parsed.name &&
          parsed.arguments &&
          parsed.callId
        ) {
          dispatchBehaviorEvent(chatBehaviorEvent('tool_started'))
          logDebugEvent({
            source: 'assistant',
            type: 'tool_call',
            summary: `模型调用 ${parsed.name}`,
            detail: {
              callId: parsed.callId,
              itemId: parsed.itemId,
              name: parsed.name,
              arguments: parsed.arguments,
              responseId,
            },
          })
          const withinBudget = toolBudget.current.tryConsume()
          const result = withinBudget
            ? executeRobotTool(parsed.name, parsed.arguments, parsed.callId)
            : {
                ok: false as const,
                toolName: parsed.name,
                error: {
                  code: 'TOOL_BUDGET_EXHAUSTED',
                  message: '本条消息的工具调用预算已耗尽。',
                  repair:
                    'Do not retry tools. Summarize only confirmed results and state what remains incomplete.',
                },
                errorText: '本条消息的工具调用预算已耗尽。',
              }
          if (toolBudget.current.isExhausted() && !budgetEventLogged.current) {
            budgetEventLogged.current = true
            logDebugEvent({
              source: 'system',
              type: 'tool_budget_exhausted',
              summary: `已执行 ${toolBudget.current.executed()} 次工具调用，后续续传将禁用工具`,
              detail: {
                limit: MAX_TOOL_CALLS_PER_MESSAGE,
                executed: toolBudget.current.executed(),
              },
            })
          }
          outputs.push({
            callId: parsed.callId,
            result,
          })
          logDebugEvent({
            source: result.ok ? 'system' : 'assistant',
            type: result.ok ? 'tool_result' : 'tool_error',
            summary: result.ok ? `${parsed.name} 执行成功` : `${parsed.name} 执行失败`,
            detail: { callId: parsed.callId, result },
          })
          setMessages((items) =>
            items.map((item, index) =>
              index === items.length - 1
                ? {
                    ...item,
                    trace: result.ok
                      ? `已执行 ${parsed.name}`
                      : `工具失败：${result.error.message}`,
                  }
                : item,
            ),
          )
        }
        if (eventType === 'awaiting_tools') awaitingTools = true
        if (eventType === 'error') {
          logDebugEvent({
            source: 'system',
            type: 'request_error',
            summary: parsed.message ?? '聊天请求失败',
            detail: parsed,
          })
          throw new Error(parsed.message ?? '聊天请求失败')
        }
      }
    }
    if ((receivedEvent || path === '/api/chat/continue') && !terminalReceived)
      throw new Error('AI 响应流未返回完成事件，请重试。')
    return {
      responseId,
      awaitingTools,
      outputs,
      receivedEvent,
      text: responseText,
      responseItems,
    }
  }
  const send = async () => {
    const text = value.trim()
    if (!text || busy) return
    const wasAuto = useBehaviorStore.getState().controlMode === 'auto'
    cancelAllAiPresentations('new_user_message')
    cancelQueuedPresentations('new_user_message')
    if (wasAuto) {
      dispatchBehaviorEvent({ type: 'resume_companion' })
      useCompanionStore.getState().recoverCompanionToAuto()
    }
    beginPresentationTurn()
    const routed = routeEmotion(text, useBehaviorStore.getState().emotion)
    if (routed.action === 'wake') {
      dispatchBehaviorEvent({
        type: 'semantic_action_requested',
        action: 'wake',
        source: 'shortcut',
      })
    } else if (routed.action) {
      dispatchBehaviorEvent({
        type: 'semantic_action_requested',
        action: routed.action,
        source: 'emotion',
      })
    } else {
      dispatchBehaviorEvent({ type: 'emotion_changed', emotion: routed.emotion })
    }
    dispatchBehaviorEvent(chatBehaviorEvent('submitted'))
    setValue('')
    setBusy(true)
    const controller = new AbortController()
    activeAbort.current = controller
    const capabilities = createSceneSnapshot()
    assistantText.current = ''
    toolBudget.current = createToolCallBudget()
    budgetEventLogged.current = false
    conversation.current.push({ role: 'user', content: text })
    logDebugEvent({
      source: 'user',
      type: 'chat_request',
      summary: '发送用户消息',
      detail: { text },
    })
    setMessages((items) => [
      ...items,
      { role: 'user', content: text },
      { role: 'assistant', content: '', status: 'streaming' },
    ])
    try {
      let turn: ChatTurn = await consume(
        '/api/chat',
        { input: conversation.current, capabilities },
        controller.signal,
      )
      if (!turn.receivedEvent) {
        await new Promise((resolve) => setTimeout(resolve, 350 + Math.random() * 150))
        turn = await consume(
          '/api/chat',
          { input: conversation.current, capabilities },
          controller.signal,
        )
      }
      const continuation = await continueToolRounds(
        turn,
        consume,
        controller.signal,
        createSceneSnapshot,
        conversation.current,
        (history) => {
          conversation.current = history
        },
        toolBudget.current.isExhausted,
      )
      turn = continuation.turn
      conversation.current = continuation.history
      dispatchBehaviorEvent(chatBehaviorEvent('finished'))
      if (turn.text) conversation.current.push({ role: 'assistant', content: turn.text })
      logDebugEvent({
        source: 'assistant',
        type: 'assistant_done',
        summary: 'assistant 回复完成',
        detail: { text: assistantText.current },
      })
      setMessages((items) =>
        items.map((item, index) =>
          index === items.length - 1
            ? { ...item, status: 'complete', trace: undefined }
            : item,
        ),
      )
    } catch (error) {
      dispatchBehaviorEvent(chatBehaviorEvent('failed'))
      const wasAuto = useBehaviorStore.getState().controlMode === 'auto'
      cancelAllAiPresentations('request_failed')
      cancelQueuedPresentations('request_failed')
      if (wasAuto) {
        dispatchBehaviorEvent({ type: 'resume_companion' })
        useCompanionStore.getState().recoverCompanionToAuto()
      }
      const activeReaction = useBehaviorStore.getState().activeReaction
      if (activeReaction?.owner === 'conversation')
        dispatchBehaviorEvent({
          type: 'reaction_cancelled',
          reactionId: activeReaction.id,
          reason: 'request_failed',
        })
      controller.abort()
      const activeTimeline = useCompanionStore.getState().timeline
      if (activeTimeline) {
        logDebugEvent({
          source: 'system',
          type: 'tool_result',
          summary: '聊天失败，已停止动画时间线',
          detail: {
            callId: activeTimeline.callId,
            timelineId: activeTimeline.id,
            status: 'cancelled',
          },
        })
        useCompanionStore.getState().cancelAnimationTimeline()
      }
      logDebugEvent({
        source: 'system',
        type: 'request_error',
        summary: error instanceof Error ? error.message : 'Request failed',
        detail: {
          error: error instanceof Error ? error.message : 'Request failed',
        },
      })
      setMessages((items) =>
        items.map((item, index) =>
          index === items.length - 1
            ? {
                ...item,
                content:
                  item.content ||
                  (toolBudget.current.isExhausted()
                    ? '部分场景操作可能已完成，但收尾响应失败。请检查当前画面后重试。'
                    : error instanceof Error
                      ? error.message
                      : 'Request failed'),
                status: 'error',
              }
            : item,
        ),
      )
    } finally {
      if (activeAbort.current === controller) activeAbort.current = null
      setBusy(false)
      requestAnimationFrame(() =>
        scrollRef.current?.scrollTo({
          top: scrollRef.current.scrollHeight,
          behavior: 'smooth',
        }),
      )
    }
  }
  const runShortcut = (action: SemanticAction) => {
    cancelAllAiPresentations('direct_shortcut')
    cancelQueuedPresentations('direct_shortcut')
    if (useBehaviorStore.getState().controlMode === 'manual') {
      dispatchBehaviorEvent({ type: 'resume_companion' })
      useCompanionStore.getState().recoverCompanionToAuto()
    }
    dispatchBehaviorEvent({
      type: 'semantic_action_requested',
      action,
      source: 'shortcut',
    })
  }
  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-end items-center sm:p-6">
      <div
        ref={scrollRef}
        className="chat-bubble-scroll pointer-events-auto mb-3 flex h-[30vh] min-h-[140px] max-h-[240px] w-full max-w-xl flex-col overflow-y-auto pr-1 sm:h-[240px]"
      >
        <BubbleGroup className="mt-auto">
          {messages.map((message, index) => (
            <ChatBubbleMessage key={index} message={message} />
          ))}
        </BubbleGroup>
      </div>
      <form
        className="pointer-events-auto flex w-full max-w-xl items-center justify-center gap-1 sm:gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          void send()
        }}
      >
        <Input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="和 Boop Bot 聊聊…"
          className="h-11 min-w-0 w-full rounded-full bg-background/90 px-4 shadow-lg backdrop-blur sm:px-5"
        />
        <Button
          type="submit"
          size="icon"
          className="size-11 shrink-0 rounded-full"
          disabled={busy || !value.trim()}
          aria-label="发送"
          title="发送"
        >
          <Send className="size-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-10 rounded-full bg-background/90 shadow-lg backdrop-blur sm:size-11"
          onClick={() => runShortcut('affection')}
          disabled={behaviorOwner === 'manual'}
          aria-label="摸摸头"
          title="摸摸头"
        >
          <Hand className="size-4" aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-10 rounded-full bg-background/90 shadow-lg backdrop-blur sm:size-11"
          onClick={() => runShortcut('praise')}
          disabled={behaviorOwner === 'manual'}
          aria-label="夸夸它"
          title="夸夸它"
        >
          <ThumbsUp className="size-4" aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-10 rounded-full bg-background/90 shadow-lg backdrop-blur sm:size-11"
          onClick={() => runShortcut(emotion === 'sleepy' ? 'wake' : 'sleep')}
          disabled={behaviorOwner === 'manual'}
          aria-label={emotion === 'sleepy' ? '叫醒 Boop' : '哄它睡觉'}
          title={emotion === 'sleepy' ? '叫醒 Boop' : '哄它睡觉'}
        >
          {emotion === 'sleepy' ? (
            <Sun className="size-4" aria-hidden="true" />
          ) : (
            <Moon className="size-4" aria-hidden="true" />
          )}
        </Button>
      </form>
    </div>
  )
}
