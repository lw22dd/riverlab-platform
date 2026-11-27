<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  shallowRef,
  watch,
} from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useMachine } from '@xstate/vue'
import { getScenarioPackage } from '@/data'
import type { Tone } from '@/models/common.model'
import type { SimNode } from '@/models/scenario.model'
import type { SessionRecord } from '@/models/session.model'
import type { SimState } from '@/models/simulation.model'
import { SimulationEngine } from '@/engine/SimulationEngine'
import type { MetricChange } from '@/engine/events'
import { compileDecisionProgram, type CompiledDecisionProgram } from '@/engine/decisionProgram'
import type { DecisionProgram } from '@/models/decisionProgram.model'
import { defaultDecisionProgram } from '@/models/decisionProgram.model'
import { flowPhase, scenarioMachine } from '@/engine/scenarioMachine'
import { buildScenarioScene, type ScenarioStageHandle } from '@/three/scenes'
import { sessionService } from '@/services/session.service'
import { usePreferencesStore } from '@/stores/preferences.store'
import BriefingOverlay from '@/components/scenario/BriefingOverlay.vue'
import DecisionPanel from '@/components/scenario/DecisionPanel.vue'
import DecisionProgramPanel from '@/components/scenario/DecisionProgramPanel.vue'
import NarrativePanel from '@/components/scenario/NarrativePanel.vue'
import NodeGraphModal from '@/components/scenario/NodeGraphModal.vue'
import OutcomeOverlay from '@/components/scenario/OutcomeOverlay.vue'
import ScenarioHud from '@/components/scenario/ScenarioHud.vue'
import SessionLogDrawer from '@/components/scenario/SessionLogDrawer.vue'
import ScenarioGlyph from '@/components/home/ScenarioGlyph.vue'
import Icon from '@/components/common/Icon.vue'

const props = defineProps<{
  id: string
}>()

const router = useRouter()
const preferences = usePreferencesStore()
const entry = computed(() => getScenarioPackage(props.id))
const scenario = computed(() => entry.value?.scenario)

const accentStyle = computed(() =>
  entry.value
    ? {
        '--accent': entry.value.presentation.accent,
        '--accent-rgb': entry.value.presentation.accentRgb,
      }
    : undefined,
)

// ---------------------------------------------------------------------------
// 表现层状态机
// ---------------------------------------------------------------------------

// 表现层状态机只负责界面阶段、相机与氛围节奏，不参与任何推演判定；
// 真实状态由内核引擎持有，这里通过事件保持同拍。
const { snapshot, send } = useMachine(scenarioMachine)
const phase = computed(() => flowPhase(snapshot.value.value))

// ---------------------------------------------------------------------------
// 仿真状态
// ---------------------------------------------------------------------------

const engine = shallowRef<SimulationEngine | null>(null)
const state = shallowRef<SimState | null>(null)
const started = ref(false)
const isPaused = ref(false)
const showBriefing = ref(true)
const showProgram = ref(false)
const compiledProgram = shallowRef<CompiledDecisionProgram | null>(null)
const programDraft = shallowRef<DecisionProgram>({ ...defaultDecisionProgram })
const showGraph = ref(false)
const showLog = ref(false)
const showOutcome = ref(false)
const finalSession = shallowRef<SessionRecord | null>(null)
const lastChanges = ref<MetricChange[]>([])
const elapsedSec = ref(0)

const currentNode = computed(() => {
  const current = state.value
  if (!current?.currentNodeId || !scenario.value) return undefined
  return scenario.value.nodes.find((node) => node.id === current.currentNodeId)
})

const decisionNode = computed(() => {
  const node = currentNode.value
  return node?.type === 'decision' ? node : null
})

const autoMode = computed(() => compiledProgram.value !== null)

const autoChoice = computed(() => {
  const node = decisionNode.value
  if (!node || !compiledProgram.value) return null
  return compiledProgram.value.choices[node.id] ?? null
})

const narrativeNode = computed(() => {
  const node = currentNode.value
  return node?.type === 'narrative' || node?.type === 'consequence' ? node : null
})

const logs = computed(() => state.value?.logs ?? [])
const metrics = computed(() => state.value?.metrics ?? {})
const decisionsMade = computed(() => state.value?.decisions.length ?? 0)
const decisionTotal = computed(
  () => scenario.value?.nodes.filter((node) => node.type === 'decision').length ?? 0,
)

const displayedPhase = computed(() =>
  finalSession.value
    ? { key: 'sealed', label: 'SEALED', hint: '规则引擎已完成结算' }
    : phase.value,
)

// ---------------------------------------------------------------------------
// 计时器与时钟
// ---------------------------------------------------------------------------

// 倒计时由界面驱动，超时后以 timedOut 标记回传内核，评分据此区分主动与被动决策。
const remainingMs = ref<number | null>(null)
const totalMs = ref<number | null>(null)
let timerId: number | undefined
let decisionDeadline = 0
let timerNodeId = ''
let timerPaused = false
let pausedRemaining = 0
let elapsedTimer: number | undefined

function stopDecisionTimer() {
  if (timerId) window.clearInterval(timerId)
  timerId = undefined
  timerNodeId = ''
  timerPaused = false
  pausedRemaining = 0
  remainingMs.value = null
  totalMs.value = null
}

