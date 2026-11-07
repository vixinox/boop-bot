import { Component, Suspense, useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Html, OrbitControls, useGLTF } from '@react-three/drei'
import type { ComponentRef, RefObject } from 'react'
import { gsap } from 'gsap'
import { RotateCcw } from 'lucide-react'
import {
  MOUSE,
  MathUtils,
  PCFSoftShadowMap,
  PerspectiveCamera,
  Raycaster,
  SkinnedMesh,
  Vector2,
  Vector3,
  TOUCH,
} from 'three'
import { Button } from '../components/ui/button'
import { useSceneStore } from '../state/sceneStore'
import { dispatchBehaviorEvent, useBehaviorStore } from '../state/behaviorStore'
import { classifyTap, classifyTouchRegion } from './touchInteraction'
import { RiggedRobot } from './RiggedRobot'
import { ChatOverlay } from '../ui/ChatOverlay'
import { SceneLights, SceneObjects } from './SceneEntities'

const MODEL_URL = '/RobotExpressive.glb'
const SCENE_BACKGROUND = '#ffffff'
const SCENE_HEMISPHERE = '#73847e'

function StageFailure({ retry }: { retry: () => void }) {
  return (
    <div
      role="alert"
      className="grid h-full place-content-center gap-3 p-8 text-center text-foreground"
    >
      <strong>机器人舞台暂时无法显示</strong>
      <span>
        模型加载或三维渲染出错，请重试；若仍无法显示，请确认浏览器支持 WebGL
        并开启硬件加速。
      </span>
      <Button type="button" onClick={retry}>
        重新加载舞台
      </Button>
    </div>
  )
}

class StageErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    if (this.state.failed) {
      return (
        <StageFailure
          retry={() => {
            useGLTF.clear(MODEL_URL)
            this.setState({ failed: false })
          }}
        />
      )
    }
    return this.props.children
  }
}

type OrbitControlsImpl = ComponentRef<typeof OrbitControls>

/** Camera offset from the target at rest; its direction is kept, its length is fitted to the viewport. */
const DEFAULT_CAMERA_OFFSET = new Vector3(0, 0.59, 4.6)
const RESET_SECONDS = 0.8
const ZOOM_SECONDS = 0.2
const DEFAULT_FOV = 34
const MIN_DISTANCE = 0.0001
const MAX_DISTANCE = Number.POSITIVE_INFINITY
const MIN_POLAR_ANGLE = 0.001
const MAX_POLAR_ANGLE = Math.PI - 0.001
const CAMERA_TARGET = new Vector3(0, 1.06, 0)
const DISABLED_MOUSE_ACTION = null as unknown as MOUSE

function fitDistance(camera: PerspectiveCamera, aspect: number, fov = camera.fov) {
  const halfFov = MathUtils.degToRad(fov / 2)
  return Math.max(
    DEFAULT_CAMERA_OFFSET.length() / (2 * Math.tan(halfFov)),
    2.05 / (2 * Math.tan(halfFov) * aspect),
  )
}

type ResetRefs = {
  controls: RefObject<OrbitControlsImpl | null>
  /** Reset offset from the orbit target, refitted to the viewport after every resize. */
  resetOffset: RefObject<Vector3>
  /** Set by the reset button; consumed by the tween, which a drag can cancel. */
  resetRequest: RefObject<boolean>
}

type TrackedPointer = {
  x: number
  y: number
  startX: number
  startY: number
  pointerType: 'mouse' | 'touch' | 'pen'
  button: number
  region: NonNullable<ReturnType<typeof classifyTouchRegion>>['region'] | null
  multiTouch: boolean
}

