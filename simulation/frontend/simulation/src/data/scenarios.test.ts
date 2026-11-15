import { describe, expect, it } from 'vitest'
import autonomousDriving from './scenarios/autonomous-driving.json'
import { scenarioPackages, scenarios } from '@/data'
import { parseScenario, ScenarioValidationError } from './scenario.schema'
import { validateScenarioGraph } from './validation'

describe('scenario packages', () => {
  it('contains five validated scenarios with unique ids', () => {
    expect(scenarios).toHaveLength(5)
    expect(new Set(scenarios.map((scenario) => scenario.id)).size).toBe(5)
  })

  it('uses the same graph/schema contract for every package', () => {
    for (const scenario of scenarios) {
      expect(scenario.nodes.some((node) => node.type === 'decision'), scenario.id).toBe(true)
      expect(scenario.nodes.some((node) => node.type === 'end'), scenario.id).toBe(true)
      expect(scenario.rules.length).toBeGreaterThan(0)
      expect(scenario.outcomes[scenario.outcomes.length - 1]?.fallback).toBe(true)
      expect(scenario.metrics.reduce((sum, metric) => sum + metric.weight, 0)).toBeCloseTo(1, 5)
      // 文案改写后节点 id、指标与条件引用必须仍然自洽。
      expect(validateScenarioGraph(scenario), scenario.id).toEqual([])
    }
  })

  it('gives every package a presentation entry', () => {
    for (const entry of scenarioPackages) {
      expect(entry.presentation.order, entry.scenario.id).not.toBe('00')
      expect(entry.presentation.domainLabel, entry.scenario.id).toBeTruthy()
      expect(entry.presentation.cardNote, entry.scenario.id).toBeTruthy()
    }
  })

  it('rejects zod-invalid scenario JSON with readable issues', () => {
    const broken = JSON.parse(JSON.stringify(autonomousDriving)) as Record<string, unknown>
    broken.version = ''
    let error: unknown
    try {
      parseScenario(broken)
    } catch (caught) {
      error = caught
    }
    expect(error).toBeInstanceOf(ScenarioValidationError)
    expect((error as ScenarioValidationError).issues.join('\n')).toContain('version')
  })

  it('rejects dangling graph edges', () => {
    const source = scenarioPackages[0]?.scenario
    expect(source).toBeDefined()
    const broken = JSON.parse(JSON.stringify(source))
    const narrative = broken.nodes.find((node: { id: string }) => node.id === 'a_intro')
    narrative.next = 'missing-node'
    const errors = validateScenarioGraph(broken)
    expect(errors.some((message) => message.includes('missing-node'))).toBe(true)
  })

  it('rejects broken decision references in rules', () => {
    const source = scenarioPackages[0]?.scenario
    expect(source).toBeDefined()
    const broken = JSON.parse(JSON.stringify(source))
    broken.rules[0].when = {
      kind: 'decision',
      nodeId: 'a_event',
      optionId: 'does-not-exist',
    }
    const errors = validateScenarioGraph(broken)
    expect(errors.some((message) => message.includes('does-not-exist'))).toBe(true)
  })
})
