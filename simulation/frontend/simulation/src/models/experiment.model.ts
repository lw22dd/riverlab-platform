/**
 * 实验门户模型。
 *
 * 首页与实验中心只消费「主题 → 场景变式」这一层，不直接依赖仿真 DSL。
 * 主题封面既可以来自后端返回的图片地址，也可以由前端程序化插画兜底。
 */

export type ExperimentCategory =
  | '道德哲学'
  | '工程伦理'
  | '算法伦理'
  | '生命伦理'
  | '技术伦理'

export type ExperimentArtwork =
  | 'trolley'
  | 'dujiangyan'
  | 'autonomous'
  | 'collapse'
  | 'triage'
  | 'alignment'

export type VariantStatus = 'ready' | 'planned'

export interface ExperimentVariant {
  id: string
  title: string
  subtitle: string
  description: string
  status: VariantStatus
  /** 已接入仿真引擎时对应 /scenario/:id。 */
  scenarioId?: string
  durationMinutes?: number
  decisionCount?: number
  tags: string[]
}

export interface ExperimentPrinciple {
  title: string
  text: string
}

/** 主题附带的实景延伸入口，目前用于都江堰全景漫游。 */
export interface ExperimentPanorama {
  title: string
  subtitle: string
  description: string
  href: string
  tags: string[]
}

export interface ExperimentTheme {
  id: string
  index: string
  title: string
  englishTitle: string
  category: ExperimentCategory
  summary: string
  description: string
  artwork: ExperimentArtwork
  /** 后端可下发封面图；为空时使用 ThemeArtwork 程序化插画。 */
  cover?: string | null
  accent: string
  accentRgb: string
  tags: string[]
  variants: ExperimentVariant[]
  principles: ExperimentPrinciple[]
  panorama?: ExperimentPanorama
  featured?: boolean
}
