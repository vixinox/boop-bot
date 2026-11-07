import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Light, Object3D, MathUtils, Mesh } from 'three'
import { useSceneStore } from '../state/sceneStore'
import type { SceneLight, ScenePrimitive } from '../state/sceneStore'
import {
  evaluateSceneLightIntensity,
  evaluateSceneObjectAnimation,
  sceneAnimationElapsed,
} from './sceneAnimation'

function PrimitiveGeometry({ object }: { object: ScenePrimitive }) {
  switch (object.shape) {
    case 'box': {
      const dimensions = object.dimensions as {
        width: number
        height: number
        depth: number
      }
      return (
        <boxGeometry args={[dimensions.width, dimensions.height, dimensions.depth]} />
      )
    }
    case 'sphere':
      return (
        <sphereGeometry
          args={[(object.dimensions as { radius: number }).radius, 32, 20]}
        />
      )
    case 'cylinder': {
      const dimensions = object.dimensions as {
        radius_top: number
        radius_bottom: number
        height: number
      }
      return (
        <cylinderGeometry
          args={[dimensions.radius_top, dimensions.radius_bottom, dimensions.height, 32]}
        />
      )
    }
    case 'cone': {
      const dimensions = object.dimensions as { radius: number; height: number }
      return <coneGeometry args={[dimensions.radius, dimensions.height, 32]} />
    }
    case 'torus': {
      const dimensions = object.dimensions as {
        major_radius: number
        tube_radius: number
      }
      return (
        <torusGeometry args={[dimensions.major_radius, dimensions.tube_radius, 16, 64]} />
      )
    }
  }
}

function PrimitiveMesh({ object }: { object: ScenePrimitive }) {
  const mesh = useRef<Mesh>(null)
  useFrame(() => {
    if (!mesh.current) return
    const command = useSceneStore.getState().sceneAnimation
    const animation = command?.objects.find((item) => item.id === object.id)
    if (!command || !animation) {
      mesh.current.position.set(object.position.x, object.position.y, object.position.z)
      mesh.current.rotation.set(0, 0, 0)
      return
    }
    const pose = evaluateSceneObjectAnimation(
      animation,
      sceneAnimationElapsed(command, performance.now()),
      object.position,
    )
    mesh.current.position.set(pose.position.x, pose.position.y, pose.position.z)
    mesh.current.quaternion.copy(pose.rotation)
  })
  return (
    <mesh
      ref={mesh}
      position={[object.position.x, object.position.y, object.position.z]}
      castShadow
      receiveShadow
    >
      <PrimitiveGeometry object={object} />
      <meshStandardMaterial color={object.color} roughness={0.55} metalness={0.04} />
    </mesh>
  )
}

function useLightAnimation(light: SceneLight, ref: React.RefObject<Light | null>) {
  useFrame(() => {
    if (!ref.current) return
    const command = useSceneStore.getState().sceneAnimation
    const animation = command?.lights.find((item) => item.id === light.id)
    ref.current.intensity =
      command && animation
        ? evaluateSceneLightIntensity(
            animation,
            sceneAnimationElapsed(command, performance.now()),
          )
        : light.intensity
  })
}

function DirectionalLight({ light }: { light: SceneLight }) {
  const lightRef = useRef<Light>(null)
  useLightAnimation(light, lightRef)
  const target = useMemo(() => new Object3D(), [])
  const position = light.position ?? { x: 0, y: 1, z: 0 }
  const point = light.target ?? { x: 0, y: 0, z: 0 }
  const scene = useThree((state) => state.scene)
  useLayoutEffect(() => {
    target.position.set(point.x, point.y, point.z)
    scene.add(target)
    target.updateMatrixWorld(true)
    return () => {
      scene.remove(target)
    }
  }, [point.x, point.y, point.z, scene, target])
  return (
    <directionalLight
      ref={lightRef}
      color={light.color}
      intensity={light.intensity}
      position={[position.x, position.y, position.z]}
      target={target}
      castShadow={light.id === 'key'}
      shadow-mapSize-width={light.id === 'key' ? 2048 : undefined}
      shadow-mapSize-height={light.id === 'key' ? 2048 : undefined}
      shadow-camera-left={light.id === 'key' ? -3 : undefined}
      shadow-camera-right={light.id === 'key' ? 3 : undefined}
      shadow-camera-top={light.id === 'key' ? 3 : undefined}
      shadow-camera-bottom={light.id === 'key' ? -1 : undefined}
      shadow-bias={light.id === 'key' ? -0.0001 : undefined}
      shadow-normalBias={light.id === 'key' ? 0.02 : undefined}
      shadow-radius={light.id === 'key' ? 4 : undefined}
    />
  )
}

function SpotLight({ light }: { light: SceneLight }) {
  const lightRef = useRef<Light>(null)
  useLightAnimation(light, lightRef)
  const target = useMemo(() => new Object3D(), [])
  const position = light.position ?? { x: 0, y: 1, z: 0 }
  const point = light.target ?? { x: 0, y: 0, z: 0 }
  const scene = useThree((state) => state.scene)
  useLayoutEffect(() => {
    target.position.set(point.x, point.y, point.z)
    scene.add(target)
    target.updateMatrixWorld(true)
    return () => {
      scene.remove(target)
    }
  }, [point.x, point.y, point.z, scene, target])
  return (
    <spotLight
      ref={lightRef}
      color={light.color}
      intensity={light.intensity}
      position={[position.x, position.y, position.z]}
      target={target}
      distance={light.distance ?? 0}
      angle={MathUtils.degToRad(light.angle_deg ?? 45)}
      decay={2}
    />
  )
}

function PointSceneLight({ light }: { light: SceneLight }) {
  const lightRef = useRef<Light>(null)
  useLightAnimation(light, lightRef)
  const position = light.position ?? { x: 0, y: 1, z: 0 }
  return (
    <pointLight
      ref={lightRef}
      color={light.color}
      intensity={light.intensity}
      position={[position.x, position.y, position.z]}
      distance={light.distance ?? 0}
      decay={2}
    />
  )
}

function AmbientSceneLight({ light }: { light: SceneLight }) {
  const lightRef = useRef<Light>(null)
  useLightAnimation(light, lightRef)
  return <ambientLight ref={lightRef} color={light.color} intensity={light.intensity} />
}

export function SceneObjects() {
  const objects = useSceneStore((state) => state.objects)
  return (
    <>
      {objects.map((object) => (
        <PrimitiveMesh key={object.id} object={object} />
      ))}
    </>
  )
}

export function SceneLights() {
  const lights = useSceneStore((state) => state.lights)
  return (
    <>
      {lights.map((light) => {
        if (light.type === 'ambient')
          return <AmbientSceneLight key={light.id} light={light} />
        if (light.type === 'directional')
          return <DirectionalLight key={light.id} light={light} />
        if (light.type === 'spot') return <SpotLight key={light.id} light={light} />
        return <PointSceneLight key={light.id} light={light} />
      })}
    </>
  )
}
