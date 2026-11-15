/**
 * 展示层模型。
 *
 * 承载与仿真无关的视觉元数据：场景卡片的主题色、首页排序、Three.js 热点标签。
 * 调整配色或编排顺序不会触碰 DSL 与内核。
 */

import type { Tone } from './common.model'
import type { ScenarioDefinition } from './scenario.model'

export type ScenarioGlyphKind =
  | 'autonomous'
  | 'trolley'
  | 'footbridge'
  | 'collapse'
  | 'dujiangyan'

export interface ScenarioPresentation {
  order: string
  glyph: ScenarioGlyphKind
  accent: string
  accentRgb: string
  gradient: string
  glow: string
  domainLabel: string
  cardNote: string
}

export interface ScenarioPackage {
  scenario: ScenarioDefinition
  presentation: ScenarioPresentation
}

export interface StageHotspot {
  id: string
  label: string
  detail: string
  tone?: Tone
}
