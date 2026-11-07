import { describe, expect, it } from 'vitest'
import { initialBehaviorState, transitionBehavior } from './behaviorPolicy'

describe('transitionBehavior', () => {
  it('starts in available under ambient ownership, independent of animation-store defaults', () => {
    expect(initialBehaviorState).toMatchObject({
      phase: 'available',
      emotion: 'neutral',
      controlMode: 'auto',
      owner: 'ambient',
    })
  })

  it('keeps emotion independent from chat phases and does not repeat an unchanged entry action', () => {
    const happy = transitionBehavior(
      initialBehaviorState,
      { type: 'semantic_action_requested', action: 'praise', source: 'shortcut' },
      1,
    )
    expect(happy.state).toMatchObject({
      emotion: 'happy',
      activeReaction: { action: 'praise' },
    })
    const same = transitionBehavior(
      happy.state,
      { type: 'emotion_changed', emotion: 'happy' },
      2,
    )
    expect(same.intents).toEqual([])
    const processing = transitionBehavior(
      happy.state,
      { type: 'conversation_processing' },
      2,
    )
    expect(processing.state).toMatchObject({ emotion: 'happy', phase: 'thinking' })
  })

  it('keeps sleep locked, allows explicit wake, and represents sleep without a clip action', () => {
    const asleep = transitionBehavior(
      initialBehaviorState,
      { type: 'semantic_action_requested', action: 'sleep', source: 'shortcut' },
      1,
    )
    expect(asleep.state).toMatchObject({
      emotion: 'sleepy',
      activeReaction: { action: 'sleep', persistent: true },
    })
    expect(
      transitionBehavior(
        asleep.state,
        { type: 'semantic_action_requested', action: 'celebrate', source: 'model' },
        2,
      ).state,
    ).toBe(asleep.state)
    const wake = transitionBehavior(
      asleep.state,
      { type: 'semantic_action_requested', action: 'wake', source: 'shortcut' },
      2,
    )
    expect(wake.state).toMatchObject({
      emotion: 'neutral',
      activeReaction: { action: 'wake' },
    })
    expect(wake.intents).toContainEqual({
      type: 'cancel_reaction',
      reactionId: 1,
      reason: 'replaced_by_semantic_action',
    })
  })

  it('queues a direct shortcut action after the wake transition completes', () => {
    const asleep = transitionBehavior(
      initialBehaviorState,
      { type: 'semantic_action_requested', action: 'sleep', source: 'shortcut' },
      1,
    ).state
    const wake = transitionBehavior(
      asleep,
      { type: 'semantic_action_requested', action: 'praise', source: 'shortcut' },
      2,
    )
    expect(wake.state).toMatchObject({
      emotion: 'neutral',
      activeReaction: { action: 'wake', followupAction: 'praise' },
    })
    const praised = transitionBehavior(
      wake.state,
      { type: 'reaction_completed', reactionId: wake.state.activeReaction!.id },
      3,
    )
    expect(praised.state).toMatchObject({
      emotion: 'happy',
      owner: 'direct_interaction',
      activeReaction: { action: 'praise', owner: 'direct_interaction' },
    })
    expect(praised.intents).toContainEqual({
      type: 'start_reaction',
      reaction: praised.state.activeReaction,
    })
    expect(
      transitionBehavior(
        praised.state,
        { type: 'reaction_completed', reactionId: wake.state.activeReaction!.id },
        4,
      ).state.activeReaction,
    ).toBe(praised.state.activeReaction)
  })

  it('suppresses model semantic actions during manual ownership without changing the scene-facing state', () => {
    const manual = transitionBehavior(
      initialBehaviorState,
      { type: 'manual_takeover' },
      1,
    ).state
    const suppressed = transitionBehavior(
      manual,
      { type: 'semantic_action_requested', action: 'greet', source: 'model' },
      2,
    )
    expect(suppressed.state).toBe(manual)
    expect(suppressed.intents).toEqual([])
  })

  it('moves through the conversation phase lifecycle and returns after settling expiry', () => {
    let state = initialBehaviorState
    for (const [event, phase] of [
      [{ type: 'conversation_submitted' }, 'listening'],
      [{ type: 'conversation_processing' }, 'thinking'],
      [{ type: 'conversation_text_started' }, 'responding'],
      [{ type: 'conversation_tool_started' }, 'thinking'],
      [{ type: 'conversation_text_started' }, 'responding'],
      [{ type: 'conversation_failed' }, 'settling'],
      [{ type: 'idle_deadline' }, 'available'],
    ] as const) {
      state = transitionBehavior(state, event, 1).state
      expect(state.phase).toBe(phase)
    }
  })

  it('keeps direct interaction ownership while conversation phase changes underneath it', () => {
    const started = transitionBehavior(
      initialBehaviorState,
      { type: 'avatar_touch_started', region: 'head' },
      1,
    ).state
    const thinking = transitionBehavior(
      started,
      { type: 'conversation_processing' },
      2,
    ).state
    expect(thinking).toMatchObject({ phase: 'thinking', owner: 'direct_interaction' })
    expect(thinking.activeReaction?.kind).toBe('head_affection')

    const recovered = transitionBehavior(
      thinking,
      { type: 'reaction_completed', reactionId: 1 },
      3,
    ).state
    expect(recovered).toMatchObject({
      phase: 'thinking',
      owner: 'conversation',
      activeReaction: null,
    })
  })

  it('copies only finite touch targets into the reaction contract', () => {
    const valid = transitionBehavior(
      initialBehaviorState,
      {
        type: 'avatar_touch_started',
        region: 'torso',
        point: { x: 0.2, y: 1, z: -0.4 },
      },
      1,
    ).state
    expect(valid.activeReaction?.target).toEqual({ x: 0.2, y: 1, z: -0.4 })

    const invalid = transitionBehavior(
      initialBehaviorState,
      {
        type: 'avatar_touch_started',
        region: 'torso',
        point: { x: Number.NaN, y: 1, z: 0 },
      },
      1,
    ).state
    expect(invalid.activeReaction).not.toHaveProperty('target')
  })

  it('ignores completion from a replaced reaction', () => {
    const original = transitionBehavior(
      initialBehaviorState,
      { type: 'ai_action_started', action: 'Wave' },
      1,
    ).state
    const replaced = transitionBehavior(
      original,
      { type: 'avatar_touch_started', region: 'head' },
      2,
    )
    const late = transitionBehavior(
      replaced.state,
      { type: 'reaction_completed', reactionId: 1 },
      3,
    )
    expect(replaced.intents).toContainEqual({
      type: 'cancel_reaction',
      reactionId: 1,
      reason: 'replaced_by_direct_interaction',
    })
    expect(replaced.state.activeReaction?.id).toBe(2)
    expect(late.state.activeReaction?.id).toBe(2)
    expect(late.intents).toEqual([])
  })

  it('does not allow AI choreography to replace a direct user reaction', () => {
    const touched = transitionBehavior(
      initialBehaviorState,
      { type: 'avatar_touch_started', region: 'hand' },
      1,
    ).state
    const aiAction = transitionBehavior(
      touched,
      { type: 'ai_action_started', action: 'ThumbsUp' },
      2,
    )
    expect(aiAction.state.activeReaction?.id).toBe(1)
    expect(aiAction.intents).toEqual([])
  })

  it('cancels temporary ownership on manual takeover and waits for explicit resume', () => {
    const active = transitionBehavior(
      initialBehaviorState,
      { type: 'avatar_touch_started', region: 'torso' },
      1,
    ).state
    const manual = transitionBehavior(active, { type: 'manual_takeover' }, 2)
    expect(manual.state).toMatchObject({
      controlMode: 'manual',
      owner: 'manual',
      activeReaction: null,
    })
    expect(manual.intents).toContainEqual({
      type: 'cancel_reaction',
      reactionId: 1,
      reason: 'manual_takeover',
    })
    const resumed = transitionBehavior(
      manual.state,
      { type: 'resume_companion' },
      3,
    ).state
    expect(resumed.owner).toBe('ambient')
    expect(resumed.controlMode).toBe('auto')
  })

  it('makes Auto recovery idempotent, cancels temporary actions, and preserves sleepy emotion', () => {
    const sleeping = transitionBehavior(
      initialBehaviorState,
      { type: 'semantic_action_requested', action: 'sleep', source: 'shortcut' },
      1,
    ).state
    const manual = transitionBehavior(sleeping, { type: 'manual_takeover' }, 2).state
    expect(manual).toMatchObject({ controlMode: 'manual', emotion: 'sleepy' })

    const recovered = transitionBehavior(manual, { type: 'resume_companion' }, 3)
    expect(recovered.state).toMatchObject({
      controlMode: 'auto',
      owner: 'ambient',
      emotion: 'sleepy',
      activeReaction: null,
    })
    expect(recovered.intents).toEqual([])
    const repeated = transitionBehavior(recovered.state, { type: 'resume_companion' }, 4)
    expect(repeated.state.controlMode).toBe('auto')
    expect(repeated.intents).toEqual([])
  })

  it('allows Auto recovery to cancel a temporary reaction without changing the phase', () => {
    const thinking = transitionBehavior(
      initialBehaviorState,
      { type: 'conversation_processing' },
      1,
    ).state
    const reacting = transitionBehavior(
      thinking,
      { type: 'ai_action_started', action: 'Wave' },
      1,
    ).state
    const recovered = transitionBehavior(reacting, { type: 'resume_companion' }, 2)
    expect(recovered.state).toMatchObject({
      controlMode: 'auto',
      phase: 'thinking',
      owner: 'conversation',
      activeReaction: null,
    })
    expect(recovered.intents).toContainEqual({
      type: 'cancel_reaction',
      reactionId: 1,
      reason: 'resume_auto',
    })
  })

  it('suspends safely and resumes without an overdue temporary reaction', () => {
    const active = transitionBehavior(
      initialBehaviorState,
      { type: 'avatar_touch_started', region: 'hand' },
      1,
    ).state
    const hidden = transitionBehavior(active, { type: 'page_hidden' }, 2)
    expect(hidden.state).toMatchObject({ phase: 'suspended', activeReaction: null })
    expect(hidden.intents).toContainEqual({
      type: 'cancel_reaction',
      reactionId: 1,
      reason: 'page_hidden',
    })
    const visible = transitionBehavior(hidden.state, { type: 'page_visible' }, 3).state
    expect(visible).toMatchObject({
      phase: 'available',
      owner: 'ambient',
      activeReaction: null,
    })
  })

  it('ignores conversation events during suspension but tracks phase under manual ownership', () => {
    const hidden = transitionBehavior(
      initialBehaviorState,
      { type: 'page_hidden' },
      1,
    ).state
    expect(transitionBehavior(hidden, { type: 'conversation_processing' }, 2).state).toBe(
      hidden,
    )
    const manual = transitionBehavior(
      initialBehaviorState,
      { type: 'manual_takeover' },
      1,
    ).state
    expect(
      transitionBehavior(manual, { type: 'conversation_processing' }, 2).state,
    ).toMatchObject({ phase: 'thinking', owner: 'manual' })
  })

  it('preserves manual ownership across page suspension until explicit resume', () => {
    const manual = transitionBehavior(
      initialBehaviorState,
      { type: 'manual_takeover' },
      1,
    ).state
    const hidden = transitionBehavior(manual, { type: 'page_hidden' }, 2).state
    const visible = transitionBehavior(hidden, { type: 'page_visible' }, 3).state
    expect(visible.owner).toBe('manual')
    expect(transitionBehavior(visible, { type: 'resume_companion' }, 4).state.owner).toBe(
      'ambient',
    )
  })

  it('settles beneath manual ownership so resume cannot leave a stale settling phase', () => {
    const settled = transitionBehavior(
      initialBehaviorState,
      { type: 'conversation_turn_finished' },
      1,
    ).state
    const manual = transitionBehavior(settled, { type: 'manual_takeover' }, 2).state
    const deadline = transitionBehavior(manual, { type: 'idle_deadline' }, 3).state
    expect(deadline).toMatchObject({ phase: 'available', owner: 'manual' })
    expect(
      transitionBehavior(deadline, { type: 'resume_companion' }, 4).state,
    ).toMatchObject({
      phase: 'available',
      owner: 'ambient',
    })
  })
})
