import type { Tone } from '@/models/common.model'
import type { DecisionOption, SimNode } from '@/models/scenario.model'
import type { SessionRecord } from '@/models/session.model'
import type { DecisionRecord, MetricDelta } from '@/models/simulation.model'

/** 一次指标变化的描述，供 HUD 增量提示与结算对比使用。 */
export interface MetricChange {
  key: string
  label: string
  delta: number
  value: number
  reason?: string
}

/**
 * 引擎向表现层广播的事件契约。
 * 视图、舞台与提示条都只依赖这张表，不读取引擎内部状态。
 */
export interface SimulationEvents {
  node: { node: SimNode }
  choice: { option: DecisionOption; decision: DecisionRecord }
  metric: { changes: MetricChange[]; reason?: string }
  stage: { action: string; payload?: Record<string, unknown>; label?: string }
  inspect: { id: string; label: string; detail: string; tone?: Tone }
  finished: { session: SessionRecord; metricDeltas: MetricDelta[] }
  warning: { text: string }
}
