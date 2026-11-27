/**
 * 四项定量实验——把水理解析式摊成可判读的曲线与柱状对比。
 *
 * 参考实现里这四张图是 canvas 现画的；这里只保留「算什么」，
 * 画法交给视图（SVG），因此采样、读数、判读文案都可以被单测覆盖。
 *
 * 四个问题对应答辩时的四句结论：
 * 1. 分水——同一个鱼嘴在枯水把水送进内江、洪水让外江反超，靠的是断面而不是比例。
 * 2. 溢流——低堰把洪峰泄回外江，高堰封死水道，东侧平原因此受淹。
 * 3. 抗冲——K<1 即水流起动流速超过材料抗冲流速；夯土堤只在近静止时勉强守住，一进枯水就起动。
 * 4. 淘滩——深淘见基岩才能满过流，浅淘留淤后过流能力掉到不足一半。
 */
import { clamp } from './math'
import { DEEP_DEPTH, SHALLOW_DEPTH, solveHydraulics } from './hydraulics'
import type { Branch, HydraulicModel } from './types'

/** 曲线采样点数（q 从 0 到 1 等分） */
export const EXPERIMENT_SAMPLES = 25

/** 流量采样序列 */
export const EXPERIMENT_FLOWS: number[] = Array.from(
  { length: EXPERIMENT_SAMPLES },
  (_, i) => i / (EXPERIMENT_SAMPLES - 1),
)

export type ExperimentTone = 'primary' | 'celadon' | 'accent' | 'muted'

export interface ExperimentLine {
  /** 与 EXPERIMENT_FLOWS 一一对应的采样值 */
  values: number[]
  tone: ExperimentTone
  dashed?: boolean
  /** 图例（多线时必填） */
  legend?: string
}

export interface ExperimentBar {
  label: string
  value: number
  tone: ExperimentTone
}

export interface ExperimentPanel {
  id: 'split' | 'spill' | 'resilience' | 'dredge'
  /** 面板标题 */
  title: string
  /** 主读数（已格式化） */
  value: string
  /** 判读结论 */
  note: string
  /** 曲线（无则空数组） */
  lines: ExperimentLine[]
  /** 当前流量在采样序列中的下标 */
  marker: number
  /** 参考基线（如 K=1 的起动线） */
  baseline?: number
  /** 柱状面板（无则省略） */
  bars?: ExperimentBar[]
}

/** 当前流量落在采样序列的哪一格 */
function markerIndex(q: number): number {
  return Math.round(clamp(q, 0, 1) * (EXPERIMENT_SAMPLES - 1))
}

/**
 * 淘滩两种做法的过流能力：同一支曼宁式里只换有效水深，因此与当前选择无关，
 * 两根柱子始终是「深淘 100% / 浅淘 (0.44/0.70)^(5/3) ≈ 46%」这两个定值对比。
 */
const DREDGE_REL = {
  deep: Math.pow(DEEP_DEPTH / DEEP_DEPTH, 5 / 3),
  shallow: Math.pow(SHALLOW_DEPTH / DEEP_DEPTH, 5 / 3),
} as const

export function buildExperiments(branch: Branch, model: HydraulicModel): ExperimentPanel[] {
  const marker = markerIndex(model.q)
  const flows = EXPERIMENT_FLOWS
  const solveAt = (q: number) => solveHydraulics(branch, q)

  const splitLine: ExperimentLine = {
    values: flows.map((q) => solveAt(q).R_in),
    tone: 'primary',
  }

  const spillLow: ExperimentLine = {
    values: flows.map((q) => solveAt(q).Q_spillAt(model.zCrestLow).Q),
    tone: 'primary',
    legend: '低堰 +0.62',
  }
  const spillHigh: ExperimentLine = {
    values: flows.map((q) => solveAt(q).Q_spillAt(model.zCrestHigh).Q),
    tone: 'accent',
    dashed: true,
    legend: '高堰 +1.24',
  }

  const resilienceOf = (material: Branch['dikeMat']) => {
    const vc = material === 'earth' ? 1.3 : material === 'stone' ? 2.6 : 4.8
    return flows.map((q) => clamp(vc / (1.2 + 3.6 * q), 0, 2.5))
  }

  return [
    {
      id: 'split',
      title: '内外江分水比',
      value: `内江 ${(model.R_in * 100).toFixed(0)}%`,
      note: model.q < 0.5 ? '枯水内江占优 · 四六分水' : '洪水外江反超 · 排走主洪',
      lines: [splitLine],
      marker,
    },
    {
      id: 'spill',
      title: '飞沙堰溢流量',
      value: `${model.Q_spill.toFixed(2)} m³/s`,
      note: `排沙效率 ${(model.eta_sand * 100).toFixed(0)}% · 溢流越大越通沙`,
      lines: [spillLow, spillHigh],
      marker,
    },
    {
      id: 'resilience',
      title: '堤身抗冲裕度 K',
      value: `K = ${model.Ks.toFixed(2)}`,
      note: model.Ks < 1 ? '低于起动流速 · 会冲毁' : '高于起动流速 · 可保',
      lines: [
        { values: resilienceOf('gabion'), tone: 'primary', legend: '竹笼 4.8' },
        { values: resilienceOf('stone'), tone: 'celadon', dashed: true, legend: '砌石 2.6' },
        { values: resilienceOf('earth'), tone: 'accent', dashed: true, legend: '夯土 1.3' },
      ],
      marker,
      baseline: 1,
    },
    {
      id: 'dredge',
      title: '岁修淘滩过流能力',
      value: `相对过流 ${(model.Qrel * 100).toFixed(0)}%`,
      note: model.Qrel < 0.7 ? '浅淘留淤 · 过流锐减' : '深淘见基岩 · 满过流',
      lines: [],
      marker,
      bars: [
        {
          label: '深淘见基岩',
          value: DREDGE_REL.deep,
          tone: branch.dredge === 'deep' ? 'primary' : 'muted',
        },
        {
          label: '浅淘留淤',
          value: DREDGE_REL.shallow,
          tone: branch.dredge === 'shallow' ? 'primary' : 'muted',
        },
      ],
    },
  ]
}
