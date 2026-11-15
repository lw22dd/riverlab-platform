import { parseScenario } from './scenario.schema'
import { assertValidScenario } from './validation'
import type { ScenarioPackage, ScenarioPresentation } from '@/models/presentation.model'
import type { ScenarioDefinition } from '@/models/scenario.model'
import autonomousDriving from './scenarios/autonomous-driving.json'
import buildingCollapse from './scenarios/building-collapse.json'
import dujiangyanBuild from './scenarios/dujiangyan-build.json'
import trolleyProblem from './scenarios/trolley-problem.json'
import trolleyFootbridge from './scenarios/trolley-footbridge.json'

// 注册前先做结构校验与图语义校验，避免把坏配置带进运行时。
function defineScenario(raw: unknown): ScenarioDefinition {
  const scenario = parseScenario(raw)
  assertValidScenario(scenario)
  return scenario
}

export const scenarios: ScenarioDefinition[] = [
  defineScenario(autonomousDriving),
  defineScenario(trolleyProblem),
  defineScenario(trolleyFootbridge),
  defineScenario(buildingCollapse),
  defineScenario(dujiangyanBuild),
]

const presentations: Record<string, ScenarioPresentation> = {
  'autonomous-driving': {
    order: '01',
    glyph: 'autonomous',
    accent: '#0e7490',
    accentRgb: '14, 116, 144',
    gradient: 'linear-gradient(135deg, rgba(14, 116, 144, 0.16), rgba(255, 255, 255, 0.04) 68%)',
    glow: 'rgba(14, 116, 144, 0.16)',
    domainLabel: '算法伦理',
    cardNote: '暴雨夜、决策表与 EDR 记录',
  },
  'trolley-problem': {
    order: '02',
    glyph: 'trolley',
    accent: '#b45309',
    accentRgb: '169, 118, 26',
    gradient: 'linear-gradient(135deg, rgba(169, 118, 26, 0.14), rgba(255, 255, 255, 0.04) 68%)',
    glow: 'rgba(169, 118, 26, 0.14)',
    domainLabel: '道德哲学',
    cardNote: '道岔手柄、75 秒与事后笔录',
  },
  'trolley-footbridge': {
    order: '02B',
    glyph: 'footbridge',
    accent: '#c2410c',
    accentRgb: '194, 65, 12',
    gradient: 'linear-gradient(135deg, rgba(194, 65, 12, 0.16), rgba(255, 255, 255, 0.04) 68%)',
    glow: 'rgba(194, 65, 12, 0.16)',
    domainLabel: '道德哲学',
    cardNote: '天桥、六米落差、一个够重的人',
  },
  'building-collapse': {
    order: '03',
    glyph: 'collapse',
    accent: '#c2410c',
    accentRgb: '194, 65, 12',
    gradient: 'linear-gradient(135deg, rgba(194, 65, 12, 0.14), rgba(255, 255, 255, 0.04) 68%)',
    glow: 'rgba(194, 65, 12, 0.14)',
    domainLabel: '工程伦理',
    cardNote: '污水渗漏、减速带与临边护栏',
  },
  'dujiangyan-build': {
    order: '04',
    glyph: 'dujiangyan',
    accent: '#0f6e84',
    accentRgb: '15, 110, 132',
    gradient: 'linear-gradient(135deg, rgba(15, 110, 132, 0.16), rgba(255, 255, 255, 0.04) 68%)',
    glow: 'rgba(15, 110, 132, 0.16)',
    domainLabel: '工程伦理',
    cardNote: '宝瓶口、鱼嘴、飞沙堰与岁修',
  },
}

export const scenarioPackages: ScenarioPackage[] = scenarios.map((scenario) => ({
  scenario,
  presentation: presentations[scenario.id] ?? {
      order: '00',
      glyph: 'autonomous',
      accent: '#0e7490',
      accentRgb: '14, 116, 144',
      gradient: 'linear-gradient(135deg, rgba(14, 116, 144, 0.16), rgba(255, 255, 255, 0.04) 68%)',
      glow: 'rgba(14, 116, 144, 0.16)',
      domainLabel: '仿真',
      cardNote: scenario.tagline,
    },
}))

export const scenarioById = new Map(scenarios.map((scenario) => [scenario.id, scenario]))
export const packageById = new Map(scenarioPackages.map((entry) => [entry.scenario.id, entry]))

export function getScenario(id: string): ScenarioDefinition | undefined {
  return scenarioById.get(id)
}

export function getScenarioPackage(id: string): ScenarioPackage | undefined {
  return packageById.get(id)
}

export function countDecisionNodes(scenario: ScenarioDefinition): number {
  return scenario.nodes.filter((node) => node.type === 'decision').length
}

export function countDecisionOptions(scenario: ScenarioDefinition): number {
  return scenario.nodes.reduce(
    (sum, node) => sum + (node.type === 'decision' ? node.options.length : 0),
    0,
  )
}