function startDecisionTimer(node: NonNullable<typeof decisionNode.value>) {
  stopDecisionTimer()
  const total = (node.timeLimitSec ?? 0) * 1000
  if (!total) return
  timerNodeId = node.id
  totalMs.value = total
  remainingMs.value = total
  decisionDeadline = performance.now() + total
  timerId = window.setInterval(tickDecisionTimer, 100)
}

function pauseDecisionTimer() {
  if (remainingMs.value === null || timerPaused) return
  timerPaused = true
  pausedRemaining = Math.max(0, decisionDeadline - performance.now())
  remainingMs.value = pausedRemaining
  if (timerId) window.clearInterval(timerId)
  timerId = undefined
}

function resumeDecisionTimer() {
  if (remainingMs.value === null || !timerPaused || isPaused.value) return
  timerPaused = false
  decisionDeadline = performance.now() + pausedRemaining
  timerId = window.setInterval(tickDecisionTimer, 100)
}

function tickDecisionTimer() {
  if (timerPaused || isPaused.value || showBriefing.value || showGraph.value || showLog.value) return
  const left = decisionDeadline - performance.now()
  remainingMs.value = Math.max(0, left)
  if (left <= 0) expireDecision()
}

function expireDecision() {
  const node = decisionNode.value
  if (!node || !engine.value) return
  const defaultOption =
    node.options.find((option) => option.id === node.timeoutOptionId) ??
    node.options.find((option) => option.timeoutDefault) ??
    node.options[0]
  if (!defaultOption) return
  showToast('决策窗口关闭', `系统自动执行默认方案：${defaultOption.label}`, 'caution', 5600)
  chooseOption(defaultOption.id, true)
}

function startElapsedClock() {
  stopElapsedClock()
  elapsedTimer = window.setInterval(() => {
    if (!isPaused.value && !showBriefing.value && !finalSession.value) elapsedSec.value += 1
  }, 1000)
}

function stopElapsedClock() {
  if (elapsedTimer) window.clearInterval(elapsedTimer)
  elapsedTimer = undefined
}

watch(
  () => [state.value?.currentNodeId, state.value?.status] as const,
  () => {
    const node = currentNode.value
    const current = state.value
    if (
      !started.value ||
      current?.status !== 'awaiting' ||
      !node ||
      node.type !== 'decision' ||
      !node.timeLimitSec
    ) {
      if (current?.status !== 'awaiting' || timerNodeId !== node?.id) stopDecisionTimer()
      return
    }
    if (timerNodeId === node.id && remainingMs.value !== null) return
    startDecisionTimer(node)
  },
  { flush: 'post' },
)

// ---------------------------------------------------------------------------
// 已编译决策程序的自动执行
// ---------------------------------------------------------------------------

let autoTimer: number | undefined

function clearAutoTimer() {
  if (autoTimer) window.clearTimeout(autoTimer)
  autoTimer = undefined
}

// 自动模式按已编译的决策程序推进；定时器统一由 watch 清理，避免节点切换后串场。
function scheduleAutoStep() {
  if (autoTimer) return
  if (!started.value || !autoMode.value || isPaused.value || finalSession.value) return
  if (showBriefing.value || showProgram.value || showGraph.value || showLog.value) return

  const node = currentNode.value
  const current = state.value
  if (!node || !current) return

  if (node.type === 'decision' && current.status === 'awaiting') {
    const choice = autoChoice.value
    const fallback = node.options[0]?.id
    if (!choice && !fallback) return
    autoTimer = window.setTimeout(() => {
      autoTimer = undefined
      if (isPaused.value || currentNode.value?.id !== node.id) return
      if (choice) showToast('决策程序执行', choice.reason, 'info', 2800)
      chooseOption(choice?.optionId ?? fallback ?? '', false)
    }, 2200)
    return
  }

  if (node.type === 'narrative' || node.type === 'consequence') {
    autoTimer = window.setTimeout(() => {
      autoTimer = undefined
      if (isPaused.value || currentNode.value?.id !== node.id) return
      advanceStory()
    }, node.type === 'consequence' ? 6000 : 5200)
  }
}

watch(
  () => [
    currentNode.value?.id,
    state.value?.status,
    isPaused.value,
    showGraph.value,
    showLog.value,
    showBriefing.value,
    showProgram.value,
    started.value,
    finalSession.value,
  ] as const,
  () => {
    clearAutoTimer()
    scheduleAutoStep()
  },
  { flush: 'post' },
)

// ---------------------------------------------------------------------------
// 3D 舞台
// ---------------------------------------------------------------------------

const canvasHost = ref<HTMLDivElement | null>(null)
const stage = shallowRef<ScenarioStageHandle | null>(null)
const stageError = ref('')
const stageLoading = ref(true)
const pendingStageActions: Array<{ action: string; payload?: Record<string, unknown> }> = []

