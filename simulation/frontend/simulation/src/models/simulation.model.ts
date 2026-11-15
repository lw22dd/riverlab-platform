/**
 * 运行时推演模型。
 *
 * 由 `engine/SimulationEngine.ts` 写入黑板书，并由 `engine/scoring.ts` 结算。
 * 与场景 DSL 分离，使「静态场景」和「一次运行」的概念边界清晰。
 */

import type { Primitive, Tone } from './common.model'

export type DecisionRecord = {
  nodeId: string
  nodeTitle: string
  optionId: string
  label: string
  tone: Tone
  tags: string[]
  elapsedMs: number
  at: number
  timedOut: boolean
}

export type LogKind = 'system' | 'narrative' | 'decision' | 'consequence' | 'inspect' | 'warning'

export interface LogEntry {
  id: number
  at: number
  elapsedMs: number
  kind: LogKind
  title?: string
  text: string
  tone?: Tone
  nodeId?: string
  optionId?: string
}

export type TransitionKind = 'start' | 'advance' | 'choice' | 'branch'

export interface TransitionRecord {
  from: string | null
  to: string
  kind: TransitionKind
  optionId?: string
  at: number
}

export interface SimState {
  sessionId: string
  status: 'ready' | 'running' | 'awaiting' | 'finished'
  startedAt: number
  finishedAt?: number
  currentNodeId?: string
  metrics: Record<string, number>
  flags: Record<string, Primitive>
  decisions: DecisionRecord[]
  logs: LogEntry[]
  visited: string[]
  inspected: string[]
  transitions: TransitionRecord[]
  evaluation?: Evaluation
}

export type Grade = 'A' | 'B' | 'C' | 'D'

export interface GradeDef {
  grade: Grade
  label: string
  tone: Tone
}

export interface MetricDelta {
  key: string
  label: string
  delta: number
  reason?: string
}

export interface RuleResult {
  id: string
  label: string
  description: string
  kind: 'positive' | 'negative' | 'neutral'
  matched: boolean
  metricDeltas: MetricDelta[]
  tags: string[]
}

export interface OutcomeResult {
  id: string
  kicker: string
  title: string
  description: string
  advice: string
}

export interface SessionMetric {
  key: string
  label: string
  description: string
  value: number
  initial: number
  weight: number
}

export interface Evaluation {
  metrics: Record<string, number>
  score: number
  grade: Grade
  gradeLabel: string
  gradeTone: Tone
  rules: RuleResult[]
  tags: string[]
  outcome: OutcomeResult
}