function StageCamera({ controls, resetOffset, resetRequest }: ResetRefs) {
  const { camera, gl, scene, size } = useThree()
  const cameraCommand = useSceneStore((state) => state.cameraCommand)
  const resetTween = useRef<gsap.core.Tween | null>(null)
  const zoomTween = useRef<gsap.core.Tween | null>(null)
  const aiTween = useRef<gsap.core.Tween | null>(null)
  const zoomValue = useRef({ distance: 0 })
  const cameraReady = useRef(false)
  const userAttentionActive = useRef(false)
  const userCameraMoved = useRef(false)
  const attentionSettleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastAttentionPosition = useRef(new Vector3(Number.NaN, Number.NaN, Number.NaN))
  const raycaster = useRef(new Raycaster())
  const pointerNdc = useRef(new Vector2())

  useEffect(() => {
    const instance = controls.current
    if (!instance) return
    instance.mouseButtons.LEFT = MOUSE.ROTATE
    instance.mouseButtons.MIDDLE = MOUSE.PAN
    instance.mouseButtons.RIGHT = DISABLED_MOUSE_ACTION
    instance.touches.ONE = TOUCH.ROTATE
  }, [controls])

  useEffect(() => {
    if (!(camera instanceof PerspectiveCamera)) return
    const aspect = size.width / Math.max(size.height, 1)
    const distance = fitDistance(camera, aspect, DEFAULT_FOV)
    resetOffset.current.copy(DEFAULT_CAMERA_OFFSET).setLength(distance)
    const instance = controls.current
    camera.aspect = aspect
    camera.updateProjectionMatrix()
    if (instance && !cameraReady.current) {
      instance.target.copy(CAMERA_TARGET)
      camera.position.copy(CAMERA_TARGET).add(resetOffset.current)
      camera.fov = DEFAULT_FOV
      camera.lookAt(instance.target)
      camera.updateProjectionMatrix()
      instance.update()
      instance.saveState()
      cameraReady.current = true
    } else if (instance) {
      instance.update()
    }
    if (instance) zoomValue.current.distance = camera.position.distanceTo(instance.target)
    if (instance)
      useSceneStore.getState().setCameraView({
        position: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
        target: { x: instance.target.x, y: instance.target.y, z: instance.target.z },
        fov: camera.fov,
      })
  }, [camera, controls, resetOffset, size.width, size.height])

  useEffect(() => {
    const instance = controls.current
    if (!(camera instanceof PerspectiveCamera) || !instance || !cameraCommand) return
    clearAttentionSettle()
    userAttentionActive.current = false
    userCameraMoved.current = false
    resetTween.current?.kill()
    zoomTween.current?.kill()
    aiTween.current?.kill()
    const fromPosition = camera.position.clone()
    const toPosition = new Vector3(
      cameraCommand.position.x,
      cameraCommand.position.y,
      cameraCommand.position.z,
    )
    const fromTarget = instance.target.clone()
    const toTarget = new Vector3(
      cameraCommand.target.x,
      cameraCommand.target.y,
      cameraCommand.target.z,
    )
    const fromFov = camera.fov
    const progress = { value: 0 }
    aiTween.current = gsap.to(progress, {
      value: 1,
      duration: cameraCommand.duration_ms / 1000,
      ease: 'power2.inOut',
      onUpdate: () => {
        camera.position.lerpVectors(fromPosition, toPosition, progress.value)
        instance.target.lerpVectors(fromTarget, toTarget, progress.value)
        camera.fov = fromFov + (cameraCommand.fov - fromFov) * progress.value
        camera.lookAt(instance.target)
        camera.updateProjectionMatrix()
        instance.update()
      },
      onComplete: () => {
        aiTween.current = null
        useSceneStore.getState().setCameraView({
          position: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
          target: { x: instance.target.x, y: instance.target.y, z: instance.target.z },
          fov: camera.fov,
        })
        useSceneStore.getState().cancelCameraCommand()
      },
    })
    return () => {
      aiTween.current?.kill()
      aiTween.current = null
    }
  }, [camera, cameraCommand?.id, controls])

  useEffect(() => () => useSceneStore.getState().cancelCameraCommand(), [])

  useEffect(() => {
    if (document.hidden) {
      dispatchBehaviorEvent({ type: 'page_hidden' })
      const reaction = useBehaviorStore.getState().activeReaction
      if (reaction?.persistent)
        dispatchBehaviorEvent({
          type: 'reaction_cancelled',
          reactionId: reaction.id,
          reason: 'page_hidden',
        })
    }
    const onVisibilityChange = () => {
      dispatchBehaviorEvent({ type: document.hidden ? 'page_hidden' : 'page_visible' })
      if (document.hidden) {
        const reaction = useBehaviorStore.getState().activeReaction
        if (reaction?.persistent)
          dispatchBehaviorEvent({
            type: 'reaction_cancelled',
            reactionId: reaction.id,
            reason: 'page_hidden',
          })
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [])

  const cameraWorldPosition = () => camera.getWorldPosition(new Vector3())
  const clearAttentionSettle = () => {
    if (attentionSettleTimer.current !== null) {
      clearTimeout(attentionSettleTimer.current)
      attentionSettleTimer.current = null
    }
  }
  const publishCameraAttention = (settled: boolean) => {
    const position = cameraWorldPosition()
    if (settled && !userCameraMoved.current) return
    if (settled || position.distanceToSquared(lastAttentionPosition.current) > 0.0004) {
      lastAttentionPosition.current.copy(position)
      userCameraMoved.current = true
      dispatchBehaviorEvent({
        type: settled ? 'camera_user_settled' : 'camera_user_changed',
        target: { x: position.x, y: position.y, z: position.z },
      })
    }
  }
  const beginUserAttention = () => {
    clearAttentionSettle()
    userAttentionActive.current = true
    userCameraMoved.current = false
    lastAttentionPosition.current.copy(cameraWorldPosition())
  }
  const settleUserAttention = () => {
    clearAttentionSettle()
    attentionSettleTimer.current = setTimeout(() => {
      attentionSettleTimer.current = null
      publishCameraAttention(true)
      userAttentionActive.current = false
      userCameraMoved.current = false
    }, 180)
  }

  const hitAvatar = (clientX: number, clientY: number) => {
    const bounds = gl.domElement.getBoundingClientRect()
    if (
      clientX < bounds.left ||
      clientX > bounds.right ||
      clientY < bounds.top ||
      clientY > bounds.bottom ||
      bounds.width === 0 ||
      bounds.height === 0
    )
      return null
    pointerNdc.current.set(
      ((clientX - bounds.left) / bounds.width) * 2 - 1,
      -((clientY - bounds.top) / bounds.height) * 2 + 1,
    )
    scene.updateMatrixWorld(true)
    raycaster.current.setFromCamera(pointerNdc.current, camera)
    const hit = raycaster.current
      .intersectObjects(scene.children, true)
      .find((intersection) => intersection.object instanceof SkinnedMesh)
    if (!hit) return null
    let avatarRoot = hit.object
    while (avatarRoot.parent && avatarRoot.parent !== scene)
      avatarRoot = avatarRoot.parent
    if (avatarRoot.parent !== scene) return null

    const rootScale = avatarRoot.scale
    if (
      !Number.isFinite(rootScale.x) ||
      !Number.isFinite(rootScale.y) ||
      !Number.isFinite(rootScale.z) ||
      rootScale.x === 0 ||
      rootScale.y === 0 ||
      rootScale.z === 0
    )
      return null

    const displayedPoint = avatarRoot
      .worldToLocal(hit.point.clone())
      .multiply(rootScale)
      .add(avatarRoot.position)
    const classified = classifyTouchRegion(displayedPoint)
    if (!classified) return null
    return {
      region: classified.region,
      point: { x: hit.point.x, y: hit.point.y, z: hit.point.z },
    }
  }

  useEffect(() => {
    const instance = controls.current
    if (!instance) return
    const canvas = gl.domElement
    const pointers = new Map<number, TrackedPointer>()
    let previousPinchDistance: number | null = null

    const cancelTweens = () => {
      resetTween.current?.kill()
      resetTween.current = null
      zoomTween.current?.kill()
      zoomTween.current = null
    }
    const takeCamera = (followAttention = false) => {
      cancelTweens()
      aiTween.current?.kill()
      aiTween.current = null
      useSceneStore.getState().cancelCameraCommand()
      if (followAttention) beginUserAttention()
    }

    const currentDistance = () => camera.position.distanceTo(instance.target)
    const applyDistance = (distance: number) => {
      const offset = camera.position.clone().sub(instance.target)
      if (offset.lengthSq() === 0) offset.set(0, 0, 1)
      camera.position.copy(instance.target).add(offset.setLength(distance))
      instance.update()
    }
    const animateDistance = (nextDistance: number) => {
      takeCamera(true)
      if (!Number.isFinite(nextDistance)) return
      zoomValue.current.distance = currentDistance()
      zoomTween.current = gsap.to(zoomValue.current, {
        distance: Math.max(MIN_DISTANCE, nextDistance),
        duration: ZOOM_SECONDS,
        ease: 'power2.out',
        onUpdate: () => {
          applyDistance(zoomValue.current.distance)
          publishCameraAttention(false)
        },
        onComplete: () => {
          zoomTween.current = null
          settleUserAttention()
          instance.saveState()
          if (camera instanceof PerspectiveCamera)
            useSceneStore.getState().setCameraView({
              position: {
                x: camera.position.x,
                y: camera.position.y,
                z: camera.position.z,
              },
              target: {
                x: instance.target.x,
                y: instance.target.y,
                z: instance.target.z,
              },
              fov: camera.fov,
            })
        },
      })
    }
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const delta =
        event.deltaY *
        (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? canvas.clientHeight : 1)
      if (delta !== 0) animateDistance(currentDistance() * Math.exp(delta * 0.001))
    }
    const onPointerDown = (event: PointerEvent) => {
      takeCamera()
      if (event.pointerType === 'touch') {
        instance.enabled = true
        instance.touches.ONE = TOUCH.ROTATE
      } else {
        instance.enabled = event.button === 0 || event.button === 1
        instance.mouseButtons.LEFT = MOUSE.ROTATE
        instance.mouseButtons.MIDDLE = MOUSE.PAN
      }
      instance.mouseButtons.RIGHT = DISABLED_MOUSE_ACTION
      const hit = hitAvatar(event.clientX, event.clientY)
      pointers.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
        startX: event.clientX,
        startY: event.clientY,
        pointerType:
          event.pointerType === 'touch' || event.pointerType === 'pen'
            ? event.pointerType
            : 'mouse',
        button: event.button,
        region: hit?.region ?? null,
        multiTouch: false,
      })
      if (pointers.size > 1)
        for (const pointer of pointers.values()) pointer.multiTouch = true
      previousPinchDistance = pointers.size === 2 ? getPinchDistance() : null
    }
    const getPinchDistance = () => {
      const [first, second] = [...pointers.values()]
      return first && second ? Math.hypot(first.x - second.x, first.y - second.y) : 0
    }
    const onPointerMove = (event: PointerEvent) => {
      const pointer = pointers.get(event.pointerId)
      if (!pointer) return
      pointer.x = event.clientX
      pointer.y = event.clientY
      if (pointers.size < 2) return

      const distance = getPinchDistance()
      if (previousPinchDistance && distance > 0) {
        event.preventDefault()
        animateDistance(currentDistance() * (previousPinchDistance / distance))
      }
      previousPinchDistance = distance
    }
    const onPointerUp = (event: PointerEvent) => {
      const pointer = pointers.get(event.pointerId)
      if (pointer) {
        pointer.x = event.clientX
        pointer.y = event.clientY
        const target = event.target
        const endedOnOverlay =
          target instanceof Element &&
          (target !== canvas ||
            Boolean(target.closest('button,input,textarea,[contenteditable="true"]')))
        const tap = classifyTap({
          start: { x: pointer.startX, y: pointer.startY },
          end: { x: pointer.x, y: pointer.y },
          pointerType: pointer.pointerType,
          button: pointer.button,
          cancelled: event.type === 'pointercancel',
          multiTouch: pointer.multiTouch,
          endedOnOverlay,
        })
        if (tap && pointer.region) {
          const hit = hitAvatar(event.clientX, event.clientY)
          if (hit && hit.region === pointer.region) {
            dispatchBehaviorEvent({
              type: 'avatar_touch_started',
              region: hit.region,
              point: hit.point,
            })
            dispatchBehaviorEvent({ type: 'avatar_touch_ended', region: hit.region })
          }
        }
      }
      pointers.delete(event.pointerId)
      previousPinchDistance = null
      if (pointers.size === 0) {
        instance.enabled = true
        instance.mouseButtons.LEFT = MOUSE.ROTATE
        instance.mouseButtons.MIDDLE = MOUSE.PAN
        instance.mouseButtons.RIGHT = DISABLED_MOUSE_ACTION
        instance.touches.ONE = TOUCH.ROTATE
        if (camera instanceof PerspectiveCamera)
          useSceneStore.getState().setCameraView({
            position: {
              x: camera.position.x,
              y: camera.position.y,
              z: camera.position.z,
            },
            target: { x: instance.target.x, y: instance.target.y, z: instance.target.z },
            fov: camera.fov,
          })
      }
    }
    const onContextMenu = (event: MouseEvent) => event.preventDefault()
    const onControlStart = () => takeCamera(true)
    const onControlEnd = () => {
      if (camera instanceof PerspectiveCamera)
        useSceneStore.getState().setCameraView({
          position: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
          target: { x: instance.target.x, y: instance.target.y, z: instance.target.z },
          fov: camera.fov,
        })
      settleUserAttention()
    }
    const onControlChange = () => {
      if (userAttentionActive.current) publishCameraAttention(false)
    }

    instance.addEventListener('start', onControlStart)
    instance.addEventListener('end', onControlEnd)
    instance.addEventListener('change', onControlChange)
    canvas.addEventListener('wheel', onWheel, { passive: false })
    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointermove', onPointerMove, { passive: false })
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerUp)
    canvas.addEventListener('contextmenu', onContextMenu)
    return () => {
      instance.removeEventListener('start', onControlStart)
      instance.removeEventListener('end', onControlEnd)
      instance.removeEventListener('change', onControlChange)
      canvas.removeEventListener('wheel', onWheel)
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerUp)
      canvas.removeEventListener('contextmenu', onContextMenu)
      instance.enabled = true
      cancelTweens()
      clearAttentionSettle()
      userAttentionActive.current = false
    }
  }, [camera, controls, gl, scene])

  useFrame(() => {
    const instance = controls.current
    const request = resetRequest.current
    resetRequest.current = false
    if (!(camera instanceof PerspectiveCamera) || !instance || !request) return
    resetTween.current?.kill()
    zoomTween.current?.kill()
    aiTween.current?.kill()
    useSceneStore.getState().cancelCameraCommand()
    beginUserAttention()
    const fromPosition = camera.position.clone()
    const toPosition = CAMERA_TARGET.clone().add(resetOffset.current)
    const fromTarget = instance.target.clone()
    const toTarget = CAMERA_TARGET
    const fromFov = camera.fov
    const progress = { value: 0 }
    resetTween.current = gsap.to(progress, {
      value: 1,
      duration: RESET_SECONDS,
      ease: 'power2.out',
      onUpdate: () => {
        instance.target.lerpVectors(fromTarget, toTarget, progress.value)
        camera.position.lerpVectors(fromPosition, toPosition, progress.value)
        camera.fov = fromFov + (DEFAULT_FOV - fromFov) * progress.value
        camera.lookAt(instance.target)
        camera.updateProjectionMatrix()
        instance.update()
        publishCameraAttention(false)
      },
      onComplete: () => {
        resetTween.current = null
        instance.update()
        instance.saveState()
        publishCameraAttention(true)
        userAttentionActive.current = false
        userCameraMoved.current = false
        useSceneStore.getState().setCameraView({
          position: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
          target: { x: instance.target.x, y: instance.target.y, z: instance.target.z },
          fov: camera.fov,
        })
      },
    })
  })

  useEffect(
    () => () => {
      resetTween.current?.kill()
      zoomTween.current?.kill()
      aiTween.current?.kill()
      useSceneStore.getState().cancelCameraCommand()
      clearAttentionSettle()
      userAttentionActive.current = false
    },
    [],
  )

  return null
}

