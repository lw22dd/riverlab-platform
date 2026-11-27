/**
 * 「都江堰：开山导江记」的数据契约。
 *
 * 参考实现把「分水 / 溢流 / 淘滩」的策略组合散落在脚本各处，
 * 这一层把它收成显式类型：视图、水理解析式与三维场景共用同一份定义，
 * 论文里引用的每一个数字也都出自这里的枚举。
 *
 * 量纲约定：概化单位，1 长度单位 ≈ 20 m，流量 q 以「常水年 = 1」归一。
 */
import type * as THREE from 'three'
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js'

/** 开凿工法：火烧水激 / 纯锤凿 / 南端绕行（三组对照） */
export type CarveMode = 'fire' | 'chisel' | 'bypass'
/** 堤身材料：竹笼卵石 / 砌石 / 夯土 */
export type DikeMaterial = 'gabion' | 'stone' | 'earth'
/** 鱼嘴落位：居中 / 偏东 / 偏西 */
export type SplitPosition = 'center' | 'east' | 'west'
/** 飞沙堰堰高：低堰（+0.62）/ 高堰（+1.24） */
export type WeirHeight = 'low' | 'mid' | 'high'
/** 岁修淘滩：深淘见基岩（0.70）/ 浅淘留淤（0.44） */
export type DredgeMode = 'deep' | 'shallow'
/** 水情：跟随剧本自动 / 枯水 / 洪水 */
export type SeasonMode = 'auto' | 'dry' | 'flood'

/** 六项可调分支，组合成一次完整的「改造方案」 */
export interface Branch {
  carve: CarveMode
  dikeMat: DikeMaterial
  splitPos: SplitPosition
  weirHeight: WeirHeight
  dredge: DredgeMode
  season: SeasonMode
}

export type BranchKey = keyof Branch

/** PLAN 平面坐标 [X 东, Z 北] */
export type PlanPoint = [number, number]

/** World 坐标 [X, Y, Z]（z = -PLAN.Z） */
export type WorldPoint = [number, number, number]

/** 横断面表的一行：[Z, 西岸线, 崖脚, 脊线, 东岸线, 脊高] */
export type ProfileRow = [number, number, number, number, number, number]

export interface CameraPreset {
  pos: WorldPoint
  look: WorldPoint
}

/** 五个叙事机位 */
export type PresetKey = 'overview' | 'gorge' | 'yuzui' | 'weir' | 'plain'

/** 天然低矮卵石沙洲（金刚堤依洲而筑的前提） */
export interface SandbarDef {
  id: string
  xy: PlanPoint
  len: number
  wid: number
  deg: number
  crest: number
  forDike: boolean
}

/** 自流渠网的一支 */
export interface CanalDef {
  level: 1 | 2 | 3 | 4
  width: number
  t0: number
  t1: number
  pts: PlanPoint[]
}

/** 史实分级：复原（合理推演）/ 史实（有明确记载）/ 沿革（后世演进） */
export type PhaseTag = '复原' | '史实' | '沿革'

/** 八段剧本的一幕 */
export interface PhaseDef {
  id: string
  title: string
  tag: PhaseTag
  seconds: number
  camFrom: WorldPoint
  camTo: WorldPoint
  look: WorldPoint
  caption: string
  labels: string[]
}

/** 时间轴上的落点 */
export interface PhaseCursor {
  idx: number
  local: number
  u: number
  phase: PhaseDef
}

/** 屏幕标签定义（tier 越小越优先） */
export interface LabelDef {
  key: string
  tier: 1 | 2 | 3 | 4
  text: string
  badge?: string
  at: WorldPoint
}

/** 水理解析式的一次求解结果 */
export interface HydraulicModel {
  /** 归一化流量 0–1 */
  q: number
  /** 鱼嘴偏置：+1 偏东 / 0 居中 / -1 偏西 */
  pOff: number
  B_in: number
  B_out: number
  hIn: number
  hOut: number
  K_in: number
  K_out: number
  /** 内江分水比 */
  R_in: number
  R_out: number
  /** 上游水位 */
  zUp: number
  zCrest: number
  zCrestLow: number
  zCrestHigh: number
  /** 堰顶水头 */
  H: number
  Q_spill: number
  /** 任意堰顶高程下的溢流曲线（用于实验面板画高/低堰两条线） */
  Q_spillAt: (zCrest: number) => { H: number; Q: number }
  /** 排沙效率 */
  eta_sand: number
  vFlow: number
  vc: number
  /** 抗冲系数（<1 即冲毁） */
  Ks: number
  /** 有效水深 */
  hEff: number
  /** 相对过流能力 */
  Qrel: number
}

/** 一帧的派生状态：场景渲染完把它交给视图，视图不再反推任何物理量 */
export interface ChronicleFrame {
  time: number
  idx: number
  u: number
  phase: PhaseDef
  floodLevel: number
  hydraulics: HydraulicModel
  /** 当前分支方案的异常提示（空串表示无警示） */
  alert: string
}

/** 性能与体量读数（对应参考实现的「建模提单」面板） */
export interface ChronicleLedger {
  triangles: number
  drawCalls: number
  fps: number
  /** 金刚堤中轴总长（概化单位） */
  dikeLength: number
}

export interface ChronicleSceneOptions {
  /** 承载 canvas 的容器 */
  stage: HTMLElement
  /** 三级屏幕标签的 HTML 容器 */
  labels: HTMLElement
  /** 竖屏/低端设备：降低像素比上限 */
  mobile?: boolean
}

/** 三维场景对外句柄：视图只调这些方法，不进入场景内部 */
export interface ChronicleScene {
  readonly scene: THREE.Scene
  readonly camera: THREE.PerspectiveCamera
  readonly controls: OrbitControls
  /** 跳到某一时刻并立即绘制 */
  seek(seconds: number): ChronicleFrame
  /** 改分支方案并立即重算（确定性归约，无累积状态） */
  setBranch(patch: Partial<Branch>): ChronicleFrame
  resetBranch(): ChronicleFrame
  setSeason(season: SeasonMode): ChronicleFrame
  setPlaying(playing: boolean): void
  setSpeed(speed: number): void
  setFollowCamera(follow: boolean): void
  setPreset(name: PresetKey): void
  setCamera(from: WorldPoint, look: WorldPoint): void
  /** 推进一帧（秒），返回该帧派生状态 */
  tick(deltaSeconds: number): ChronicleFrame
  resize(width: number, height: number): void
  ledger(): ChronicleLedger
  dispose(): void
}
