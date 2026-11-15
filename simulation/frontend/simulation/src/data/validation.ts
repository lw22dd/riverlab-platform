import type { Condition, ScenarioDefinition, SimNode } from '@/models/scenario.model'
import { ScenarioValidationError } from './scenario.schema'

function outgoing(node: SimNode): string[] {
  switch (node.type) {
    case 'narrative':
    case 'consequence':
      return [node.next]
    case 'decision':
      return node.options.map((option) => option.next)
    case 'branch':
      return node.cases.map((branchCase) => branchCase.next)
    case 'end':
      return []
  }
}

function collectConditionRefs(condition: Condition, refs: { metricKeys: Set<string>; nodeIds: Set<string> }) {
  switch (condition.kind) {
    case 'all':
    case 'any':
      condition.conditions.forEach((child) => collectConditionRefs(child, refs))
      break
    case 'not':
      collectConditionRefs(condition.condition, refs)
      break
    case 'metric':
      refs.metricKeys.add(condition.key)
      break
    case 'decision':
    case 'visited':
      refs.nodeIds.add(condition.nodeId)
      break
    default:
      break
  }
}

/**
 * 补足 zod 无法声明式表达的结构与语义校验：
 * 悬挂边、不可达节点、指标拼写错误、兜底结局顺序、
 * 分支默认项、失效的决策引用等。
 */
