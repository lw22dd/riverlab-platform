import { describe, expect, it } from 'vitest'
import { getScenario } from '@/data'
import { SimulationEngine } from './SimulationEngine'

function engineFor(id: string): SimulationEngine {
  const scenario = getScenario(id)
  if (!scenario) throw new Error(`missing scenario ${id}`)
  let now = 1_700_000_000_000
  const engine = new SimulationEngine(scenario, {
    now: () => {
      now += 850
      return now
    },
    createId: () => `test-${id}`,
  })
  engine.start()
  return engine
}

describe('node graph interpreter', () => {
  it('walks the autonomous-driving path and applies rules once at the end', () => {
    const engine = engineFor('autonomous-driving')
    expect(engine.currentNode?.id).toBe('a_intro')
    expect(engine.state.status).toBe('running')

    engine.advance()
    expect(engine.currentNode?.type).toBe('decision')
    engine.choose('a_policy_minimize')

    engine.advance()
    engine.choose('a_act_right')
    expect(engine.currentNode?.id).toBe('a_right')

    engine.advance()
    engine.advance()
    engine.choose('a_data_full')
    engine.advance()

    expect(engine.state.status).toBe('finished')
    expect(engine.state.decisions).toHaveLength(3)
    const session = engine.finish()
    expect(session.decisions.map((decision) => decision.optionId)).toEqual([
      'a_policy_minimize',
      'a_act_right',
      'a_data_full',
    ])
    expect(session.path[0]).toBe('a_intro')
    expect(session.path).toContain('a_end')
    expect(session.outcome.id).toBe('a_out_governed')
    expect(session.rules.some((rule) => rule.id === 'a_rule_minimize_consistent' && rule.matched)).toBe(true)
    expect(session.rules.some((rule) => rule.id === 'a_rule_full_disclosure' && rule.matched)).toBe(true)
    expect(session.score).toBeGreaterThan(0)
    expect(session.durationMs).toBeGreaterThan(0)
  })

  it('records inspection evidence and rewards it through the rule engine', () => {
    const engine = engineFor('trolley-problem')
    engine.advance()
    engine.advance()
    expect(engine.inspect('t_lever', '道岔手柄', '机械结构有效')).toBe(true)
    expect(engine.state.flags['inspect.t_lever']).toBe(true)
    engine.choose('t_pull')
    engine.advance()
    engine.advance()
    engine.choose('t_own')
    engine.advance()

    expect(engine.state.status).toBe('finished')
    const session = engine.finish()
    expect(session.inspected).toContain('t_lever')
    expect(session.rules.some((rule) => rule.id === 't_rule_inspect_lever' && rule.matched)).toBe(true)
    expect(session.outcome.id).toBe('t_out_utilitarian')
  })

  it('auto-routes a branch into the collapse consequence', () => {
    const engine = engineFor('building-collapse')
    engine.advance()
    engine.choose('c_sewage_divert')
    engine.advance()
    engine.choose('c_speed_remove')
    engine.choose('c_guard_none')

    expect(engine.currentNode?.id).toBe('c_collapse')
    expect(engine.state.flags.structuralEvent).toBe('collapse')
    expect(engine.state.visited).toContain('c_branch')
    expect(engine.state.transitions.some((transition) => transition.kind === 'branch')).toBe(true)

    engine.advance()
    engine.advance()
    engine.choose('c_subcontract')
    engine.advance()

    const session = engine.finish()
    expect(engine.state.status).toBe('finished')
    expect(session.outcome.id).toBe('c_out_collapse_evasive')
    expect(session.rules.some((rule) => rule.id === 'c_rule_collapse' && rule.matched)).toBe(true)
    expect(session.rules.some((rule) => rule.id === 'c_rule_responsibility_blame' && rule.matched)).toBe(true)
  })

  it('routes the same graph into the stable consequence with preventive choices', () => {
    const engine = engineFor('building-collapse')
    engine.advance()
    engine.choose('c_sewage_report')
    engine.advance()
    engine.choose('c_speed_standard')
    engine.choose('c_guard_standard')

    expect(engine.currentNode?.id).toBe('c_stable')
    expect(engine.state.flags.structuralEvent).toBe('stable')

    engine.advance()
    engine.advance()
    engine.choose('c_own')
    engine.advance()
    const session = engine.finish()
    expect(session.outcome.id).toBe('c_out_governance')
    expect(session.rules.some((rule) => rule.id === 'c_rule_systemic_prevention' && rule.matched)).toBe(true)
  })

  it('runs the footbridge push path and records the direct harm', () => {
    const engine = engineFor('trolley-footbridge')
    engine.advance()
    engine.advance()
    expect(engine.currentNode?.id).toBe('f_decision')
    expect(engine.inspect('f_workers', '轨道上的五人', '五人未撤离')).toBe(true)

    engine.choose('f_push')
    expect(engine.state.flags.choice).toBe('push')

    engine.advance()
    engine.advance()
    expect(engine.currentNode?.id).toBe('f_witness')
    expect(engine.currentNode?.type).toBe('decision')

    engine.choose('f_own')
    engine.advance()

    expect(engine.state.status).toBe('finished')
    const session = engine.finish()
    expect(session.decisions.map((decision) => decision.optionId)).toEqual(['f_push', 'f_own'])
    expect(session.inspected).toContain('f_workers')
    expect(session.rules.some((rule) => rule.id === 'f_rule_push_tool' && rule.matched)).toBe(true)
    expect(session.rules.some((rule) => rule.id === 'f_rule_own_after_push' && rule.matched)).toBe(true)
    expect(session.outcome.id).toBe('f_out_tool')
  })

  it('ignores out-of-order advances on decisions', () => {
    const engine = engineFor('trolley-problem')
    engine.advance()
    engine.advance()
    engine.advance()
    expect(engine.currentNode?.type).toBe('decision')
    expect(engine.state.transitions.some((transition) => transition.kind === 'advance' && transition.from === 't_decision')).toBe(false)
  })
})
