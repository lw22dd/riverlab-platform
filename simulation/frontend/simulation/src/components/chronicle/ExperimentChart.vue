<script setup lang="ts">
import { computed } from 'vue'
import type { ExperimentPanel } from '@/three/chronicle'

const props = defineProps<{ panel: ExperimentPanel }>()

const W = 100
const H = 34
const PAD_Y = 5

/** 纵轴取值域：带上基线，并在数据全为正值时把 0 留在图里 */
const domain = computed<{ lo: number; hi: number }>(() => {
  const values = props.panel.lines.flatMap((line) => line.values)
  if (props.panel.baseline !== undefined) values.push(props.panel.baseline)
  if (!values.length) return { lo: 0, hi: 1 }
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || Math.abs(max) || 1
  const pad = span * 0.18
  return {
    lo: min >= 0 ? Math.max(0, min - pad) : min - pad,
    hi: max + pad,
  }
})

function toX(index: number): number {
  const count = props.panel.lines[0]?.values.length ?? 1
  return count <= 1 ? 0 : (index / (count - 1)) * W
}

function toY(value: number): number {
  const { lo, hi } = domain.value
  const ratio = hi === lo ? 0.5 : (value - lo) / (hi - lo)
  return PAD_Y + (1 - ratio) * (H - PAD_Y * 2)
}

const plotLines = computed(() =>
  props.panel.lines.map((line) => ({
    tone: line.tone,
    dashed: line.dashed === true,
    points: line.values.map((value, index) => `${toX(index).toFixed(2)},${toY(value).toFixed(2)}`).join(' '),
  })),
)

const markerX = computed(() => toX(props.panel.marker))

const markerY = computed<number | null>(() => {
  const first = props.panel.lines[0]
  if (!first) return null
  const value = first.values[props.panel.marker]
  return value === undefined ? null : toY(value)
})

const baselineY = computed<number | null>(() =>
  props.panel.baseline === undefined ? null : toY(props.panel.baseline),
)

const legend = computed(() => props.panel.lines.filter((line) => line.legend !== undefined))

const barMax = computed(() => {
  const bars = props.panel.bars ?? []
  return bars.reduce((max, bar) => Math.max(max, Math.abs(bar.value)), 0) || 1
})
</script>

<template>
  <article class="chart">
    <header class="chart__head">
      <h3 class="chart__title">{{ panel.title }}</h3>
      <p class="chart__value">{{ panel.value }}</p>
    </header>

    <svg
      v-if="panel.lines.length"
      class="chart__plot"
      :viewBox="`0 0 ${W} ${H}`"
      preserveAspectRatio="none"
      role="img"
      :aria-label="`${panel.title}：${panel.value}`"
    >
      <line
        v-if="baselineY !== null"
        class="chart__baseline"
        x1="0"
        :y1="baselineY"
        :x2="W"
        :y2="baselineY"
      />
      <polyline
        v-for="(line, index) in plotLines"
        :key="index"
        class="chart__line"
        :class="[`is-${line.tone}`, { 'is-dashed': line.dashed }]"
        :points="line.points"
        fill="none"
        stroke-width="1.1"
        stroke-linecap="round"
        stroke-linejoin="round"
        vector-effect="non-scaling-stroke"
      />
      <g class="chart__marker">
        <line :x1="markerX" y1="0" :x2="markerX" :y2="H" />
        <circle v-if="markerY !== null" :cx="markerX" :cy="markerY" r="1.6" />
      </g>
    </svg>

    <ul v-else class="chart__bars">
      <li v-for="bar in panel.bars ?? []" :key="bar.label">
        <span class="chart__bar-label">{{ bar.label }}</span>
        <span class="chart__bar-track">
          <i
            :class="`is-${bar.tone}`"
            :style="{ width: `${Math.round((Math.abs(bar.value) / barMax) * 100)}%` }"
          />
        </span>
        <span class="chart__bar-value">{{ Math.round(bar.value * 100) }}%</span>
      </li>
    </ul>

    <p class="chart__note">{{ panel.note }}</p>

    <ul v-if="legend.length" class="chart__legend">
      <li v-for="line in legend" :key="line.legend">
        <i :class="[`is-${line.tone}`, { 'is-dashed': line.dashed === true }]" />
        {{ line.legend }}
      </li>
    </ul>
  </article>
</template>

<style scoped>
.chart {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 9px 7px;
  border: 1px solid var(--rl-border);
  border-radius: var(--rl-r-sm);
  background: var(--rl-surface);
}

.chart__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}

.chart__title {
  margin: 0;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.03em;
  color: var(--rl-muted);
}

.chart__value {
  margin: 0;
  font-family: var(--rl-mono);
  font-size: 12px;
  font-weight: 600;
  color: var(--rl-ink);
  white-space: nowrap;
}

.chart__plot {
  width: 100%;
  height: 40px;
  overflow: visible;
}

.chart__line.is-primary {
  stroke: var(--rl-primary);
}

.chart__line.is-celadon {
  stroke: var(--rl-celadon);
}

.chart__line.is-accent {
  stroke: var(--rl-accent);
}

.chart__line.is-muted {
  stroke: var(--rl-muted);
}

.chart__line.is-dashed {
  stroke-dasharray: 2 2;
}

.chart__baseline {
  stroke: var(--rl-faint);
  stroke-width: 0.7;
  stroke-dasharray: 1 2;
  vector-effect: non-scaling-stroke;
}

.chart__marker line {
  stroke: color-mix(in srgb, var(--rl-accent) 55%, transparent);
  stroke-width: 0.8;
  stroke-dasharray: 2 2;
  vector-effect: non-scaling-stroke;
}

.chart__marker circle {
  fill: var(--rl-accent);
}

.chart__note {
  margin: 0;
  font-size: 10px;
  line-height: 1.45;
  color: var(--rl-body);
}

.chart__bars {
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin: 1px 0 0;
  padding: 0;
  list-style: none;
}

.chart__bars li {
  display: grid;
  grid-template-columns: 64px 1fr 34px;
  align-items: center;
  gap: 8px;
}

.chart__bar-label {
  font-size: 10px;
  color: var(--rl-muted);
  white-space: nowrap;
}

.chart__bar-track {
  height: 7px;
  overflow: hidden;
  border-radius: 4px;
  background: var(--rl-bg-alt);
}

.chart__bar-track i {
  display: block;
  height: 100%;
  border-radius: 4px;
}

.chart__bar-track i.is-primary {
  background: var(--rl-primary);
}

.chart__bar-track i.is-muted {
  background: var(--rl-faint);
}

.chart__bar-value {
  font-family: var(--rl-mono);
  font-size: 10px;
  color: var(--rl-ink);
  text-align: right;
}

.chart__legend {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.chart__legend li {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 9.5px;
  color: var(--rl-muted);
}

.chart__legend i {
  width: 12px;
  height: 0;
  border-top: 1.4px solid currentColor;
}

.chart__legend i.is-primary {
  color: var(--rl-primary);
}

.chart__legend i.is-celadon {
  color: var(--rl-celadon);
}

.chart__legend i.is-accent {
  color: var(--rl-accent);
}

.chart__legend i.is-dashed {
  border-top-style: dashed;
}
</style>
