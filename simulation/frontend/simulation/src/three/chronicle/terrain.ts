/**
 * 解析式低模地形：任何一个 (X, Z) 都能直接算出高程与分区。
 *
 * 不做高度图采样、不做网格求交，所以 3D 网格、标签落点、渠网挖槽
 * 用的都是同一个函数；地形因此可以随时按参数（是否已凿开宝瓶口）重算。
 */
import { clamp, distToPolyline, lerp, smoothstep } from './math'
import { CANALS, GAP, GAP_LEN, GAP_UX, GAP_UZ, sampleProfile } from './spec'

/** 宝瓶口出水口（离堆东脚）。江水出峡后先摊进这处深潭，再向东上成都平原干渠。 */
export const GAP_MOUTH: [number, number] = [
  GAP.to[0] + GAP_UX * 0.9,
  GAP.to[1] + GAP_UZ * 0.9,
];
/** 出水潭半径（概化单位）；潭底比平原低 0.62，常水位(0.0)下约 0.28 深。 */
export const POOL_R = 4.3;
export const POOL_DEPTH = 0.62;

/** 出水潭圈定：md=0 为潭心，POOL_R 以外归零（供水着色器复用同一判据）。 */
export function evalPool(mX: number, mZ: number): { md: number; carve: number } {
  const md = Math.hypot(mX - GAP_MOUTH[0], mZ - GAP_MOUTH[1]);
  return { md, carve: POOL_DEPTH * (1 - smoothstep(md, 1.5, POOL_R)) };
}

/** 地表分区：河床 / 西岸漫滩 / 西岸丘陵 / 崖壁 / 山体 / 峡壁 / 渠底 / 平原 */
export type TerrainZone =
  | 'bed'
  | 'westFlood'
  | 'westHill'
  | 'cliff'
  | 'mountain'
  | 'gorgeWall'
  | 'canalBed'
  | 'plain'

export interface TerrainSample {
  /** 高程（概化单位，河床为负） */
  y: number
  zone: TerrainZone
  slope: number
}
/* ============================================================================
 * 3. 解析式低多边形地形高程函数（含不对称陡崖 + 宝瓶口真深槽 + 东平原）
 * ========================================================================== */
export function evalGapDist(X: number, Z: number): { s: number; d: number } {
  const rx = X - GAP.from[0], rz = Z - GAP.from[1];
  const s = rx * GAP_UX + rz * GAP_UZ;
  const d = Math.abs(-rx * GAP_UZ + rz * GAP_UX);
  return { s, d };
}

