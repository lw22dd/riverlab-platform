/**
 * 「都江堰：开山导江记」的数值与几何小工具。
 *
 * 全部是纯函数：无 DOM、无随机源（噪声来自确定性 hash2）。
 * 这样三维场景、实验曲线与单元测试拿到的永远是同一组数字，
 * 时间轴任意跳转/复位也能得到唯一结果。
 */
import * as THREE from 'three'

export const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v))

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t

/**
 * 三次平滑插值。注意 a > b 时同样是合法的反向斜坡（参考实现依赖这一点做「淡出」），
 * 因此这里不做 a < b 的断言。
 */
export function smoothstep(x: number, a: number, b: number): number {
  const t = clamp((x - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}

export const invLerp = (x: number, a: number, b: number): number => clamp((x - a) / (b - a), 0, 1)

/** PLAN 平面坐标 [X 东, Z 北] → World 坐标 [X, Y, -Z] */
export const p2w = (X: number, Z: number, y = 0): THREE.Vector3 => new THREE.Vector3(X, y, -Z)

/** 确定性 2D 噪声（0–1），用来替代 Math.random 以保住「结果唯一」 */
export function hash2(x: number, y: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123
  return s - Math.floor(s)
}

export interface SegmentHit {
  d2: number
  t: number
  cx: number
  cy: number
}

/** 点到线段距离的平方，同时给出投影参数与投影点 */
export function distToSegmentSq(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): SegmentHit {
  const dx = bx - ax
  const dy = by - ay
  const t = clamp(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1), 0, 1)
  const cx = ax + dx * t
  const cy = ay + dy * t
  return { d2: (px - cx) ** 2 + (py - cy) ** 2, t, cx, cy }
}

export interface PolylineHit {
  /** 点到折线的最短距离（不是平方） */
  dist: number
  /** 最近的那一段的下标 */
  seg: number
  /** 在该段上的投影参数 0–1 */
  t: number
}

export function distToPolyline(
  px: number,
  py: number,
  pts: ReadonlyArray<readonly [number, number]>,
): PolylineHit {
  let best = Infinity
  let bestSeg = 0
  let bestT = 0
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i] as readonly [number, number]
    const b = pts[i + 1] as readonly [number, number]
    const r = distToSegmentSq(px, py, a[0], a[1], b[0], b[1])
    if (r.d2 < best) {
      best = r.d2
      bestSeg = i
      bestT = r.t
    }
  }
  return { dist: Math.sqrt(best), seg: bestSeg, t: bestT }
}
