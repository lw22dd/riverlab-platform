/**
 * 都江堰渠首的四项定量实验：分水、泄洪排沙、建材抗冲、淘滩深度。
 *
 * 这一层是纯函数：3D 场景、面板读数与单元测试都从同一处取数，避免“画面一套说法、面板另一套数字”。
 * 量纲说明：长度以「概化单位」计（1 单位 ≈ 10 m），流量为相对值（Q = 1 视为常水年岷江来水），
 * 因此下面的系数只保证**单调关系与数量级**符合史料与水利常识，不对应真实河道的水文实测值。
 */

/** 内江/外江的分水摆位：偏内（深窄）＝枯水多引、偏外（宽浅）＝洪水多泄。 */
export type SplitChoice = 'inner' | 'balanced' | 'outer'
/** 飞沙堰堰顶：低顶泄洪排沙，高顶壅水。mid 用于「偏高堰顶」这一错误处置。 */
export type WeirHeight = 'low' | 'mid' | 'high'
/** 鱼嘴与金刚堤用料：竹笼卵石、散石、夯土。 */
export type DikeMaterial = 'gabion' | 'stone' | 'earth'
/** 岁修淘滩深度：淘到卧铁（深）或淘浅了。 */
export type DredgeChoice = 'shallow' | 'deep'
/** 时令：枯水、常水、洪水。 */
export type Season = 'dry' | 'normal' | 'flood'

export interface HydraulicInput {
  season: Season
  weir: WeirHeight
  split: SplitChoice
  material: DikeMaterial
  dredge: DredgeChoice
}

export interface HydraulicResult {
  /** 来水强度 0（枯）→ 1（洪）。 */
  q: number
  /** 内江、外江过水断面宽（相对值）。 */
  innerWidth: number
  outerWidth: number
  /** 内江、外江水深。 */
  innerDepth: number
  outerDepth: number
  /** 输水能力 K ∝ B·h^(5/3)。 */
  innerCapacity: number
  outerCapacity: number
  /** 内江分水比 0–1。 */
  innerShare: number
  /** 上游水位（相对基准面 0）。 */
  upstreamLevel: number
  /** 当前堰顶高程。 */
  crest: number
  /** 堰顶以上的水头，≤0 表示不过堰。 */
  spillHead: number
  /** 过堰流量（相对值）。 */
  spillQ: number
  /** 随水越堰被甩回外江的泥沙比例。 */
  sandShare: number
  /** 内江流速（相对值）。 */
  flowSpeed: number
  /** 该料的不冲流速。 */
  criticalSpeed: number
  /** 抗冲安全系数 = v_c / v，≥1 表示不被冲动。 */
  materialSafety: number
  /** 淘滩后的过水能力相对值（以淘到卧铁为 1）。 */
  dredgeCapacity: number
}

const SEASON_Q: Record<Season, number> = { dry: 0.18, normal: 0.55, flood: 1 }
const SPLIT_OFFSET: Record<SplitChoice, number> = { inner: -1, balanced: 0, outer: 1 }
const WEIR_CREST: Record<WeirHeight, number> = { low: 0.62, mid: 0.88, high: 1.24 }
/** 三种料的不冲流速：竹笼填石整体性最好，散石次之，夯土遇水最易被冲开。 */
const CRITICAL_SPEED: Record<DikeMaterial, number> = { gabion: 4.8, stone: 2.6, earth: 1.3 }
/** 淘滩后的河槽水深：淘到卧铁 0.70，淘浅只剩 0.44。 */
const DREDGE_DEPTH: Record<DredgeChoice, number> = { shallow: 0.44, deep: 0.7 }
/** 飞沙堰顶宽（概化单位）：过堰流量按宽顶堰计算，L 直接进 Q = C·L·H^(3/2)。 */
export const WEIR_LENGTH = 7.5
const WEIR_COEFFICIENT = 1.7

/**
 * 求解一组工况。纯函数、无副作用，3D 场景每帧调用也不会累积状态。
 */
export function solveHydraulics(input: HydraulicInput): HydraulicResult {
  const q = SEASON_Q[input.season]
  const offset = SPLIT_OFFSET[input.split]

  // ① 四六分水：鱼嘴把江面分成内深窄、外宽浅两条槽，靠断面与水深自然分配，不是固定比例。
  const innerWidth = 4.2 * (1 - 0.1 * offset)
  const outerWidth = 5.2 * (1 + 0.06 * offset)
  const innerDepth = 0.7 + 0.55 * q
  const outerDepth = 0.42 + 1.05 * q
  const innerCapacity = innerWidth * innerDepth ** (5 / 3)
  const outerCapacity = outerWidth * outerDepth ** (5 / 3)
  const innerShare = innerCapacity / (innerCapacity + outerCapacity)

  // ② 低作堰：堰顶越低，洪水越容易漫顶把水与沙甩回外江；堰顶一高，内江就壅住了。
  const upstreamLevel = -0.3 + 1.55 * q
  const crest = WEIR_CREST[input.weir]
  const spillHead = Math.max(0, upstreamLevel - crest)
  const spillQ = WEIR_COEFFICIENT * WEIR_LENGTH * spillHead ** 1.5
  // 微弯河道的环流把底沙推向外江一侧；堰顶抬高会让“沙翻不过堰”，排沙效率迅速掉下来。
  const sandShare = 0.78 * (q / (q + 0.6)) * Math.exp(-2.2 * Math.max(0, crest - 0.55))

  // ③ 三料抗冲：流速随来水上涨，各料靠自己的不冲流速给出安全系数。
  const flowSpeed = 1.2 + 3.6 * q
  const criticalSpeed = CRITICAL_SPEED[input.material]
  const materialSafety = Math.min(2.5, criticalSpeed / flowSpeed)

  // ④ 深淘滩：淘得深，同一水位下过的水更多；§六字诀「深淘滩，低作堰」说的就是这两条。
  const dredgeCapacity = (DREDGE_DEPTH[input.dredge] / 0.7) ** (5 / 3)

  return {
    q,
    innerWidth,
    outerWidth,
    innerDepth,
    outerDepth,
    innerCapacity,
    outerCapacity,
    innerShare,
    upstreamLevel,
    crest,
    spillHead,
    spillQ,
    sandShare,
    flowSpeed,
    criticalSpeed,
    materialSafety,
    dredgeCapacity,
  }
}

/**
 * 面板与测试共用的四条判据，措辞就是答辩时要讲的那四句话。
 */
export function experimentVerdicts(result: HydraulicResult): {
  splitBySeason: string
  spillByCrest: string
  materialBySpeed: string
  dredgeByDepth: string
} {
  const innerPct = Math.round(result.innerShare * 100)
  return {
    splitBySeason: `内江过水 ${innerPct}%${result.innerShare > 0.5 ? '：枯水多引灌' : '：洪水多泄洪'}`,
    spillByCrest: result.spillHead > 0
      ? `漫顶水头 ${result.spillHead.toFixed(2)}，过堰流量 ${result.spillQ.toFixed(2)}`
      : '水位未越堰顶，不过堰',
    materialBySpeed: `流速 ${result.flowSpeed.toFixed(2)} / 不冲 ${result.criticalSpeed.toFixed(2)} → 安全系数 ${result.materialSafety.toFixed(2)}`,
    dredgeByDepth: `淘后过水能力 ${(result.dredgeCapacity * 100).toFixed(0)}%（以淘到卧铁为 100%）`,
  }
}
