import { describe, expect, it } from 'vitest'
import {
  makeToolCallEvent,
  responseStreamOutcome,
  responseFailureDetails,
} from './protocol.js'

describe('Responses function-call continuation protocol', () => {
  it('returns call_id rather than the function-call item id', () => {
    expect(
      makeToolCallEvent(
        { id: 'fc_item_123', call_id: 'call_456', name: 'play_animation_timeline' },
        { outputIndex: 2, arguments: '{"animation":"Dance"}' },
        'resp_789',
      ),
    ).toEqual({
      callId: 'call_456',
      itemId: 'fc_item_123',
      outputIndex: 2,
      name: 'play_animation_timeline',
      arguments: '{"animation":"Dance"}',
      responseId: 'resp_789',
    })
  })

  it('turns successful tool responses into a continuation signal', () => {
    expect(responseStreamOutcome('response.completed', true)).toBe('awaiting_tools')
  })

  it('surfaces failed or incomplete upstream terminal events instead of silently ending SSE', () => {
    expect(responseStreamOutcome('response.failed', false)).toBe('error')
    expect(responseStreamOutcome('response.incomplete', false)).toBe('error')
    expect(responseStreamOutcome('response.completed', false)).toBe('message_done')
  })

  it('preserves safe upstream failure details for diagnosis', () => {
    expect(
      responseFailureDetails({
        type: 'response.failed',
        response: {
          error: {
            code: 'invalid_previous_response',
            type: 'invalid_request_error',
            message: 'Previous response is unavailable',
          },
        },
      }),
    ).toEqual({
      code: 'invalid_previous_response',
      type: 'invalid_request_error',
      upstreamMessage: 'Previous response is unavailable',
    })
    expect(
      responseFailureDetails({
        type: 'response.incomplete',
        response: { incomplete_details: { reason: 'max_output_tokens' } },
      }),
    ).toEqual({ reason: 'max_output_tokens' })
  })
})
