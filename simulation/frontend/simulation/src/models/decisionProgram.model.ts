export type AgeRule = 'child' | 'elder' | 'equal'
export type GenderRule = 'neutral' | 'female' | 'male'
export type RoadUserRule = 'pedestrian' | 'occupant' | 'minimize'
export type RuleConflictRule = 'law' | 'harm' | 'balanced'
export type DisclosureRule = 'full' | 'third' | 'minimal' | 'delete'

/**
 * 自动驾驶决策表。
 *
 * 用户不再在事故发生瞬间做选择，而是在出发前把自己的价值排序写成
 * 可执行的默认规则。`compileDecisionProgram` 会把这张表编译为具体
 * 场景节点上的选项。
 */
export interface DecisionProgram {
  age: AgeRule
  gender: GenderRule
  roadUser: RoadUserRule
  ruleConflict: RuleConflictRule
  disclosure: DisclosureRule
}

export const defaultDecisionProgram: DecisionProgram = {
  age: 'child',
  gender: 'neutral',
  roadUser: 'pedestrian',
  ruleConflict: 'balanced',
  disclosure: 'third',
}
