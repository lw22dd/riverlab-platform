import type { Tone } from '@/models/common.model'
import type { Effect, ScenarioDefinition, SimNode } from '@/models/scenario.model'
import type { SessionRecord } from '@/models/session.model'
import type {
  DecisionRecord,
  MetricDelta,
  SimState,
  TransitionKind,
} from '@/models/simulation.model'
import { evaluateCondition, type ConditionContext } from './conditions'
import { TypedEventBus } from './eventBus'
import type { MetricChange, SimulationEvents } from './events'
import { clamp, evaluateSimulation } from './scoring'

export interface SimulationEngineOptions {
  now?: () => number
  createId?: () => string
  bus?: TypedEventBus<SimulationEvents>
}

function defaultId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `session-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function serializable<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

/**
 * 确定性、与框架无关的节点图解释器。
 *
 * 引擎持有黑板状态（指标、flag、决策、路径），并向外发出表现事件；
 * 它不接触 Vue、Three.js 或持久化，因此整个推演可以在 Vitest 中无 DOM 运行。
 */
export class SimulationEngine {
  readonly scenario: ScenarioDefinition
  readonly bus: TypedEventBus<SimulationEvents>
  state: SimState

  private readonly now: () => number
  private readonly createId: () => string
  private logSeq = 0

  constructor(scenario: ScenarioDefinition, options: SimulationEngineOptions = {}) {
    this.scenario = scenario
    this.now = options.now ?? (() => Date.now())
    this.createId = options.createId ?? defaultId
    this.bus = options.bus ?? new TypedEventBus<SimulationEvents>()

    // 用场景定义的初始值初始化黑板指标。
    const metrics: Record<string, number> = {}
    for (const metric of scenario.metrics) metrics[metric.key] = metric.initial

    this.state = {
      sessionId: this.createId(),
      status: 'ready',
      startedAt: this.now(),
      metrics,
      flags: {},
      decisions: [],
      logs: [],
      visited: [],
      inspected: [],
      transitions: [],
    }

    this.addLog('system', `场景配置 ${scenario.id}@${scenario.version} 已完成字段与节点图校验。`, {
      title: '配置校验通过',
      tone: 'info',
    })
  }

  /** 当前所在节点，供视图与舞台读取；未开始时为 undefined。 */
  get currentNode(): SimNode | undefined {
    return this.state.currentNodeId ? this.scenario.nodes.find((node) => node.id === this.state.currentNodeId) : undefined
  }

  /** 从起点节点开始推演；后续节点迁移统一由 transitionTo 处理。 */
  start(): void {
    // 只有 ready 状态可以启动，避免重复进入起点。
    if (this.state.status !== 'ready') return
    this.state.startedAt = this.now()
    this.state.status = 'running'
    this.addLog('system', '起点已锁定。后续的选择、勘查和规则命中都会写入本地留档，动作与时刻一并保留。', {
      title: '记录开始',
      tone: 'info',
    })
    this.transitionTo(this.scenario.startNodeId, null, 'start')
  }

  /** 推进叙事或后果节点；决策节点必须先 choose，否则只发出警告。 */
  advance(): void {
    const node = this.currentNode
    if (!node) return
    if (node.type !== 'narrative' && node.type !== 'consequence') {
      this.bus.emit('warning', { text: '当前节点需要先完成决策。' })
      return
    }
    this.transitionTo(node.next, node.id, 'advance')
  }

  /** 在决策节点提交选项：写入决策记录、应用选项效果并迁移到下一节点。 */
  choose(optionId: string, meta: { timedOut?: boolean } = {}): void {
    const node = this.currentNode
    if (!node || node.type !== 'decision' || this.state.status !== 'awaiting') return
    const option = node.options.find((candidate) => candidate.id === optionId)
    if (!option) {
      this.bus.emit('warning', { text: `未知选项：${optionId}` })
      return
    }

    // 决策记录先落黑板，再应用效果并迁移，保证事件顺序可复盘。
    const at = this.now()
    const decision: DecisionRecord = {
      nodeId: node.id,
      nodeTitle: node.title,
      optionId: option.id,
      label: option.label,
      tone: option.tone ?? 'neutral',
      tags: option.tags ?? [],
      elapsedMs: Math.max(0, at - this.state.startedAt),
      at,
      timedOut: Boolean(meta.timedOut),
    }
    this.state.decisions.push(decision)

    this.addLog('decision', `选择「${option.label}」${meta.timedOut ? '（决策超时，自动执行默认方案）' : ''}`, {
      title: node.title,
      tone: option.tone ?? 'info',
      nodeId: node.id,
      optionId: option.id,
    })

    this.applyEffects(option.effects ?? [], option.label)
    this.bus.emit('choice', { option, decision })
    this.transitionTo(option.next, node.id, 'choice', option.id)
  }

  /**
   * 记录一次现场勘查。勘查结果同时写入 flags（`inspect.<id>`）与日志，
   * 因此评分规则可以用 `inspected` 条件判断玩家是否真的查看过线索。
   */
  inspect(id: string, label: string, detail: string, tone: Tone = 'info'): boolean {
    if (this.state.inspected.includes(id)) {
      this.bus.emit('warning', { text: `已记录过勘查：${label}` })
      return false
    }
    this.state.inspected.push(id)
    this.state.flags[`inspect.${id}`] = true
    this.addLog('inspect', `勘查「${label}」：${detail}`, {
      title: '现场勘查',
      tone,
    })
    this.bus.emit('inspect', { id, label, detail, tone })
    return true
  }

  /** 结算当前推演：评分、生成会话快照并发出 finished 事件（幂等）。 */
  finish(): SessionRecord {
    // 评分只执行一次；重复调用直接复用已有结算结果。
    if (this.state.status === 'finished' && this.state.evaluation) {
      return this.buildSession(this.state.evaluation.score, this.state.evaluation)
    }

    const finishedAt = this.now()
    this.state.status = 'finished'
    this.state.finishedAt = finishedAt
    const evaluation = evaluateSimulation(this.scenario, this.state, finishedAt)
    this.state.evaluation = evaluation

    this.addLog('system', `评分汇总完成：${evaluation.score} 分 / ${evaluation.grade} ${evaluation.gradeLabel}。`, {
      title: '推演结束',
      tone: evaluation.gradeTone,
    })

    const session = this.buildSession(evaluation.score, evaluation)
    const metricDeltas: MetricDelta[] = this.scenario.metrics
      .map((metric) => ({
        key: metric.key,
        label: metric.label,
        delta: (evaluation.metrics[metric.key] ?? metric.initial) - metric.initial,
      }))
      .filter((delta) => delta.delta !== 0)

    this.bus.emit('finished', { session, metricDeltas })
    return session
  }

  /**
   * 所有迁移的唯一入口：写入路径与轨迹、应用节点效果，
   * 再按节点类型分派到分支递归、结算或发出 node 事件。
   */
  private transitionTo(
    nodeId: string,
    from: string | null,
    kind: TransitionKind,
    optionId?: string,
    depth = 0,
  ): void {
    // 递归保护：配置错误导致分支链过深时中止，避免死循环。
    if (depth > 64) {
      this.bus.emit('warning', { text: '节点图递归层数过深，已中止推演。' })
      return
    }

    const node = this.scenario.nodes.find((candidate) => candidate.id === nodeId)
    if (!node) {
      this.bus.emit('warning', { text: `节点不存在：${nodeId}` })
      return
    }

    this.state.currentNodeId = node.id
    this.state.visited.push(node.id)
    this.state.transitions.push({ from, to: node.id, kind, optionId, at: this.now() })

    this.applyEffects(node.effects ?? [])

    if (node.type === 'branch') {
      const context = this.buildContext()
      const chosen = node.cases.find((branchCase) => !branchCase.when || evaluateCondition(branchCase.when, context))
      if (!chosen) {
        this.bus.emit('warning', { text: `分支节点 ${node.id} 没有命中任何分支。` })
        return
      }
      this.addLog('system', chosen.note ?? `条件分支命中：${node.id} → ${chosen.next}`, {
        title: '规则分支',
        tone: 'info',
        nodeId: node.id,
      })
      this.transitionTo(chosen.next, node.id, 'branch', undefined, depth + 1)
      return
    }

    if (node.type === 'end') {
      this.addLog('system', node.summary ?? '路径走完，选择与勘查记录进入评分汇总。', {
        title: '材料归档',
        tone: 'neutral',
        nodeId: node.id,
      })
      this.finish()
      return
    }

    this.state.status = node.type === 'decision' ? 'awaiting' : 'running'

    if (node.type === 'narrative' || node.type === 'consequence') {
      this.addLog(node.type === 'consequence' ? 'consequence' : 'narrative', node.text, {
        title: node.title,
        tone: node.type === 'consequence' ? 'caution' : 'neutral',
        nodeId: node.id,
      })
    } else if (node.type === 'decision') {
      this.addLog('decision', node.prompt, {
        title: `决策点 · ${node.title}`,
        tone: 'info',
        nodeId: node.id,
      })
    }

    this.bus.emit('node', { node })
  }

  /** 批量应用效果：指标裁剪到上下界、flag 写入、日志与舞台动作转发。 */
  private applyEffects(effects: Effect[], reason?: string): void {
    const changes: MetricChange[] = []

    // 指标统一裁剪到场景定义的上下界，并汇总为一次 metric 事件。
    for (const effect of effects) {
      if (effect.type === 'metric') {
        const definition = this.scenario.metrics.find((metric) => metric.key === effect.key)
        if (!definition) {
          this.bus.emit('warning', { text: `未知指标：${effect.key}` })
          continue
        }
        const before = this.state.metrics[effect.key] ?? definition.initial
        const next =
          effect.set !== undefined ? effect.set : before + (effect.delta ?? 0)
        const clamped = clamp(next, definition.min, definition.max)
        if (clamped !== before) {
          this.state.metrics[effect.key] = clamped
          changes.push({
            key: effect.key,
            label: definition.label,
            delta: clamped - before,
            value: clamped,
            reason: effect.reason,
          })
        }
      } else if (effect.type === 'flag') {
        this.state.flags[effect.key] = effect.value
      } else if (effect.type === 'log') {
        this.addLog('system', effect.text, {
          title: effect.title,
          tone: effect.tone ?? 'neutral',
        })
      } else if (effect.type === 'stage') {
        this.bus.emit('stage', { action: effect.action, payload: effect.payload, label: effect.label })
      }
    }

    if (changes.length) this.bus.emit('metric', { changes, reason })
  }

  /** 组装条件求值上下文，并补上实时耗时，供 elapsed 条件使用。 */
  private buildContext(): ConditionContext {
    return {
      metrics: { ...this.state.metrics },
      flags: { ...this.state.flags },
      decisions: this.state.decisions,
      visited: this.state.visited,
      inspected: this.state.inspected,
      elapsedMs: Math.max(0, this.now() - this.state.startedAt),
    }
  }

  /** 把黑板状态整理成可持久化的会话快照（深拷贝，避免与运行态共享引用）。 */
  private buildSession(
    score: number,
    evaluation: NonNullable<SimState['evaluation']>,
  ): SessionRecord {
    const finishedAt = this.state.finishedAt ?? this.now()
    return serializable({
      id: this.state.sessionId,
      scenarioId: this.scenario.id,
      scenarioTitle: this.scenario.title,
      scenarioSubtitle: this.scenario.subtitle,
      scenarioVersion: this.scenario.version,
      domain: this.scenario.domain,
      startedAt: this.state.startedAt,
      finishedAt,
      durationMs: Math.max(0, finishedAt - this.state.startedAt),
      decisions: this.state.decisions,
      logs: this.state.logs,
      path: this.state.visited,
      inspected: this.state.inspected,
      transitions: this.state.transitions,
      metrics: this.scenario.metrics.map((metric) => ({
        key: metric.key,
        label: metric.label,
        description: metric.description,
        value: evaluation.metrics[metric.key] ?? metric.initial,
        initial: metric.initial,
        weight: metric.weight,
      })),
      score,
      grade: evaluation.grade,
      gradeLabel: evaluation.gradeLabel,
      gradeTone: evaluation.gradeTone,
      rules: evaluation.rules,
      tags: evaluation.tags,
      outcome: evaluation.outcome,
    })
  }

  /** 追加一条带相对耗时的日志，是推演谱系与复盘面板的唯一数据来源。 */
  private addLog(
    kind: SimState['logs'][number]['kind'],
    text: string,
    extra: {
      title?: string
      tone?: Tone
      nodeId?: string
      optionId?: string
    } = {},
  ): void {
    const at = this.now()
    this.state.logs.push({
      id: ++this.logSeq,
      at,
      elapsedMs: Math.max(0, at - this.state.startedAt),
      kind,
      text,
      ...extra,
    })
  }
}

/** 引擎工厂函数，等价于 `new SimulationEngine`，便于在测试中注入时钟与 id。 */
export function createSimulationEngine(
  scenario: ScenarioDefinition,
  options?: SimulationEngineOptions,
): SimulationEngine {
  return new SimulationEngine(scenario, options)
}