async function initStage() {
  const host = canvasHost.value
  const currentScenario = scenario.value
  if (!host || !currentScenario) {
    stageLoading.value = false
    return
  }
  stageLoading.value = true
  await nextTick()
  if (!host.isConnected) {
    stageLoading.value = false
    return
  }
  try {
    const built = buildScenarioScene(currentScenario.domain, host, {
      reducedMotion: preferences.reducedMotion,
      cinematicCamera: preferences.cinematicCamera,
      onInspect: handleInspect,
    })
    stage.value = built
    stageError.value = ''
    // 开发期把场景句柄挂到 window 上，方便 Playwright 直接驱动 stage 动作做回归截图。
    if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__scenarioStage = built
    const node = currentNode.value
    if (node?.focus) built.focus(node.focus)
    if (node?.ambience) built.setAmbience(node.ambience)
    for (const action of pendingStageActions.splice(0)) built.applyAction(action.action, action.payload)
    if (isPaused.value) built.pause(true)
  } catch (error) {
    console.warn('[ScenarioView] 3D stage 初始化失败', error)
    stage.value = null
    stageError.value = '3D 场景无法在当前浏览器中初始化。仿真内核、决策与评分仍可正常使用。'
  } finally {
    stageLoading.value = false
  }
}

function disposeStage() {
  if (!stage.value) return
  stage.value.dispose()
  stage.value = null
}

function dispatchStage(action: string, payload?: Record<string, unknown>) {
  if (stage.value) {
    stage.value.applyAction(action, payload)
  } else if (!stageError.value) {
    pendingStageActions.push({ action, payload })
  }
}

function handleInspect(hotspot: { id: string; label: string; detail: string; tone?: Tone }) {
  if (!started.value || finalSession.value || !engine.value) return
  engine.value.inspect(hotspot.id, hotspot.label, hotspot.detail, hotspot.tone)
}

// ---------------------------------------------------------------------------
// 引擎接线
// ---------------------------------------------------------------------------

let busCleanups: Array<() => void> = []

function cleanupBus() {
  for (const cleanup of busCleanups) cleanup()
  busCleanups = []
  engine.value?.bus.clear()
}

// 引擎事件在此统一转译为界面状态、舞台动作与轻提示，视图不直接读取引擎内部。
function connectBus(instance: SimulationEngine) {
  const bus = instance.bus
  busCleanups.push(
    bus.on('node', ({ node }) => handleNode(node)),
    bus.on('stage', ({ action, payload }) => dispatchStage(action, payload)),
    bus.on('metric', ({ changes }) => {
      lastChanges.value = changes.map((change) => ({ ...change }))
    }),
    bus.on('inspect', (payload) => {
      stage.value?.markHotspot(payload.id)
      showToast(payload.label, payload.detail, payload.tone ?? 'info', 6000)
    }),
    bus.on('warning', ({ text }) => {
      showToast('系统提示', text, 'caution', 4200)
    }),
    bus.on('finished', ({ session }) => handleFinished(session)),
  )
}

// 重开或切换场景时重建引擎，避免上一轮的指标、决策与路径残留。
function createEngine() {
  const currentScenario = scenario.value
  if (!currentScenario) return
  cleanupBus()
  const instance = new SimulationEngine(currentScenario)
  instance.state = reactive(instance.state) as SimState
  engine.value = instance
  state.value = instance.state
  connectBus(instance)
}

function handleNode(node: SimNode) {
  if (node.type === 'narrative' || node.type === 'decision' || node.type === 'consequence') {
    send({ type: 'NODE', nodeId: node.id, nodeType: node.type })
  }
  if (node.focus) {
    stage.value?.focus(node.focus)
    send({ type: 'CAMERA', mode: 'moving' })
  }
  if (node.ambience) {
    stage.value?.setAmbience(node.ambience)
    send({ type: 'AMBIENCE', level: node.ambience })
  }
}

// 结算只发生一次：先落盘并停止所有计时器，再切到结局面板。
function handleFinished(session: SessionRecord) {
  finalSession.value = session
  if (compiledProgram.value) session.program = compiledProgram.value.summary
  sessionService.save(session)
  clearAutoTimer()
  stopDecisionTimer()
  stopElapsedClock()
  elapsedSec.value = Math.round(session.durationMs / 1000)
  showGraph.value = false
  showLog.value = false
  isPaused.value = false
  stage.value?.pause(false)
  showOutcome.value = true
  showToast('会话已封存', `规则引擎完成结算：${session.score} 分 / ${session.grade} 级。`, session.gradeTone, 5000)
  send({ type: 'FINISH' })
}

// ---------------------------------------------------------------------------
// 交互动作
// ---------------------------------------------------------------------------

function handleBriefingStart() {
  if (scenario.value?.domain === 'autonomous') {
    showBriefing.value = false
    showProgram.value = true
    return
  }
  startRun()
}

function handleProgramBack() {
  showProgram.value = false
  showBriefing.value = true
}

function handleProgramCompile(program: DecisionProgram) {
  programDraft.value = { ...program }
  compiledProgram.value = compileDecisionProgram(program)
  showProgram.value = false
  startRun()
}

// 表现状态机与内核通过事件同拍：先通知界面进入运行态，再启动解释器。
function startRun() {
  if (!engine.value || started.value) return
  started.value = true
  showBriefing.value = false
  isPaused.value = false
  elapsedSec.value = 0
  lastChanges.value = []
  toast.value = null
  send({ type: 'BEGIN' })
  engine.value.start()
  startElapsedClock()
}

