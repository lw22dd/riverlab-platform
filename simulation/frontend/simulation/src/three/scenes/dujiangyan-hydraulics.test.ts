import { describe, expect, it } from 'vitest'
import { experimentVerdicts, solveHydraulics, WEIR_LENGTH, type HydraulicInput } from './dujiangyan-hydraulics'

const base: HydraulicInput = { season: 'normal', weir: 'low', split: 'balanced', material: 'gabion', dredge: 'deep' }
const solve = (patch: Partial<HydraulicInput> = {}) => solveHydraulics({ ...base, ...patch })

describe('Dujiangyan hydraulic experiments', () => {
  it('lets the same fish mouth take more water inside in the dry season and release more outside in flood', () => {
    const dry = solve({ season: 'dry' })
    const flood = solve({ season: 'flood' })
    expect(dry.innerShare).toBeGreaterThan(0.55)
    expect(flood.innerShare).toBeLessThan(0.45)
    expect(dry.innerShare - flood.innerShare).toBeGreaterThan(0.15)
    // 洪水时外江宽浅槽的输水能力必须反超内江深窄槽，靠的是断面而不是固定比例。
    expect(dry.innerCapacity).toBeGreaterThan(dry.outerCapacity)
    expect(flood.outerCapacity).toBeGreaterThan(flood.innerCapacity)
  })

  it('shifts the split with the fish mouth position without flipping the seasonal rule', () => {
    const inner = solve({ season: 'flood', split: 'inner' })
    const balanced = solve({ season: 'flood', split: 'balanced' })
    const outer = solve({ season: 'flood', split: 'outer' })
    expect(inner.innerShare).toBeGreaterThan(balanced.innerShare)
    expect(balanced.innerShare).toBeGreaterThan(outer.innerShare)
    expect(outer.innerShare).toBeLessThan(0.45)
  })

  it('spills far more over a low crest than a high one and never spills below the crest', () => {
    const low = solve({ season: 'flood', weir: 'low' })
    const high = solve({ season: 'flood', weir: 'high' })
    expect(low.crest).toBeCloseTo(0.62, 2)
    expect(high.crest).toBeCloseTo(1.24, 2)
    expect(low.spillHead).toBeGreaterThan(0)
    expect(high.spillHead).toBeLessThan(0.05)
    expect(low.spillQ / high.spillQ).toBeGreaterThan(5)
    expect(solve({ season: 'dry' }).spillQ).toBe(0)
    expect(solve({ season: 'normal' }).spillQ).toBe(0)
  })

  it('scales the spill with the square-root-of-three-halves head law and the crest width', () => {
    const flood = solve({ season: 'flood', weir: 'mid' })
    expect(flood.spillQ).toBeCloseTo(1.7 * WEIR_LENGTH * flood.spillHead ** 1.5, 6)
  })

  it('flushes sand over the low crest and lets it settle when the crest is raised', () => {
    const low = solve({ season: 'flood', weir: 'low' })
    const mid = solve({ season: 'flood', weir: 'mid' })
    const high = solve({ season: 'flood', weir: 'high' })
    expect(low.sandShare).toBeGreaterThan(0.3)
    expect(low.sandShare).toBeGreaterThan(high.sandShare + 0.1)
    expect(mid.sandShare).toBeLessThan(low.sandShare)
    expect(solve({ season: 'dry' }).sandShare).toBeLessThan(low.sandShare / 2)
  })

  it('ranks gabion above rubble above rammed earth against the same flood velocity', () => {
    const gabion = solve({ season: 'flood', material: 'gabion' })
    const stone = solve({ season: 'flood', material: 'stone' })
    const earth = solve({ season: 'flood', material: 'earth' })
    expect(gabion.materialSafety).toBeGreaterThan(stone.materialSafety)
    expect(stone.materialSafety).toBeGreaterThan(earth.materialSafety)
    expect(earth.materialSafety).toBeLessThan(1)
    expect(gabion.materialSafety).toBeGreaterThanOrEqual(1)
    expect(gabion.criticalSpeed).toBeCloseTo(4.8, 5)
    expect(earth.criticalSpeed).toBeCloseTo(1.3, 5)
  })

  it('raises the flow capacity only when the dredging reaches the marker depth', () => {
    const deep = solve({ dredge: 'deep' })
    const shallow = solve({ dredge: 'shallow' })
    expect(deep.dredgeCapacity).toBeCloseTo(1, 6)
    expect(shallow.dredgeCapacity).toBeLessThan(0.5)
    expect(shallow.dredgeCapacity).toBeCloseTo((0.44 / 0.7) ** (5 / 3), 6)
  })

  it('reports the four verdicts without changing the numbers', () => {
    const result = solve({ season: 'flood', weir: 'low', material: 'earth' })
    const verdicts = experimentVerdicts(result)
    expect(verdicts.splitBySeason).toContain('内江')
    expect(verdicts.spillByCrest).toContain('过堰流量')
    expect(verdicts.materialBySpeed).toContain('安全系数')
    expect(verdicts.dredgeByDepth).toContain('100%')
    expect(experimentVerdicts(solve({ season: 'dry' })).spillByCrest).toContain('不过堰')
  })
})