// opt.carve === false → 返回“宝瓶口从未开凿”的原生山脊面（岩塞顶面必须与两侧山体连续）
export function sampleTerrain(X: number, Z: number, opt?: { carve?: boolean }): TerrainSample {
  const carve = !opt || opt.carve !== false;
  const [, xW, xE, xR, xEast, ridgeH] = sampleProfile(Z);
  const n1 = Math.sin(X * 0.27 + Z * 0.21) * Math.cos(Z * 0.19 - X * 0.15);
  const n2 = Math.sin(X * 0.72 - Z * 0.58) * 0.5;

  // 1) 河床基础高程（东侧内江深 -0.72，西侧外江浅 -0.32）
  if (X >= xW && X <= xE) {
    const u = (X - xW) / Math.max(1, xE - xW);
    const bankRoll = smoothstep(u, 0, 0.12) * smoothstep(1 - u, 0, 0.10);
    const bedDepth = lerp(-0.32, -0.70, smoothstep(u, 0.25, 0.78));
    let y = lerp(0.18, bedDepth, bankRoll) + n2 * 0.03;
    // 宝瓶口西进水喇叭口（伏龙潭深潭）
    const gd = evalGapDist(X, Z);
    if (gd.s > -2.5 && gd.s < 2.2 && gd.d < 3.0) {
      y = Math.min(y, -0.72);
    }
    return { y, zone: 'bed', slope: 0.1 };
  }

  // 2) 西岸洪泛低地 + 远西低丘
  if (X < xW) {
    const dw = xW - X;
    // 紧靠西岸 0~13 单位保持低洼 (+0.38~0.64)，洪水 (+0.72) 可自然漫滩演出“西涝”
    let y = 0.22 + 0.36 * smoothstep(dw, 0, 3.2) + 0.14 * smoothstep(dw, 4, 15);
    y += 3.2 * smoothstep(dw, 15, 36) * (0.75 + 0.25 * n1);
    y += n1 * 0.08 + n2 * 0.04;
    return { y, zone: dw < 14 ? 'westFlood' : 'westHill', slope: dw < 3 ? 0.3 : 0.15 };
  }

  // 3) 玉垒山—离堆连续带状陡脊（xE < X <= xEast）
  if (X <= xEast && Z > -36.5) {
    let hRidge = 0.35;
    let isWestCliff = false;
    if (X <= xR) {
      // 西侧临江迎水面：极陡峭（52°–65°）形成死死挡水的岩壁！
      const t = clamp((X - xE) / Math.max(0.5, xR - xE), 0, 1);
      hRidge = 0.35 + (ridgeH - 0.35) * Math.pow(t, 0.50);
      isWestCliff = t < 0.72;
    } else {
      // 东侧背向平原：清晰折落至成都平原
      const t = clamp((xEast - X) / Math.max(0.5, xEast - xR), 0, 1);
      hRidge = 0.34 + (ridgeH - 0.34) * Math.pow(t, 1.15);
    }
    // 叠加低模岩脊自然起伏（颈部处微减以保证平滑）
    const crestMod = 1.0 + (0.10 * n1 + 0.05 * n2) * smoothstep(ridgeH, 2.0, 7.0);
    let y = hRidge * crestMod;

    // 4) 切割宝瓶口真实倒梯形深槽（未凿前由连续山嘴岩塞完整封堵！）
    const gd = evalGapDist(X, Z);
    if (carve && gd.s >= -1.2 && gd.s <= GAP_LEN + 1.2) {
      // 两端喇叭收束：进水口/出水口宽，喉口收窄
      const flare = 0.75 * (smoothstep(gd.s, 2.2, 0.0) + smoothstep(gd.s, GAP_LEN - 2.2, GAP_LEN));
      const halfW = GAP.wBot + flare;
      const wallY = -0.68 + Math.max(0, gd.d - halfW) * 3.45;
      const alongFade = smoothstep(gd.s, -1.2, 0.2) * smoothstep(gd.s, GAP_LEN + 1.2, GAP_LEN - 0.3);
      const cutY = lerp(y, Math.min(y, wallY), alongFade);
      if (cutY < y - 0.05) {
        return { y: cutY, zone: cutY < 0.15 ? 'bed' : 'gorgeWall', slope: 0.95 };
      }
    }
    return { y, zone: isWestCliff ? 'cliff' : 'mountain', slope: isWestCliff ? 0.85 : 0.45 };
  }

  // 5) 东侧成都平原（开阔平缓 +0.28~0.42）
  const plainY = 0.34 + n1 * 0.045 + n2 * 0.025 + smoothstep(Z, -16, 42) * 0.55;
  // 东侧干渠浅槽微凹（下挖须深于地形网格 0.9 的解析能力，否则沟槽会被顶点抖动抹平）
  let canalCarve = 0;
  for (const c of CANALS) {
    const r = distToPolyline(X, Z, c.pts);
    if (r.dist < c.width * 0.78) {
      const k = 1 - smoothstep(r.dist, c.width * 0.35, c.width * 0.78);
      canalCarve = Math.max(canalCarve, k * (c.level === 1 ? 0.4 : 0.3));
    }
  }
  // 宝瓶口出水潭：出峡第一站，潭底低于常水位 0.28，江水在这里摊开再进干渠
  const pool = evalPool(X, Z).carve;
  const carveAll = Math.max(canalCarve, pool);
  return {
    y: plainY - carveAll,
    zone: carveAll > 0.12 ? 'canalBed' : 'plain',
    slope: 0.05,
  };
}