function chooseOption(optionId: string, timedOut = false) {
  if (!engine.value || isPaused.value || finalSession.value) return
  stopDecisionTimer()
  engine.value.choose(optionId, { timedOut })
}

function advanceStory() {
  if (!engine.value || isPaused.value || finalSession.value) return
  engine.value.advance()
}

function pauseRun() {
  if (!started.value || finalSession.value || isPaused.value) return
  isPaused.value = true
  stage.value?.pause(true)
  pauseDecisionTimer()
  send({ type: 'PAUSE' })
}

function resumeRun() {
  if (!isPaused.value) return
  isPaused.value = false
  stage.value?.pause(false)
  resumeDecisionTimer()
  send({ type: 'RESUME' })
}

function requestExit() {
  if (!started.value || finalSession.value) {
    goHome()
    return
  }
  pauseRun()
}

function goHome() {
  void router.push({ name: 'home' })
}

function openGraph() {
  if (!started.value) return
  showGraph.value = true
  pauseDecisionTimer()
}

function closeGraph() {
  showGraph.value = false
  if (!isPaused.value) resumeDecisionTimer()
}

function openLog() {
  if (!started.value) return
  showLog.value = true
  pauseDecisionTimer()
}

function handleLogVisible(visible: boolean) {
  showLog.value = visible
  if (!visible && !isPaused.value) resumeDecisionTimer()
  if (visible) pauseDecisionTimer()
}

function closeOutcome() {
  showOutcome.value = false
}

function openResult() {
  if (!finalSession.value) return
  void router.push({ name: 'result', params: { sessionId: finalSession.value.id } })
}

async function restartRun() {
  showOutcome.value = false
  finalSession.value = null
  showBriefing.value = true
  showProgram.value = false
  compiledProgram.value = null
  started.value = false
  isPaused.value = false
  showGraph.value = false
  showLog.value = false
  elapsedSec.value = 0
  lastChanges.value = []
  toast.value = null
  pendingStageActions.length = 0
  clearAutoTimer()
  stopDecisionTimer()
  stopElapsedClock()
  disposeStage()
  stageError.value = ''
  createEngine()
  send({ type: 'RESET' })
  await nextTick()
  void initStage()
}

// ---------------------------------------------------------------------------
// 轻提示
// ---------------------------------------------------------------------------

const toast = ref<{ title: string; text: string; tone: Tone } | null>(null)
let toastTimer: number | undefined

function showToast(title: string, text: string, tone: Tone = 'info', duration = 4800) {
  toast.value = { title, text, tone }
  if (toastTimer) window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => {
    toast.value = null
  }, duration)
}

function toastIcon(tone: Tone): string {
  switch (tone) {
    case 'positive':
      return 'check'
    case 'caution':
      return 'alert'
    case 'danger':
      return 'alert'
    default:
      return 'info'
  }
}

// ---------------------------------------------------------------------------
// 键盘与生命周期
// ---------------------------------------------------------------------------

function onKeydown(event: KeyboardEvent) {
  if (event.metaKey || event.ctrlKey || event.altKey) return
  const target = event.target as HTMLElement | null
  if (
    target &&
    (target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.tagName === 'SELECT' ||
      target.isContentEditable)
  ) {
    return
  }

  if (showOutcome.value) {
    if (event.key === 'Escape') closeOutcome()
    return
  }

  if (showBriefing.value) {
    if (event.key === 'Enter') {
      event.preventDefault()
      handleBriefingStart()
    }
    return
  }

  if (showProgram.value) {
    if (event.key === 'Escape') handleProgramBack()
    return
  }

  if (showGraph.value) {
    if (event.key === 'Escape' || event.key === 'g' || event.key === 'G') closeGraph()
    return
  }

  if (isPaused.value) {
    if (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      resumeRun()
    }
    return
  }

  if (showLog.value) {
    if (event.key === 'Escape') handleLogVisible(false)
    return
  }

  if (target?.closest('button, a') && (event.key === 'Enter' || event.key === ' ')) return

  if (event.key === 'p' || event.key === 'P') {
    event.preventDefault()
    pauseRun()
    return
  }
  if (event.key === 'g' || event.key === 'G') {
    event.preventDefault()
    openGraph()
    return
  }
  if (event.key === 'l' || event.key === 'L') {
    event.preventDefault()
    openLog()
    return
  }

  if (decisionNode.value && state.value?.status === 'awaiting' && !autoMode.value) {
    const index = Number(event.key)
    if (Number.isInteger(index) && index >= 1 && index <= decisionNode.value.options.length) {
      const option = decisionNode.value.options[index - 1]
      if (option) {
        event.preventDefault()
        chooseOption(option.id)
      }
    }
    return
  }

  if (narrativeNode.value && (event.key === 'Enter' || event.key === ' ')) {
    event.preventDefault()
    advanceStory()
  }
}

function onBeforeUnload(event: BeforeUnloadEvent) {
  if (started.value && !finalSession.value) {
    event.preventDefault()
    event.returnValue = ''
  }
}

