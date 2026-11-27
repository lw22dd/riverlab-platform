<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import {
  DEFAULT_BRANCH,
  PHASES,
  PHASE_STARTS,
  TOTAL_SEC,
  buildExperiments,
  createChronicleScene,
} from '@/three/chronicle'
import type {
  Branch,
  ChronicleFrame,
  ChronicleLedger,
  ChronicleScene,
  ExperimentPanel,
  PresetKey,
} from '@/three/chronicle'
import PhaseRail from '@/components/chronicle/PhaseRail.vue'
import CaptionDeck from '@/components/chronicle/CaptionDeck.vue'
import BranchLab from '@/components/chronicle/BranchLab.vue'
import BriefDrawer from '@/components/chronicle/BriefDrawer.vue'

const PRESET_BUTTONS: Array<{ key: PresetKey; label: string }> = [
  { key: 'overview', label: '全景' },
  { key: 'gorge', label: '宝瓶口' },
  { key: 'yuzui', label: '鱼嘴' },
  { key: 'weir', label: '飞沙堰' },
  { key: 'plain', label: '灌区' },
]

const stageRef = ref<HTMLElement | null>(null)
const labelsRef = ref<HTMLElement | null>(null)

const frame = ref<ChronicleFrame | null>(null)
const branch = ref<Branch>({ ...DEFAULT_BRANCH })
const panels = ref<ExperimentPanel[]>([])
const ledger = ref<ChronicleLedger>({ triangles: 0, drawCalls: 0, fps: 60, dikeLength: 0 })

const playing = ref(true)
const speed = ref(1)
const follow = ref(true)
const preset = ref<PresetKey>('overview')
const showLab = ref(false)
const showBrief = ref(false)

const currentIdx = computed(() => frame.value?.idx ?? 0)
const progress = computed(() => frame.value?.u ?? 0)
const currentPhase = computed(() => frame.value?.phase ?? PHASES[0])
const currentTime = computed(() => frame.value?.time ?? 0)
const alert = computed(() => frame.value?.alert ?? '')

let scene: ChronicleScene | null = null
let raf = 0
let lastStamp = 0
let ledgerStamp = 0
let panelKey = ''

const branchSignature = (value: Branch): string =>
  `${value.carve}|${value.dikeMat}|${value.splitPos}|${value.weirHeight}|${value.dredge}|${value.season}`

/** 分水比与溢流随水情连续变化，按 0.01 的流量步长重算四张图，避免每帧重建面板 */
function syncPanels(next: ChronicleFrame): void {
  const key = `${next.floodLevel.toFixed(2)}|${branchSignature(branch.value)}`
  if (key === panelKey) return
  panelKey = key
  panels.value = buildExperiments(branch.value, next.hydraulics)
}

function loop(stamp: number): void {
  raf = requestAnimationFrame(loop)
  if (!scene) return
  const delta = lastStamp === 0 ? 0 : Math.min(0.05, (stamp - lastStamp) / 1000)
  lastStamp = stamp

  const next = scene.tick(delta)
  frame.value = next
  syncPanels(next)

  if (stamp - ledgerStamp > 480) {
    ledgerStamp = stamp
    ledger.value = scene.ledger()
  }
}

function doSeek(seconds: number): void {
  if (!scene) return
  frame.value = scene.seek(seconds)
  lastStamp = 0
  syncPanels(frame.value)
}

function togglePlay(): void {
  playing.value = !playing.value
  scene?.setPlaying(playing.value)
}

function changeSpeed(value: number): void {
  speed.value = value
  scene?.setSpeed(value)
}

function changeFollow(value: boolean): void {
  follow.value = value
  scene?.setFollowCamera(value)
}

function jumpToPhase(index: number): void {
  const start = PHASE_STARTS[index]
  if (start === undefined) return
  if (!follow.value) changeFollow(true)
  doSeek(start + 0.001)
}

function changePreset(key: PresetKey): void {
  preset.value = key
  scene?.setPreset(key)
  changeFollow(false)
}

function applyBranch(next: Branch): void {
  branch.value = next
  if (!scene) return
  const nextFrame = scene.setBranch(next)
  frame.value = nextFrame
  syncPanels(nextFrame)
}

function resetBranch(): void {
  branch.value = { ...DEFAULT_BRANCH }
  if (!scene) return
  const nextFrame = scene.resetBranch()
  frame.value = nextFrame
  syncPanels(nextFrame)
}

function resetAll(): void {
  resetBranch()
  playing.value = true
  scene?.setPlaying(true)
  changeFollow(true)
  preset.value = 'overview'
  doSeek(0)
}

