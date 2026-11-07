import type { CompanionEmotion, SemanticAction } from './behaviorPolicy'

export type EmotionRoute = {
  emotion: CompanionEmotion
  action?: SemanticAction
}

const wakePhrases = ['醒醒', '醒一醒', '叫醒', '起床', '别睡了']
const sleepPhrases = ['哄你睡', '睡觉', '去睡', '睡吧', '晚安', '好困', '困死', '想睡']
const comfortPhrases = [
  '没完成',
  '没有完成',
  '没成功',
  '没有成功',
  '不喜欢',
  '不高兴',
  '开心不起来',
  '难过',
  '伤心',
  '失落',
  '委屈',
  '焦虑',
  '沮丧',
  '不开心',
  '心情不好',
  '心情不太好',
  '心情不怎么好',
  '心情有点差',
  '压力好大',
  '好失败',
  '做不好',
  '糟透了',
  '很糟',
]
const happyPhrases = [
  '太好了',
  '好开心',
  '很开心',
  '开心',
  '高兴',
  '成功了',
  '完成了',
  '做到了',
  '好棒',
  '真棒',
  '喜欢你',
  '谢谢你',
  '好耶',
]

function includesAny(text: string, phrases: string[]) {
  return phrases.some((phrase) => text.includes(phrase))
}

export function routeEmotion(text: string, current: CompanionEmotion): EmotionRoute {
  const normalized = text.trim().toLocaleLowerCase()
  if (!normalized) return { emotion: 'neutral' }

  if (includesAny(normalized, wakePhrases)) return { emotion: 'neutral', action: 'wake' }
  if (current === 'sleepy') return { emotion: 'sleepy' }

  if (includesAny(normalized, sleepPhrases)) {
    return { emotion: 'sleepy', action: 'sleep' }
  }
  if (includesAny(normalized, comfortPhrases)) {
    return current === 'comfort'
      ? { emotion: 'comfort' }
      : { emotion: 'comfort', action: 'comfort' }
  }
  if (includesAny(normalized, happyPhrases)) {
    return current === 'happy'
      ? { emotion: 'happy' }
      : { emotion: 'happy', action: 'praise' }
  }
  return { emotion: 'neutral' }
}
