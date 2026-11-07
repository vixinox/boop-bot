import { SlidersHorizontal, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from './components/ui/button'
import {
  Sheet,
  SheetBody,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from './components/ui/sheet'
import { CompanionStage } from './stage/CompanionStage'
import { ManualInspector } from './ui/ManualInspector'

function App() {
  const [isDesktop, setIsDesktop] = useState(
    () => window.matchMedia('(min-width: 1024px)').matches,
  )
  const [inspectorOpen, setInspectorOpen] = useState(false)

  useEffect(() => {
    const media = window.matchMedia('(min-width: 1024px)')
    const onChange = (event: MediaQueryListEvent) => setIsDesktop(event.matches)
    setIsDesktop(media.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    if (isDesktop) setInspectorOpen(false)
  }, [isDesktop])

  return (
    <div className="flex h-dvh min-h-[420px] flex-col overflow-hidden bg-background text-foreground">
      <header className="z-10 flex h-16 shrink-0 items-center justify-between gap-4 border-b bg-background px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className="grid size-9 shrink-0 place-items-center rounded-md bg-primary text-base font-bold text-primary-foreground"
            aria-hidden="true"
          >
            B
          </span>
          <div className="min-w-0">
            <h1 className="text-sm font-semibold leading-tight">Boop Bot</h1>
            <p className="hidden text-xs text-muted-foreground sm:block">
              Companion Control
            </p>
          </div>
        </div>
        <Button
          render={
            <a
              href="https://github.com/vixinox/boop-bot"
              target="_blank"
              rel="noreferrer"
              aria-label="在 GitHub 上查看 Boop Bot"
              title="GitHub"
            />
          }
          variant="ghost"
          size="icon"
        >
          <svg
            viewBox="0 0 24 24"
            className="size-5 fill-current"
            aria-hidden="true"
          >
            <path d="M12 .9a11.1 11.1 0 0 0-3.51 21.63c.56.1.76-.24.76-.54v-2.1c-3.1.67-3.76-1.32-3.76-1.32-.5-1.29-1.24-1.63-1.24-1.63-1.01-.69.08-.68.08-.68 1.12.08 1.7 1.15 1.7 1.15.99 1.69 2.59 1.2 3.22.92.1-.72.39-1.2.7-1.48-2.48-.28-5.09-1.24-5.09-5.52 0-1.22.44-2.22 1.15-3-.12-.28-.5-1.42.11-2.96 0 0 .94-.3 3.05 1.15a10.6 10.6 0 0 1 5.55 0c2.12-1.45 3.05-1.15 3.05-1.15.61 1.54.23 2.68.12 2.96.71.78 1.14 1.78 1.14 3 0 4.29-2.61 5.23-5.1 5.51.4.35.75 1.02.75 2.05v3.05c0 .3.2.65.77.54A11.1 11.1 0 0 0 12 .9Z" />
          </svg>
        </Button>
      </header>

      <main className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_420px]">
        <section
          className="relative min-h-0 min-w-0 overflow-hidden bg-muted"
          aria-label="桌面伴侣机器人舞台"
        >
          <CompanionStage />
          {!isDesktop && (
            <Sheet open={inspectorOpen} onOpenChange={setInspectorOpen}>
              <SheetTrigger
                render={
                  <Button
                    variant="outline"
                    size="icon"
                    className="absolute right-4 top-4 z-30 rounded-full lg:hidden"
                    aria-label="打开动画与骨骼控制面板"
                    title="打开动画与骨骼控制面板"
                  />
                }
              >
                <SlidersHorizontal className="size-4" aria-hidden="true" />
              </SheetTrigger>
              <SheetContent className="max-w-none" style={{ width: 'min(100vw, 30rem)' }}>
                <SheetHeader className="relative pr-14">
                  <SheetTitle className="text-base font-semibold">
                    Animation Inspector
                  </SheetTitle>
                  <SheetClose
                    render={
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-3 top-3"
                        aria-label="关闭控制面板"
                        title="关闭控制面板"
                      />
                    }
                  >
                    <X className="size-4" aria-hidden="true" />
                  </SheetClose>
                </SheetHeader>
                <SheetBody className="p-0">
                  {inspectorOpen && <ManualInspector />}
                </SheetBody>
              </SheetContent>
            </Sheet>
          )}
        </section>

        {isDesktop && (
          <aside
            className="hidden min-h-0 overflow-hidden border-l bg-background lg:block"
            aria-label="动画与骨骼控制面板"
          >
            <ManualInspector />
          </aside>
        )}
      </main>
    </div>
  )
}

export default App
