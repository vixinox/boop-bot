const vectorSchema = {
  type: 'object',
  properties: {
    x: { type: 'number' },
    y: { type: 'number' },
    z: { type: 'number' },
  },
  required: ['x', 'y', 'z'],
  additionalProperties: false,
}

const positive = { type: 'number', exclusiveMinimum: 0 }
const primitiveDimensions = {
  type: 'object',
  properties: {
    width: positive,
    height: positive,
    depth: positive,
    radius: positive,
    radius_top: positive,
    radius_bottom: positive,
    major_radius: positive,
    tube_radius: positive,
  },
  additionalProperties: false,
}

const primitiveDimensionVariants = {
  box: {
    type: 'object',
    properties: { width: positive, height: positive, depth: positive },
    required: ['width', 'height', 'depth'],
    additionalProperties: false,
  },
  sphere: {
    type: 'object',
    properties: { radius: positive },
    required: ['radius'],
    additionalProperties: false,
  },
  cylinder: {
    type: 'object',
    properties: { radius_top: positive, radius_bottom: positive, height: positive },
    required: ['radius_top', 'radius_bottom', 'height'],
    additionalProperties: false,
  },
  cone: {
    type: 'object',
    properties: { radius: positive, height: positive },
    required: ['radius', 'height'],
    additionalProperties: false,
  },
  torus: {
    type: 'object',
    properties: { major_radius: positive, tube_radius: positive },
    required: ['major_radius', 'tube_radius'],
    additionalProperties: false,
  },
}
const partialPrimitiveDimensionVariants = Object.fromEntries(
  Object.entries(primitiveDimensionVariants).map(([shape, schema]) => [
    shape,
    {
      ...schema,
      required: [],
      minProperties: 1,
    },
  ]),
)

const emptyObject = {
  type: 'object',
  properties: {},
  required: [],
  additionalProperties: false,
}

const expressionCueSchema = {
  type: 'object',
  properties: {
    expression: { type: 'string', enum: ['Angry', 'Surprised', 'Sad'] },
    to: { type: 'number', minimum: 0, maximum: 1 },
    fade_in_ms: { type: 'integer', minimum: 0, maximum: 5000 },
    hold_ms: { type: 'integer', minimum: 0, maximum: 5000 },
    fade_out_ms: { type: 'integer', minimum: 0, maximum: 5000 },
  },
  required: ['expression', 'to', 'fade_in_ms', 'hold_ms', 'fade_out_ms'],
  anyOf: [
    { properties: { fade_in_ms: { minimum: 1 } } },
    { properties: { hold_ms: { minimum: 1 } } },
    { properties: { fade_out_ms: { minimum: 1 } } },
  ],
  additionalProperties: false,
}
const expressionCuesSchema = {
  type: 'array',
  minItems: 1,
  maxItems: 3,
  items: expressionCueSchema,
}

const lightProperties = {
  color: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' },
  intensity: { type: 'number', minimum: 0 },
  position: vectorSchema,
  target: vectorSchema,
  distance: { type: 'number', minimum: 0 },
  angle_deg: { type: 'number', exclusiveMinimum: 0, exclusiveMaximum: 180 },
}

const createLightVariants = [
  {
    properties: { type: { const: 'directional' } },
    not: { anyOf: [{ required: ['distance'] }, { required: ['angle_deg'] }] },
  },
  {
    properties: { type: { const: 'point' } },
    not: { anyOf: [{ required: ['target'] }, { required: ['angle_deg'] }] },
  },
  { properties: { type: { const: 'spot' } } },
]

const updateLightVariants = [
  {
    properties: { type: { const: 'ambient' } },
    not: {
      anyOf: [
        { required: ['position'] },
        { required: ['target'] },
        { required: ['distance'] },
        { required: ['angle_deg'] },
      ],
    },
  },
  {
    properties: { type: { const: 'directional' } },
    not: { anyOf: [{ required: ['distance'] }, { required: ['angle_deg'] }] },
  },
  {
    properties: { type: { const: 'point' } },
    not: { anyOf: [{ required: ['target'] }, { required: ['angle_deg'] }] },
  },
  { properties: { type: { const: 'spot' } } },
]

