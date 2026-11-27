/**
 * 都江堰的「反演规格」——几何与剧本的唯一真源。
 *
 * 数据逐项对应 docs/dujiangyan/external-brief.md 的史实基线：
 * 峡口本无通道、玉垒山彻底挡水、金刚堤只能依托天然卵石沙洲。
 * PLAN 平面坐标 [X 东, Z 北]；World 坐标 z = -Z。
 */
import { clamp, lerp } from './math'
import type {
  Branch,
  CameraPreset,
  CanalDef,
  PhaseCursor,
  LabelDef,
  PhaseDef,
  PlanPoint,
  PresetKey,
  ProfileRow,
  SandbarDef,
} from './types'
// 反演主槽与带状玉垒山脊控制表（按 Z 由北到南）
export const PROFILE_TABLE: ProfileRow[] = [
  // [Z, xW_before, xE_cliff, xR_crest, xE_east, ridgeH]
  [ 53.5, -49.5, -31.8, -24.5, -18.5,  9.0],
  [ 50.0, -46.0, -28.8, -22.0, -16.2,  9.2],
  [ 41.0, -34.8, -20.8, -13.5,  -5.8,  9.6],
  [ 30.0, -23.5, -10.5,  -3.0,   4.2,  9.8],
  [ 26.25,-19.8,  -5.6,   1.5,   7.4,  9.9], // 鱼嘴锚点 (-12.78, +26.25)
  [ 20.0, -16.1,  -1.5,   6.2,  13.2, 10.2],
  [ 10.0,  -9.9,   5.5,  12.5,  21.0, 10.7],
  [  0.0,  -5.4,   8.8,  16.8,  26.8, 11.1],
  [ -7.8,  -4.6,  10.8,  21.0,  30.5, 11.5], // 玉垒山主峰 (+21.0, -7.8)
  [-13.5,  -3.5,  13.2,  19.2,  25.8,  8.6],
  [-17.0,  -2.7,  14.8,  17.7,  21.6,  5.5], // 宝瓶口颈部 (+16.15, -16.97)
  [-23.5,  -4.2,  12.6,  16.5,  20.6,  4.7], // 离堆孤丘顶 (+16.5, -23.5)
  [-30.5,  -4.6,  11.6,  15.4,  18.2,  2.4],
  [-36.0,  -4.7,  11.0,  14.5,  14.8,  0.35],// 山脊收尖入成都平原
  [-53.5,  -5.2,   9.0,  14.0,  14.0,  0.32],
];

export function sampleProfile(Z: number): ProfileRow {
  const T = PROFILE_TABLE;
  if (Z >= T[0][0]) return T[0];
  const last = T[T.length - 1];
  if (Z <= last[0]) return last;
  for (let i = 0; i < T.length - 1; i++) {
    const a = T[i], b = T[i + 1];
    if (Z <= a[0] && Z >= b[0]) {
      const t = (a[0] - Z) / (a[0] - b[0]);
      // 轻平滑插值避免硬折线
      const s = t * t * (3 - 2 * t) * 0.35 + t * 0.65;
      return [
        Z,
        lerp(a[1], b[1], s),
        lerp(a[2], b[2], s),
        lerp(a[3], b[3], s),
        lerp(a[4], b[4], s),
        lerp(a[5], b[5], s),
      ];
    }
  }
  return last;
}

// 修正后的真金刚堤中轴（对应 dujiangyan_map.json 的 mountain_03，而非外江西侧 holes[0]）
export const DIKE_AXIS: PlanPoint[] = [
  [-12.78,  26.25], // 鱼嘴迎水尖
  [ -8.50,  19.80],
  [ -3.50,  12.00],
  [  0.50,   3.50],
  [  2.60,  -6.50],
  [  2.14, -17.79], // 接飞沙堰北端
];

// 飞沙堰轴线（衔接金刚堤尾至离堆北侧岸）
export const WEIR_AXIS: PlanPoint[] = [
  [ 2.14, -17.79],
  [ 5.60, -17.50],
  [ 9.60, -17.05],
];

// 宝瓶口倒梯形走廊（PLAN 坐标）
export const GAP: { from: PlanPoint; to: PlanPoint; wBot: number } = {
  from: [13.4, -15.6],
  to:   [21.4, -19.8],
  wBot: 0.85,  // 半底宽 → 总底宽 1.7（水面宽 ~2.1，顶宽 ~2.9）
};
export const GAP_DX = GAP.to[0] - GAP.from[0];
export const GAP_DZ = GAP.to[1] - GAP.from[1];
export const GAP_LEN = Math.hypot(GAP_DX, GAP_DZ);
export const GAP_UX = GAP_DX / GAP_LEN;
export const GAP_UZ = GAP_DZ / GAP_LEN;

