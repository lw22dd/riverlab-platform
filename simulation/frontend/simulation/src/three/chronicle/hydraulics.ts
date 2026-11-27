/**
 * 都江堰水理的解析式——单一真源。
 *
 * 三维场景的着色器 uniform、面板读数、四项定量实验曲线，全部由
 * solveHydraulics() 这一支纯函数算出，避免「场景一套数、图表另一套数」。
 *
 * 量纲：概化单位 1 长度单位 ≈ 20 m；q 为归一化流量（常水年 = 1，
 * 枯水 0.18、洪水 1.0），因此下面的系数是教学用的概化值而非工程值。
 */
import { clamp, smoothstep } from './math'
import { WEIR_LEN, getPhaseAt } from './spec'
import type { Branch, HydraulicModel, SeasonMode } from './types'

/** 溢流系数（宽顶堰） */
export const SPILL_COEFFICIENT = 1.7
/** 低堰堰顶高程 */
export const CREST_LOW = 0.62
/** 中堰堰顶高程：介于低作堰与高堰之间的折中方案 */
export const CREST_MID = 0.88
/** 高堰堰顶高程：抬高 0.62 → 洪水季封死泄流，东侧平原受淹 */
export const CREST_HIGH = 1.24
/** 排沙效率的半饱和流量 */
export const SAND_Q50 = 8.0
/** 深淘见基岩的有效水深 */
export const DEEP_DEPTH = 0.7
/** 浅淘留淤的有效水深 */
export const SHALLOW_DEPTH = 0.44

/**
 * 给定分支方案与归一化流量，求该时刻的分水、溢流、排沙与抗冲指标。
 * 纯函数：同样的入参永远得到同样的结果（时间轴可任意跳转）。
 */
export function solveHydraulics(branch: Branch, qRaw: number): HydraulicModel {
  const q = clamp(qRaw, 0, 1)

  // 鱼嘴偏置把过水断面重新分配；居中时内外江按 4.20 / 5.20 分流
  const pOff = branch.splitPos === 'east' ? 1 : branch.splitPos === 'west' ? -1 : 0
  const B_in = 4.2 * (1 - 0.1 * pOff)
  const B_out = 5.2 * (1 + 0.06 * pOff)

  // 内江窄而深、外江宽而浅：枯水内江占优，洪水外江反超
  const hIn = 0.7 + 0.55 * q
  const hOut = 0.42 + 1.05 * q

  // 曼宁型输水能力 K ∝ B·h^(5/3)
  const K_in = B_in * Math.pow(hIn, 5 / 3)
  const K_out = B_out * Math.pow(hOut, 5 / 3)
  const R_in = K_in / (K_in + K_out)

  const zUp = -0.3 + 1.55 * q
  const zCrest =
    branch.weirHeight === 'high' ? CREST_HIGH : branch.weirHeight === 'mid' ? CREST_MID : CREST_LOW

  const Q_spillAt = (crest: number): { H: number; Q: number } => {
    const H = Math.max(0, zUp - crest)
    return { H, Q: SPILL_COEFFICIENT * WEIR_LEN * Math.pow(H, 1.5) }
  }
  const spill = Q_spillAt(zCrest)

  // 溢流越大、堰越低，排沙越顺（飞沙堰「正面取水、侧面排沙」）
  const eta_sand = 0.78 * (spill.Q / (spill.Q + SAND_Q50)) * Math.exp(-2.2 * Math.max(0, zCrest - 0.55))

  const vFlow = 1.2 + 3.6 * q
  const vc = branch.dikeMat === 'earth' ? 1.3 : branch.dikeMat === 'stone' ? 2.6 : 4.8
  const Ks = clamp(vc / vFlow, 0, 2.5)

  const hEff = branch.dredge === 'shallow' ? SHALLOW_DEPTH : DEEP_DEPTH
  const Qrel = Math.pow(hEff / DEEP_DEPTH, 5 / 3)

  return {
    q,
    pOff,
    B_in,
    B_out,
    hIn,
    hOut,
    K_in,
    K_out,
    R_in,
    R_out: 1 - R_in,
    zUp,
    zCrest,
    zCrestLow: CREST_LOW,
    zCrestHigh: CREST_HIGH,
    H: spill.H,
    Q_spill: spill.Q,
    Q_spillAt,
    eta_sand,
    vFlow,
    vc,
    Ks,
    hEff,
    Qrel,
  }
}

/**
 * 水情强度 0–1：枯水 0、洪水 1；auto 时由剧本时间轴决定
 * （第 1 段尾、第 5 段中、第 6 段前半各来一次涨落）。
 */
export function floodLevelAt(seconds: number, season: SeasonMode): number {
  if (season === 'dry') return 0
  if (season === 'flood') return 1

  const { idx, u } = getPhaseAt(seconds)
  if (idx === 0) return smoothstep(u, 0.55, 0.78) * (1 - smoothstep(u, 0.9, 1.0)) * 0.95
  if (idx === 4) return smoothstep(u, 0.48, 0.68)
  if (idx === 5) return smoothstep(u, 0.28, 0.5) * (1 - smoothstep(u, 0.84, 1.0))
  return 0
}
