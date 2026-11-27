/**
 * 「都江堰：开山导江记」引擎入口。
 *
 * 视图只从这里取东西：
 * - 场景句柄 createChronicleScene（三维表现层，无 DOM 语义）
 * - 剧本与几何规格（spec.ts，论文引用的所有数字）
 * - 水理解析式与四项定量实验的判据（hydraulics.ts，纯函数）
 * - 地形高程（terrain.ts，纯函数，可与标签落点共用）
 */
export { createChronicleScene } from './scene'

export {
  CANALS,
  DEFAULT_BRANCH,
  DIKE_AXIS,
  GAP,
  GAP_DX,
  GAP_DZ,
  GAP_LEN,
  GAP_UX,
  GAP_UZ,
  LABEL_DEFS,
  PHASE_STARTS,
  PHASES,
  PRESETS,
  PROFILE_TABLE,
  SANDBARS,
  TOTAL_SEC,
  WEIR_AXIS,
  WEIR_LEN,
  getPhaseAt,
  sampleProfile,
} from './spec'

export {
  CREST_HIGH,
  CREST_LOW,
  DEEP_DEPTH,
  SAND_Q50,
  SHALLOW_DEPTH,
  SPILL_COEFFICIENT,
  floodLevelAt,
  solveHydraulics,
} from './hydraulics'

export { evalGapDist, sampleTerrain } from './terrain'

export { EXPERIMENT_FLOWS, EXPERIMENT_SAMPLES, buildExperiments } from './experiments'

export type { TerrainSample, TerrainZone } from './terrain'

export type {
  ExperimentBar,
  ExperimentLine,
  ExperimentPanel,
  ExperimentTone,
} from './experiments'

export type {
  Branch,
  BranchKey,
  CameraPreset,
  CanalDef,
  CarveMode,
  ChronicleFrame,
  ChronicleLedger,
  ChronicleScene,
  ChronicleSceneOptions,
  DikeMaterial,
  DredgeMode,
  HydraulicModel,
  LabelDef,
  PhaseCursor,
  PhaseDef,
  PhaseTag,
  PlanPoint,
  PresetKey,
  ProfileRow,
  SandbarDef,
  SeasonMode,
  SplitPosition,
  WeirHeight,
  WorldPoint,
} from './types'