function onKey(event: KeyboardEvent): void {
  const target = event.target
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return
  if (event.metaKey || event.ctrlKey || event.altKey) return

  if (event.code === 'Space') {
    event.preventDefault()
    togglePlay()
    return
  }
  if (event.code === 'ArrowLeft') {
    event.preventDefault()
    doSeek(Math.max(0, currentTime.value - 2))
    return
  }
  if (event.code === 'ArrowRight') {
    event.preventDefault()
    doSeek(Math.min(TOTAL_SEC - 0.001, currentTime.value + 2))
    return
  }
  if (/^Digit[1-8]$/.test(event.code)) {
    const index = Number(event.code.slice(5)) - 1
    jumpToPhase(index)
  }
}

let resizeObserver: ResizeObserver | null = null

function onControlStart(): void {
  if (!follow.value) return
  follow.value = false
  scene?.setFollowCamera(false)
}

onMounted(() => {
  const stage = stageRef.value
  const labels = labelsRef.value
  if (!stage || !labels) return

  scene = createChronicleScene({
    stage,
    labels,
    mobile: window.innerWidth < 820,
  })
  scene.setPlaying(playing.value)
  scene.setSpeed(speed.value)
  scene.setFollowCamera(follow.value)
  scene.controls.addEventListener('start', onControlStart)

  frame.value = scene.seek(0)
  ledger.value = scene.ledger()
  syncPanels(frame.value)

  resizeObserver = new ResizeObserver(() => {
    const width = stage.clientWidth
    const height = stage.clientHeight
    if (width > 0 && height > 0) scene?.resize(width, height)
  })
  resizeObserver.observe(stage)

  window.addEventListener('keydown', onKey)
  raf = requestAnimationFrame(loop)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  window.removeEventListener('keydown', onKey)
  resizeObserver?.disconnect()
  resizeObserver = null
  scene?.controls.removeEventListener('start', onControlStart)
  scene?.dispose()
  scene = null
})
</script>

<template>
  <main class="chronicle">
    <div ref="stageRef" class="chronicle__stage" />

    <header class="chronicle__bar">
      <RouterLink class="chronicle__back" to="/experiments/dujiangyan">
        <span aria-hidden="true">←</span> 都江堰 · 主题
      </RouterLink>

      <div class="chronicle__ident">
        <span class="rl-eyebrow">REVERSE-ENGINEERED CHRONICLE</span>
        <h1 class="chronicle__name">开山导江记</h1>
      </div>

      <div class="chronicle__tools">
        <div class="chronicle__presets" role="group" aria-label="机位">
          <button
            v-for="item in PRESET_BUTTONS"
            :key="item.key"
            type="button"
            :class="{ 'is-on': preset === item.key }"
            @click="changePreset(item.key)"
          >
            {{ item.label }}
          </button>
        </div>

        <dl class="chronicle__stats">
          <div>
            <dt>面</dt>
            <dd>{{ (ledger.triangles / 1000).toFixed(1) }}k</dd>
          </div>
          <div>
            <dt>CALLS</dt>
            <dd>{{ ledger.drawCalls }}</dd>
          </div>
          <div>
            <dt>FPS</dt>
            <dd>{{ Math.round(ledger.fps) }}</dd>
          </div>
        </dl>

        <div class="chronicle__drawers">
          <button
            type="button"
            class="chronicle__tab"
            :class="{ 'is-on': showLab }"
            :aria-expanded="showLab"
            @click="showLab = !showLab"
          >
            方案实验
          </button>
          <button
            type="button"
            class="chronicle__tab"
            :class="{ 'is-on': showBrief }"
            :aria-expanded="showBrief"
            @click="showBrief = !showBrief"
          >
            建模提单
          </button>
        </div>
      </div>
    </header>

    <PhaseRail
      class="chronicle__rail"
      :phases="PHASES"
      :current-idx="currentIdx"
      :progress="progress"
      :playing="playing"
      @select="jumpToPhase"
    />

    <CaptionDeck
      class="chronicle__deck"
      :phase="currentPhase"
      :current-idx="currentIdx"
      :time="currentTime"
      :total="TOTAL_SEC"
      :playing="playing"
      :speed="speed"
      :follow="follow"
      @toggle="togglePlay"
      @reset="resetAll"
      @seek="doSeek"
      @speed="changeSpeed"
      @follow="changeFollow"
    />

    <div v-if="showLab || showBrief" class="chronicle__drawer">
      <BranchLab
        v-if="showLab"
        :branch="branch"
        :panels="panels"
        :alert="alert"
        :open="showLab"
        @change="applyBranch"
        @reset="resetBranch"
        @close="showLab = false"
      />
      <BriefDrawer
        v-if="showBrief"
        :ledger="ledger"
        :open="showBrief"
        @close="showBrief = false"
      />
    </div>

    <div ref="labelsRef" class="scene-labels" aria-hidden="true" />
  </main>
</template>

