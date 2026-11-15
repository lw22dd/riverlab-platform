/**
 * 场景 DSL 模型。
 *
 * 对应 `data/scenarios/*.json` 的静态定义，由 `data/scenario.schema.ts` 与
 * `data/validation.ts` 校验。所有类型都与框架无关，可被解释器、评分引擎、
 * Three.js 表现层与无头测试共用。
 */

import type { Primitive, Tone } from './common.model'

export type DomainKind = 'autonomous' | 'trolley' | 'footbridge' | 'collapse' | 'dujiangyan'

export type ComparisonOp = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'notIn'

/**
 * 图分支与评分规则共用的声明式条件语言。
 *
 * 让分支和规则使用同一套语言，整个推演在运行时都可检查，
 * 而不需要在配置中嵌入任意 JavaScript。
 */
export type Condition =
  | { kind: 'all'; conditions: Condition[] }
  | { kind: 'any'; conditions: Condition[] }
  | { kind: 'not'; condition: Condition }
  | { kind: 'decision'; nodeId: string; optionId?: string | string[] }
  | { kind: 'flag'; key: string; op?: ComparisonOp; value?: Primitive | Primitive[] }
  | { kind: 'metric'; key: string; op: ComparisonOp; value: number }
  | { kind: 'visited'; nodeId: string }
  | { kind: 'elapsed'; op: 'gt' | 'gte' | 'lt' | 'lte'; seconds: number }
  | { kind: 'inspected'; id: string }

export interface MetricDef {
  key: string
  label: string
  shortLabel?: string
  description: string
  initial: number
  weight: number
  min: number
  max: number
}

export interface MetricEffect {
  type: 'metric'
  key: string
  delta?: number
  set?: number
  reason?: string
}

export interface FlagEffect {
  type: 'flag'
  key: string
  value: Primitive
}

export interface LogEffect {
  type: 'log'
  text: string
  title?: string
  tone?: Tone
}

export interface StageEffect {
  type: 'stage'
  action: string
  payload?: Record<string, unknown>
  /** 仅用于展示；即使省略，效果仍会发送给舞台适配器。 */
  label?: string
}

export type Effect = MetricEffect | FlagEffect | LogEffect | StageEffect

export interface NodeBase {
  id: string
  title: string
  /** 场景舞台可识别的相机预设，例如 "crosswalk"。 */
  focus?: string
  /** 舞台可识别的氛围压力等级。 */
  ambience?: 'calm' | 'tense' | 'critical'
  /** 进入节点时应用的效果。 */
  effects?: Effect[]
}

export interface NarrativeNode extends NodeBase {
  type: 'narrative'
  speaker?: string
  kicker?: string
  text: string
  next: string
  advanceLabel?: string
}

export interface DecisionOption {
  id: string
  label: string
  summary: string
  detail?: string
  tone?: Tone
  badge?: string
  tags?: string[]
  effects?: Effect[]
  next: string
  timeoutDefault?: boolean
}

export interface DecisionNode extends NodeBase {
  type: 'decision'
  kicker?: string
  prompt: string
  context?: string
  timeLimitSec?: number
  timeoutOptionId?: string
  options: DecisionOption[]
}

export interface ConsequenceNode extends NodeBase {
  type: 'consequence'
  speaker?: string
  kicker?: string
  text: string
  next: string
  advanceLabel?: string
}

export interface BranchCase {
  when?: Condition
  next: string
  note?: string
}

export interface BranchNode extends NodeBase {
  type: 'branch'
  cases: BranchCase[]
}

export interface EndNode extends NodeBase {
  type: 'end'
  summary?: string
}

export type SimNode = NarrativeNode | DecisionNode | ConsequenceNode | BranchNode | EndNode

export interface RuleMetricEffect {
  key: string
  delta: number
  reason?: string
}

export interface RuleEffects {
  metrics?: RuleMetricEffect[]
  tags?: string[]
}

export interface ScoreRule {
  id: string
  label: string
  description: string
  kind: 'positive' | 'negative' | 'neutral'
  when: Condition
  effects: RuleEffects
}

export interface OutcomeDef {
  id: string
  kicker: string
  title: string
  description: string
  advice: string
  when?: Condition
  minScore?: number
  /** 最后一个结局必须是无条件兜底。 */
  fallback?: boolean
}

export interface ScenarioBrief {
  role: string
  premise: string
  objective: string
  constraints: string[]
  ethicsLens: string
  safetyNotice: string
}

export interface ScenarioDefinition {
  id: string
  title: string
  subtitle: string
  tagline: string
  description: string
  domain: DomainKind
  version: string
  difficulty: '入门' | '进阶' | '挑战'
  estimatedMinutes: number
  tags: string[]
  brief: ScenarioBrief
  metrics: MetricDef[]
  startNodeId: string
  nodes: SimNode[]
  rules: ScoreRule[]
  outcomes: OutcomeDef[]
}