// 3 处天然低矮卵石沙洲（宽占比 ≤ 16%，枯露 +0.18~0.22，洪水 +0.72 完全没顶）
export const SANDBARS: SandbarDef[] = [
  { id: 'bar1', xy: [-7.2, 18.2], len: 11.0, wid: 2.35, deg: 122, crest: 0.22, forDike: true },
  { id: 'bar2', xy: [ 1.5,  1.5], len: 10.5, wid: 2.15, deg: 104, crest: 0.19, forDike: true },
  { id: 'bar3', xy: [-23.5,36.0], len:  6.4, wid: 1.55, deg: 132, crest: 0.14, forDike: false },
];

// 四级自流灌溉渠网（PLAN 坐标，仅在山脊东侧成都平原）
export const CANALS: CanalDef[] = [
  // L1 总干渠（宝瓶口 → 南桥 → 东南）
  { level: 1, width: 2.2, t0: 0.00, t1: 0.42, pts: [[18.6,-18.4],[22.8,-21.4],[27.2,-25.0],[31.0,-27.9],[38.5,-30.3],[48.5,-33.0]] },
  // L2 分干渠北支（蒲阳河方向）
  { level: 2, width: 1.5, t0: 0.28, t1: 0.62, pts: [[31.0,-27.9],[35.6,-25.0],[41.5,-22.6],[48.5,-21.2]] },
  // L2 分干渠南支（走马/郫江方向）
  { level: 2, width: 1.5, t0: 0.28, t1: 0.72, pts: [[31.0,-27.9],[33.2,-33.8],[36.2,-41.2],[39.5,-49.5]] },
  // L3 支渠 × 6
  { level: 3, width: 1.4, t0: 0.44, t1: 0.78, pts: [[37.5,-24.2],[40.0,-29.2]] },
  { level: 3, width: 1.4, t0: 0.48, t1: 0.84, pts: [[43.0,-22.2],[45.5,-28.0]] },
  { level: 3, width: 1.4, t0: 0.46, t1: 0.82, pts: [[38.5,-30.3],[42.5,-38.8],[46.0,-46.5]] },
  { level: 3, width: 1.4, t0: 0.50, t1: 0.88, pts: [[44.5,-31.9],[47.5,-40.0]] },
  { level: 3, width: 1.4, t0: 0.45, t1: 0.82, pts: [[33.2,-33.8],[26.8,-36.0],[22.5,-39.0]] },
  { level: 3, width: 1.4, t0: 0.54, t1: 0.90, pts: [[36.2,-41.2],[29.0,-44.2],[24.0,-47.5]] },
];

// 5 个相机预设（World [x, y, z]，z = -PLAN.Z）
export const PRESETS: Record<PresetKey, CameraPreset> = {
  overview: { pos: [-46, 56, 36], look: [6.0, 1.5, 2.0] },
  gorge:    { pos: [ -4, 15,  4], look: [16.5, 2.3, 17.5] },
  yuzui:    { pos: [-34, 24,-46], look: [-7.5, 0.8,-15.0] },
  weir:     { pos: [-18, 22, 34], look: [ 6.2, 0.6, 13.0] },
  plain:    { pos: [  8, 36, 12], look: [34.5, 0.5, 34.5] },
};

