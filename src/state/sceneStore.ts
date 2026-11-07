import { create } from 'zustand'

export type SceneVector = { x: number; y: number; z: number }

export type SceneObjectAnimation = {
  id: string
  orbit?: { center: SceneVector; radius: number; period_ms: number; phase_deg: number }
  spin?: { axis: SceneVector; period_ms: number; phase_deg: number }
}

export type SceneLightAnimation = {
  id: string
  intensity: { min: number; max: number; period_ms: number; phase_deg: number }
}

export type SceneAnimationCommand = {
  id: number
  startedAtMs: number
  objects: SceneObjectAnimation[]
  lights: SceneLightAnimation[]
}

export type PrimitiveShape = 'box' | 'sphere' | 'cylinder' | 'cone' | 'torus'
export type PrimitiveDimensions =
  | { width: number; height: number; depth: number }
  | { radius: number }
  | { radius_top: number; radius_bottom: number; height: number }
  | { radius: number; height: number }
  | { major_radius: number; tube_radius: number }

export interface ScenePrimitive {
  id: string
  shape: PrimitiveShape
  position: SceneVector
  dimensions: PrimitiveDimensions
  color: string
}

export type SceneLightType = 'ambient' | 'directional' | 'point' | 'spot'
export interface SceneLight {
  id: string
  type: SceneLightType
  color: string
  intensity: number
  position?: SceneVector
  target?: SceneVector
  distance?: number
  angle_deg?: number
  builtIn: boolean
}

export interface CameraView {
  position: SceneVector
  target: SceneVector
  fov: number
}

export interface CameraPoseCommand extends CameraView {
  id: number
  duration_ms: number
}

const DEFAULT_LIGHTS: SceneLight[] = [
  {
    id: 'ambient',
    type: 'ambient',
    color: '#ffffff',
    intensity: 1.4,
    builtIn: true,
  },
  {
    id: 'key',
    type: 'directional',
    color: '#ffffff',
    intensity: 3.1,
    position: { x: 3, y: 5, z: 4 },
    target: { x: 0, y: 0, z: 0 },
    builtIn: true,
  },
  {
    id: 'fill',
    type: 'directional',
    color: '#c7d7ef',
    intensity: 1.15,
    position: { x: -4, y: 2, z: -3 },
    target: { x: 0, y: 0, z: 0 },
    builtIn: true,
  },
]

const DEFAULT_CAMERA: CameraView = {
  position: { x: 0, y: 1.65, z: 4.6 },
  target: { x: 0, y: 1.06, z: 0 },
  fov: 34,
}

export interface SceneState {
  objects: ScenePrimitive[]
  lights: SceneLight[]
  camera: CameraView
  cameraCommand: CameraPoseCommand | null
  sceneAnimation: SceneAnimationCommand | null
  sceneAnimationRevision: number
  revision: number
  cameraRevision: number
  nextEntityId: number
  createPrimitive: (value: Omit<ScenePrimitive, 'id'>) => string
  updatePrimitive: (
    id: string,
    patch: Partial<Omit<ScenePrimitive, 'id' | 'shape'>>,
  ) => boolean
  deletePrimitive: (id: string) => boolean
  createLight: (value: Omit<SceneLight, 'id' | 'builtIn'>) => string
  updateLight: (id: string, patch: Partial<Omit<SceneLight, 'id' | 'builtIn'>>) => boolean
  deleteLight: (id: string) => boolean
  requestCameraPose: (pose: Omit<CameraPoseCommand, 'id'>) => number
  setCameraView: (view: CameraView) => void
  cancelCameraCommand: () => void
  startSceneAnimation: (command: Omit<SceneAnimationCommand, 'id'>) => number
  cancelSceneAnimation: () => boolean
}

export const useSceneStore = create<SceneState>((set, get) => ({
  objects: [],
  lights: DEFAULT_LIGHTS.map((light) => structuredClone(light)),
  camera: structuredClone(DEFAULT_CAMERA),
  cameraCommand: null,
  sceneAnimation: null,
  sceneAnimationRevision: 0,
  revision: 0,
  cameraRevision: 0,
  nextEntityId: 1,
  createPrimitive: (value) => {
    const state = get()
    const id = `object-${state.nextEntityId}`
    set({
      objects: [...state.objects, { id, ...structuredClone(value) }],
      revision: state.revision + 1,
      nextEntityId: state.nextEntityId + 1,
    })
    return id
  },
  updatePrimitive: (id, patch) => {
    const state = get()
    if (!state.objects.some((object) => object.id === id)) return false
    set({
      objects: state.objects.map((object) =>
        object.id === id ? { ...object, ...structuredClone(patch) } : object,
      ),
      revision: state.revision + 1,
    })
    return true
  },
  deletePrimitive: (id) => {
    const state = get()
    const objects = state.objects.filter((object) => object.id !== id)
    if (objects.length === state.objects.length) return false
    set({ objects, revision: state.revision + 1 })
    return true
  },
  createLight: (value) => {
    const state = get()
    const id = `light-${state.nextEntityId}`
    set({
      lights: [...state.lights, { id, ...structuredClone(value), builtIn: false }],
      revision: state.revision + 1,
      nextEntityId: state.nextEntityId + 1,
    })
    return id
  },
  updateLight: (id, patch) => {
    const state = get()
    if (!state.lights.some((light) => light.id === id)) return false
    set({
      lights: state.lights.map((light) =>
        light.id === id ? { ...light, ...structuredClone(patch) } : light,
      ),
      revision: state.revision + 1,
    })
    return true
  },
  deleteLight: (id) => {
    const state = get()
    const light = state.lights.find((item) => item.id === id)
    if (!light || light.builtIn) return false
    set({
      lights: state.lights.filter((item) => item.id !== id),
      revision: state.revision + 1,
    })
    return true
  },
  requestCameraPose: (pose) => {
    const state = get()
    const id = state.cameraRevision + 1
    set({
      camera: {
        position: structuredClone(pose.position),
        target: structuredClone(pose.target),
        fov: pose.fov,
      },
      cameraCommand: { ...structuredClone(pose), id },
      cameraRevision: id,
    })
    return id
  },
  setCameraView: (camera) => set({ camera: structuredClone(camera) }),
  cancelCameraCommand: () => {
    const state = get()
    if (!state.cameraCommand) return
    set({ cameraCommand: null, cameraRevision: state.cameraRevision + 1 })
  },
  startSceneAnimation: (command) => {
    const id = get().sceneAnimationRevision + 1
    set({
      sceneAnimation: { ...structuredClone(command), id },
      sceneAnimationRevision: id,
    })
    return id
  },
  cancelSceneAnimation: () => {
    const state = get()
    if (!state.sceneAnimation) return false
    set({
      sceneAnimation: null,
      sceneAnimationRevision: state.sceneAnimationRevision + 1,
    })
    return true
  },
}))