function StageContents() {
  return (
    <>
      <color attach="background" args={[SCENE_BACKGROUND]} />
      <mesh position={[0, -0.04, 0]} receiveShadow>
        <cylinderGeometry args={[2.1, 2.1, 0.08, 64]} />
        <meshStandardMaterial color={SCENE_BACKGROUND} roughness={0.88} />
      </mesh>
      <hemisphereLight args={['#ffffff', SCENE_HEMISPHERE, 0.55]} />
    </>
  )
}

export function CompanionStage() {
  const controlsRef = useRef<OrbitControlsImpl>(null)
  const resetOffsetRef = useRef(DEFAULT_CAMERA_OFFSET.clone())
  const resetRequestRef = useRef(false)

  return (
    <div className="relative h-full w-full">
      <StageErrorBoundary>
        <Canvas
          aria-label="桌面伴侣机器人 3D 舞台，可拖拽调整视角"
          camera={{ position: [0, 1.65, 4.6], fov: 34 }}
          dpr={[1, 1.75]}
          shadows={{ type: PCFSoftShadowMap }}
          fallback={<span>3D 机器人舞台，使用互动控件操作。</span>}
          gl={{ antialias: true, alpha: false }}
          className="h-full w-full"
        >
          <StageCamera
            controls={controlsRef}
            resetOffset={resetOffsetRef}
            resetRequest={resetRequestRef}
          />
          <OrbitControls
            ref={controlsRef}
            target={[0, 1.06, 0]}
            minPolarAngle={MIN_POLAR_ANGLE}
            maxPolarAngle={MAX_POLAR_ANGLE}
            enablePan
            enableZoom={false}
            minDistance={MIN_DISTANCE}
            maxDistance={MAX_DISTANCE}
            enableDamping
            dampingFactor={0.08}
            mouseButtons={{
              LEFT: MOUSE.ROTATE,
              MIDDLE: MOUSE.PAN,
              RIGHT: null as unknown as MOUSE,
            }}
            touches={{ ONE: TOUCH.ROTATE, TWO: TOUCH.DOLLY_PAN }}
          />
          <hemisphereLight args={['#ffffff', '#73847e', 0.55]} />
          <SceneLights />
          <StageContents />
          <SceneObjects />
          <Suspense
            fallback={
              <Html center>
                <span>正在加载机器人…</span>
              </Html>
            }
          >
            <RiggedRobot />
          </Suspense>
        </Canvas>
      </StageErrorBoundary>
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => {
          useSceneStore.getState().cancelCameraCommand()
          resetRequestRef.current = true
        }}
        className="absolute left-4 top-4 z-10 rounded-full transition-transform duration-200 hover:scale-[1.04] active:scale-[0.96] motion-reduce:hover:scale-100 motion-reduce:active:scale-100"
        aria-label="复原视角"
        title="复原视角"
      >
        <RotateCcw className="size-4" aria-hidden="true" />
      </Button>
      <ChatOverlay />
    </div>
  )
}
