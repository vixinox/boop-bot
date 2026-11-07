import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { ChevronDown, Pause, Play, RotateCcw, Search, Sparkles } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Card } from '../components/ui/card'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '../components/ui/collapsible'
import { Input } from '../components/ui/input'
import { Slider } from '../components/ui/slider'
import { Switch } from '../components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { useCompanionStore } from '../state/companionStore'
import { dispatchBehaviorEvent, useBehaviorStore } from '../state/behaviorStore'
import {
  cancelAllAiPresentations,
  cancelQueuedPresentations,
} from '../stage/toolExecutor'
import { logDebugEvent } from '../state/debugConsoleStore'
import { DebugConsole } from './DebugConsole'
import type {
  AnimationName,
  BoneRotation,
  ExpressionName,
  RigJoint,
} from '../state/companionStore'

type InspectorTab = 'animation' | 'bones' | 'expressions'
type Axis = keyof BoneRotation

const axisNames: Record<Axis, string> = { x: 'X', y: 'Y', z: 'Z' }
const expressionNames: { id: ExpressionName; label: string }[] = [
  { id: 'Angry', label: 'Angry' },
  { id: 'Surprised', label: 'Surprised' },
  { id: 'Sad', label: 'Sad' },
]

export function visibleRigJoints(
  joints: RigJoint[],
  query: string,
  collapsed: Set<string>,
) {
  const byName = new Map(joints.map((joint) => [joint.name, joint]))
  const normalized = query.trim().toLowerCase()
  const matches = new Set<string>()
  if (!normalized) {
    for (const joint of joints) matches.add(joint.name)
  } else {
    for (const joint of joints) {
      if (!joint.name.toLowerCase().includes(normalized)) continue
      let current: RigJoint | undefined = joint
      while (current) {
        matches.add(current.name)
        current = current.parentName ? byName.get(current.parentName) : undefined
      }
    }
  }

  return joints.filter((joint) => {
    if (!matches.has(joint.name)) return false
    let parentName = joint.parentName
    while (parentName && !normalized) {
      if (collapsed.has(parentName)) return false
      parentName = byName.get(parentName)?.parentName ?? null
    }
    return true
  })
}

function clipLabel(name: AnimationName) {
  return name.replace(/([a-z])([A-Z])/g, '$1 $2')
}

function clipButtonClass(active: boolean) {
  return `grid min-h-10 w-full grid-cols-[minmax(0,1fr)_4rem] items-center rounded-md px-3 text-left text-xs font-medium ${active ? 'bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`
}

function NumberField({
  value,
  min,
  max,
  step,
  label,
  onChange,
}: {
  value: number
  min: number
  max: number
  step: number
  label: string
  onChange: (value: number) => void
}) {
  const [draft, setDraft] = useState(value.toFixed(1))
  useEffect(() => setDraft(value.toFixed(1)), [value])

  return (
    <Input
      type="number"
      aria-label={label}
      value={draft}
      min={min}
      max={max}
      step={step}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        if (draft.trim() && Number.isFinite(Number(draft))) onChange(Number(draft))
        else setDraft(value.toFixed(1))
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur()
      }}
      className="h-8 w-[4.5rem] px-2 text-right font-mono text-xs tabular-nums"
    />
  )
}

