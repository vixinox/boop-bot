import type { SemanticAction } from '../state/behaviorPolicy'
import type { AnimationName, ExpressionCue } from '../state/companionStore'

export type CompanionActionPresentation = {
  animation?: AnimationName
  expressions?: ExpressionCue[]
  pose?: 'sleep' | 'wake'
}

export const SEMANTIC_ACTIONS: readonly SemanticAction[] = [
  'greet',
  'affection',
  'praise',
  'celebrate',
  'comfort',
  'sleep',
  'wake',
]

const presentations: Record<SemanticAction, CompanionActionPresentation> = {
  greet: { animation: 'Wave' },
  affection: { animation: 'Yes' },
  praise: { animation: 'ThumbsUp' },
  celebrate: { animation: 'Dance' },
  comfort: {
    animation: 'Yes',
    expressions: [
      { expression: 'Sad', to: 0.38, fade_in_ms: 150, hold_ms: 500, fade_out_ms: 250 },
    ],
  },
  sleep: { pose: 'sleep' },
  wake: { pose: 'wake' },
}

export function companionActionPresentation(action: SemanticAction) {
  return presentations[action]
}