onMounted(() => {
  createEngine()
  window.addEventListener('keydown', onKeydown)
  window.addEventListener('beforeunload', onBeforeUnload)
  void initStage()
})

onBeforeUnmount(() => {
  cleanupBus()
  clearAutoTimer()
  stopDecisionTimer()
  stopElapsedClock()
  if (toastTimer) window.clearTimeout(toastTimer)
  disposeStage()
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('beforeunload', onBeforeUnload)
})
</script>

<template>
  <main v-if="entry && scenario" class="scenario-page" :style="accentStyle">
    <div ref="canvasHost" class="scene-host"></div>
    <div class="scene-vignette" aria-hidden="true"></div>
    <div class="scene-grain" aria-hidden="true"></div>

    <div v-if="stageError" class="scene-fallback">
      <div class="scene-fallback__glyph">
        <ScenarioGlyph :kind="entry.presentation.glyph" />
      </div>
      <div class="scene-fallback__copy">
        <span class="mono-label">WEBGL FALLBACK</span>
        <h2>3D 场景不可用</h2>
        <p>{{ stageError }}</p>
      </div>
    </div>

    <div v-if="stageLoading" class="stage-loading">
      <span></span>
      正在构建 3D 场景
    </div>

    <header class="scenario-topbar">
      <div class="scenario-topbar__left">
        <button type="button" class="icon-btn" aria-label="返回或暂停" @click="requestExit">
          <Icon name="arrow-left" :size="18" />
        </button>
        <div class="scenario-topbar__title">
          <h1>
            {{ scenario.title }}
            <em>{{ scenario.subtitle }}</em>
          </h1>
          <span v-if="autoMode" class="scenario-topbar__auto">
            AUTOPILOT · 决策程序运行中
          </span>
        </div>
      </div>

      <div
        v-if="started && !finalSession"
        class="scenario-topbar__phase"
        :class="`phase--${displayedPhase.key}`"
      >
        <i aria-hidden="true"></i>
        <span>{{ displayedPhase.label }}</span>
        <em>{{ String(decisionsMade).padStart(2, '0') }} / {{ String(decisionTotal).padStart(2, '0') }}</em>
      </div>

      <div class="scenario-topbar__actions">
        <button
          type="button"
          class="scene-tool"
          :disabled="!started"
          title="查看节点图谱 (G)"
          aria-label="查看节点图谱"
          @click="openGraph"
        >
          <Icon name="graph" :size="18" />
        </button>
        <button
          type="button"
          class="scene-tool"
          :disabled="!started"
          title="查看演化日志 (L)"
          aria-label="查看演化日志"
          @click="openLog"
        >
          <Icon name="layers" :size="18" />
        </button>
        <button
          v-if="started && !finalSession"
          type="button"
          class="scene-tool"
          title="暂停 (P)"
          aria-label="暂停推演"
          @click="pauseRun"
        >
          <Icon name="pause" :size="18" />
        </button>
        <button
          v-if="finalSession"
          type="button"
          class="scene-tool scene-tool--result"
          title="查看结果报告"
          aria-label="查看结果报告"
          @click="openResult"
        >
          <Icon name="activity" :size="18" />
        </button>
      </div>
    </header>

    <div v-if="started" class="scenario-hud-slot">
      <ScenarioHud
        :scenario="scenario"
        :metrics="metrics"
        :changes="lastChanges"
        :elapsed-sec="elapsedSec"
        :phase-label="displayedPhase.label"
        :phase-hint="displayedPhase.hint"
      />
    </div>

    <Transition name="toast">
      <div v-if="toast" class="scene-toast" :class="`scene-toast--${toast.tone}`" role="status">
        <span class="scene-toast__icon">
          <Icon :name="toastIcon(toast.tone)" :size="18" />
        </span>
        <div>
          <strong>{{ toast.title }}</strong>
          <p>{{ toast.text }}</p>
        </div>
        <button type="button" class="scene-toast__close" aria-label="关闭提示" @click="toast = null">
          <Icon name="close" :size="14" />
        </button>
      </div>
    </Transition>

    <div v-if="started && !showOutcome" class="scenario-dock">
      <NarrativePanel
        v-if="narrativeNode && !isPaused"
        :key="narrativeNode.id"
        :node="narrativeNode"
        :auto="autoMode"
        @advance="advanceStory"
      />

      <DecisionPanel
        v-else-if="decisionNode && !isPaused"
        :key="decisionNode.id"
        :node="decisionNode"
        :remaining-ms="remainingMs"
        :total-ms="totalMs"
        :auto-choice="autoChoice?.optionId ?? null"
        :auto-reason="autoChoice?.reason ?? null"
        @choose="chooseOption"
      />

      <section v-else-if="finalSession" class="completion-dock">
        <span class="completion-dock__grade" :class="`grade--${finalSession.grade.toLowerCase()}`">
          {{ finalSession.grade }}
        </span>
        <div class="completion-dock__copy">
          <span class="mono-label">SESSION SEALED</span>
          <h2>{{ finalSession.outcome.title }}</h2>
        </div>
        <div class="completion-dock__actions">
          <button type="button" class="btn btn--primary btn--small" @click="openResult">
            结果报告
            <Icon name="arrow-right" :size="16" />
          </button>
          <button type="button" class="btn btn--small" @click="restartRun">
            <Icon name="refresh" :size="16" />
            重来
          </button>
        </div>
      </section>
    </div>

    <div v-if="isPaused" class="pause-overlay" role="dialog" aria-modal="true" aria-labelledby="pause-title">
      <div class="pause-overlay__backdrop"></div>
      <div class="pause-card">
        <span class="pause-card__icon"><Icon name="pause" :size="24" /></span>
        <span class="eyebrow">SESSION PAUSED</span>
        <h2 id="pause-title">推演已暂停</h2>
        <p>场景动画、决策倒计时与计时器已冻结。你可以安全地查看图谱和日志，或退出本次实验。</p>
        <div class="pause-card__actions">
          <button type="button" class="btn btn--primary" @click="resumeRun">
            <Icon name="play" :size="16" />
            继续推演
          </button>
          <button type="button" class="btn" @click="openGraph">
            <Icon name="graph" :size="16" />
            查看图谱
          </button>
          <RouterLink to="/" class="btn btn--ghost" @click="resumeRun">
            退出实验
          </RouterLink>
        </div>
        <span class="pause-card__note">退出后，本次未封存的决策不会生成会话报告。</span>
      </div>
    </div>

    <BriefingOverlay
      v-if="showBriefing"
      :entry="entry"
      @start="handleBriefingStart"
      @back="goHome"
    />

    <DecisionProgramPanel
      v-if="showProgram && scenario"
      :scenario="scenario"
      :initial="programDraft"
      @compile="handleProgramCompile"
      @back="handleProgramBack"
    />

    <OutcomeOverlay
      v-if="showOutcome && finalSession"
      :session="finalSession"
      @result="openResult"
      @restart="restartRun"
      @close="closeOutcome"
    />

    <NodeGraphModal
      :scenario="scenario"
      :state="state"
      :visible="showGraph"
      @close="closeGraph"
    />

    <SessionLogDrawer
      :visible="showLog"
      :logs="logs"
      @update:visible="handleLogVisible"
    />
  </main>

  <main v-else class="scenario-missing">
    <span class="eyebrow">SCENARIO NOT FOUND</span>
    <h1>这个场景不存在</h1>
    <p>场景注册表里没有对应的实验包。返回实验主题重新选择。</p>
    <RouterLink to="/" class="btn btn--primary">返回实验主题</RouterLink>
  </main>