// 8 阶段标准剧本（总计 64 秒）
export const PHASES: PhaseDef[] = [
  {
    id: 'before', title: '峡口未凿', tag: '复原', seconds: 8,
    camFrom: [-50, 58, 40], camTo: [-42, 50, 32], look: [6.5, 1.6, 2.0],
    caption: '公元前三世纪，岷江独股出山。玉垒山完整陡脊死死挡住东进水路，江水撞崖南折；江心仅存低矮卵石浅洲，汛期漫没西侧低地，山后成都平原却无渠易旱。',
    labels: ['yulei', 'minjiang', 'shoal', 'west-flood', 'plain-dry'],
  },
  {
    id: 'fire_quench', title: '火烧水激', tag: '复原', seconds: 8,
    camFrom: [0, 17, 4], camTo: [6.5, 13.5, 8.5], look: [16.2, 2.4, 17.2],
    caption: '秦无火药。工匠在玉垒山最窄山嘴的崖根积薪炙烤，再引槽局部泼水激冷；砂砾岩沿竖向节理酥裂起缝、逐片剥离，非一日之功，而是积岁推进。',
    labels: ['yulei', 'gap-sealed', 'fire-note', 'period-qin'],
  },
  {
    id: 'chisel', title: '凿开宝瓶口', tag: '复原', seconds: 8,
    camFrom: [6, 15, 7], camTo: [11, 20, 4], look: [17.0, 2.0, 18.2],
    caption: '五层岩壁依次撬剥崩落（史实是多轮炙烧—激裂—撬剥、历岁累进的缩时演示），宽约二十米的倒梯形峡口终于贯通，称“宝瓶口”；南端被凿开的孤丘独立成“离堆”。江水首次穿过玉垒山奔向成都平原。',
    labels: ['baoping', 'lidui', 'yulei', 'time-lapse'],
  },
  {
    id: 'cages', title: '依洲筑鱼嘴', tag: '复原', seconds: 9,
    camFrom: [-38, 26, -50], camTo: [-28, 20, -36], look: [-7.5, 0.9, -15.5],
    caption: '不以刚石硬堵，而是依托天然江心浅洲沉放装满卵石的竹笼：一层层叠压加高成金刚堤，迎水端收成 60° 尖角“鱼嘴”，一江至此被硬生生劈为两汊。',
    labels: ['fishmouth', 'shoal-base', 'gabion-note', 'period-tang'],
  },
  {
    id: 'split', title: '内外分水', tag: '史实', seconds: 8,
    camFrom: [-34, 52, 24], camTo: [-24, 46, 20], look: [1.0, 0.5, 2.0],
    caption: '前半枯水：深槽内江呈深碧密流，收水约六成；后半洪水：外江拓宽转浑黄猛泻排沙，内江受宝瓶口束控保持清稳——后世将此动态机制概称“四六分水”。',
    labels: ['fishmouth', 'inner', 'outer', 'baoping'],
  },
  {
    id: 'weir', title: '飞沙堰溢流', tag: '沿革', seconds: 8,
    camFrom: [-20, 23, 35], camTo: [-12, 18, 28], look: [6.8, 0.8, 15.5],
    caption: '金刚堤尾修筑低矮笼石溢流堰（唐代定型称飞沙堰）：枯水拦水入宝瓶口，洪水顶托即自动漫顶，弯道离心力把粗沙甩回外江，护住下游平原不涝。',
    labels: ['feishayan', 'baoping', 'inner', 'outer', 'period-ming'],
  },
  {
    id: 'maint', title: '岁修淘滩', tag: '沿革', seconds: 7,
    camFrom: [24, 20, 14], camTo: [17, 15, 10], look: [5.5, 0.5, -1.5],
    caption: '冬春枯水以传统三脚截流架（后世称杩槎）断内江，堰工下床深淘淤沙至天然基岩底标，并凭岸畔“石人水则”校水位——后世凝练为“深淘滩，低作堰”（秦代无卧铁）。',
    labels: ['macha', 'dredge', 'stone-gauge'],
  },
  {
    id: 'harvest', title: '天府得水', tag: '复原', seconds: 8,
    camFrom: [10, 35, 12], camTo: [-32, 54, 34], look: [33.0, 0.5, 32.0],
    caption: '江水经宝瓶口入总干渠，自南桥扇形分入走马河、蒲阳河与各级支渠，逐格润透旱原沃野。从此“水旱从人，不知饥馑”，成都平原方得天府之名。',
    labels: ['baoping', 'canals', 'plain-green', 'yulei'],
  },
];
export const LABEL_DEFS: LabelDef[] = [
  // L1 常驻锚
  { key: 'yulei',       tier: 1, text: '玉垒山',             at: [21.0, 12.6,  7.8] },
  { key: 'minjiang',    tier: 1, text: '岷江（单股正流）',   at: [-20.0, 3.0,-32.0] },
  { key: 'inner',       tier: 1, text: '内江',               at: [  5.5, 2.8,  2.0] },
  { key: 'outer',       tier: 1, text: '外江',               at: [ -1.8, 2.8, 12.0] },
  // L2 阶段主角
  { key: 'shoal',       tier: 2, text: '天然浅洲（洪期没顶）',at: [ -7.2, 2.0,-18.2] },
  { key: 'west-flood',  tier: 2, text: '西侧低地 · 汛期漫涝',at: [-16.0, 2.5, 16.0] },
  { key: 'plain-dry',   tier: 2, text: '成都平原 · 无渠易旱',at: [ 36.0, 2.6, 36.0] },
  { key: 'gap-sealed',  tier: 2, text: '玉垒山嘴（完整阻水）',at: [ 16.4, 6.8, 17.2] },
  { key: 'baoping',     tier: 2, text: '宝瓶口',             at: [ 16.5, 6.6, 17.2] },
  { key: 'lidui',       tier: 2, text: '离堆',               at: [ 16.5, 5.8, 23.8] },
  { key: 'fishmouth',   tier: 2, text: '鱼嘴（60°分水尖）',  at: [-12.8, 3.2,-26.3] },
  { key: 'shoal-base',  tier: 2, text: '依天然洲叠笼成堤',   at: [ -3.5, 2.6,-11.5] },
  { key: 'feishayan',   tier: 2, text: '飞沙堰',             at: [  5.6, 2.8, 17.5] },
  { key: 'dredge',      tier: 2, text: '凤栖窝 · 深淘见基岩',at: [  7.2, 2.2,  5.5] },
  { key: 'canals',      tier: 2, text: '总干渠 → 扇形支渠',  at: [ 31.5, 2.6, 28.0] },
  { key: 'plain-green', tier: 2, text: '天府之国 · 得水沃野',at: [ 37.5, 2.6, 38.5] },
  // L3 史实/沿革注脚
  { key: 'fire-note',   tier: 3, text: '崖根炙烤·引槽激裂',  badge: '推论', at: [14.2, 3.8, 16.2] },
  { key: 'gabion-note', tier: 3, text: '竹笼装卵石',         badge: '史实', at: [ 0.5, 2.8, -3.5] },
  { key: 'macha',       tier: 3, text: '截流木架（后世称杩槎）',badge: '沿革', at: [4.2, 4.2, -8.1] },
  { key: 'stone-gauge', tier: 3, text: '石人水则（秦代标尺）', badge: '史实', at: [12.3, 2.8, 13.5] },
  { key: 'time-lapse',  tier: 3, text: '多轮循环 · 历岁缩时', badge: '缩时', at: [17.2, 8.5, 15.0] },
  // L4 历史分期角标（同一工程被后世不断改造：秦凿离堆 → 汉唐竹笼 → 明清砌石与定名）
  { key: 'period-qin',  tier: 4, text: '战国秦 · 凿离堆（《史记·河渠书》）', badge: '分期 1', at: [13.0, 5.4, 17.0] },
  { key: 'period-tang', tier: 4, text: '汉唐 · 竹笼壅水 / 侍郎堰', badge: '分期 2', at: [-8.0, 6.2, -24.0] },
  { key: 'period-ming', tier: 4, text: '明清 · 砌石鱼嘴 / 定名飞沙堰', badge: '分期 3', at: [6.4, 6.4, 15.5] },
];

