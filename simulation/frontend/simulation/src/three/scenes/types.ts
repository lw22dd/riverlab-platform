import type { StageHotspot } from '@/models/presentation.model'

/** 构建场景所需的运行时选项：动效偏好与勘查回调。 */
export interface ScenarioSceneOptions {
  reducedMotion: boolean
  cinematicCamera: boolean
  onInspect: (hotspot: StageHotspot) => void
}

/** 运行页操作舞台的统一接口：聚焦、执行动作、氛围、热点、重置与销毁。 */
export interface ScenarioStageHandle {
  focus(preset?: string): void
  applyAction(action: string, payload?: Record<string, unknown>): void
  setAmbience(level: 'calm' | 'tense' | 'critical'): void
  markHotspot(id: string): void
  reset(): void
  pause(paused: boolean): void
  dispose(): void
}

/** 具名机位：相机位置与观察目标，供场景内预设镜头使用。 */
export interface CameraPreset {
  position: [number, number, number]
  target: [number, number, number]
}
