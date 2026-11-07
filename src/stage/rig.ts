import { Bone, SkinnedMesh } from 'three'
import type { Object3D } from 'three'
import type { AnimationInfo, RigJoint } from '../state/companionStore'

export function collectSkinnedBones(root: Object3D) {
  const bones: Bone[] = []
  const seen = new Set<string>()

  root.traverse((object) => {
    if (!(object instanceof SkinnedMesh)) return
    for (const bone of object.skeleton.bones) {
      if (seen.has(bone.name)) continue
      seen.add(bone.name)
      bones.push(bone)
    }
  })

  return bones
}

export function buildRigCatalog(bones: Bone[]): RigJoint[] {
  const boneSet = new Set(bones)
  const visited = new Set<Bone>()
  const catalog: RigJoint[] = []

  function visit(bone: Bone, depth: number) {
    if (visited.has(bone)) return
    visited.add(bone)
    const parent =
      bone.parent instanceof Bone && boneSet.has(bone.parent) ? bone.parent : null
    catalog.push({
      name: bone.name,
      parentName: parent?.name ?? null,
      depth,
      helper: /^(PoleTarget|IK|Target)/i.test(bone.name),
    })
    for (const child of bone.children) {
      if (child instanceof Bone && boneSet.has(child)) visit(child, depth + 1)
    }
  }

  const roots = bones.filter(
    (bone) => !(bone.parent instanceof Bone) || !boneSet.has(bone.parent),
  )
  for (const root of roots) visit(root, 0)
  for (const bone of bones) visit(bone, 0)
  return catalog
}

export function animationCatalog(
  clips: Array<{ name: string; duration: number; tracks?: readonly { name: string }[] }>,
  validNames: readonly string[],
): AnimationInfo[] {
  const valid = new Set(validNames)
  const descriptions: Partial<Record<AnimationInfo['name'], string>> = {
    Dance: '节奏感较强的全身舞蹈',
    Death: '倒下并保持静止',
    Idle: '放松站立与呼吸',
    Jump: '原地跳起并落下',
    No: '摇头表示否定',
    Punch: '向前出拳',
    Running: '原地跑步循环',
    Sitting: '坐下并保持姿态',
    Standing: '从坐姿站起',
    ThumbsUp: '竖起拇指表示赞许',
    Walking: '原地走步循环',
    WalkJump: '走步后跳起',
    Wave: '抬手挥手问候',
    Yes: '点头表示肯定',
  }
  return clips
    .filter(
      (
        clip,
      ): clip is {
        name: AnimationInfo['name']
        duration: number
        tracks?: readonly { name: string }[]
      } => valid.has(clip.name),
    )
    .map(({ name, duration, tracks }) => ({
      name,
      duration,
      description: descriptions[name] ?? name,
      affectsHead:
        tracks?.some((track) =>
          /(^|[/.])Head\.(?:quaternion|position|scale)(?:$|\[)/.test(track.name),
        ) ?? false,
      affectsNeck:
        tracks?.some((track) =>
          /(^|[/.])Neck\.(?:quaternion|position|scale)(?:$|\[)/.test(track.name),
        ) ?? false,
    }))
}
