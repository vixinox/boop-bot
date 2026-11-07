import { afterEach, describe, expect, it } from 'vitest'
import { dispatchBehaviorEvent, useBehaviorStore } from '../state/behaviorStore'
import { createSceneSnapshot } from './sceneSnapshot'

describe('createSceneSnapshot behavior context', () => {
  afterEach(() => useBehaviorStore.getState().resetBehavior())

  it('publishes companion emotion, conversation phase, and owner as read-only context', () => {
    dispatchBehaviorEvent({
      type: 'semantic_action_requested',
      action: 'praise',
      source: 'shortcut',
    })
    dispatchBehaviorEvent({ type: 'conversation_processing' })

    expect(createSceneSnapshot().robot).toMatchObject({
      emotion: 'happy',
      behaviorPhase: 'thinking',
      behaviorOwner: 'direct_interaction',
    })
  })
})