export function ManualInspector() {
  const [tab, setTab] = useState<InspectorTab>('animation')
  const [query, setQuery] = useState('')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const wasPlayingBeforeSeek = useRef(false)
  const seeking = useRef(false)
  const animations = useCompanionStore((state) => state.animations)
  const controlMode = useBehaviorStore((state) => state.controlMode)
  const animation = useCompanionStore((state) => state.animation)
  const playing = useCompanionStore((state) => state.animationPlaying)
  const loop = useCompanionStore((state) => state.animationLoop)
  const currentTime = useCompanionStore((state) => state.animationTime)
  const duration = useCompanionStore((state) => state.animationDuration)
  const joints = useCompanionStore((state) => state.rigJoints)
  const selectedBoneName = useCompanionStore((state) => state.selectedBoneName)
  const rotations = useCompanionStore((state) => state.boneRotations)
  const expressionWeights = useCompanionStore((state) => state.expressionWeights)
  const startClipPreview = useCompanionStore((state) => state.startClipPreview)
  const setPlaying = useCompanionStore((state) => state.setAnimationPlaying)
  const setLoop = useCompanionStore((state) => state.setAnimationLoop)
  const setTime = useCompanionStore((state) => state.setAnimationTime)
  const setSelectedBone = useCompanionStore((state) => state.setSelectedBone)
  const setBoneRotation = useCompanionStore((state) => state.setBoneRotation)
  const resetBoneRotation = useCompanionStore((state) => state.resetBoneRotation)
  const resetAllBoneRotations = useCompanionStore((state) => state.resetAllBoneRotations)
  const setExpressionWeight = useCompanionStore((state) => state.setExpressionWeight)
  const takeExpressionControl = useCompanionStore((state) => state.takeExpressionControl)
  const recoverCompanionToAuto = useCompanionStore(
    (state) => state.recoverCompanionToAuto,
  )
  const filteredJoints = useMemo(
    () => visibleRigJoints(joints, query, collapsed),
    [collapsed, joints, query],
  )
  const selectedJoint = joints.find((joint) => joint.name === selectedBoneName)
  const selectedRotation = selectedBoneName ? rotations[selectedBoneName] : undefined
  const currentRotation = selectedRotation ?? { x: 0, y: 0, z: 0 }

  function takeManualControl() {
    cancelAllAiPresentations('manual_takeover')
    cancelQueuedPresentations('manual_takeover')
    dispatchBehaviorEvent({ type: 'manual_takeover' })
  }

  function takeManualExpressionControl() {
    takeExpressionControl()
  }

  function resumeCompanion() {
    cancelAllAiPresentations('resume_auto')
    cancelQueuedPresentations('resume_auto')
    dispatchBehaviorEvent({ type: 'resume_companion' })
    if (animations.some((clip) => clip.name === 'Idle')) recoverCompanionToAuto()
  }

  function updateAxis(axis: Axis, value: number) {
    if (!selectedBoneName || !Number.isFinite(value)) {
      logDebugEvent({
        source: 'user',
        type: 'user_action',
        summary: '骨骼旋转输入无效',
        detail: { axis, value },
      })
      return
    }
    const before = useCompanionStore.getState().boneRotations[selectedBoneName]
    takeManualControl()
    setBoneRotation(selectedBoneName, { ...currentRotation, [axis]: value })
    const after = useCompanionStore.getState().boneRotations[selectedBoneName]
    logDebugEvent({
      source: 'user',
      type: 'user_action',
      summary: `设置 ${selectedBoneName} ${axisNames[axis]} 旋转`,
      detail: {
        joint: selectedBoneName,
        axis,
        requested: value,
        before: before?.[axis] ?? 0,
        after: after?.[axis] ?? 0,
        success: after?.[axis] !== before?.[axis],
      },
    })
  }

  function formatTime(value: number) {
    return `${value.toFixed(2)} s`
  }

  function beginSeek() {
    if (seeking.current) return
    seeking.current = true
    wasPlayingBeforeSeek.current = playing
    const before = useCompanionStore.getState().animationPlaying
    takeManualControl()
    setPlaying(false)
    logDebugEvent({
      source: 'user',
      type: 'user_action',
      summary: '开始调整动画时间轴',
      detail: { before, after: useCompanionStore.getState().animationPlaying },
    })
  }

  function endSeek() {
    if (!seeking.current) return
    seeking.current = false
    if (wasPlayingBeforeSeek.current) takeManualControl()
    setPlaying(wasPlayingBeforeSeek.current)
    logDebugEvent({
      source: 'user',
      type: 'user_action',
      summary: '提交动画时间轴',
      detail: {
        time: useCompanionStore.getState().animationTime,
        resumed: wasPlayingBeforeSeek.current,
      },
    })
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <Tabs
        value={tab}
        onValueChange={(value) => setTab(value as InspectorTab)}
        className="flex min-h-0 flex-1 flex-col"
      >
        <div className="shrink-0 border-b px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[0.65rem] font-semibold uppercase text-primary">
                Rig Inspector
              </p>
              <h2 className="mt-1 text-sm font-semibold">RobotExpressive</h2>
            </div>
            {controlMode === 'manual' && (
              <Button type="button" variant="outline" size="sm" onClick={resumeCompanion}>
                <RotateCcw className="mr-1.5 size-3.5" aria-hidden="true" />
                恢复伴侣
              </Button>
            )}
          </div>
          <TabsList className="mt-3 w-full grid-cols-3" aria-label="Inspector sections">
            <TabsTrigger value="animation">动画</TabsTrigger>
            <TabsTrigger value="bones">骨骼</TabsTrigger>
            <TabsTrigger value="expressions">表情</TabsTrigger>
          </TabsList>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <TabsContent value="animation" className="mt-0">
            <section className="space-y-5" aria-labelledby="clip-heading">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 id="clip-heading" className="text-sm font-semibold">
                    Animation transport
                  </h3>
                  <p className="mt-1 font-mono text-xs text-muted-foreground">
                    {clipLabel(animation)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded bg-muted px-2 py-1 font-mono text-xs">
                    {duration.toFixed(2)} s
                  </span>
                  <span className="rounded bg-muted px-2 py-1 text-[0.65rem] font-semibold uppercase text-muted-foreground">
                    {controlMode === 'auto' ? 'Auto' : '手动'}
                  </span>
                </div>
              </div>

              <Card className="space-y-3 rounded-md p-3">
                <div className="flex items-center justify-between gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const before = useCompanionStore.getState().animationPlaying
                      takeManualControl()
                      setPlaying(!before)
                      const after = useCompanionStore.getState().animationPlaying
                      logDebugEvent({
                        source: 'user',
                        type: 'user_action',
                        summary: after ? '播放动画' : '暂停动画',
                        detail: { before, after, success: before !== after },
                      })
                    }}
                    aria-label={playing ? '暂停动画' : '播放动画'}
                  >
                    {playing ? (
                      <Pause className="mr-1.5 size-3.5" />
                    ) : (
                      <Play className="mr-1.5 size-3.5" />
                    )}
                    {playing ? '暂停' : '播放'}
                  </Button>
                  <output className="font-mono text-xs tabular-nums text-muted-foreground">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </output>
                </div>
                <Slider
                  aria-label="动画时间轴"
                  min={0}
                  max={Math.max(duration, 0.001)}
                  step={0.01}
                  value={[Math.min(currentTime, duration)]}
                  onValueChange={(value) => {
                    beginSeek()
                    setTime(Array.isArray(value) ? (value[0] ?? 0) : value)
                  }}
                  onValueCommitted={(value) => {
                    endSeek()
                    logDebugEvent({
                      source: 'user',
                      type: 'user_action',
                      summary: '提交动画时间轴',
                      detail: {
                        value: Array.isArray(value) ? value[0] : value,
                        actual: useCompanionStore.getState().animationTime,
                      },
                    })
                  }}
                />
                <label className="flex min-h-9 items-center gap-2 text-xs">
                  <Switch
                    checked={loop}
                    onCheckedChange={(next) => {
                      const before = useCompanionStore.getState().animationLoop
                      takeManualControl()
                      setLoop(next)
                      const after = useCompanionStore.getState().animationLoop
                      logDebugEvent({
                        source: 'user',
                        type: 'user_action',
                        summary: next ? '启用循环播放' : '关闭循环播放',
                        detail: { before, after, success: before !== after },
                      })
                    }}
                  />
                  循环播放
                </label>
              </Card>

              <div
                className="space-y-1.5 border-t pt-4"
                aria-labelledby="available-clips-heading"
              >
                <p id="available-clips-heading" className="text-xs font-semibold">
                  Available clips
                </p>
                <div className="space-y-1" role="group" aria-label="动画片段">
                  <Button
                    type="button"
                    variant="ghost"
                    aria-pressed={controlMode === 'auto'}
                    onClick={resumeCompanion}
                    className={clipButtonClass(controlMode === 'auto')}
                  >
                    <span className="flex items-center gap-2">
                      <Sparkles className="size-3.5" aria-hidden="true" />
                      Auto
                    </span>
                    <span className="text-right font-mono tabular-nums">自动</span>
                  </Button>
                  {[...animations]
                    .sort((left, right) =>
                      left.name === 'Idle' ? -1 : right.name === 'Idle' ? 1 : 0,
                    )
                    .map((clip) => (
                      <Button
                        key={clip.name}
                        type="button"
                        variant="ghost"
                        aria-pressed={animation === clip.name}
                        onClick={() => {
                          if (clip.name === 'Idle') {
                            resumeCompanion()
                            return
                          }
                          const before = useCompanionStore.getState().animation
                          startClipPreview(clip.name)
                          const after = useCompanionStore.getState().animation
                          logDebugEvent({
                            source: 'user',
                            type: 'user_action',
                            summary: `选择动画 ${clip.name}`,
                            detail: {
                              before,
                              requested: clip.name,
                              after,
                              success: before !== after || after === clip.name,
                            },
                          })
                        }}
                        className={clipButtonClass(animation === clip.name)}
                      >
                        <span>{clipLabel(clip.name)}</span>
                        <span className="text-right font-mono tabular-nums">
                          {clip.duration.toFixed(2)}s
                        </span>
                      </Button>
                    ))}
                </div>
              </div>
            </section>
          </TabsContent>

          <TabsContent value="bones" className="mt-0">
            <section className="space-y-4" aria-labelledby="bone-heading">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 id="bone-heading" className="text-sm font-semibold">
                    Joint transforms
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    动画结果上的局部旋转偏移
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const before = useCompanionStore.getState().boneRotations
                    takeManualControl()
                    resetAllBoneRotations()
                    const after = useCompanionStore.getState().boneRotations
                    logDebugEvent({
                      source: 'user',
                      type: 'user_action',
                      summary: '复位全部骨骼旋转',
                      detail: {
                        count: Object.keys(before).length,
                        success:
                          Object.keys(before).length > 0 &&
                          Object.keys(after).length === 0,
                      },
                    })
                  }}
                  disabled={Object.keys(rotations).length === 0}
                >
                  <RotateCcw className="mr-1.5 size-3.5" />
                  全复位
                </Button>
              </div>
              <label className="relative block">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="搜索关节…"
                  aria-label="搜索关节"
                  className="h-10 pl-9 pr-3"
                />
              </label>
              <div
                className="max-h-64 overflow-y-auto rounded-md border bg-muted/30 p-1"
                role="tree"
                aria-label="GLB joints"
              >
                {filteredJoints.length ? (
                  (() => {
                    const visibleNames = new Set(
                      filteredJoints.map((joint) => joint.name),
                    )
                    const renderJoint = (joint: RigJoint): ReactNode => {
                      const children = joints.filter(
                        (item) =>
                          item.parentName === joint.name && visibleNames.has(item.name),
                      )
                      const open = query.trim() ? true : !collapsed.has(joint.name)
                      const row = (
                        <div className="flex min-h-8 items-center gap-1" role="none">
                          {children.length ? (
                            <CollapsibleTrigger
                              render={
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  aria-label={`${open ? '折叠' : '展开'} ${joint.name}`}
                                  className="size-7"
                                >
                                  <ChevronDown
                                    className={`size-3.5 transition-transform ${open ? '' : '-rotate-90'}`}
                                    aria-hidden="true"
                                  />
                                </Button>
                              }
                            />
                          ) : (
                            <span className="size-7 shrink-0" />
                          )}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            role="treeitem"
                            aria-selected={selectedBoneName === joint.name}
                            aria-level={joint.depth + 1}
                            onClick={() => setSelectedBone(joint.name)}
                            className={`h-8 min-w-0 flex-1 justify-between rounded px-2 text-left text-xs font-normal ${selectedBoneName === joint.name ? 'bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground' : 'text-foreground'}`}
                          >
                            <span className="truncate">{joint.name}</span>
                            <span className="flex shrink-0 items-center gap-1">
                              {joint.helper && (
                                <span className="rounded bg-muted px-1 py-0.5 text-[0.58rem] text-muted-foreground">
                                  helper
                                </span>
                              )}
                              {rotations[joint.name] && (
                                <span
                                  className="size-1.5 rounded-full bg-amber-500"
                                  aria-label="有手动偏移"
                                />
                              )}
                            </span>
                          </Button>
                        </div>
                      )

                      if (!children.length) return <div key={joint.name}>{row}</div>

                      return (
                        <Collapsible
                          key={joint.name}
                          open={open}
                          onOpenChange={(nextOpen) => {
                            if (query.trim()) return
                            setCollapsed((current) => {
                              const next = new Set(current)
                              if (nextOpen) next.delete(joint.name)
                              else next.add(joint.name)
                              return next
                            })
                          }}
                        >
                          {row}
                          <CollapsibleContent role="group" className="pl-3">
                            {children.map(renderJoint)}
                          </CollapsibleContent>
                        </Collapsible>
                      )
                    }

                    return joints
                      .filter(
                        (joint) => !joint.parentName && visibleNames.has(joint.name),
                      )
                      .map(renderJoint)
                  })()
                ) : (
                  <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                    没有匹配的关节
                  </p>
                )}
              </div>

              {selectedJoint ? (
                <Card className="space-y-4 rounded-md p-3">
                  <div className="flex items-center justify-between gap-2 border-b pb-3">
                    <div className="min-w-0">
                      <p className="text-[0.65rem] uppercase text-muted-foreground">
                        Selected joint
                      </p>
                      <p className="mt-1 truncate font-mono text-sm font-semibold">
                        {selectedJoint.name}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`复位 ${selectedJoint.name}`}
                      onClick={() => {
                        const before =
                          useCompanionStore.getState().boneRotations[selectedJoint.name]
                        takeManualControl()
                        resetBoneRotation(selectedJoint.name)
                        const after =
                          useCompanionStore.getState().boneRotations[selectedJoint.name]
                        logDebugEvent({
                          source: 'user',
                          type: 'user_action',
                          summary: `复位 ${selectedJoint.name}`,
                          detail: { before, after, success: Boolean(before) && !after },
                        })
                      }}
                      disabled={!selectedRotation}
                    >
                      <RotateCcw className="size-4" />
                    </Button>
                  </div>
                  {(['x', 'y', 'z'] as const).map((axis) => (
                    <div
                      key={axis}
                      className="grid grid-cols-[1.1rem_minmax(0,1fr)_4.5rem] items-center gap-2"
                    >
                      <span className="font-mono text-xs font-semibold text-muted-foreground">
                        {axisNames[axis]}
                      </span>
                      <Slider
                        aria-label={`${selectedJoint.name} ${axisNames[axis]} 旋转`}
                        min={-180}
                        max={180}
                        step={0.1}
                        value={[currentRotation[axis]]}
                        onValueChange={(value) => {
                          takeManualControl()
                          updateAxis(axis, Array.isArray(value) ? (value[0] ?? 0) : value)
                        }}
                        onValueCommitted={(value) =>
                          logDebugEvent({
                            source: 'user',
                            type: 'user_action',
                            summary: `提交 ${selectedJoint.name} ${axisNames[axis]} 旋转`,
                            detail: {
                              joint: selectedJoint.name,
                              axis,
                              value: Array.isArray(value) ? value[0] : value,
                              actual:
                                useCompanionStore.getState().boneRotations[
                                  selectedJoint.name
                                ]?.[axis] ?? 0,
                            },
                          })
                        }
                        className="w-full"
                      />
                      <NumberField
                        value={currentRotation[axis]}
                        min={-180}
                        max={180}
                        step={0.1}
                        label={`${selectedJoint.name} ${axisNames[axis]} 角度数值`}
                        onChange={(value) => updateAxis(axis, value)}
                      />
                    </div>
                  ))}
                  <p className="text-[0.65rem] text-muted-foreground">
                    单位：度 · 范围：−180° 至 180°
                  </p>
                </Card>
              ) : (
                <p className="rounded-md border border-dashed px-4 py-8 text-center text-xs text-muted-foreground">
                  模型关节加载后可在此调节旋转
                </p>
              )}
            </section>
          </TabsContent>

          <TabsContent value="expressions" className="mt-0">
            <section className="space-y-5" aria-labelledby="expression-heading">
              <div>
                <h3 id="expression-heading" className="text-sm font-semibold">
                  Morph targets
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  手动权重覆盖动画片段的表情轨道
                </p>
              </div>
              {expressionNames.map(({ id, label }) => {
                const value = expressionWeights[id]
                return (
                  <Card key={id} className="space-y-2 rounded-md p-3">
                    <div className="flex items-center justify-between gap-3">
                      <label htmlFor={`morph-${id}`} className="text-sm font-medium">
                        {label}
                      </label>
                      <output
                        htmlFor={`morph-${id}`}
                        className="font-mono text-xs tabular-nums text-muted-foreground"
                      >
                        {value.toFixed(2)}
                      </output>
                    </div>
                    <Slider
                      id={`morph-${id}`}
                      aria-label={`${label} 权重`}
                      min={0}
                      max={1}
                      step={0.01}
                      value={[value]}
                      onValueChange={(next) => {
                        takeManualExpressionControl()
                        setExpressionWeight(
                          id,
                          Array.isArray(next) ? (next[0] ?? 0) : next,
                        )
                      }}
                      onValueCommitted={(next) =>
                        logDebugEvent({
                          source: 'user',
                          type: 'user_action',
                          summary: `设置 ${label} 表情`,
                          detail: {
                            name: id,
                            value: Array.isArray(next) ? next[0] : next,
                            actual: useCompanionStore.getState().expressionWeights[id],
                          },
                        })
                      }
                      className="w-full"
                    />
                  </Card>
                )
              })}
            </section>
          </TabsContent>
        </div>
      </Tabs>
      <DebugConsole />
    </div>
  )
}