export function validateScenarioGraph(scenario: ScenarioDefinition): string[] {
  const errors: string[] = []
  const nodeIds = new Set(scenario.nodes.map((node) => node.id))
  const nodesById = new Map(scenario.nodes.map((node) => [node.id, node]))
  const metricKeys = new Set(scenario.metrics.map((metric) => metric.key))

  if (scenario.nodes.length !== nodeIds.size) {
    const seen = new Set<string>()
    for (const node of scenario.nodes) {
      if (seen.has(node.id)) errors.push(`节点 id 重复：${node.id}`)
      seen.add(node.id)
    }
  }

  if (scenario.metrics.length !== metricKeys.size) {
    errors.push('评分指标 key 必须唯一')
  }

  const weightTotal = scenario.metrics.reduce((sum, metric) => sum + metric.weight, 0)
  if (Math.abs(weightTotal - 1) > 0.02) {
    errors.push(`评分指标权重之和应为 1，当前为 ${weightTotal.toFixed(3)}`)
  }

  for (const metric of scenario.metrics) {
    if (metric.initial < metric.min || metric.initial > metric.max) {
      errors.push(`指标 ${metric.key} 的初始值超出 min/max 范围`)
    }
  }

  if (!nodesById.has(scenario.startNodeId)) {
    errors.push(`起始节点不存在：${scenario.startNodeId}`)
  }
  if (nodesById.get(scenario.startNodeId)?.type === 'end') {
    errors.push('起始节点不能是结束节点')
  }

  for (const node of scenario.nodes) {
    if (node.type === 'decision') {
      if (new Set(node.options.map((option) => option.id)).size !== node.options.length) {
        errors.push(`决策节点 ${node.id} 的选项 id 重复`)
      }
      if (node.timeLimitSec && node.timeoutOptionId && !node.options.some((option) => option.id === node.timeoutOptionId)) {
        errors.push(`决策节点 ${node.id} 的 timeoutOptionId 不存在`)
      }
    }

    if (node.type === 'branch') {
      const last = node.cases[node.cases.length - 1]
      if (last.when) errors.push(`分支节点 ${node.id} 的最后一个分支必须是默认分支`)
    }

    for (const target of outgoing(node)) {
      if (!nodesById.has(target)) {
        errors.push(`节点 ${node.id} 指向不存在的节点：${target}`)
      }
    }

    for (const effect of node.effects ?? []) {
      if (effect.type === 'metric' && !metricKeys.has(effect.key)) {
        errors.push(`节点 ${node.id} 引用了未知指标：${effect.key}`)
      }
    }

    if (node.type === 'decision') {
      for (const option of node.options) {
        for (const effect of option.effects ?? []) {
          if (effect.type === 'metric' && !metricKeys.has(effect.key)) {
            errors.push(`选项 ${node.id}.${option.id} 引用了未知指标：${effect.key}`)
          }
        }
      }
    }
  }

  const ends = scenario.nodes.filter((node) => node.type === 'end')
  if (ends.length === 0) errors.push('场景至少需要一个结束节点')

  // 从起点做一次可达性遍历，找出永远走不到的节点。
  if (nodeIds.has(scenario.startNodeId)) {
    const reachable = new Set<string>()
    const stack = [scenario.startNodeId]
    while (stack.length) {
      const id = stack.pop() as string
      if (reachable.has(id)) continue
      reachable.add(id)
      const node = nodesById.get(id)
      if (node) {
        for (const target of outgoing(node)) {
          if (nodesById.has(target)) stack.push(target)
        }
      }
    }
    for (const node of scenario.nodes) {
      if (!reachable.has(node.id)) errors.push(`节点不可达：${node.id}`)
    }

    // 反向遍历确认每个节点最终都能抵达结束节点。
    const reverse = new Map<string, string[]>()
    for (const node of scenario.nodes) {
      for (const target of outgoing(node)) {
        const list = reverse.get(target) ?? []
        list.push(node.id)
        reverse.set(target, list)
      }
    }
    const canFinish = new Set<string>()
    const endStack = ends.map((node) => node.id)
    while (endStack.length) {
      const id = endStack.pop() as string
      if (canFinish.has(id)) continue
      canFinish.add(id)
      for (const parent of reverse.get(id) ?? []) endStack.push(parent)
    }
    for (const node of scenario.nodes) {
      if (!canFinish.has(node.id)) errors.push(`节点无法到达任何结束节点：${node.id}`)
    }
  }

  const ruleIds = new Set<string>()
  for (const rule of scenario.rules) {
    if (ruleIds.has(rule.id)) errors.push(`评分规则 id 重复：${rule.id}`)
    ruleIds.add(rule.id)
    for (const metricEffect of rule.effects.metrics ?? []) {
      if (!metricKeys.has(metricEffect.key)) {
        errors.push(`规则 ${rule.id} 引用了未知指标：${metricEffect.key}`)
      }
    }
  }

  const outcomeIds = new Set<string>()
  scenario.outcomes.forEach((outcome, index) => {
    if (outcomeIds.has(outcome.id)) errors.push(`结局 id 重复：${outcome.id}`)
    outcomeIds.add(outcome.id)
    if (outcome.fallback && index !== scenario.outcomes.length - 1) {
      errors.push(`结局 ${outcome.id} 被标记为 fallback，但 fallback 必须是最后一个结局`)
    }
  })
  const lastOutcome = scenario.outcomes[scenario.outcomes.length - 1]
  if (!lastOutcome.fallback) errors.push('最后一个结局必须标记 fallback: true')

  // 每个条件引用都必须指向图中真实存在的实体。
  const conditionRefs: { metricKeys: Set<string>; nodeIds: Set<string> } = {
    metricKeys: new Set(),
    nodeIds: new Set(),
  }
  for (const node of scenario.nodes) {
    if (node.type === 'branch') {
      node.cases.forEach((branchCase) => {
        if (branchCase.when) collectConditionRefs(branchCase.when, conditionRefs)
      })
    }
  }
  scenario.rules.forEach((rule) => collectConditionRefs(rule.when, conditionRefs))
  scenario.outcomes.forEach((outcome) => {
    if (outcome.when) collectConditionRefs(outcome.when, conditionRefs)
  })

  for (const key of conditionRefs.metricKeys) {
    if (!metricKeys.has(key)) errors.push(`条件引用了未知指标：${key}`)
  }

  const visitCondition = (condition: Condition) => {
    if (condition.kind === 'decision') {
      const node = nodesById.get(condition.nodeId)
      if (!node || node.type !== 'decision') {
        errors.push(`条件引用的决策节点不存在或类型错误：${condition.nodeId}`)
        return
      }
      const ids = Array.isArray(condition.optionId)
        ? condition.optionId
        : condition.optionId
          ? [condition.optionId]
          : []
      for (const optionId of ids) {
        if (!node.options.some((option) => option.id === optionId)) {
          errors.push(`条件引用了决策 ${condition.nodeId} 中不存在的选项：${optionId}`)
        }
      }
    } else if (condition.kind === 'visited') {
      if (!nodeIds.has(condition.nodeId)) errors.push(`条件引用了不存在的节点：${condition.nodeId}`)
    } else if (condition.kind === 'all' || condition.kind === 'any') {
      condition.conditions.forEach(visitCondition)
    } else if (condition.kind === 'not') {
      visitCondition(condition.condition)
    }
  }

  scenario.nodes.forEach((node) => {
    if (node.type === 'branch') {
      node.cases.forEach((branchCase) => branchCase.when && visitCondition(branchCase.when))
    }
  })
  scenario.rules.forEach((rule) => visitCondition(rule.when))
  scenario.outcomes.forEach((outcome) => outcome.when && visitCondition(outcome.when))

  return errors
}

export function assertValidScenario(scenario: ScenarioDefinition): void {
  const errors = validateScenarioGraph(scenario)
  if (errors.length) {
    throw new ScenarioValidationError(`场景图校验失败（${errors.length} 项）`, errors)
  }
}
