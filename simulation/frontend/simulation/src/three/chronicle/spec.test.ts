import { describe, expect, it } from 'vitest'
import {
  DEFAULT_BRANCH,
  DIKE_AXIS,
  LABEL_DEFS,
  PHASES,
  PHASE_STARTS,
  PRESETS,
  TOTAL_SEC,
  WEIR_AXIS,
  WEIR_LEN,
  getPhaseAt,
  sampleProfile,
} from './spec'

describe('都江堰剧本规格', () => {
  it('lays the eight phases end to end into a 64 second loop', () => {
    expect(PHASES).toHaveLength(8)
    expect(TOTAL_SEC).toBe(64)
    expect(PHASE_STARTS).toEqual([0, 8, 16, 24, 33, 41, 49, 56])
    expect(PHASES.map((phase) => phase.id)).toEqual([
      'before',
      'fire_quench',
      'chisel',
      'cages',
      'split',
      'weir',
      'maint',
      'harvest',
    ])
  })

  it('keeps the phase starts consistent with the measured seconds', () => {
    let acc = 0
    PHASES.forEach((phase, index) => {
      expect(PHASE_STARTS[index]).toBeCloseTo(acc, 6)
      expect(phase.seconds).toBeGreaterThan(0)
      acc += phase.seconds
    })
    expect(acc).toBe(TOTAL_SEC)
  })

  it('resolves a timestamp into a phase and its in-phase progress', () => {
    expect(getPhaseAt(0)).toMatchObject({ idx: 0, local: 0, u: 0 })
    expect(getPhaseAt(7.999).idx).toBe(0)
    // 段边界归属于下一段，避免「最后 0.001 s 抖动」
    expect(getPhaseAt(8)).toMatchObject({ idx: 1, local: 0, u: 0 })
    expect(getPhaseAt(33).idx).toBe(4)
    expect(getPhaseAt(40).u).toBeCloseTo(7 / 8, 6)
    // 越界夹紧：不会出现 undefined 的当前段
    expect(getPhaseAt(-5).idx).toBe(0)
    expect(getPhaseAt(TOTAL_SEC + 30).idx).toBe(7)
    expect(getPhaseAt(TOTAL_SEC).u).toBeLessThanOrEqual(1)
  })

  it('gives every phase two distinct camera stops inside the stage bounds', () => {
    for (const phase of PHASES) {
      expect(phase.camFrom).not.toEqual(phase.camTo)
      for (const point of [phase.camFrom, phase.camTo, phase.look]) {
        expect(Math.abs(point[0])).toBeLessThan(60)
        expect(point[1]).toBeGreaterThan(0)
        expect(point[1]).toBeLessThan(60)
        expect(Math.abs(point[2])).toBeLessThan(60)
      }
      expect(phase.caption.length).toBeGreaterThan(20)
      expect(phase.labels.length).toBeGreaterThan(0)
    }
  })

  it('reserves five camera presets and a label for every narrative anchor', () => {
    expect(Object.keys(PRESETS)).toEqual(['overview', 'gorge', 'yuzui', 'weir', 'plain'])
    const labelKeys = new Set(LABEL_DEFS.map((def) => def.key))
    for (const phase of PHASES) {
      for (const key of phase.labels) expect(labelKeys.has(key)).toBe(true)
    }
  })

  it('measures the weir crest line as the spill width of the analytic model', () => {
    const folded = WEIR_AXIS.slice(1).reduce(
      (sum, point, i) => sum + Math.hypot(point[0] - WEIR_AXIS[i][0], point[1] - WEIR_AXIS[i][1]),
      0,
    )
    expect(WEIR_LEN).toBeCloseTo(folded, 6)
    expect(WEIR_LEN).toBeGreaterThan(7.4)
    expect(WEIR_LEN).toBeLessThan(7.5)
  })

  it('keeps the cross-section lanes ordered and clamps beyond both ends', () => {
    for (let z = 53.5; z >= -53.5; z -= 2.5) {
      const [rowZ, xW, xECliff, xRCrest, xEEast, ridgeH] = sampleProfile(z)
      expect(rowZ).toBe(z)
      expect(xW).toBeLessThan(xECliff)
      expect(xECliff).toBeLessThan(xRCrest)
      expect(xRCrest).toBeLessThanOrEqual(xEEast)
      expect(ridgeH).toBeGreaterThan(0)
    }
    // 玉垒山主峰在 (-7.8)，脊高最深
    expect(sampleProfile(-7.8)[5]).toBeCloseTo(11.5, 6)
    // 山脊收尖入平原后仍保留 0.32 的余脉
    expect(sampleProfile(-53.5)[5]).toBeCloseTo(0.32, 6)
    // 超出断面表范围时夹到首尾两行，而不是外插出无意义的高程
    expect(sampleProfile(999)[0]).toBe(53.5)
    expect(sampleProfile(-999)[0]).toBe(-53.5)
  })

  it('anchors the fish mouth and the weir on the dike axis', () => {
    expect(DIKE_AXIS[0][1]).toBe(26.25)
    expect(DIKE_AXIS[DIKE_AXIS.length - 1]).toEqual(WEIR_AXIS[0])
  })

  it('ships a default branch that is the documented history line', () => {
    expect(DEFAULT_BRANCH).toEqual({
      carve: 'fire',
      dikeMat: 'gabion',
      splitPos: 'center',
      weirHeight: 'low',
      dredge: 'deep',
      season: 'auto',
    })
  })
})

