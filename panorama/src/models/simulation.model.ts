/**
 * 平台后台“实验数据”相关模型。
 *
 * 数据来自仿真实验上报的 SessionRecord 快照，
 * 后端将高频查询字段拆列，完整快照保存在 payload 中。
 */

/** 统计分析通用查询参数。 */
export interface AnalyticsQuery {
  /** 开始日期，格式 YYYY-MM-DD（含当天）。 */
  from?: string;
  /** 结束日期，格式 YYYY-MM-DD（含当天）。 */
  to?: string;
  scenario_id?: string;
  class_id?: number;
}

/** 会话列表查询参数。 */
export interface SessionListQuery extends AnalyticsQuery {
  page?: number;
  page_size?: number;
  keyword?: string;
}

/** 等级分布，后端保证 A/B/C/D 四个键都存在。 */
export interface GradeDistribution {
  A: number;
  B: number;
  C: number;
  D: number;
}

export interface OutcomeCount {
  id: string;
  title: string;
  count: number;
}

export interface DailyTrendPoint {
  date: string;
  sessions: number;
  avg_score: number;
}

/** GET /sim/analytics/overview 的 data。 */
export interface AnalyticsOverview {
  sessions: number;
  students: number;
  avg_score: number;
  avg_duration_ms: number;
  grade_distribution: GradeDistribution;
  outcome_distribution: OutcomeCount[];
  daily_trend: DailyTrendPoint[];
}

export interface ScenarioStat {
  scenario_id: string;
  scenario_title: string;
  sessions: number;
  students: number;
  avg_score: number;
  avg_duration_ms: number;
}

/** GET /sim/analytics/scenarios 的 data。 */
export interface ScenarioAnalyticsData {
  items: ScenarioStat[];
}

export interface DecisionStat {
  node_id: string;
  node_title: string;
  option_id: string;
  label: string;
  count: number;
}

/** GET /sim/analytics/decisions 的 data。 */
export interface DecisionAnalyticsData {
  items: DecisionStat[];
  total: number;
}

export interface RuleStat {
  rule_id: string;
  label: string;
  kind: string;
  hits: number;
  total: number;
  /** 命中率，取值 0 ~ 1。 */
  hit_rate: number;
}

/** GET /sim/analytics/rules 的 data。 */
export interface RuleAnalyticsData {
  items: RuleStat[];
}

export type SessionGrade = 'A' | 'B' | 'C' | 'D';

/** 会话列表行，时间字段均为毫秒时间戳。 */
export interface SimSessionItem {
  id: string;
  user_id: number;
  username: string;
  nickname: string;
  class_id: number;
  class_name: string;
  scenario_id: string;
  scenario_title: string;
  scenario_version: string;
  domain: string;
  score: number;
  grade: SessionGrade | string;
  grade_label: string;
  outcome_id: string;
  outcome_title: string;
  duration_ms: number;
  started_at: number;
  finished_at: number;
  received_at: number;
}

/** GET /sim/sessions 的 data。 */
export interface SessionListData {
  items: SimSessionItem[];
  total: number;
  page: number;
  page_size: number;
}

/** SessionRecord.payload.decisions 中的单条决策。 */
export interface SessionDecisionRecord {
  nodeId: string;
  nodeTitle: string;
  optionId: string;
  label: string;
  tone?: string;
  tags?: string[];
  elapsedMs?: number;
  at?: number;
  timedOut?: boolean;
}

export interface SessionRuleMetricDelta {
  key: string;
  label: string;
  delta: number;
  reason?: string;
}

/** SessionRecord.payload.rules 中的单条规则结算结果。 */
export interface SessionRuleResult {
  id: string;
  label: string;
  description?: string;
  kind?: 'positive' | 'negative' | 'neutral' | string;
  matched?: boolean;
  metricDeltas?: SessionRuleMetricDelta[];
  tags?: string[];
}

export type SessionLogKind =
  | 'system'
  | 'narrative'
  | 'decision'
  | 'consequence'
  | 'inspect'
  | 'warning'
  | string;

/** SessionRecord.payload.logs 中的单条日志。 */
export interface SessionLogEntry {
  id?: number;
  at?: number;
  elapsedMs?: number;
  kind?: SessionLogKind;
  title?: string;
  text: string;
  tone?: string;
  nodeId?: string;
  optionId?: string;
}

export interface SessionMetric {
  key: string;
  label: string;
  description?: string;
  value: number;
  initial?: number;
  weight?: number;
}

export interface SessionOutcome {
  id: string;
  kicker?: string;
  title: string;
  description?: string;
  advice?: string;
}

/** 完整 SessionRecord 快照（camelCase，与仿真前端保持一致）。 */
export interface SessionPayload {
  id?: string;
  scenarioId?: string;
  scenarioTitle?: string;
  scenarioSubtitle?: string;
  scenarioVersion?: string;
  domain?: string;
  startedAt?: number;
  finishedAt?: number;
  durationMs?: number;
  decisions?: SessionDecisionRecord[];
  logs?: SessionLogEntry[];
  path?: string[];
  inspected?: string[];
  metrics?: SessionMetric[];
  score?: number;
  grade?: SessionGrade | string;
  gradeLabel?: string;
  rules?: SessionRuleResult[];
  tags?: string[];
  outcome?: SessionOutcome;
  program?: string[];
}

/** GET /sim/sessions/:id 的 data。 */
export interface SimSessionDetail extends SimSessionItem {
  /** 后端通常返回对象；兼容历史数据中可能出现的 JSON 字符串。 */
  payload?: SessionPayload | string | null;
}
