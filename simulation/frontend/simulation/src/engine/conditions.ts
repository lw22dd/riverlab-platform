import type { Primitive } from '@/models/common.model'
import type { ComparisonOp, Condition } from '@/models/scenario.model'
import type { DecisionRecord } from '@/models/simulation.model'

export interface ConditionContext {
  metrics: Record<string, number>
  flags: Record<string, Primitive>
  decisions: DecisionRecord[]
  visited: string[]
  inspected: string[]
  elapsedMs: number
}

/**
 * 单一比较运算的实现：相等 / 集合 / 数值大小。
 * 类型不匹配时一律返回 false，而不是做隐式转换，保证配置错误能被暴露。
 */
function compare(
  actual: Primitive | undefined,
  op: ComparisonOp,
  expected: Primitive | Primitive[] | undefined,
): boolean {
  if (actual === undefined) return false

  if (op === 'in') {
    return Array.isArray(expected) && expected.includes(actual)
  }
  if (op === 'notIn') {
    return Array.isArray(expected) && !expected.includes(actual)
  }

  if (op === 'eq') return actual === expected
  if (op === 'neq') return actual !== expected

  // 非数值只支持相等 / 集合比较，避免隐式类型转换。
  if (typeof actual !== 'number' || typeof expected !== 'number') return false
  switch (op) {
    case 'gt':
      return actual > expected
    case 'gte':
      return actual >= expected
    case 'lt':
      return actual < expected
    case 'lte':
      return actual <= expected
    default:
      return false
  }
}

/**
 * 小型、确定性的条件求值器。
 *
 * 不使用 `eval`，场景 JSON 中也不允许出现函数值；这既保证安全，
 * 也便于运行时审计。
 */
export function evaluateCondition(condition: Condition, ctx: ConditionContext): boolean {
  // 分支与评分共用同一套条件语义，避免两处判断口径不一致。
  switch (condition.kind) {
    case 'all':
      return condition.conditions.every((child) => evaluateCondition(child, ctx))
    case 'any':
      return condition.conditions.some((child) => evaluateCondition(child, ctx))
    case 'not':
      return !evaluateCondition(condition.condition, ctx)
    case 'decision': {
      const record = ctx.decisions.find((decision) => decision.nodeId === condition.nodeId)
      if (!record) return false
      if (condition.optionId === undefined) return true
      if (Array.isArray(condition.optionId)) return condition.optionId.includes(record.optionId)
      return record.optionId === condition.optionId
    }
    case 'flag': {
      const actual = ctx.flags[condition.key]
      if (condition.op || condition.value !== undefined) {
        if (!condition.op) return compare(actual, 'eq', condition.value)
        return compare(actual, condition.op, condition.value)
      }
      if (typeof actual === 'boolean') return actual
      return actual !== undefined && actual !== '' && actual !== 0
    }
    case 'metric': {
      const actual = ctx.metrics[condition.key] ?? 0
      return compare(actual, condition.op, condition.value)
    }
    case 'visited':
      return ctx.visited.includes(condition.nodeId)
    case 'elapsed': {
      const seconds = ctx.elapsedMs / 1000
      switch (condition.op) {
        case 'gt':
          return seconds > condition.seconds
        case 'gte':
          return seconds >= condition.seconds
        case 'lt':
          return seconds < condition.seconds
        case 'lte':
          return seconds <= condition.seconds
        default:
          return false
      }
    }
    case 'inspected':
      return ctx.inspected.includes(condition.id)
    default:
      return false
  }
}

/** 把条件渲染成中文短句，用于决策程序预览与规则说明面板。 */
export function conditionSummary(condition: Condition): string {
  switch (condition.kind) {
    case 'all':
      return condition.conditions.map(conditionSummary).join(' 且 ')
    case 'any':
      return condition.conditions.map(conditionSummary).join(' 或 ')
    case 'not':
      return `非（${conditionSummary(condition.condition)}）`
    case 'decision': {
      const options = condition.optionId
        ? Array.isArray(condition.optionId)
          ? condition.optionId.join(' / ')
          : condition.optionId
        : '任意选择'
      return `决策 ${condition.nodeId} → ${options}`
    }
    case 'flag':
      return condition.value === undefined
        ? `标记 ${condition.key} 为真`
        : `标记 ${condition.key} ${condition.op ?? '='} ${String(condition.value)}`
    case 'metric':
      return `指标 ${condition.key} ${condition.op} ${condition.value}`
    case 'visited':
      return `经过节点 ${condition.nodeId}`
    case 'elapsed':
      return `用时 ${condition.op} ${condition.seconds}s`
    case 'inspected':
      return `已勘查 ${condition.id}`
    default:
      return '未知条件'
  }
}
