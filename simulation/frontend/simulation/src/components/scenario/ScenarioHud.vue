<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import type { MetricDef, ScenarioDefinition } from '@/models/scenario.model'
import type { MetricChange } from '@/engine/events'
import Icon from '@/components/common/Icon.vue'

const props = defineProps<{
  scenario: ScenarioDefinition
  metrics: Record<string, number>
  changes: MetricChange[]
  elapsedSec: number
  phaseLabel: string
  phaseHint: string
}>()

const expanded = ref(false)
const deltas = ref<Record<string, number>>({})
let deltaTimer: number | undefined

watch(
  () => props.changes,
  (changes) => {
    if (!changes.length) return
    const next: Record<string, number> = {}
    for (const change of changes) next[change.key] = change.delta
    deltas.value = next
    if (deltaTimer) window.clearTimeout(deltaTimer)
    deltaTimer = window.setTimeout(() => {
      deltas.value = {}
    }, 2800)
  },
)

const elapsed = computed(() => {
  const minutes = Math.floor(props.elapsedSec / 60)
  const seconds = props.elapsedSec % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
})

function metricValue(metric: MetricDef): number {
  return Math.round(props.metrics[metric.key] ?? metric.initial)
}

function metricPercent(metric: MetricDef): number {
  const span = metric.max - metric.min || 1
  return Math.max(0, Math.min(100, ((metricValue(metric) - metric.min) / span) * 100))
}

function metricTone(metric: MetricDef): string {
  const percent = metricPercent(metric)
  if (percent <= 30) return 'is-low'
  if (percent <= 52) return 'is-guarded'
  return ''
}

onBeforeUnmount(() => {
  if (deltaTimer) window.clearTimeout(deltaTimer)
})
</script>

<template>
  <aside class="scene-status" :class="{ 'is-open': expanded }">
    <div class="scene-status__rail">
      <span class="scene-status__clock" :title="`已推演 ${elapsed}`">
        <Icon name="clock" :size="14" />
        {{ elapsed }}
      </span>

      <span class="scene-status__gauges" aria-hidden="true">
        <span
          v-for="metric in scenario.metrics"
          :key="metric.key"
          class="scene-gauge"
          :class="[metricTone(metric), { 'is-shifting': Boolean(deltas[metric.key]) }]"
          :title="`${metric.label} · ${metricValue(metric)}`"
        >
          <i :style="{ height: `${metricPercent(metric)}%` }"></i>
        </span>
      </span>

      <button
        type="button"
        class="scene-status__toggle"
        :aria-expanded="expanded"
        :aria-label="expanded ? '收起状态面板' : '展开状态面板'"
        @click="expanded = !expanded"
      >
        <Icon :name="expanded ? 'chevron-down' : 'activity'" :size="16" />
      </button>
    </div>

    <Transition name="status-drop">
      <div v-if="expanded" class="scene-status__panel">
        <header class="scene-status__head">
          <span class="scene-status__phase">{{ phaseLabel }}</span>
          <span class="scene-status__phase-hint">{{ phaseHint }}</span>
        </header>

        <div class="scene-status__metric-list">
          <div
            v-for="metric in scenario.metrics"
            :key="metric.key"
            class="scene-metric"
            :title="metric.description"
          >
            <div class="scene-metric__row">
              <span>{{ metric.label }}</span>
              <span class="scene-metric__value">
                {{ metricValue(metric) }}
                <em v-if="deltas[metric.key]" :class="{ 'is-negative': deltas[metric.key] < 0 }">
                  {{ deltas[metric.key] > 0 ? '+' : '' }}{{ deltas[metric.key] }}
                </em>
              </span>
            </div>
            <div class="scene-metric__track" :class="{ 'is-pulsing': Boolean(deltas[metric.key]) }">
              <i :style="{ width: `${metricPercent(metric)}%` }"></i>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </aside>
</template>

<style scoped>
.scene-status {
  position: relative;
  width: max-content;
  animation: status-in 500ms 160ms var(--ease-out) both;
}

.scene-status__rail {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 36px;
  padding: 0 6px 0 13px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.62);
  backdrop-filter: blur(18px) saturate(130%);
  box-shadow: var(--shadow-sm);
}

.scene-status__clock {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: var(--font-mono);
  font-size: 11.5px;
  letter-spacing: 0.04em;
  color: var(--text-muted);
  white-space: nowrap;
}

.scene-status__gauges {
  display: inline-flex;
  align-items: flex-end;
  gap: 4px;
  height: 16px;
  padding-left: 10px;
  border-left: 1px solid var(--line);
}

.scene-gauge {
  position: relative;
  display: block;
  width: 3px;
  height: 15px;
  border-radius: 999px;
  background: rgba(22, 50, 79, 0.12);
  overflow: hidden;
  transition: box-shadow 240ms ease;
}

.scene-gauge i {
  position: absolute;
  inset: auto 0 0;
  display: block;
  border-radius: inherit;
  background: var(--accent, var(--brand));
  opacity: 0.9;
  transition:
    height 650ms var(--ease-out),
    background 300ms ease;
}

.scene-gauge.is-guarded i {
  background: var(--warn);
}

.scene-gauge.is-low i {
  background: var(--danger);
}

.scene-gauge.is-shifting {
  box-shadow: 0 0 9px rgba(var(--accent-rgb, var(--brand-rgb)), 0.5);
}

.scene-status__toggle {
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--text-faint);
  cursor: pointer;
  transition:
    color 170ms ease,
    background 170ms ease;
}

.scene-status__toggle:hover {
  background: rgba(22, 50, 79, 0.06);
  color: var(--text-strong);
}

.scene-status__panel {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  width: 288px;
  padding: 14px 15px 12px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.78);
  backdrop-filter: blur(24px) saturate(135%);
  box-shadow: var(--shadow-lg);
}

.scene-status__head {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--line);
}

.scene-status__phase {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.1em;
  color: var(--accent, var(--brand));
}

.scene-status__phase-hint {
  font-size: 11px;
  color: var(--text-faint);
}

.scene-status__metric-list {
  padding: 10px 0 2px;
}

.scene-metric + .scene-metric {
  margin-top: 7px;
}

.scene-metric__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  font-size: 11.5px;
  color: var(--text-muted);
}

.scene-metric__value {
  display: inline-flex;
  align-items: baseline;
  gap: 4px;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text);
}

.scene-metric__value em {
  font-style: normal;
  font-size: 9.5px;
  color: var(--success);
}

.scene-metric__value em.is-negative {
  color: var(--danger);
}

.scene-metric__track {
  height: 2px;
  margin-top: 4px;
  border-radius: 999px;
  background: rgba(22, 50, 79, 0.1);
  overflow: hidden;
}

.scene-metric__track i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--accent, var(--brand));
  opacity: 0.85;
  transition: width 650ms var(--ease-out);
}

.scene-metric__track.is-pulsing {
  box-shadow: 0 0 10px rgba(var(--accent-rgb, var(--brand-rgb)), 0.26);
}

.status-drop-enter-active,
.status-drop-leave-active {
  transition:
    opacity 170ms ease,
    transform 220ms var(--ease-out);
}

.status-drop-enter-from,
.status-drop-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

@keyframes status-in {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 860px) {
  .scene-status__panel {
    width: min(272px, calc(100vw - 28px));
  }
}
</style>
