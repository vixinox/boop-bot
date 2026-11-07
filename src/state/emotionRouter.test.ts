import { describe, expect, it } from 'vitest'
import { routeEmotion } from './emotionRouter'

describe('routeEmotion', () => {
  it('routes explicit Chinese positive, comfort, and sleep language', () => {
    expect(routeEmotion('项目终于完成了，好开心！', 'neutral')).toEqual({
      emotion: 'happy',
      action: 'praise',
    })
    expect(routeEmotion('今天很难过，感觉什么都做不好', 'neutral')).toEqual({
      emotion: 'comfort',
      action: 'comfort',
    })
    expect(routeEmotion('我今天心情不好', 'neutral')).toEqual({
      emotion: 'comfort',
      action: 'comfort',
    })
    expect(routeEmotion('心情不太好', 'neutral')).toEqual({
      emotion: 'comfort',
      action: 'comfort',
    })
    expect(routeEmotion('晚安，去睡吧', 'neutral')).toEqual({
      emotion: 'sleepy',
      action: 'sleep',
    })
  })

  it('returns to neutral when the message has no clear emotional signal', () => {
    expect(routeEmotion('把太阳放在行星中间', 'happy')).toEqual({ emotion: 'neutral' })
    expect(routeEmotion('我没完成这个项目', 'happy')).toEqual({
      emotion: 'comfort',
      action: 'comfort',
    })
  })

  it('does not replay an entry action for repeated mood messages', () => {
    expect(routeEmotion('今天好开心', 'happy')).toEqual({ emotion: 'happy' })
  })

  it('keeps the sleepy lock until an explicit wake phrase', () => {
    expect(routeEmotion('我今天完成项目了，好开心', 'sleepy')).toEqual({
      emotion: 'sleepy',
    })
    expect(routeEmotion('醒醒，我们继续做太阳系', 'sleepy')).toEqual({
      emotion: 'neutral',
      action: 'wake',
    })
  })
})