</template>

<style scoped>
.scenario-page {
  position: relative;
  width: 100%;
  height: 100svh;
  overflow: hidden;
  background: var(--bg);
  color: var(--text);
}

.scene-host {
  position: absolute;
  inset: 0;
  z-index: 1;
}

.scene-vignette {
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.55) 0%, transparent 18%, transparent 58%, rgba(250, 253, 255, 0.62) 100%),
    radial-gradient(78% 72% at 50% 44%, transparent 52%, rgba(255, 255, 255, 0.24) 100%);
}

.scene-grain {
  position: absolute;
  inset: 0;
  z-index: 3;
  pointer-events: none;
  opacity: 0.08;
  background-image:
    repeating-linear-gradient(0deg, rgba(16, 42, 67, 0.018) 0, rgba(16, 42, 67, 0.018) 1px, transparent 1px, transparent 3px);
  mix-blend-mode: multiply;
}

.scene-fallback {
  position: absolute;
  inset: 0;
  z-index: 4;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: clamp(30px, 6vw, 90px);
  padding: 30px;
  background:
    radial-gradient(60% 70% at 35% 40%, rgba(var(--accent-rgb), 0.08), transparent 65%),
    linear-gradient(140deg, #f8fbfe, #eaf3fa);
}

.scene-fallback__glyph {
  width: min(460px, 46vw);
  opacity: 0.7;
}

.scene-fallback__copy {
  max-width: 320px;
}

.scene-fallback__copy h2 {
  margin-top: 9px;
  font-size: 25px;
  font-weight: 550;
}

.scene-fallback__copy p {
  margin-top: 11px;
  font-size: 13px;
  line-height: 1.75;
  color: var(--text-muted);
}

.stage-loading {
  position: absolute;
  left: 24px;
  bottom: 24px;
  z-index: 6;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 9px 12px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.78);
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.06em;
  color: var(--text-muted);
  box-shadow: var(--shadow-sm);
  backdrop-filter: blur(12px);
}

.stage-loading span {
  width: 6px;
  height: 6px;
  border: 1px solid rgba(var(--accent-rgb), 0.7);
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 800ms linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* 顶栏 ----------------------------------------------------------------- */

.scenario-topbar {
  position: absolute;
  inset: 0 0 auto;
  z-index: 20;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: 18px;
  padding: 14px 20px;
  pointer-events: none;
}

.scenario-topbar__left {
  display: flex;
  align-items: center;
  gap: 11px;
  min-width: 0;
  pointer-events: auto;
}

.icon-btn {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  flex: none;
  border: 1px solid var(--line);
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.72);
  color: var(--text-muted);
  cursor: pointer;
  box-shadow: var(--shadow-sm);
  backdrop-filter: blur(12px);
  transition:
    background 180ms ease,
    border-color 180ms ease,
    color 180ms ease,
    transform 180ms ease,
    box-shadow 180ms ease;
}

