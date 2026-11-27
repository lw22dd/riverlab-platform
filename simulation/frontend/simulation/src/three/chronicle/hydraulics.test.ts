import { describe, expect, it } from 'vitest'
import { CREST_HIGH, CREST_LOW, DEEP_DEPTH, SHALLOW_DEPTH, floodLevelAt, solveHydraulics } from './hydraulics'
import { DEFAULT_BRANCH, WEIR_LEN } from './spec'
import type { Branch } from './types'

const solve = (patch: Partial<Branch> = {}, q = 0.55) => solveHydraulics({ ...DEFAULT_BRANCH, ...patch }, q)

describe('都江堰水理解析式', () => {
  it('lets the same fish mouth take more water inside in the dry season and release more outside in flood', () => {
    const dry = solve({}, 0.18)
    const flood = solve({}, 1)
    expect(dry.R_in).toBeGreaterThan(0.52)
    expect(flood.R_in).toBeLessThan(0.42)
    expect(dry.R_in - flood.R_in).toBeGreaterThan(0.12)
    // 反超来自断面（窄深 vs 宽浅）而不是写死的比例
    expect(dry.K_in).toBeGreaterThan(dry.K_out)
    expect(flood.K_out).toBeGreaterThan(flood.K_in)
  })

  it('shifts the split with the fish mouth position without flipping the seasonal rule', () => {
    const east = solve({ splitPos: 'east' }, 1)
    const center = solve({ splitPos: 'center' }, 1)
    const west = solve({ splitPos: 'west' }, 1)
    expect(east.R_in).toBeLessThan(center.R_in)
    expect(center.R_in).toBeLessThan(west.R_in)
    expect(east.pOff).toBe(1)
    expect(west.pOff).toBe(-1)
  })

  it('spills far more over a low crest than a high one and never spills below the crest', () => {
    const low = solve({ weirHeight: 'low' }, 1)
    const high = solve({ weirHeight: 'high' }, 1)
    expect(low.zCrest).toBe(CREST_LOW)
    expect(high.zCrest).toBe(CREST_HIGH)
    expect(low.Q_spill).toBeGreaterThan(high.Q_spill * 10)
    // 枯水时上游水位低于堰顶，堰不溢流
    const dry = solve({ weirHeight: 'low' }, 0.05)
    expect(dry.H).toBe(0)
    expect(dry.Q_spill).toBe(0)
    // 同一支曲线可以直接取任意堰顶高程，供实验面板画两条线
    expect(low.Q_spillAt(CREST_HIGH).Q).toBeCloseTo(high.Q_spill, 9)
  })

  it('scales overflow with weir length and the 3/2 head law', () => {
    const model = solve({ weirHeight: 'low' }, 1)
    expect(model.Q_spill).toBeCloseTo(1.7 * WEIR_LEN * Math.pow(model.H, 1.5), 9)
  })

  it('rates earth as breachable and gabion as holding at flood speed', () => {
    const gabion = solve({ dikeMat: 'gabion' }, 1)
    const stone = solve({ dikeMat: 'stone' }, 1)
    const earth = solve({ dikeMat: 'earth' }, 1)
    expect(gabion.vc).toBeCloseTo(4.8, 6)
    expect(stone.vc).toBeCloseTo(2.6, 6)
    expect(earth.vc).toBeCloseTo(1.3, 6)
    expect(gabion.Ks).toBeGreaterThan(stone.Ks)
    expect(stone.Ks).toBeGreaterThan(earth.Ks)
    // K<1 即水流起动流速超过材料抗冲流速——夯土堤在洪水里必然溃口
    expect(earth.Ks).toBeLessThan(1)
    expect(gabion.Ks).toBeGreaterThanOrEqual(1)
    // 同一条夯土堤在枯水期仍比洪水期安全，但整个量程都在起动线以下：
    // 这正是「夯土不可用于金刚堤」的定量结论
    expect(solve({ dikeMat: 'earth' }, 0.18).Ks).toBeGreaterThan(solve({ dikeMat: 'earth' }, 1).Ks)
    expect(solve({ dikeMat: 'earth' }, 0.18).Ks).toBeLessThan(1)
  })

  it('collapses intake capacity when the river bed is dredged too shallow', () => {
    const deep = solve({ dredge: 'deep' })
    const shallow = solve({ dredge: 'shallow' })
    expect(deep.hEff).toBe(DEEP_DEPTH)
    expect(shallow.hEff).toBe(SHALLOW_DEPTH)
    expect(deep.Qrel).toBeCloseTo(1, 6)
    expect(shallow.Qrel).toBeCloseTo(Math.pow(SHALLOW_DEPTH / DEEP_DEPTH, 5 / 3), 9)
    expect(shallow.Qrel).toBeGreaterThan(0.4)
    expect(shallow.Qrel).toBeLessThan(DEEP_DEPTH / SHALLOW_DEPTH)
  })

  it('sends more sediment out as the overflow grows and the crest drops', () => {
    const low = solve({ weirHeight: 'low' }, 1)
    const high = solve({ weirHeight: 'high' }, 1)
    expect(low.eta_sand).toBeGreaterThan(high.eta_sand)
    expect(low.eta_sand).toBeGreaterThan(0.25)
    expect(low.eta_sand).toBeLessThanOrEqual(0.78)
    const quiet = solve({ weirHeight: 'low' }, 0.1)
    expect(quiet.eta_sand).toBeLessThan(low.eta_sand)
  })

  it('clamps the flow input so the timeline cannot produce out-of-range numbers', () => {
    expect(solve({}, -3).q).toBe(0)
    expect(solve({}, 9).q).toBe(1)
    expect(solve({}, 0.5).R_out).toBeCloseTo(1 - solve({}, 0.5).R_in, 12)
  })
})

describe('水情强度曲线', () => {
  it('pins the manual seasons to their extremes', () => {
    expect(floodLevelAt(0, 'dry')).toBe(0)
    expect(floodLevelAt(30, 'flood')).toBe(1)
    expect(floodLevelAt(63, 'flood')).toBe(1)
  })

  it('raises and drops the flood inside the scripted phases only', () => {
    // 第一段尾：涨水后回落
    expect(floodLevelAt(1, 'auto')).toBe(0)
    expect(floodLevelAt(7.0, 'auto')).toBeGreaterThan(0.3)
    // 第二、三段：开凿过程中水位平复
    expect(floodLevelAt(12, 'auto')).toBe(0)
    // 第五段（内外分水）内涨水，永远保持在 [0, 1]
    for (let t = 0; t <= 64; t += 0.5) {
      const level = floodLevelAt(t, 'auto')
      expect(level).toBeGreaterThanOrEqual(0)
      expect(level).toBeLessThanOrEqual(1)
    }
  })
})