export const robotTools = [
  {
    type: 'function',
    name: 'perform_companion_action',
    description:
      'Perform one brief, named companion action: greet (Wave), affection (Yes), praise (ThumbsUp), celebrate (Dance), comfort (Yes with a restrained Sad cue), sleep, or wake. Prefer this semantic tool for those intents; do not pass clip names such as ThumbsUp as action values. Sleep keeps looping Idle with a lowered head until wake; wake smoothly raises the head. Other actions play once and return to looping Idle. The action may be suppressed by manual control, direct interaction, or sleep lock; only report it as performed when the tool result says started.',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['greet', 'affection', 'praise', 'celebrate', 'comfort', 'sleep', 'wake'],
        },
      },
      required: ['action'],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'play_expression_timeline',
    description:
      'Play or replace a one-shot expression timeline independently of body animation. It may overlay a conversation-owned local or AI body action without interrupting it. Manual control, direct interaction, sleep, and page suspension suppress this tool. Prefer one primary expression; use 1-3 different expressions only when needed. Each cue sets target weight and explicit fade-in, hold, and fade-out milliseconds; it starts at the currently visible weight and returns to the captured baseline. At least one phase must be greater than 0 ms; each phase is at most 5000 ms and the total is at most 10000 ms. Available expressions are Angry, Surprised, and Sad.',
    parameters: {
      type: 'object',
      properties: { expressions: expressionCuesSchema },
      required: ['expressions'],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'play_animation_timeline',
    description:
      'Play a short, finite sequence using only the supplied AI animation clips. Use repeat_count 1 for one play. Set speed and transition only when they help the request. Choose this tool when body motion and expression must be synchronized; otherwise use play_expression_timeline for expression-only changes. A step may include expression cues with expression, target weight (to), fade_in_ms, hold_ms, and fade_out_ms. At least one phase must be greater than 0 ms. A cue must finish within its animation step and fades back to the captured baseline. On completion or cancellation, the runtime returns to looping Idle and the current conversation phase.',
    parameters: {
      type: 'object',
      properties: {
        steps: {
          type: 'array',
          minItems: 1,
          maxItems: 12,
          items: {
            type: 'object',
            properties: {
              animation: { type: 'string', enum: [] },
              repeat_count: { type: 'integer', minimum: 1, maximum: 5 },
              speed: { type: 'number', minimum: 0.5, maximum: 1.5 },
              transition_ms: { type: 'integer', minimum: 0, maximum: 800 },
              easing: {
                type: 'string',
                enum: ['linear', 'ease_in', 'ease_out', 'ease_in_out'],
              },
              expressions: expressionCuesSchema,
            },
            required: ['animation', 'repeat_count', 'speed', 'transition_ms', 'easing'],
            additionalProperties: false,
          },
        },
      },
      required: ['steps'],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'cancel_companion_presentation',
    description:
      'Cancel the active AI companion action or animation timeline, clear queued AI presentations for this user turn, and return to automatic companion behavior. This does not affect scene animations or manual Inspector control. If manual control is active, cancellation is suppressed.',
    parameters: emptyObject,
  },
  {
    type: 'function',
    name: 'animate_scene_nodes',
    description:
      'Start persistent environment animations for current scene primitive and light IDs. Objects may orbit a center in the XZ plane and/or spin around a normalized axis; periods are milliseconds and phases are degrees. Lights may pulse intensity between min and max. These loops continue until replaced by a new animate_scene_nodes command or stopped with cancel_scene_animations.',
    parameters: {
      type: 'object',
      properties: {
        objects: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              orbit: {
                type: 'object',
                properties: {
                  center: vectorSchema,
                  radius: { type: 'number', minimum: 0 },
                  period_ms: positive,
                  phase_deg: { type: 'number' },
                },
                required: ['center', 'radius', 'period_ms', 'phase_deg'],
                additionalProperties: false,
              },
              spin: {
                type: 'object',
                properties: {
                  axis: vectorSchema,
                  period_ms: positive,
                  phase_deg: { type: 'number' },
                },
                required: ['axis', 'period_ms', 'phase_deg'],
                additionalProperties: false,
              },
            },
            required: ['id'],
            anyOf: [{ required: ['orbit'] }, { required: ['spin'] }],
            additionalProperties: false,
          },
        },
        lights: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              intensity: {
                type: 'object',
                properties: {
                  min: { type: 'number', minimum: 0 },
                  max: { type: 'number', minimum: 0 },
                  period_ms: positive,
                  phase_deg: { type: 'number' },
                },
                required: ['min', 'max', 'period_ms', 'phase_deg'],
                additionalProperties: false,
              },
            },
            required: ['id', 'intensity'],
            additionalProperties: false,
          },
        },
      },
      required: ['objects', 'lights'],
      anyOf: [
        { properties: { objects: { minItems: 1 } } },
        { properties: { lights: { minItems: 1 } } },
      ],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'cancel_scene_animations',
    description:
      'Stop all active scene object and light animations and restore their static values.',
    parameters: emptyObject,
  },
  {
    type: 'function',
    name: 'inspect_scene',
    description:
      'Read the current objects, editable lights, fixed environment lights, robot presentation and camera pose before planning scene changes.',
    parameters: emptyObject,
  },
  {
    type: 'function',
    name: 'create_primitive',
    description:
      'Create one primitive at a position in scene units. Choose exactly one shape and use only its dimensions: box={width,height,depth}; sphere={radius}; cylinder={radius_top,radius_bottom,height}; cone={radius,height}; torus={major_radius,tube_radius}. Do not mix dimensions from different shapes. All dimensions are finite numbers > 0. Color must be #RRGGBB.',
    parameters: {
      type: 'object',
      properties: {
        shape: { type: 'string', enum: ['box', 'sphere', 'cylinder', 'cone', 'torus'] },
        position: vectorSchema,
        dimensions: primitiveDimensions,
        color: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' },
      },
      required: ['shape', 'position', 'dimensions', 'color'],
      additionalProperties: false,
      oneOf: Object.entries(primitiveDimensionVariants).map(([shape, dimensions]) => ({
        properties: { shape: { const: shape }, dimensions },
      })),
    },
  },
  {
    type: 'function',
    name: 'update_primitive',
    description:
      'Update an existing primitive by an ID from the latest inspect_scene result. Its shape cannot change. You may update position, color, or only the dimensions for its current shape: box={width,height,depth}; sphere={radius}; cylinder={radius_top,radius_bottom,height}; cone={radius,height}; torus={major_radius,tube_radius}. All supplied dimensions must be finite and > 0; do not mix shape fields.',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        position: vectorSchema,
        dimensions: primitiveDimensions,
        color: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' },
      },
      required: ['id'],
      additionalProperties: false,
      oneOf: [
        { not: { required: ['dimensions'] } },
        ...Object.values(partialPrimitiveDimensionVariants).map((dimensions) => ({
          required: ['dimensions'],
          properties: { dimensions },
        })),
      ],
    },
  },
  {
    type: 'function',
    name: 'delete_scene_object',
    description:
      'Delete one user-created primitive by an ID from the latest inspect_scene result. Unknown or built-in IDs cannot be deleted.',
    parameters: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'create_light',
    description:
      'Create a directional, point, or spot light using color #RRGGBB, finite non-negative intensity, and position. Directional supports target (default {x:0,y:0,z:0}); point supports distance (default 0); spot supports target, distance (default 0), and angle_deg in (0,180) (default 45). Pass only fields allowed for the selected type.',
    parameters: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['directional', 'point', 'spot'] },
        color: lightProperties.color,
        intensity: lightProperties.intensity,
        position: vectorSchema,
        target: vectorSchema,
        distance: lightProperties.distance,
        angle_deg: lightProperties.angle_deg,
      },
      required: ['type', 'color', 'intensity', 'position'],
      oneOf: createLightVariants,
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'update_light',
    description:
      'Update a light by an ID from the latest scene snapshot. Include its current type exactly as reported: ambient supports color/intensity; directional supports color/intensity/position/target; point supports color/intensity/position/distance; spot supports color/intensity/position/target/distance/angle_deg. Built-in lights may be edited but not deleted or retyped. Colors are #RRGGBB and numeric values must be finite and within the documented ranges.',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        type: { type: 'string', enum: ['ambient', 'directional', 'point', 'spot'] },
        color: lightProperties.color,
        intensity: lightProperties.intensity,
        position: vectorSchema,
        target: vectorSchema,
        distance: lightProperties.distance,
        angle_deg: lightProperties.angle_deg,
      },
      required: ['id', 'type'],
      oneOf: updateLightVariants,
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'delete_light',
    description:
      'Delete one user-created light by an ID from the latest inspect_scene result. Built-in lights cannot be deleted.',
    parameters: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'set_camera_pose',
    description:
      'Move the existing camera using position and a different look-at target in scene units, FOV in (0,180) degrees, and duration_ms from 200 to 1500. Do not create another camera or pass equal position and target.',
    parameters: {
      type: 'object',
      properties: {
        position: vectorSchema,
        target: vectorSchema,
        fov: { type: 'number', exclusiveMinimum: 0, exclusiveMaximum: 180 },
        duration_ms: { type: 'integer', minimum: 200, maximum: 1500 },
      },
      required: ['position', 'target', 'fov', 'duration_ms'],
      additionalProperties: false,
    },
  },
] as const

type ToolDefinition = {
  type: 'function'
  name: string
  description: string
  parameters: { type: 'object'; properties?: Record<string, any>; [key: string]: unknown }
}

type ToolCapabilities = {
  animations?: unknown
}

const NON_AI_ANIMATIONS = new Set(['Death', 'Punch'])

export function robotToolsFor(value: unknown) {
  const tools = structuredClone(robotTools) as unknown as ToolDefinition[]
  const capabilities = (
    value && typeof value === 'object' ? value : {}
  ) as ToolCapabilities
  const animations = Array.isArray(capabilities.animations)
    ? capabilities.animations
        .flatMap((item) => {
          if (typeof item === 'string') return [item]
          if (!item || typeof item !== 'object') return []
          const name = (item as { name?: unknown }).name
          return typeof name === 'string' ? [name] : []
        })
        .filter((name) => !NON_AI_ANIMATIONS.has(name))
    : []
  const timeline = tools.find((tool) => tool.name === 'play_animation_timeline')
  const step = timeline?.parameters.properties?.steps?.items
  if (step?.properties?.animation) step.properties.animation.enum = animations
  return tools
}
