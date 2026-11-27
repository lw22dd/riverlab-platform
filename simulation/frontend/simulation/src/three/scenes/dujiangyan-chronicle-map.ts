/**
 * 场景节点指令 → 纪事舞台动作的映射表（纯函数，可单测）。
 *
 * 引擎只认识 `dujiangyan:*` 这类动作名与九个机位名；纪事引擎认识的是「第几幕、几分之几秒」
 * 与三维分支向量。两者之间的对应关系全部收在这一个文件里，适配器只负责执行。
 */

import { PHASES, PHASE_STARTS } from '@/three/chronicle'
import type { Branch, SeasonMode, WorldPoint } from '@/three/chronicle'

/** 一个取景：相机位置与看向点（世界坐标，`p2w(X, Z, y)` 的写法）。 */
export interface FocusCamera {
  from: WorldPoint
  look: WorldPoint
}

/**
 * 场景节点 `focus` → 纪事机位。
 *
 * 每个剧情节点各配一条独立机位：分水（split）与鱼嘴（fishmouth）、岁修（maintenance）
 * 与飞沙堰（weir）、凿宝瓶口（irrigation）与验收见水（irrigated）本来是同一片工地，
 * 但剧情阶段不同，必须换过镜头才能让每步推进都有画面变化。取值是逐个在浏览器里
 * 走查、截图比对后定下的（`tmp/chronicle-cam/`）。
 */
export const FOCUS_CAMERA: Record<string, FocusCamera> = {
  // 全景：河横贯中段、玉垒山居中右、平原在右、上游入口在左
  overview: { from: [-52, 60, 50], look: [8, 0, 0] },
  // 踏勘：逆着江从上游看，视线尽头是挡水的山体（尚未开凿）
  survey: { from: [-40, 34, -30], look: [12, 1, 12] },
  // 峡口：贴着峡谷看火烧崖壁，火苗正好落在凿出的缺口里
  bottleneck: { from: [12, 14, 27], look: [17, 2.5, 17] },
  // 凿宝瓶口：水从凿开的瓶口涌出，缺口在右、内江在左、离堆压在右下
  irrigation: { from: [24, 22, 40], look: [13, 2.5, 16] },
  // 灌区见水：站在平原这一侧回望宝瓶口，干渠的水就在眼前往北推
  irrigated: { from: [-4, 33, -8], look: [31, 0.5, 27] },
  // 鱼嘴：从上游俯看迎水尖与整条金刚堤
  fishmouth: { from: [-22, 16, -42], look: [-12, 1, -25] },
  // 内外分水：站在西岸横看，金刚堤把水一剖为二
  split: { from: [-30, 26, 6], look: [4, 0, 4] },
  // 飞沙堰：堰体居中，溢流的白沫与右侧的宝瓶口同框
  weir: { from: [-14, 20, 36], look: [8, 0.6, 17] },
  // 岁修：凤栖窝淘滩坑居中，石人水则在左上、飞沙堰在右
  maintenance: { from: [-24, 26, -2], look: [8, 0, 10] },
  // 收尾：从平原回望山体与全套工程（缺口、堰、堤、江都在画内）
  legacy: { from: [24, 18, 40], look: [10, 2, 12] },
}

/** 兜底取景：节点没写 focus 或写了没登记的机位时用它。 */
export const DEFAULT_FOCUS_CAMERA: FocusCamera = FOCUS_CAMERA.overview ?? {
  from: [0, 50, 50],
  look: [0, 0, 0],
}

/** 一次舞台指令：跳到哪一秒、播到哪一秒，同时改哪些分支。 */
export interface StageDirective {
  /** 直接跳到这一秒（不播放） */
  seekTo?: number
  /** 从 seekTo 开始播放到这一秒后自动停住 */
  playUntil?: number
  /** 同步写入的分支字段 */
  branch?: Partial<Branch>
  /** 同步写入的水情 */
  season?: SeasonMode
  /** 是否显示三处勘查热点 */
  showHotspots?: boolean
  /** 是否复位分支与时间轴 */
  reset?: boolean
}

/** 第 index 幕内的相对窗口，换算成绝对秒。 */
function window(index: number, from: number, to: number): { seekTo: number; playUntil: number } {
  const start = PHASE_STARTS[index] ?? 0
  const seconds = PHASES[index]?.seconds ?? 0
  return {
    seekTo: start + Math.min(from, seconds),
    playUntil: start + Math.min(to, seconds),
  }
}

/**
 * 把引擎的动作名翻译成舞台指令。未登记的动作返回 null（舞台保持现状）。
 * 动作名与 `src/data/scenarios/dujiangyan-build.json` 里的 `stage.action` 一一对应。
 */
export function resolveStageAction(action: string): StageDirective | null {
  switch (action) {
    case 'dujiangyan:show:survey':
      return { ...window(0, 0.4, 3.0), showHotspots: true }
    case 'dujiangyan:flood':
      return { season: 'flood' }
    case 'dujiangyan:dry':
      return { season: 'dry' }
    case 'dujiangyan:ignite':
      return window(1, 0.15, 3.0)
    case 'dujiangyan:quench':
      return window(1, 3.2, 7.4)
    case 'dujiangyan:chisel':
      return window(2, 0.15, 7.6)
    // 验收见水：凿口幕可能被玩家点「继续」跳过，进节点时把时间推到凿通之后，
    // 再往前带一小段，让总干渠走满、左中右干渠开始起水。只向前、不回退。
    case 'dujiangyan:gap:flow':
      return { seekTo: 23.6, playUntil: 25.4 }
    case 'dujiangyan:cages':
      return window(3, 0.2, 8.3)
    // 四六分水：偏西加宽内江 → 枯水多进内江；偏东加宽外江 → 洪水先走外江
    case 'dujiangyan:split:dry':
      return { ...window(4, 0, 7.4), branch: { splitPos: 'west' }, season: 'dry' }
    case 'dujiangyan:split:flood':
      return { ...window(4, 0, 7.4), branch: { splitPos: 'east' }, season: 'flood' }
    case 'dujiangyan:weir:low':
      return { ...window(5, 0, 7.4), branch: { weirHeight: 'low' } }
    case 'dujiangyan:weir:mid':
      return { ...window(5, 0, 7.4), branch: { weirHeight: 'mid' } }
    case 'dujiangyan:weir:high':
      return { ...window(5, 0, 7.4), branch: { weirHeight: 'high' } }
    case 'dujiangyan:cribs':
      return window(6, 0, 3.2)
    case 'dujiangyan:dredge':
      return { ...window(6, 1.4, 6.2), branch: { dredge: 'deep' } }
    case 'dujiangyan:restore':
      return window(6, 4.0, 6.8)
    case 'dujiangyan:celebrate':
      return window(7, 0, 7.6)
    case 'dujiangyan:reset':
      return { seekTo: 0, reset: true }
    default:
      return null
  }
}

/** 氛围分级 → 水情。紧张与危急都由「critical」走到洪水位，其余交给脚本自动水位。 */
export function ambienceSeason(level: 'calm' | 'tense' | 'critical'): SeasonMode {
  return level === 'critical' ? 'flood' : 'auto'
}

/** 场景机位名 → 纪事取景；未知机位回落到全景。 */
export function focusCamera(name?: string): FocusCamera {
  if (!name) return DEFAULT_FOCUS_CAMERA
  return FOCUS_CAMERA[name] ?? DEFAULT_FOCUS_CAMERA
}
