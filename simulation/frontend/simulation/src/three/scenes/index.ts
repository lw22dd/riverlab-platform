import type { DomainKind } from '@/models/scenario.model'
import { buildAutonomousScene } from './autonomous'
import { buildCollapseScene } from './collapse'
import { buildDujiangyanScene } from './dujiangyan'
import { buildFootbridgeScene } from './footbridge'
import { buildTrolleyScene } from './trolley'
import type { ScenarioSceneOptions, ScenarioStageHandle } from './types'

/** 场景域到具体舞台构建器的唯一分发点，新增场景只需在此登记。 */
export function buildScenarioScene(
  domain: DomainKind,
  host: HTMLElement,
  options: ScenarioSceneOptions,
): ScenarioStageHandle {
  switch (domain) {
    case 'autonomous':
      return buildAutonomousScene(host, options)
    case 'trolley':
      return buildTrolleyScene(host, options)
    case 'footbridge':
      return buildFootbridgeScene(host, options)
    case 'collapse':
      return buildCollapseScene(host, options)
    case 'dujiangyan':
      return buildDujiangyanScene(host, options)
    default:
      throw new Error(`未注册的场景舞台：${String(domain)}`)
  }
}

export type { ScenarioSceneOptions, ScenarioStageHandle }