<style scoped>
.chronicle {
  position: relative;
  height: 100svh;
  overflow: hidden;
  background: var(--rl-bg-alt);
  isolation: isolate;
}

.chronicle__stage {
  position: absolute;
  inset: 0;
  z-index: 1;
}

.chronicle__bar {
  position: absolute;
  top: 0;
  right: 0;
  left: 0;
  z-index: 6;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 16px;
  pointer-events: none;
}

.chronicle__bar > * {
  pointer-events: auto;
}

.chronicle__back {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 11px;
  border: 1px solid var(--rl-border);
  border-radius: var(--rl-r-sm);
  background: color-mix(in srgb, var(--rl-surface) 88%, transparent);
  font-size: 11.5px;
  color: var(--rl-primary);
  text-decoration: none;
  backdrop-filter: blur(10px);
}

.chronicle__back:hover {
  border-color: var(--rl-primary);
}

.chronicle__ident {
  flex: 1;
  min-width: 0;
}

.chronicle__name {
  margin: 2px 0 0;
  font-family: var(--rl-display);
  font-size: 22px;
  font-weight: 600;
  letter-spacing: 0.06em;
  color: var(--rl-ink);
  text-shadow: 0 1px 12px color-mix(in srgb, var(--rl-surface) 70%, transparent);
}

.chronicle__tools {
  display: flex;
  align-items: center;
  gap: 10px;
}

.chronicle__presets {
  display: flex;
  padding: 2px;
  border: 1px solid var(--rl-border);
  border-radius: var(--rl-r-sm);
  background: color-mix(in srgb, var(--rl-surface) 86%, transparent);
  backdrop-filter: blur(10px);
}

.chronicle__presets button {
  padding: 4px 9px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  font-size: 11px;
  color: var(--rl-muted);
  cursor: pointer;
}

.chronicle__presets button:hover {
  color: var(--rl-primary);
}

.chronicle__presets button.is-on {
  background: var(--rl-surface);
  color: var(--rl-primary);
  font-weight: 600;
  box-shadow: var(--rl-sh-sm);
}

.chronicle__stats {
  display: flex;
  gap: 10px;
  margin: 0;
  padding: 4px 10px;
  border: 1px solid var(--rl-border);
  border-radius: var(--rl-r-sm);
  background: color-mix(in srgb, var(--rl-surface) 86%, transparent);
  backdrop-filter: blur(10px);
}

.chronicle__stats div {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
}

.chronicle__stats dt {
  font-size: 8px;
  letter-spacing: 0.06em;
  color: var(--rl-faint);
}

.chronicle__stats dd {
  margin: 0;
  font-family: var(--rl-mono);
  font-size: 11.5px;
  font-weight: 600;
  color: var(--rl-primary);
}

.chronicle__drawers {
  display: flex;
  gap: 6px;
}

.chronicle__tab {
  padding: 6px 11px;
  border: 1px solid var(--rl-border);
  border-radius: var(--rl-r-sm);
  background: color-mix(in srgb, var(--rl-surface) 88%, transparent);
  font-size: 11.5px;
  color: var(--rl-body);
  cursor: pointer;
  backdrop-filter: blur(10px);
}

.chronicle__tab:hover {
  border-color: var(--rl-primary);
  color: var(--rl-primary);
}

.chronicle__tab.is-on {
  border-color: var(--rl-primary);
  background: var(--rl-primary);
  color: var(--rl-surface);
}

.chronicle__rail {
  position: absolute;
  top: 74px;
  bottom: 186px;
  left: 16px;
  z-index: 5;
}

.chronicle__deck {
  position: absolute;
  right: 16px;
  bottom: 16px;
  left: 16px;
  z-index: 6;
}

.chronicle__drawer {
  position: absolute;
  top: 74px;
  right: 16px;
  bottom: 186px;
  z-index: 7;
  display: flex;
  gap: 12px;
  align-items: flex-start;
  justify-content: flex-end;
}

@media (max-width: 1080px) {
  .chronicle__bar {
    flex-wrap: wrap;
    gap: 8px;
    padding: 10px 12px;
  }

  .chronicle__ident {
    order: 3;
    flex-basis: 100%;
  }

  .chronicle__name {
    font-size: 18px;
  }

  .chronicle__stats {
    display: none;
  }

  .chronicle__rail {
    top: 96px;
    right: 12px;
    bottom: auto;
    left: 12px;
  }

  .chronicle__deck {
    right: 10px;
    bottom: 10px;
    left: 10px;
  }

  .chronicle__drawer {
    top: 96px;
    right: 10px;
    bottom: 10px;
    left: 10px;
    justify-content: center;
  }
}

@media (max-width: 720px) {
  .chronicle__presets {
    display: none;
  }

  .chronicle__tab {
    padding: 5px 9px;
    font-size: 11px;
  }
}
</style>
