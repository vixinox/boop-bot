import { describe, expect, it } from 'vitest'
import { robotTools, robotToolsFor } from './tools.js'

describe('runtime companion tool schemas', () => {
  it('exposes finite semantic actions, timelines, and scene tools without bone controls', () => {
    expect(robotTools.map((tool) => tool.name)).toEqual([
      'perform_companion_action',
      'play_expression_timeline',
      'play_animation_timeline',
      'cancel_companion_presentation',
      'animate_scene_nodes',
      'cancel_scene_animations',
      'inspect_scene',
      'create_primitive',
      'update_primitive',
      'delete_scene_object',
      'create_light',
      'update_light',
      'delete_light',
      'set_camera_pose',
    ])
    const serialized = JSON.stringify(robotTools)
    expect(serialized).not.toContain('play_choreography')
    expect(serialized).not.toContain('set_attention')
    expect(serialized).toContain('fade_in_ms')
    expect(serialized).not.toContain('joints')
    expect(
      robotTools.find((tool) => tool.name === 'play_animation_timeline')?.description,
    ).toContain('returns to looping Idle')
    expect(
      robotTools.find((tool) => tool.name === 'play_expression_timeline')?.description,
    ).toContain('fade-out milliseconds')
    expect(
      robotTools.find((tool) => tool.name === 'perform_companion_action')?.parameters,
    ).toMatchObject({
      required: ['action'],
      additionalProperties: false,
      properties: {
        action: {
          enum: ['greet', 'affection', 'praise', 'celebrate', 'comfort', 'sleep', 'wake'],
        },
      },
    })
    expect(
      robotTools.find((tool) => tool.name === 'perform_companion_action')?.description,
    ).toContain('do not pass clip names such as ThumbsUp as action values')
  })

  it('uses only loaded AI clips and excludes Death and Punch', () => {
    const tools = robotToolsFor({
      animations: [
        { name: 'Idle', duration: 2, description: '站立呼吸' },
        { name: 'Wave', duration: 1, description: '挥手' },
        { name: 'Death', duration: 2, description: '倒下' },
        'Punch',
      ],
    })
    const timeline = tools.find((tool) => tool.name === 'play_animation_timeline')!
    const step = timeline.parameters.properties!.steps.items
    expect(step.properties.animation.enum).toEqual(['Idle', 'Wave'])
    expect(step.properties).toHaveProperty('repeat_count')
    expect(step.properties.expressions.items.properties).toHaveProperty('fade_in_ms')
    expect(step.properties.expressions.items.properties).toHaveProperty('hold_ms')
    expect(step.properties.expressions.items.properties).toHaveProperty('fade_out_ms')
    expect(step.properties.expressions.items.anyOf).toHaveLength(3)
    const expressionTool = tools.find((tool) => tool.name === 'play_expression_timeline')!
    expect(expressionTool.parameters.properties!.expressions.items.anyOf).toHaveLength(3)
  })

  it('requires a positive duration in at least one expression cue phase', () => {
    const cueSchema = robotTools.find((tool) => tool.name === 'play_expression_timeline')!
      .parameters.properties!.expressions.items
    expect(cueSchema.anyOf).toEqual([
      { properties: { fade_in_ms: { minimum: 1 } } },
      { properties: { hold_ms: { minimum: 1 } } },
      { properties: { fade_out_ms: { minimum: 1 } } },
    ])
  })

  it('defines strict scene animation and cancellation schemas', () => {
    const tools = robotToolsFor({ animations: [] })
    const animate = tools.find((tool) => tool.name === 'animate_scene_nodes')!
    expect(animate.parameters.required).toEqual(['objects', 'lights'])
    expect(animate.parameters.properties!.objects.items.anyOf).toHaveLength(2)
    expect(animate.parameters.properties!.objects.items.additionalProperties).toBe(false)
    expect(
      animate.parameters.properties!.lights.items.properties.intensity.required,
    ).toEqual(['min', 'max', 'period_ms', 'phase_deg'])
    expect(
      tools.find((tool) => tool.name === 'cancel_scene_animations')!.parameters,
    ).toEqual({
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    })
  })

  it('describes unified companion presentation cancellation without scene side effects', () => {
    const cancel = robotTools.find(
      (tool) => tool.name === 'cancel_companion_presentation',
    )!
    expect(cancel.parameters).toEqual({
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    })
    expect(cancel.description).toContain('clear queued AI presentations')
    expect(robotTools.some((tool) => tool.name === 'cancel_animation_timeline')).toBe(
      false,
    )
  })

  it('defines basic geometry, light CRUD and the existing camera pose schema', () => {
    const tools = robotToolsFor({ animations: ['Idle'] })
    const create = tools.find((tool) => tool.name === 'create_primitive')!
    expect(create.parameters.properties!.shape.enum).toEqual([
      'box',
      'sphere',
      'cylinder',
      'cone',
      'torus',
    ])
    expect(create.parameters.properties!.dimensions.additionalProperties).toBe(false)
    expect(create.parameters.oneOf).toHaveLength(5)
    const boxCondition = create.parameters.oneOf.find(
      (item: any) => item.properties.shape.const === 'box',
    )
    expect(boxCondition.properties.dimensions.required).toEqual([
      'width',
      'height',
      'depth',
    ])
    expect(
      create.parameters.properties!.dimensions.properties.radius_top.exclusiveMinimum,
    ).toBe(0)
    const update = tools.find((tool) => tool.name === 'update_primitive')!
    expect(update.parameters.oneOf).toHaveLength(6)
    for (const tool of tools) {
      expect(tool.description.trim().length).toBeGreaterThan(30)
      const visit = (schema: any): void => {
        if (!schema || typeof schema !== 'object') return
        if (schema.type === 'object') expect(schema.additionalProperties).toBe(false)
        Object.values(schema).forEach((value) => {
          if (Array.isArray(value)) value.forEach(visit)
          else if (value && typeof value === 'object') visit(value)
        })
      }
      visit(tool.parameters)
    }
    const camera = tools.find((tool) => tool.name === 'set_camera_pose')!
    expect(camera.parameters.required).toEqual([
      'position',
      'target',
      'fov',
      'duration_ms',
    ])
    expect(camera.parameters.properties).not.toHaveProperty('camera_type')
  })

  it('constrains light fields by light type and advertises persistent scene motion', () => {
    const tools = robotToolsFor({ animations: [] })
    const create = tools.find((tool) => tool.name === 'create_light')!
    expect(create.parameters.oneOf).toHaveLength(3)
    expect(
      create.parameters.oneOf.map((variant: any) => variant.properties.type.const),
    ).toEqual(['directional', 'point', 'spot'])
    expect(JSON.stringify(create.parameters.oneOf[0])).toContain('distance')
    expect(JSON.stringify(create.parameters.oneOf[1])).toContain('target')

    const update = tools.find((tool) => tool.name === 'update_light')!
    expect(update.parameters.required).toEqual(['id', 'type'])
    expect(update.parameters.oneOf).toHaveLength(4)
    expect(update.description).toContain('Include its current type exactly as reported')

    const animate = tools.find((tool) => tool.name === 'animate_scene_nodes')!
    expect(animate.description).toContain('persistent environment animations')
    expect(animate.description).toContain('until replaced')
  })
})
