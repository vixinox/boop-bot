import { describe, expect, it, vi } from 'vitest'
import { chatBehaviorEvent, createToolCallBudget, continueToolRounds } from './chatFlow'

describe('chat behavior lifecycle mapping', () => {
  it('maps accepted chat phases to the shared behavior contract', () => {
    expect(chatBehaviorEvent('submitted')).toEqual({ type: 'conversation_submitted' })
    expect(chatBehaviorEvent('processing')).toEqual({ type: 'conversation_processing' })
    expect(chatBehaviorEvent('text_started')).toEqual({
      type: 'conversation_text_started',
    })
    expect(chatBehaviorEvent('tool_started')).toEqual({
      type: 'conversation_tool_started',
    })
    expect(chatBehaviorEvent('finished')).toEqual({ type: 'conversation_turn_finished' })
    expect(chatBehaviorEvent('failed')).toEqual({ type: 'conversation_failed' })
  })
})

describe('chat tool continuation', () => {
  it('enforces the per-message tool budget at the actual execution boundary', () => {
    const budget = createToolCallBudget(50)
    for (let call = 1; call <= 49; call += 1) expect(budget.tryConsume()).toBe(true)
    expect(budget.isExhausted()).toBe(false)
    expect(budget.tryConsume()).toBe(true)
    expect(budget.executed()).toBe(50)
    expect(budget.isExhausted()).toBe(true)
    expect(budget.tryConsume()).toBe(false)
    expect(budget.executed()).toBe(50)
  })

  it('replays local history, full model output items, and tool results across rounds', async () => {
    const consume = vi
      .fn()
      .mockResolvedValueOnce({
        responseId: 'resp-tools-2',
        awaitingTools: true,
        text: 'Preparing another gesture.',
        responseItems: [
          {
            type: 'message',
            role: 'assistant',
            content: [{ type: 'output_text', text: 'Preparing another gesture.' }],
          },
          {
            id: 'fc-2',
            type: 'function_call',
            call_id: 'call-2',
            name: 'create_primitive',
            arguments: '{"shape":"sphere"}',
            status: 'completed',
          },
        ],
        outputs: [
          {
            callId: 'call-2',
            result: { ok: true },
          },
        ],
        receivedEvent: true,
      })
      .mockResolvedValueOnce({
        responseId: 'resp-final',
        outputs: [],
        receivedEvent: true,
        text: 'Done.',
      })
    const history = [{ role: 'user', content: 'wave' }]
    const updates: unknown[][] = []
    let snapshotRevision = 0
    const result = await continueToolRounds(
      {
        responseId: 'resp-tools',
        awaitingTools: true,
        text: 'Starting.',
        responseItems: [
          {
            type: 'message',
            role: 'assistant',
            content: [{ type: 'output_text', text: 'Starting.' }],
          },
          {
            id: 'fc-1',
            type: 'function_call',
            call_id: 'call-1',
            name: 'play_animation_timeline',
            arguments: '{"steps":[]}',
            status: 'completed',
          },
        ],
        outputs: [
          {
            callId: 'call-1',
            result: {
              ok: false,
              toolName: 'create_primitive',
              error: {
                code: 'INVALID_DIMENSIONS_FOR_SHAPE',
                message: 'box dimensions contain unsupported fields',
                path: 'dimensions',
                expected: 'width, height, depth',
                repair: 'Keep only width, height, and depth.',
              },
            },
          },
        ],
        receivedEvent: true,
      },
      consume,
      new AbortController().signal,
      () => ({ sceneRevision: ++snapshotRevision }),
      history,
      (nextHistory) => updates.push(nextHistory),
    )
    expect(consume).toHaveBeenNthCalledWith(
      1,
      '/api/chat/continue',
      {
        input: [
          { role: 'user', content: 'wave' },
          {
            type: 'message',
            role: 'assistant',
            content: [{ type: 'output_text', text: 'Starting.' }],
          },
          {
            id: 'fc-1',
            type: 'function_call',
            call_id: 'call-1',
            name: 'play_animation_timeline',
            arguments: '{"steps":[]}',
            status: 'completed',
          },
          {
            type: 'function_call_output',
            call_id: 'call-1',
            output:
              '{"ok":false,"toolName":"create_primitive","error":{"code":"INVALID_DIMENSIONS_FOR_SHAPE","message":"box dimensions contain unsupported fields","path":"dimensions","expected":"width, height, depth","repair":"Keep only width, height, and depth."}}',
          },
        ],
        capabilities: { sceneRevision: 1 },
        toolBudgetExhausted: false,
      },
      expect.any(AbortSignal),
    )
    const secondBody = consume.mock.calls[1][1] as { input: unknown[] }
    expect(secondBody.input).toHaveLength(7)
    expect(secondBody.input[4]).toEqual({
      type: 'message',
      role: 'assistant',
      content: [{ type: 'output_text', text: 'Preparing another gesture.' }],
    })
    expect(secondBody.input[5]).toEqual({
      id: 'fc-2',
      type: 'function_call',
      call_id: 'call-2',
      name: 'create_primitive',
      arguments: '{"shape":"sphere"}',
      status: 'completed',
    })
    expect(secondBody.input.slice(-2)).toEqual([
      {
        id: 'fc-2',
        type: 'function_call',
        call_id: 'call-2',
        name: 'create_primitive',
        arguments: '{"shape":"sphere"}',
        status: 'completed',
      },
      { type: 'function_call_output', call_id: 'call-2', output: '{"ok":true}' },
    ])
    expect(result.turn.responseId).toBe('resp-final')
    expect(result.turn.text).toBe('Done.')
    expect(result.history).toHaveLength(7)
    expect(updates).toHaveLength(2)
    expect((consume.mock.calls[1][1] as { capabilities: unknown }).capabilities).toEqual({
      sceneRevision: 2,
    })
  })

  it('fails visibly instead of leaving a turn open when a continuation has no outputs', async () => {
    await expect(
      continueToolRounds(
        {
          responseId: 'resp-tools',
          awaitingTools: true,
          outputs: [],
          receivedEvent: true,
        },
        vi.fn(),
        new AbortController().signal,
      ),
    ).rejects.toThrow('工具调用结果缺失')
  })

  it('continues through more than four tool rounds until the model finishes', async () => {
    const consume = vi.fn<(...args: any[]) => Promise<any>>()
    for (let round = 1; round <= 5; round += 1)
      consume.mockResolvedValueOnce({
        responseId: `resp-${round}`,
        awaitingTools: true,
        outputs: [{ callId: `call-${round}`, result: { ok: true } }],
        responseItems: [{ type: 'function_call', call_id: `call-${round}` }],
        receivedEvent: true,
      })
    consume.mockResolvedValueOnce({
      responseId: 'resp-final',
      outputs: [],
      text: 'Finished',
      receivedEvent: true,
    })

    const result = await continueToolRounds(
      {
        responseId: 'resp-initial',
        awaitingTools: true,
        outputs: [{ callId: 'call-initial', result: { ok: true } }],
        responseItems: [{ type: 'function_call', call_id: 'call-initial' }],
        receivedEvent: true,
      },
      consume,
      new AbortController().signal,
    )

    expect(consume).toHaveBeenCalledTimes(6)
    expect(result.turn.text).toBe('Finished')
  })

  it('requires the complete model output context before replaying tool results', async () => {
    await expect(
      continueToolRounds(
        {
          awaitingTools: true,
          outputs: [{ callId: 'call-1', result: { ok: true } }],
          receivedEvent: true,
        },
        vi.fn(),
        new AbortController().signal,
      ),
    ).rejects.toThrow('模型工具调用上下文缺失')
  })

  it('marks the post-budget continuation so it can finish without tools', async () => {
    const consume = vi.fn().mockResolvedValue({
      responseId: 'resp-final',
      outputs: [],
      receivedEvent: true,
      text: '已完成部分布景，其余未完成。',
    })
    const result = await continueToolRounds(
      {
        responseId: 'resp-tools',
        awaitingTools: true,
        outputs: [{ callId: 'call-50', result: { ok: true } }],
        responseItems: [{ type: 'function_call', call_id: 'call-50' }],
        receivedEvent: true,
      },
      consume,
      new AbortController().signal,
      undefined,
      [{ role: 'user', content: 'make a scene' }],
      undefined,
      () => true,
    )
    expect(consume.mock.calls[0][1]).toMatchObject({ toolBudgetExhausted: true })
    expect(result.turn.text).toContain('其余未完成')
  })

  it('stops if the no-tool wrap-up unexpectedly returns another tool call', async () => {
    const consume = vi.fn().mockResolvedValue({
      responseId: 'resp-invalid-wrap-up',
      awaitingTools: true,
      outputs: [{ callId: 'call-extra', result: { ok: false } }],
      responseItems: [{ type: 'function_call', call_id: 'call-extra' }],
      receivedEvent: true,
    })
    await expect(
      continueToolRounds(
        {
          responseId: 'resp-tools',
          awaitingTools: true,
          outputs: [{ callId: 'call-50', result: { ok: true } }],
          responseItems: [{ type: 'function_call', call_id: 'call-50' }],
          receivedEvent: true,
        },
        consume,
        new AbortController().signal,
        undefined,
        [],
        undefined,
        () => true,
      ),
    ).rejects.toThrow('收尾响应仍请求工具')
    expect(consume).toHaveBeenCalledTimes(1)
  })
})
