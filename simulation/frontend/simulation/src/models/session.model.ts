/**
 * 会话快照模型。
 *
 * `SessionRecord` 是持久化与跨设备查看的唯一契约：
 * `services/session.service.ts` 写入 localStorage，
 * `apis/session.api.ts` 可选地同步到 REST 后端。
 */

import type { Tone } from './common.model'
import type { DomainKind } from './scenario.model'
import type {
  DecisionRecord,
  Grade,
  LogEntry,
  OutcomeResult,
  RuleResult,
  SessionMetric,
  TransitionRecord,
} from './simulation.model'

export interface SessionRecord {
  id: string
  scenarioId: string
  scenarioTitle: string
  scenarioSubtitle: string
  scenarioVersion: string
  domain: DomainKind
  startedAt: number
  finishedAt: number
  durationMs: number
  decisions: DecisionRecord[]
  logs: LogEntry[]
  path: string[]
  inspected: string[]
  transitions: TransitionRecord[]
  metrics: SessionMetric[]
  score: number
  grade: Grade
  gradeLabel: string
  gradeTone: Tone
  rules: RuleResult[]
  tags: string[]
  outcome: OutcomeResult
  /** 自动驾驶场景中本次运行使用的决策程序摘要。 */
  program?: string[]
}
