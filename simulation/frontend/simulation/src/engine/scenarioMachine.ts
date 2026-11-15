import { assign, setup } from 'xstate'

export type VisibleNodeType = 'narrative' | 'decision' | 'consequence'
export type AmbienceLevel = 'calm' | 'tense' | 'critical'
export type CameraMode = 'idle' | 'moving' | 'inspecting'

export interface ScenarioMachineContext {
  nodeId: string | null
  nodeType: VisibleNodeType | null
  decisionCount: number
}

export type ScenarioMachineEvent =
  | { type: 'BEGIN' }
  | { type: 'NODE'; nodeId: string; nodeType: VisibleNodeType }
  | { type: 'FINISH' }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'CAMERA'; mode: CameraMode }
  | { type: 'AMBIENCE'; level: AmbienceLevel }
  | { type: 'RESET' }

/** 生成节点类型守卫，让状态机只在对应类型的节点事件上迁移。 */
function isNodeOf(type: VisibleNodeType) {
  return ({ event }: { event: ScenarioMachineEvent }) =>
    event.type === 'NODE' && event.nodeType === type
}

/**
 * 场景运行页的表现层状态机。
 *
 * - `flow`、`tempo`、`stage`、`ambience` 四个区域并行运行。
 * - `flow` 是嵌套状态机，对应解释器可见的节点类型。
 * - 舞台节奏使用延迟迁移；相机与氛围区域由 Three.js 适配器通过事件驱动。
 */
export const scenarioMachine = setup({
  types: {
    context: {} as ScenarioMachineContext,
    events: {} as ScenarioMachineEvent,
  },
  guards: {
    isNarrative: isNodeOf('narrative'),
    isDecision: isNodeOf('decision'),
    isConsequence: isNodeOf('consequence'),
  },
  actions: {
    rememberNode: assign({
      nodeId: ({ event }) => (event.type === 'NODE' ? event.nodeId : null),
      nodeType: ({ event }) => (event.type === 'NODE' ? event.nodeType : null),
    }),
    countDecision: assign({
      decisionCount: ({ context }) => context.decisionCount + 1,
    }),
  },
}).createMachine({
  id: 'scenario-presentation',
  initial: 'briefing',
  context: {
    nodeId: null,
    nodeType: null,
    decisionCount: 0,
  },
  on: {
    FINISH: '.finished',
    RESET: '.briefing',
  },
  states: {
    briefing: {
      on: {
        BEGIN: 'live',
      },
    },
    // 运行期四个并行区域：叙事流、节奏、舞台与氛围。
    live: {
      type: 'parallel',
      states: {
        // 可见节点流：叙事 → 决策 → 后果。
        flow: {
          initial: 'narrating',
          states: {
            narrating: {
              on: {
                NODE: [
                  { guard: 'isDecision', target: 'deciding', actions: 'rememberNode' },
                  { guard: 'isConsequence', target: 'resolving', actions: 'rememberNode' },
                  { target: 'narrating', actions: 'rememberNode' },
                ],
              },
            },
            deciding: {
              entry: ['countDecision'],
              on: {
                NODE: [
                  { guard: 'isNarrative', target: 'narrating', actions: 'rememberNode' },
                  { guard: 'isConsequence', target: 'resolving', actions: 'rememberNode' },
                  { target: 'deciding', actions: 'rememberNode' },
                ],
              },
            },
            resolving: {
              on: {
                NODE: [
                  { guard: 'isDecision', target: 'deciding', actions: 'rememberNode' },
                  { guard: 'isNarrative', target: 'narrating', actions: 'rememberNode' },
                  { target: 'resolving', actions: 'rememberNode' },
                ],
              },
            },
          },
        },
        // 暂停只冻结节奏区域，倒计时由界面另行处理。
        tempo: {
          initial: 'active',
          states: {
            active: {
              on: { PAUSE: 'paused' },
            },
            paused: {
              entry: assign({ nodeId: ({ context }) => context.nodeId }),
              on: { RESUME: 'active' },
            },
          },
        },
        stage: {
          initial: 'settled',
          states: {
            settled: {
              on: {
                CAMERA: [
                  { guard: ({ event }) => event.mode === 'inspecting', target: 'inspecting' },
                  { target: 'moving' },
                ],
              },
            },
            moving: {
              after: {
                1400: 'settled',
              },
            },
            inspecting: {
              after: {
                2200: 'settled',
              },
            },
          },
        },
        ambience: {
          initial: 'calm',
          states: {
            calm: {
              on: {
                AMBIENCE: [
                  { guard: ({ event }) => event.level === 'critical', target: 'critical' },
                  { guard: ({ event }) => event.level === 'tense', target: 'tense' },
                  { target: 'calm' },
                ],
              },
            },
            tense: {
              on: {
                AMBIENCE: [
                  { guard: ({ event }) => event.level === 'critical', target: 'critical' },
                  { guard: ({ event }) => event.level === 'calm', target: 'calm' },
                  { target: 'tense' },
                ],
              },
            },
            critical: {
              on: {
                AMBIENCE: [
                  { guard: ({ event }) => event.level === 'calm', target: 'calm' },
                  { guard: ({ event }) => event.level === 'tense', target: 'tense' },
                  { target: 'critical' },
                ],
              },
            },
          },
        },
      },
    },
    finished: {
      type: 'final',
    },
  },
})

export type ScenarioMachine = typeof scenarioMachine

export interface PresentationPhase {
  key: string
  label: string
  hint: string
}

/**
 * 把状态机快照折算成顶栏展示的阶段信息。
 * 同时兼容取 `live` 包裹层与直接传入 flow 状态两种形态。
 */
export function flowPhase(value: unknown): PresentationPhase {
  const root =
    typeof value === 'object' && value !== null && 'live' in value
      ? (value as { live?: unknown }).live
      : value
  const flow =
    typeof root === 'object' && root !== null && 'flow' in root
      ? (root as { flow?: string }).flow
      : undefined
  switch (flow) {
    case 'deciding':
      return { key: 'deciding', label: 'DECISION', hint: '等待你的选择' }
    case 'resolving':
      return { key: 'resolving', label: 'CONSEQUENCE', hint: '选择正在产生后果' }
    case 'narrating':
      return { key: 'narrating', label: 'OBSERVE', hint: '观察与判断' }
    default:
      return { key: 'idle', label: 'STANDBY', hint: '推演尚未开始' }
  }
}
