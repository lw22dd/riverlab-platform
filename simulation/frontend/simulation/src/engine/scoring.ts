import type { OutcomeDef, ScenarioDefinition } from '@/models/scenario.model'
import type {
  Evaluation,
  Grade,
  GradeDef,
  MetricDelta,
  OutcomeResult,
  RuleResult,
  SimState,
} from '@/models/simulation.model'
import { evaluateCondition, type ConditionContext } from './conditions'

/** 把数值限制在 `[min, max]` 区间内，指标写入与评分共用。 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** 把分数映射到 A–D 等级与展示文案，是评分结果对外的唯一出口。 */
export function gradeForScore(score: number): GradeDef {
  if (score >= 85) return { grade: 'A', label: '示范级', tone: 'positive' }
  if (score >= 70) return { grade: 'B', label: '稳健级', tone: 'info' }
  if (score >= 55) return { grade: 'C', label: '警示级', tone: 'caution' }
  return { grade: 'D', label: '失范级', tone: 'danger' }
}

/** 取指标的上下界，配置缺失时退化为 0–100，避免结算直接抛错。 */
function metricBounds(scenario: ScenarioDefinition, key: string): { min: number; max: number } {
  const definition = scenario.metrics.find((metric) => metric.key === key)
  return { min: definition?.min ?? 0, max: definition?.max ?? 100 }
}

/** 从推演状态组装条件上下文；可传入替换后的指标，用于结局判定。 */
function buildContext(state: SimState, elapsedMs: number): ConditionContext {
  return {
    metrics: state.metrics,
    flags: state.flags,
    decisions: state.decisions,
    visited: state.visited,
    inspected: state.inspected,
    elapsedMs,
  }
}

/** 把配置里的结局定义裁剪成结局面板需要的字段。 */
function buildOutcome(outcome: OutcomeDef): OutcomeResult {
  return {
    id: outcome.id,
    kicker: outcome.kicker,
    title: outcome.title,
    description: outcome.description,
    advice: outcome.advice,
  }
}

/**
 * 无头评分流程。
 *
 * 规则先基于「应用规则效果前」的指标求值，因此结果不依赖规则声明顺序；
 * 随后批量应用效果，再计算加权总分。
 */
export function evaluateSimulation(
  scenario: ScenarioDefinition,
  state: SimState,
  finishedAt = state.finishedAt ?? Date.now(),
): Evaluation {
  const elapsedMs = Math.max(0, finishedAt - state.startedAt)
  const context = buildContext(state, elapsedMs)

  const ruleResults: RuleResult[] = []
  const metricTotals: Record<string, number> = {}

  // 先对规则条件求值，再统一累计指标，确保结果与规则顺序无关。
  for (const rule of scenario.rules) {
    const matched = evaluateCondition(rule.when, context)
    const metricDeltas: MetricDelta[] = []

    if (matched) {
      for (const effect of rule.effects.metrics ?? []) {
        const label = scenario.metrics.find((metric) => metric.key === effect.key)?.label ?? effect.key
        metricDeltas.push({ key: effect.key, label, delta: effect.delta, reason: effect.reason })
        metricTotals[effect.key] = (metricTotals[effect.key] ?? 0) + effect.delta
      }
    }

    ruleResults.push({
      id: rule.id,
      label: rule.label,
      description: rule.description,
      kind: rule.kind,
      matched,
      metricDeltas,
      tags: matched ? (rule.effects.tags ?? []) : [],
    })
  }

  const metrics: Record<string, number> = {}
  for (const definition of scenario.metrics) {
    const bounds = metricBounds(scenario, definition.key)
    const before = state.metrics[definition.key] ?? definition.initial
    metrics[definition.key] = Math.round(clamp(before + (metricTotals[definition.key] ?? 0), bounds.min, bounds.max))
  }

  // 按指标权重计算加权平均分。
  const weightTotal = scenario.metrics.reduce((sum, metric) => sum + metric.weight, 0)
  const score = Math.round(
    scenario.metrics.reduce((sum, metric) => {
      const value = metrics[metric.key] ?? metric.initial
      return sum + value * metric.weight
    }, 0) / (weightTotal || 1),
  )

  const grade = gradeForScore(score)
  const outcomeContext = buildContext({ ...state, metrics }, elapsedMs)
  // 结局按声明顺序匹配，最后一个 fallback 作为兜底。
  const outcome =
    scenario.outcomes.find((candidate) => {
      if (candidate.fallback) return true
      if (candidate.minScore !== undefined && score < candidate.minScore) return false
      if (candidate.when && !evaluateCondition(candidate.when, outcomeContext)) return false
      return true
    }) ?? scenario.outcomes[scenario.outcomes.length - 1]

  const tags = Array.from(
    new Set([...state.decisions.flatMap((decision) => decision.tags), ...ruleResults.flatMap((rule) => rule.tags)]),
  )

  return {
    metrics,
    score,
    grade: grade.grade as Grade,
    gradeLabel: grade.label,
    gradeTone: grade.tone,
    rules: ruleResults,
    tags,
    outcome: buildOutcome(outcome),
  }
}
