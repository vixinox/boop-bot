import { beforeEach, describe, expect, it } from 'vitest'
import { useSceneStore } from './sceneStore'

const builtInLights = [
  {
    id: 'ambient',
    type: 'ambient' as const,
    color: '#ffffff',
    intensity: 1.4,
    builtIn: true,
  },
  {
    id: 'key',
    type: 'directional' as const,
    color: '#ffffff',
    intensity: 3.1,
    position: { x: 3, y: 5, z: 4 },
    target: { x: 0, y: 0, z: 0 },
    builtIn: true,
  },
  {
    id: 'fill',
    type: 'directional' as const,
    color: '#c7d7ef',
    intensity: 1.15,
    position: { x: -4, y: 2, z: -3 },
    target: { x: 0, y: 0, z: 0 },
    builtIn: true,
  },
]

describe('scene session store', () => {
  beforeEach(() => {
    useSceneStore.setState({
      objects: [],
      lights: structuredClone(builtInLights),
      camera: {
        position: { x: 0, y: 1.65, z: 4.6 },
        target: { x: 0, y: 1.06, z: 0 },
        fov: 34,
      },
      cameraCommand: null,
      sceneAnimation: null,
      sceneAnimationRevision: 0,
      revision: 0,
      cameraRevision: 0,
      nextEntityId: 1,
    })
  })

  it('keeps serializable primitive IDs stable across update and deletion', () => {
    const store = useSceneStore.getState()
    const id = store.createPrimitive({
      shape: 'sphere',
      position: { x: 1, y: 2, z: 0 },
      dimensions: { radius: 0.5 },
      color: '#336699',
    })
    expect(id).toBe('object-1')
    expect(store.updatePrimitive(id, { color: '#abcdef' })).toBe(true)
    expect(useSceneStore.getState().objects[0]).toMatchObject({ id, color: '#abcdef' })
    expect(useSceneStore.getState().deletePrimitive(id)).toBe(true)
    expect(useSceneStore.getState().objects).toEqual([])
  })

  it('allows built-in light edits but protects their identity and deletion', () => {
    const store = useSceneStore.getState()
    expect(store.updateLight('key', { intensity: 4 })).toBe(true)
    expect(useSceneStore.getState().lights[1]?.intensity).toBe(4)
    expect(store.deleteLight('key')).toBe(false)
    const id = store.createLight({
      type: 'point',
      color: '#ffffff',
      intensity: 1,
      position: { x: 0, y: 2, z: 0 },
      distance: 0,
    })
    expect(id).toBe('light-1')
    expect(useSceneStore.getState().deleteLight(id)).toBe(true)
  })

  it('publishes desired camera state separately from the render command', () => {
    const id = useSceneStore.getState().requestCameraPose({
      position: { x: 2, y: 3, z: 4 },
      target: { x: 0, y: 1, z: 0 },
      fov: 48,
      duration_ms: 800,
    })
    expect(useSceneStore.getState()).toMatchObject({
      cameraCommand: { id },
      camera: { fov: 48, position: { x: 2, y: 3, z: 4 } },
    })
    useSceneStore.getState().cancelCameraCommand()
    expect(useSceneStore.getState().cameraCommand).toBeNull()
  })

  it('replaces the active scene animation and cancels it without changing scene entities', () => {
    const state = useSceneStore.getState()
    const command = {
      startedAtMs: 100,
      objects: [],
      lights: [
        {
          id: 'key',
          intensity: { min: 1, max: 2, period_ms: 1000, phase_deg: 0 },
        },
      ],
    }
    const firstId = state.startSceneAnimation(command)
    const secondId = useSceneStore.getState().startSceneAnimation(command)
    expect(secondId).toBeGreaterThan(firstId)
    expect(useSceneStore.getState().sceneAnimation?.id).toBe(secondId)
    expect(useSceneStore.getState().cancelSceneAnimation()).toBe(true)
    expect(useSceneStore.getState().sceneAnimation).toBeNull()
    expect(useSceneStore.getState().cancelSceneAnimation()).toBe(false)
  })
})
