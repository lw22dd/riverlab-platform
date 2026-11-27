import { describe, expect, it } from 'vitest'

import { PHASE_STARTS, PHASES, TOTAL_SEC } from '@/three/chronicle'

import {
  DEFAULT_FOCUS_CAMERA,
  FOCUS_CAMERA,
  ambienceSeason,
  focusCamera,
  resolveStageAction,
} from './dujiangyan-chronicle-map'

/** 场景 JSON 里出现过的全部动作名。 */
const ACTIONS = [
  'dujiangyan:cages',
  'dujiangyan:celebrate',
  'dujiangyan:chisel',
  'dujiangyan:cribs',
  'dujiangyan:dredge',
  'dujiangyan:dry',
  'dujiangyan:flood',
  'dujiangyan:gap:flow',
  'dujiangyan:ignite',
  'dujiangyan:quench',
  'dujiangyan:restore',
  'dujiangyan:show:survey',
  'dujiangyan:split:dry',
  'dujiangyan:split:flood',
  'dujiangyan:weir:high',
  'dujiangyan:weir:low',
  'dujiangyan:weir:mid',
  'dujiangyan:reset',
]

/** 场景 JSON 里出现过的全部机位名（`focus` 字段）。 */
const FOCUS_NAMES = [
  'bottleneck',
  'fishmouth',
  'irrigated',
  'irrigation',
  'legacy',
  'maintenance',
  'overview',
  'split',
  'survey',
  'weir',
]

describe('resolveStageAction', () => {  it('登记了场景 JSON 里的每一个动作', () => {
    for (const action of ACTIONS) {
      expect(resolveStageAction(action), action).not.toBeNull()
    }
  })

  it('未登记的动作返回 null', () => {
    expect(resolveStageAction('dujiangyan:unknown')).toBeNull()
    expect(resolveStageAction('')).toBeNull()
  })

  it('时间窗不越过 0 与总时长，且终点不早于起点', () => {
    for (const action of ACTIONS) {
      const directive = resolveStageAction(action)
      if (directive?.seekTo === undefined) continue
      expect(directive.seekTo).toBeGreaterThanOrEqual(0)
      expect(directive.seekTo).toBeLessThanOrEqual(TOTAL_SEC)
      if (directive.playUntil !== undefined) {
        expect(directive.playUntil).toBeGreaterThanOrEqual(directive.seekTo)
        expect(directive.playUntil).toBeLessThanOrEqual(TOTAL_SEC)
      }
    }
  })

  it('凿开宝瓶口落在第三幕的时间范围内', () => {
    const directive = resolveStageAction('dujiangyan:chisel')
    const start = PHASE_STARTS[2]
    const end = start + PHASES[2].seconds
    expect(directive?.seekTo).toBeGreaterThanOrEqual(start)
    expect(directive?.playUntil).toBeLessThanOrEqual(end)
  })

  it('宝瓶口验收要把时间推到凿通之后，且只向前不倒退', () => {
    const directive = resolveStageAction('dujiangyan:gap:flow')
    expect(directive).not.toBeNull()
    // 凿口幕的终点：总干渠到这里已经走到头（波前 0.42），玩家跳读也该看到满渠
    expect(directive?.seekTo).toBe(PHASE_STARTS[2] + 7.6)
    expect(directive?.playUntil).toBeGreaterThan(directive?.seekTo ?? 0)
    // 再往前带一段，好让分干渠（t0 = 0.28）开始起水
    expect(directive?.playUntil).toBeGreaterThan(PHASE_STARTS[3] ?? 0)
  })

  it('四六分水：偏西配枯水，偏东配洪水', () => {
    expect(resolveStageAction('dujiangyan:split:dry')).toMatchObject({
      branch: { splitPos: 'west' },
      season: 'dry',
    })
    expect(resolveStageAction('dujiangyan:split:flood')).toMatchObject({
      branch: { splitPos: 'east' },
      season: 'flood',
    })
  })

  it('堰顶三档各自写入对应高程', () => {
    expect(resolveStageAction('dujiangyan:weir:low')?.branch?.weirHeight).toBe('low')
    expect(resolveStageAction('dujiangyan:weir:mid')?.branch?.weirHeight).toBe('mid')
    expect(resolveStageAction('dujiangyan:weir:high')?.branch?.weirHeight).toBe('high')
  })

  it('踏勘显示热点，复位清空时间轴', () => {
    expect(resolveStageAction('dujiangyan:show:survey')?.showHotspots).toBe(true)
    expect(resolveStageAction('dujiangyan:reset')).toMatchObject({ seekTo: 0, reset: true })
  })

  it('水情动作只改水情，不动时间轴', () => {
    for (const action of ['dujiangyan:dry', 'dujiangyan:flood'] as const) {
      const directive = resolveStageAction(action)
      expect(directive?.seekTo).toBeUndefined()
      expect(directive?.playUntil).toBeUndefined()
      expect(directive?.season).toBe(action === 'dujiangyan:dry' ? 'dry' : 'flood')
    }
  })
})

describe('focusCamera', () => {
  it('每个场景机位都是一条独立机位，且两两不同', () => {
    const names = Object.keys(FOCUS_CAMERA)
    expect(names.length).toBe(10)
    const seen = new Set<string>()
    for (const name of names) {
      const camera = focusCamera(name)
      expect(camera).toBe(FOCUS_CAMERA[name])
      seen.add(`${camera.from.join(',')}|${camera.look.join(',')}`)
    }
    expect(seen.size).toBe(10)
  })

  it('登记了场景 JSON 里用到的每一个 focus（写错会静默回落到全景）', () => {
    for (const name of FOCUS_NAMES) {
      expect(FOCUS_CAMERA[name], name).toBeDefined()
      expect(focusCamera(name), name).toBe(FOCUS_CAMERA[name])
    }
  })

  it('每条机位都在场景尺度内，且看向点低处（拍水面而非天上）', () => {
    for (const { from, look } of Object.values(FOCUS_CAMERA)) {
      const [fx, fy, fz] = from
      const [lx, ly, lz] = look
      const distance = Math.hypot(fx - lx, fy - ly, fz - lz)
      expect(distance).toBeGreaterThan(12)
      expect(distance).toBeLessThan(120)
      expect(ly).toBeLessThan(6)
      expect(fy).toBeGreaterThan(ly)
    }
  })

  it('未知名的机位与缺省机位回落到全景', () => {
    expect(focusCamera()).toBe(DEFAULT_FOCUS_CAMERA)
    expect(focusCamera('no-such-preset')).toBe(DEFAULT_FOCUS_CAMERA)
    expect(DEFAULT_FOCUS_CAMERA).toBe(FOCUS_CAMERA.overview)
  })
})

describe('ambienceSeason', () => {
  it('只有危急档强推洪水位，其余交给脚本', () => {
    expect(ambienceSeason('critical')).toBe('flood')
    expect(ambienceSeason('tense')).toBe('auto')
    expect(ambienceSeason('calm')).toBe('auto')
  })
})