.icon-btn:hover {
  transform: translateX(-2px);
  border-color: rgba(var(--accent-rgb), 0.35);
  background: #ffffff;
  color: var(--text-strong);
  box-shadow: var(--shadow-md);
}

.scenario-topbar__title {
  min-width: 0;
}

.scenario-topbar__title h1 {
  display: flex;
  align-items: baseline;
  gap: 9px;
  margin-top: 1px;
  overflow: hidden;
  white-space: nowrap;
  font-size: 16px;
  font-weight: 550;
  letter-spacing: -0.015em;
}

.scenario-topbar__title h1 em {
  overflow: hidden;
  font-size: 12px;
  font-style: normal;
  font-weight: 400;
  color: var(--text-faint);
  text-overflow: ellipsis;
}

.scenario-topbar__auto {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 3px;
  color: var(--accent);
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.08em;
}

.scenario-topbar__auto::before {
  content: '';
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: currentColor;
  animation: phase-pulse 2.4s ease-in-out infinite;
}

.scenario-topbar__phase {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 11px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.62);
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.1em;
  color: var(--text-muted);
  box-shadow: var(--shadow-sm);
  backdrop-filter: blur(12px);
  pointer-events: none;
  white-space: nowrap;
}

.scenario-topbar__phase i {
  width: 5px;
  height: 5px;
  flex: none;
  border-radius: 50%;
  background: var(--accent);
  animation: phase-pulse 2.4s ease-in-out infinite;
}

.scenario-topbar__phase em {
  padding-left: 8px;
  border-left: 1px solid var(--line);
  font-style: normal;
  color: var(--text-faint);
}

.scenario-topbar__phase.phase--deciding i {
  background: var(--warn);
}

.scenario-topbar__phase.phase--resolving i {
  background: var(--danger);
}

.scenario-topbar__phase.phase--sealed i {
  background: var(--success);
  animation: none;
}

.scenario-topbar__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  pointer-events: auto;
}

.scene-tool {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 50%;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition:
    background 170ms ease,
    border-color 170ms ease,
    color 170ms ease,
    box-shadow 170ms ease;
}

.scene-tool:hover:not(:disabled) {
  border-color: var(--line);
  background: rgba(255, 255, 255, 0.7);
  color: var(--text-strong);
  box-shadow: var(--shadow-sm);
}

.scene-tool:disabled {
  opacity: 0.3;
  cursor: default;
}

.scene-tool--result {
  color: var(--success);
}

@keyframes phase-pulse {
  0%,
  100% {
    opacity: 0.45;
  }
  50% {
    opacity: 1;
  }
}

/* HUD 与底部操作栏 ------------------------------------------------------- */

.scenario-hud-slot {
  position: absolute;
  top: 56px;
  right: 20px;
  z-index: 16;
}

.scenario-dock {
  position: absolute;
  inset: 0;
  z-index: 15;
  pointer-events: none;
}

.completion-dock {
  position: absolute;
  left: 50%;
  bottom: calc(28px + env(safe-area-inset-bottom, 0px));
  display: flex;
  align-items: center;
  gap: 13px;
  width: min(620px, calc(100% - 40px));
  padding: 9px 11px 9px 9px;
  border: 1px solid rgba(47, 158, 104, 0.18);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(22px);
  box-shadow: var(--shadow-lg);
  transform: translateX(-50%);
  pointer-events: auto;
  animation: panel-in 450ms var(--ease-out) both;
}

.completion-dock__grade {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  flex: none;
  border: 1px solid var(--line-strong);
  border-radius: 50%;
  font-family: var(--font-display);
  font-size: 16px;
  font-weight: 600;
}

.grade--a {
  border-color: rgba(47, 158, 104, 0.3);
  background: rgba(47, 158, 104, 0.09);
  color: var(--success);
}

.grade--b {
  border-color: rgba(62, 127, 184, 0.28);
  background: rgba(62, 127, 184, 0.08);
  color: var(--blue);
}

.grade--c {
  border-color: rgba(169, 118, 26, 0.28);
  background: rgba(169, 118, 26, 0.08);
  color: var(--warn);
}

.grade--d {
  border-color: rgba(195, 76, 60, 0.28);
  background: rgba(195, 76, 60, 0.08);
  color: var(--danger);
}

.completion-dock__copy {
  min-width: 0;
  flex: 1;
}

.completion-dock__copy h2 {
  margin-top: 2px;
  font-size: 15px;
  font-weight: 550;
}

.completion-dock__actions {
  display: flex;
  gap: 6px;
  margin-left: auto;
}

