import { z } from 'zod'
import type { Condition, ScenarioDefinition } from '@/models/scenario.model'

const primitiveSchema = z.union([z.string(), z.number(), z.boolean()])
const comparisonOpSchema = z.enum(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'notIn'])
const toneSchema = z.enum(['neutral', 'info', 'positive', 'caution', 'danger'])

export const conditionSchema: z.ZodType<Condition> = z.lazy(() =>
  z.discriminatedUnion('kind', [
    z
      .object({
        kind: z.literal('all'),
        conditions: z.array(conditionSchema).min(1),
      })
      .strict(),
    z
      .object({
        kind: z.literal('any'),
        conditions: z.array(conditionSchema).min(1),
      })
      .strict(),
    z
      .object({
        kind: z.literal('not'),
        condition: conditionSchema,
      })
      .strict(),
    z
      .object({
        kind: z.literal('decision'),
        nodeId: z.string().min(1),
        optionId: z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]).optional(),
      })
      .strict(),
    z
      .object({
        kind: z.literal('flag'),
        key: z.string().min(1),
        op: comparisonOpSchema.optional(),
        value: z.union([primitiveSchema, z.array(primitiveSchema).min(1)]).optional(),
      })
      .strict(),
    z
      .object({
        kind: z.literal('metric'),
        key: z.string().min(1),
        op: comparisonOpSchema,
        value: z.number(),
      })
      .strict(),
    z
      .object({
        kind: z.literal('visited'),
        nodeId: z.string().min(1),
      })
      .strict(),
    z
      .object({
        kind: z.literal('elapsed'),
        op: z.enum(['gt', 'gte', 'lt', 'lte']),
        seconds: z.number().nonnegative(),
      })
      .strict(),
    z
      .object({
        kind: z.literal('inspected'),
        id: z.string().min(1),
      })
      .strict(),
  ]),
)

const stagePayloadSchema = z.record(z.string(), z.unknown())

const metricEffectSchema = z
  .object({
    type: z.literal('metric'),
    key: z.string().min(1),
    delta: z.number().optional(),
    set: z.number().optional(),
    reason: z.string().optional(),
  })
  .strict()
  .refine((effect) => effect.delta !== undefined || effect.set !== undefined, {
    message: 'metric effect requires either delta or set',
  })

const effectSchema = z.discriminatedUnion('type', [
  metricEffectSchema,
  z
    .object({
      type: z.literal('flag'),
      key: z.string().min(1),
      value: primitiveSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal('log'),
      text: z.string().min(1),
      title: z.string().optional(),
      tone: toneSchema.optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal('stage'),
      action: z.string().min(1),
      payload: stagePayloadSchema.optional(),
      label: z.string().optional(),
    })
    .strict(),
])

const nodeBase = {
  id: z.string().min(1),
  title: z.string().min(1),
  focus: z.string().optional(),
  ambience: z.enum(['calm', 'tense', 'critical']).optional(),
  effects: z.array(effectSchema).optional(),
}

const narrativeNodeSchema = z
  .object({
    ...nodeBase,
    type: z.literal('narrative'),
    speaker: z.string().optional(),
    kicker: z.string().optional(),
    text: z.string().min(1),
    next: z.string().min(1),
    advanceLabel: z.string().optional(),
  })
  .strict()

const decisionOptionSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1),
    summary: z.string().min(1),
    detail: z.string().optional(),
    tone: toneSchema.optional(),
    badge: z.string().optional(),
    tags: z.array(z.string()).optional(),
    effects: z.array(effectSchema).optional(),
    next: z.string().min(1),
    timeoutDefault: z.boolean().optional(),
  })
  .strict()

const decisionNodeSchema = z
  .object({
    ...nodeBase,
    type: z.literal('decision'),
    kicker: z.string().optional(),
    prompt: z.string().min(1),
    context: z.string().optional(),
    timeLimitSec: z.number().positive().optional(),
    timeoutOptionId: z.string().optional(),
    options: z.array(decisionOptionSchema).min(2),
  })
  .strict()

const consequenceNodeSchema = z
  .object({
    ...nodeBase,
    type: z.literal('consequence'),
    speaker: z.string().optional(),
    kicker: z.string().optional(),
    text: z.string().min(1),
    next: z.string().min(1),
    advanceLabel: z.string().optional(),
  })
  .strict()

