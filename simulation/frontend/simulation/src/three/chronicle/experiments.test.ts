import { describe, expect, it } from 'vitest'
import { buildExperiments } from './experiments'
import { solveHydraulics } from './hydraulics'
import { DEFAULT_BRANCH } from './spec'
import type { Branch } from './types'

const panels = (patch: Partial<Branch> = {}, q = 0.55) => {
  const branch: Branch = { ...DEFAULT_BRANCH, ...patch }
  return buildExperiments(branch, solveHydraulics(branch, q))
}

const panelOf = (id: string, patch: Partial<Branch> = {}, q = 0.55) => {
  const found = panels(patch, q).find((panel) => panel.id === id)
  if (!found) throw new Error(`missing panel ${id}`)
  return found
}

describe('四项定量实验面板', () => {
  it('always renders the same four questions in the same order', () => {
    expect(panels().map((panel) => panel.id)).toEqual(['split', 'spill', 'resilience', 'dredge'])
  })

  it('draws the split curve downward: the same fish mouth favours the inner river when dry', () => {
    const split = panelOf('split')
    const values = split.lines[0].values
    expect(values[0]).toBeGreaterThan(values[values.length - 1])
    expect(values[0] - values[values.length - 1]).toBeGreaterThan(0.12)
    // 曲线必须是单调下降，否则图上会出现折返
    for (let i = 1; i < values.length; i += 1) {
      expect(values[i]).toBeLessThan(values[i - 1] + 1e-9)
    }
  })

  it('shows low crest spilling in flood while high crest seals the channel', () => {
    const low = panelOf('spill', { weirHeight: 'low' }, 1)
    const high = panelOf('spill', { weirHeight: 'high' }, 1)
    expect(low.lines).toHaveLength(2)
    // 洪水时低堰泄掉六成多，高堰只差 0.01 就没过顶（zUp=1.25 vs 堰顶 1.24）
    expect(Number.parseFloat(low.value)).toBeGreaterThan(6)
    expect(Number.parseFloat(high.value)).toBeLessThan(0.05)
  })

  it('keeps the driving line at 1 and puts rammed earth below it from the dry season on', () => {
    const resilience = panelOf('resilience')
    expect(resilience.baseline).toBe(1)
    const earth = resilience.lines.find((line) => line.legend === '夯土 1.3')
    expect(earth).toBeTruthy()
    // 近静止（q→0）时 vFlow=1.2 仍低于 1.3，所以只从枯水段开始判负
    const dryIndex = Math.ceil(0.18 * (resilience.lines[0].values.length - 1))
    for (const value of (earth?.values ?? []).slice(dryIndex)) {
      expect(value).toBeLessThan(1)
    }
    const gabion = resilience.lines.find((line) => line.legend === '竹笼 4.8')
    expect(gabion?.values[gabion.values.length - 1]).toBeCloseTo(1, 1)
  })

  it('compares deep and shallow dredging as two fixed options, not as the current pick', () => {
    const deep = panelOf('dredge', { dredge: 'deep' })
    const shallow = panelOf('dredge', { dredge: 'shallow' })
    const bars = deep.bars ?? []
    expect(bars).toHaveLength(2)
    expect(bars[0].value).toBe(1)
    expect(bars[1].value).toBeCloseTo(Math.pow(0.44 / 0.7, 5 / 3), 4)
    expect(bars[1].value).toBeCloseTo(0.4613, 3)
    // 换当前选择只改高亮，不改两根柱子的高度
    expect(shallow.bars?.map((bar) => bar.value)).toEqual(bars.map((bar) => bar.value))
    expect(shallow.value).toContain('46')
  })

  it('marks the current flow on the shared sample grid', () => {
    for (const panel of panels({}, 1)) {
      expect(panel.marker).toBeGreaterThanOrEqual(0)
      expect(panel.marker).toBeLessThan(25)
    }
    expect(panelOf('split', {}, 0).marker).toBe(0)
    expect(panelOf('split', {}, 1).marker).toBe(24)
  })
})
