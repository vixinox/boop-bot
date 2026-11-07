import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { ArrowDown, Clipboard, GripHorizontal, Trash2 } from 'lucide-react'
import { Button } from '../components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '../components/ui/collapsible'
import { useDebugConsoleStore } from '../state/debugConsoleStore'

const sourceNames = { user: '用户', assistant: 'Assistant', system: '系统' }
const MIN_HEIGHT = 200
const MIN_INSPECTOR_HEIGHT = 140

export function DebugConsole() {
  const entries = useDebugConsoleStore((state) => state.entries)
  const clear = useDebugConsoleStore((state) => state.clear)
  const listRef = useRef<HTMLDivElement>(null)
  const sectionRef = useRef<HTMLElement>(null)
  const resizeRef = useRef<{
    pointerId: number
    startY: number
    startHeight: number
  } | null>(null)
  const wasAtBottom = useRef(true)
  const [height, setHeight] = useState(MIN_HEIGHT)
  const [showLatest, setShowLatest] = useState(false)
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')

  useEffect(() => {
    const element = listRef.current
    if (!element) return
    if (wasAtBottom.current) {
      element.scrollTop = element.scrollHeight
      setShowLatest(false)
    } else {
      setShowLatest(true)
    }
  }, [entries.length])

  async function copyEntries() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(entries, null, 2))
      setCopyState('copied')
    } catch {
      setCopyState('failed')
    }
    window.setTimeout(() => setCopyState('idle'), 1600)
  }

  function handleScroll() {
    const element = listRef.current
    if (!element) return
    wasAtBottom.current =
      element.scrollHeight - element.scrollTop - element.clientHeight < 24
    if (wasAtBottom.current) setShowLatest(false)
  }

  function maxHeight() {
    const available = sectionRef.current?.parentElement?.clientHeight ?? MIN_HEIGHT
    return Math.max(MIN_HEIGHT, available - MIN_INSPECTOR_HEIGHT)
  }

  function updateHeight(next: number) {
    setHeight(Math.max(MIN_HEIGHT, Math.min(maxHeight(), next)))
  }

  function handleResizeKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      updateHeight(height + 16)
    } else if (event.key === 'ArrowDown') {
      event.preventDefault()
      updateHeight(height - 16)
    } else if (event.key === 'Home') {
      event.preventDefault()
      updateHeight(MIN_HEIGHT)
    } else if (event.key === 'End') {
      event.preventDefault()
      updateHeight(maxHeight())
    }
  }

  return (
    <section
      ref={sectionRef}
      aria-label="调试控制台"
      className="pointer-events-auto flex min-h-[200px] shrink-0 flex-col border-t bg-background"
      style={{ height, flexBasis: height }}
    >
      <div
        role="separator"
        aria-label="调整调试控制台高度"
        aria-orientation="horizontal"
        aria-valuemin={MIN_HEIGHT}
        aria-valuemax={maxHeight()}
        aria-valuenow={height}
        tabIndex={0}
        className="group flex h-3 shrink-0 cursor-row-resize touch-none items-center justify-center bg-background hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        onKeyDown={handleResizeKeyDown}
        onPointerDown={(event) => {
          event.preventDefault()
          resizeRef.current = {
            pointerId: event.pointerId,
            startY: event.clientY,
            startHeight: height,
          }
          event.currentTarget.setPointerCapture(event.pointerId)
        }}
        onPointerMove={(event) => {
          const drag = resizeRef.current
          if (!drag || drag.pointerId !== event.pointerId) return
          updateHeight(drag.startHeight + drag.startY - event.clientY)
        }}
        onPointerUp={(event) => {
          if (resizeRef.current?.pointerId !== event.pointerId) return
          resizeRef.current = null
          if (event.currentTarget.hasPointerCapture(event.pointerId))
            event.currentTarget.releasePointerCapture(event.pointerId)
        }}
        onPointerCancel={() => {
          resizeRef.current = null
        }}
      >
        <GripHorizontal
          className="size-4 text-muted-foreground transition-colors group-hover:text-foreground"
          aria-hidden="true"
        />
      </div>
      <header className="flex h-9 shrink-0 items-center gap-2 border-b px-3">
        <h2 className="text-xs font-semibold">Debug Console</h2>
        <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
          {entries.length}/1000
        </span>
        <div className="ml-auto flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7"
            aria-label={copyState === 'copied' ? '日志已复制' : '复制全部日志 JSON'}
            title={
              copyState === 'failed'
                ? '复制失败'
                : copyState === 'copied'
                  ? '已复制'
                  : '复制全部日志 JSON'
            }
            onClick={() => void copyEntries()}
            disabled={!entries.length}
          >
            <Clipboard className="size-3.5" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7"
            aria-label="清空日志"
            title="清空日志"
            onClick={clear}
            disabled={!entries.length}
          >
            <Trash2 className="size-3.5" aria-hidden="true" />
          </Button>
        </div>
      </header>
      <div
        ref={listRef}
        onScroll={handleScroll}
        className="relative min-h-0 flex-1 overflow-y-auto px-2 py-1 font-mono text-[10px]"
        aria-live="polite"
      >
        {!entries.length ? (
          <p className="px-2 py-3 text-muted-foreground">等待交互事件</p>
        ) : (
          <ol className="space-y-0.5">
            {entries.map((entry) => (
              <li key={entry.id}>
                <Collapsible>
                  <CollapsibleTrigger className="flex min-h-6 w-full min-w-0 items-center gap-1.5 rounded px-1 text-left hover:bg-muted">
                    <time className="shrink-0 text-muted-foreground">
                      {new Date(entry.timestamp).toLocaleTimeString()}
                    </time>
                    <span className="w-14 shrink-0 truncate text-primary">
                      {sourceNames[entry.source]}
                    </span>
                    <span className="w-28 shrink-0 truncate text-muted-foreground">
                      {entry.type === 'behavior' ? '行为状态' : entry.type}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{entry.summary}</span>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="max-h-24 overflow-auto rounded bg-muted/50 px-2 py-1">
                    <pre className="whitespace-pre-wrap break-words">
                      {JSON.stringify(entry.detail ?? {}, null, 2)}
                    </pre>
                  </CollapsibleContent>
                </Collapsible>
              </li>
            ))}
          </ol>
        )}
        {showLatest && (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="absolute bottom-2 right-2 h-7 text-[10px]"
            onClick={() => {
              const element = listRef.current
              if (element) element.scrollTop = element.scrollHeight
              wasAtBottom.current = true
              setShowLatest(false)
            }}
          >
            <ArrowDown className="size-3" aria-hidden="true" />
            最新记录
          </Button>
        )}
      </div>
    </section>
  )
}