/** 八段剧本总时长（秒） */
export const TOTAL_SEC: number = PHASES.reduce((sum, phase) => sum + phase.seconds, 0)

/** 每一段的起始时刻（秒） */
export const PHASE_STARTS: number[] = PHASES.map((_, i) =>
  PHASES.slice(0, i).reduce((sum, phase) => sum + phase.seconds, 0),
)

/** 飞沙堰轴线长度——溢流公式里的堰宽，由 WEIR_AXIS 折线积分得到 */
export const WEIR_LEN: number = WEIR_AXIS.reduce((sum, point, i) => {
  if (i === 0) return 0
  const prev = WEIR_AXIS[i - 1]
  return sum + Math.hypot(point[0] - prev[0], point[1] - prev[1])
}, 0)

/** 默认分支：史实主线的「标准解」，六项全部取记载中最稳的一档 */
export const DEFAULT_BRANCH: Branch = {
  carve: 'fire',
  dikeMat: 'gabion',
  splitPos: 'center',
  weirHeight: 'low',
  dredge: 'deep',
  season: 'auto',
}

/** 时间轴落点：把秒数换算成「第几段 + 段内进度」 */
export function getPhaseAt(seconds: number): PhaseCursor {
  const ct = clamp(seconds, 0, TOTAL_SEC - 0.0001)
  let idx = 0
  while (idx < PHASES.length - 1 && ct >= PHASE_STARTS[idx] + PHASES[idx].seconds) idx++
  const local = ct - PHASE_STARTS[idx]
  return { idx, local, u: local / PHASES[idx].seconds, phase: PHASES[idx] }
}