const branchCaseSchema = z
  .object({
    when: conditionSchema.optional(),
    next: z.string().min(1),
    note: z.string().optional(),
  })
  .strict()

const branchNodeSchema = z
  .object({
    ...nodeBase,
    type: z.literal('branch'),
    cases: z.array(branchCaseSchema).min(1),
  })
  .strict()

const endNodeSchema = z
  .object({
    ...nodeBase,
    type: z.literal('end'),
    summary: z.string().optional(),
  })
  .strict()

export const simNodeSchema = z.discriminatedUnion('type', [
  narrativeNodeSchema,
  decisionNodeSchema,
  consequenceNodeSchema,
  branchNodeSchema,
  endNodeSchema,
])

const metricDefSchema = z
  .object({
    key: z.string().min(1),
    label: z.string().min(1),
    shortLabel: z.string().optional(),
    description: z.string().min(1),
    initial: z.number().min(0).max(100),
    weight: z.number().min(0).max(1),
    min: z.number().min(0).max(100),
    max: z.number().min(0).max(100),
  })
  .strict()
  .refine((metric) => metric.max > metric.min, {
    message: 'metric max must be greater than min',
  })

const ruleEffectsSchema = z
  .object({
    metrics: z
      .array(
        z
          .object({
            key: z.string().min(1),
            delta: z.number(),
            reason: z.string().optional(),
          })
          .strict(),
      )
      .optional(),
    tags: z.array(z.string().min(1)).optional(),
  })
  .strict()

const scoreRuleSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1),
    description: z.string().min(1),
    kind: z.enum(['positive', 'negative', 'neutral']),
    when: conditionSchema,
    effects: ruleEffectsSchema,
  })
  .strict()

const outcomeSchema = z
  .object({
    id: z.string().min(1),
    kicker: z.string().min(1),
    title: z.string().min(1),
    description: z.string().min(1),
    advice: z.string().min(1),
    when: conditionSchema.optional(),
    minScore: z.number().min(0).max(100).optional(),
    fallback: z.boolean().optional(),
  })
  .strict()

export const scenarioSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    subtitle: z.string().min(1),
    tagline: z.string().min(1),
    description: z.string().min(1),
    domain: z.enum(['autonomous', 'trolley', 'footbridge', 'collapse', 'dujiangyan']),
    version: z.string().min(1),
    difficulty: z.enum(['入门', '进阶', '挑战']),
    estimatedMinutes: z.number().positive(),
    tags: z.array(z.string().min(1)),
    brief: z
      .object({
        role: z.string().min(1),
        premise: z.string().min(1),
        objective: z.string().min(1),
        constraints: z.array(z.string().min(1)).min(1),
        ethicsLens: z.string().min(1),
        safetyNotice: z.string().min(1),
      })
      .strict(),
    metrics: z.array(metricDefSchema).min(1),
    startNodeId: z.string().min(1),
    nodes: z.array(simNodeSchema).min(3),
    rules: z.array(scoreRuleSchema).min(1),
    outcomes: z.array(outcomeSchema).min(1),
  })
  .strict()

export class ScenarioValidationError extends Error {
  readonly issues: string[]

  constructor(message: string, issues: string[]) {
    super(message)
    this.name = 'ScenarioValidationError'
    this.issues = issues
  }
}

/**
 * 在模块边界解析并校验场景。
 *
 * JSON 文件本身仍是纯数据；只有这里允许把它们转换成可信的
 * `ScenarioDefinition`。
 */
export function parseScenario(raw: unknown): ScenarioDefinition {
  // 结构校验失败时汇总全部 issue，方便一次性修正配置。
  const result = scenarioSchema.safeParse(raw)
  if (!result.success) {
    const issues = result.error.issues.map((issue) => {
      const path = issue.path.length ? issue.path.join('.') : '<root>'
      return `${path}: ${issue.message}`
    })
    throw new ScenarioValidationError(`场景配置校验失败（${issues.length} 项）`, issues)
  }
  return result.data as unknown as ScenarioDefinition
}

export { conditionSchema as exportedConditionSchema }