@keyframes panel-in {
  from {
    opacity: 0;
    transform: translateY(14px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 轻提示 ---------------------------------------------------------------- */

.scene-toast {
  position: fixed;
  top: 68px;
  left: 20px;
  z-index: 30;
  display: flex;
  align-items: flex-start;
  gap: 9px;
  width: min(320px, calc(100vw - 40px));
  padding: 10px 10px 11px 12px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.78);
  backdrop-filter: blur(18px);
  box-shadow: var(--shadow-md);
}

.scene-toast--caution {
  border-left-color: rgba(169, 118, 26, 0.8);
}

.scene-toast--danger {
  border-left-color: rgba(195, 76, 60, 0.85);
}

.scene-toast--positive {
  border-left-color: rgba(47, 158, 104, 0.8);
}

.scene-toast__icon {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  flex: none;
  border-radius: 50%;
  background: rgba(var(--accent-rgb), 0.1);
  color: var(--accent);
}

.scene-toast--caution .scene-toast__icon {
  background: rgba(169, 118, 26, 0.1);
  color: var(--warn);
}

.scene-toast--danger .scene-toast__icon {
  background: rgba(195, 76, 60, 0.1);
  color: var(--danger);
}

.scene-toast--positive .scene-toast__icon {
  background: rgba(47, 158, 104, 0.1);
  color: var(--success);
}

.scene-toast > div {
  min-width: 0;
  padding-top: 1px;
}

.scene-toast strong {
  display: block;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-strong);
}

.scene-toast p {
  margin-top: 3px;
  font-size: 11px;
  line-height: 1.55;
  color: var(--text-muted);
}

.scene-toast__close {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  margin-left: auto;
  flex: none;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--text-faint);
  cursor: pointer;
}

.scene-toast__close:hover {
  background: rgba(255, 255, 255, 0.05);
  color: var(--text-strong);
}

.toast-enter-active,
.toast-leave-active {
  transition:
    opacity 220ms ease,
    transform 260ms var(--ease-out);
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

/* 暂停 ------------------------------------------------------------------ */

.pause-overlay {
  position: fixed;
  inset: 0;
  z-index: 70;
  display: grid;
  place-items: center;
  padding: 20px;
}

.pause-overlay__backdrop {
  position: absolute;
  inset: 0;
  background: rgba(236, 244, 250, 0.76);
  backdrop-filter: blur(16px);
}

.pause-card {
  position: relative;
  z-index: 1;
  width: min(440px, 100%);
  padding: 28px;
  border: 1px solid var(--line);
  border-radius: 20px;
  background: #ffffff;
  text-align: center;
  box-shadow: var(--shadow-lg);
}

.pause-card__icon {
  display: inline-grid;
  place-items: center;
  width: 48px;
  height: 48px;
  margin-bottom: 14px;
  border: 1px solid rgba(var(--accent-rgb), 0.24);
  border-radius: 50%;
  background: rgba(var(--accent-rgb), 0.08);
  color: var(--accent);
}

.pause-card h2 {
  margin-top: 8px;
  font-size: 28px;
  font-weight: 550;
  letter-spacing: -0.03em;
}

.pause-card p {
  margin-top: 12px;
  font-size: 14px;
  line-height: 1.8;
  color: var(--text-muted);
}

.pause-card__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
  margin-top: 22px;
}

.pause-card__note {
  display: block;
  margin-top: 15px;
  font-family: var(--font-mono);
  font-size: 11px;
  line-height: 1.6;
  color: var(--text-faint);
}

/* 场景缺失 -------------------------------------------------------------- */

.scenario-missing {
  min-height: 100svh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  padding: 30px;
  text-align: center;
}

.scenario-missing h1 {
  font-size: 42px;
  letter-spacing: -0.04em;
}

.scenario-missing p {
  margin-bottom: 8px;
  font-size: 14px;
  color: var(--text-muted);
}

/* 响应式 ---------------------------------------------------------------- */

@media (max-width: 1020px) {
  .scenario-topbar {
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .scenario-topbar__phase {
    display: none;
  }
}

@media (max-width: 860px) {
  .scenario-topbar {
    padding: 10px 14px;
    gap: 10px;
  }

  .scenario-topbar__title h1 {
    font-size: 15px;
  }

  .scenario-topbar__title h1 em {
    display: none;
  }

  .scene-tool {
    width: 32px;
    height: 32px;
  }

  .scenario-hud-slot {
    top: 48px;
    right: 14px;
  }

  .scene-toast {
    top: 56px;
    left: 14px;
    width: min(280px, calc(100vw - 28px));
  }

  .completion-dock {
    flex-wrap: wrap;
    gap: 9px;
    padding: 8px 10px;
    border-radius: 20px;
    bottom: calc(14px + env(safe-area-inset-bottom, 0px));
    width: calc(100% - 28px);
  }

  .completion-dock__actions {
    width: 100%;
    margin-left: 0;
  }

  .completion-dock__actions .btn {
    flex: 1;
  }

  .stage-loading {
    left: 14px;
    bottom: 14px;
  }
}

@media (max-width: 600px) {
  .scenario-topbar__title h1 {
    font-size: 14px;
  }

  .scene-fallback {
    flex-direction: column;
    gap: 12px;
    padding: 80px 22px 40px;
    justify-content: center;
  }

  .scene-fallback__glyph {
    width: min(300px, 70vw);
  }

  .scene-fallback__copy {
    text-align: center;
  }

  .pause-card {
    padding: 22px 18px;
  }

  .pause-card__actions .btn {
    flex: 1 1 100%;
  }
}
</style>
