import { describe, expect, it } from 'vitest'
import { COMPANION_INSTRUCTIONS, responseInstructions } from './persona.js'

describe('companion instructions', () => {
  it('defines performance layers and task-first visual pacing', () => {
    expect(COMPANION_INSTRUCTIONS).toContain('环境层')
    expect(COMPANION_INSTRUCTIONS).toContain('角色表演层')
    expect(COMPANION_INSTRUCTIONS).toContain('开场、进展、收尾')
    expect(COMPANION_INSTRUCTIONS).toContain('轻量的聆听、思考、回应阶段反馈')
    expect(COMPANION_INSTRUCTIONS).toContain('不要为了每条消息或每段流式文本调用全身动作')
    expect(COMPANION_INSTRUCTIONS).toContain(
      '普通闲聊、无法判断的含糊语句及严肃/敏感而不适合表演的语境不触发表情',
    )
    expect(COMPANION_INSTRUCTIONS).toContain('简单修改保持轻量')
    expect(COMPANION_INSTRUCTIONS).toContain('明显改善构图、重点展示或收尾')
    expect(COMPANION_INSTRUCTIONS).toContain('场景任务成功的前提')
    expect(COMPANION_INSTRUCTIONS).toContain('不得假定存在 Happy morph')
    expect(COMPANION_INSTRUCTIONS).toContain('明确赞许调用 action=praise')
    expect(COMPANION_INSTRUCTIONS).toContain(
      'perform_companion_action 只接受注册语义动作',
    )
    expect(COMPANION_INSTRUCTIONS).toContain('sleep 保持循环 Idle 并低头')
    expect(COMPANION_INSTRUCTIONS).toContain('表情仅使用 Angry、Surprised、Sad')
    expect(COMPANION_INSTRUCTIONS).toContain(
      '不得假定存在 Happy morph、眨眼、摸头专用动作',
    )
    expect(COMPANION_INSTRUCTIONS).toContain(
      '其他动作播放一次后回到循环 Idle 和当前对话阶段',
    )
    expect(COMPANION_INSTRUCTIONS).toContain('点按反应由本地运行时处理')
    expect(COMPANION_INSTRUCTIONS).toContain('一般用户文本情绪由本地规则路由')
    expect(COMPANION_INSTRUCTIONS).toContain('我今天心情不好')
    expect(COMPANION_INSTRUCTIONS).toContain(
      '不得因其不是强烈情绪而一概省略表情',
    )
    expect(COMPANION_INSTRUCTIONS).toContain('只保留最新的一条独立表情时间线')
    expect(COMPANION_INSTRUCTIONS).toContain('"expression":"Surprised"')
    expect(COMPANION_INSTRUCTIONS).toContain('play_expression_timeline')
    expect(COMPANION_INSTRUCTIONS).toContain('fade_in_ms、hold_ms、fade_out_ms')
    expect(COMPANION_INSTRUCTIONS).toContain('Happy morph 不存在')
    expect(COMPANION_INSTRUCTIONS).not.toContain('保持最后姿态')
    expect(COMPANION_INSTRUCTIONS).toContain('纯色')
    expect(COMPANION_INSTRUCTIONS).toContain('先读取当前快照并据此规划')
  })

  it('injects current capability and scene snapshots on every response', () => {
    const snapshot = {
      animations: [{ name: 'Wave', duration: 1 }],
      scene: { objects: [{ id: 'object-1', shape: 'sphere' }], lights: [] },
      camera: { fov: 34 },
    }
    for (const continuation of [false, true]) {
      const instructions = responseInstructions(continuation, snapshot)
      expect(instructions).toContain(COMPANION_INSTRUCTIONS)
      expect(instructions).toContain('object-1')
      expect(instructions).toContain('"fov":34')
    }
  })

  it('adds a truthful no-more-tools wrap-up rule when the budget is exhausted', () => {
    const instructions = responseInstructions(true, { scene: {} }, true)
    expect(instructions).toContain('工具调用预算已耗尽')
    expect(instructions).toContain('不得再请求或声称执行任何工具操作')
    expect(instructions).toContain('不要把未确认变更说成成功')
  })
})
