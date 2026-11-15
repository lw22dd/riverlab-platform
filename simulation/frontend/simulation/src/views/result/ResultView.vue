<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import * as echarts from 'echarts/core'
import { RadarChart } from 'echarts/charts'
import { TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import type { EChartsCoreOption } from 'echarts/core'
import { getScenarioPackage } from '@/data'
import { sessionService } from '@/services/session.service'
import { formatDuration } from '@/utils/format'
import Icon from '@/components/common/Icon.vue'
import StoryRoute from '@/components/result/StoryRoute.vue'

echarts.use([RadarChart, TooltipComponent, CanvasRenderer])

const props = defineProps<{
  sessionId: string
}>()

const session = sessionService.get(props.sessionId)
const entry = session ? getScenarioPackage(session.scenarioId) : undefined
const accent = entry?.presentation.accent ?? '#0f6e84'

const accentStyle = entry
  ? {
      '--accent': entry.presentation.accent,
      '--accent-rgb': entry.presentation.accentRgb,
    }
  : undefined

const chartHost = ref<HTMLDivElement | null>(null)
let chart: echarts.ECharts | null = null
let resizeObserver: ResizeObserver | null = null

const circumference = 2 * Math.PI * 62

const scoreOffset = computed(() => (session ? circumference * (1 - session.score / 100) : circumference))
const matchedRules = computed(() => session?.rules.filter((rule) => rule.matched) ?? [])
const missedCount = computed(() => (session?.rules.length ?? 0) - matchedRules.value.length)

const initialScore = computed(() => {
  if (!session) return 0
  const weight = session.metrics.reduce((sum, metric) => sum + metric.weight, 0) || 1
  return Math.round(session.metrics.reduce((sum, metric) => sum + metric.initial * metric.weight, 0) / weight)
})

const scoreDelta = computed(() => (session ? session.score - initialScore.value : 0))
const gradeClass = computed(() => (session ? `grade--${session.grade.toLowerCase()}` : ''))

function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.replace('#', '')
  const value = Number.parseInt(normalized.length === 3 ? normalized.repeat(2) : normalized, 16)
  const r = (value >> 16) & 255
  const g = (value >> 8) & 255
  const b = value & 255
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function buildRadarOption(): EChartsCoreOption {
  if (!session) return {}
  return {
    animationDuration: 900,
    animationEasing: 'cubicOut',
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(255,255,255,.98)',
      borderColor: 'rgba(20,36,46,.14)',
      borderWidth: 1,
      padding: [10, 13],
      textStyle: { color: '#3d5462', fontSize: 12 },
      extraCssText: 'box-shadow: 0 12px 32px rgba(20,36,46,.12); border-radius: 8px;',
    },
    radar: {
      center: ['50%', '52%'],
      radius: '68%',
      shape: 'polygon',
      splitNumber: 4,
      indicator: session.metrics.map((metric) => ({ name: metric.label, max: 100 })),
      axisName: {
        color: '#6e8593',
        fontSize: 11,
        fontFamily: 'Inter, PingFang SC, sans-serif',
        padding: [2, 5],
      },
      axisLine: { lineStyle: { color: 'rgba(20,36,46,.16)' } },
      splitLine: { lineStyle: { color: 'rgba(20,36,46,.1)' } },
      splitArea: {
        areaStyle: {
          color: ['rgba(255,255,255,0)', 'rgba(20,36,46,.025)'],
        },
      },
    },
    series: [
      {
        type: 'radar',
        symbol: 'circle',
        symbolSize: 5,
        emphasis: { lineStyle: { width: 2.5 } },
        data: [
          {
            name: '初始基线',
            value: session.metrics.map((metric) => metric.initial),
            lineStyle: {
              color: 'rgba(82,102,122,.5)',
              width: 1.2,
              type: 'dashed',
            },
            itemStyle: { color: 'rgba(82,102,122,.6)' },
            areaStyle: { color: 'rgba(82,102,122,.05)' },
          },
          {
            name: '最终结果',
            value: session.metrics.map((metric) => metric.value),
            lineStyle: { color: accent, width: 2 },
            itemStyle: { color: accent, borderColor: '#ffffff', borderWidth: 1 },
            areaStyle: { color: hexToRgba(accent, 0.14) },
          },
        ],
      },
    ],
  }
}

onMounted(() => {
  if (!session || !chartHost.value) return
  chart = echarts.init(chartHost.value, undefined, { renderer: 'canvas' })
  chart.setOption(buildRadarOption())
  resizeObserver = new ResizeObserver(() => chart?.resize())
  resizeObserver.observe(chartHost.value)
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  chart?.dispose()
  chart = null
})

function downloadSession() {
  if (!session) return
  const blob = new Blob([sessionService.toJSON(session)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `moral-lab-${session.scenarioId}-${session.id.slice(0, 8)}.json`
  anchor.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <main v-if="session" class="result-page" :style="accentStyle">
    <div class="container result-container">
      <header class="result-head">
        <RouterLink to="/" class="result-back">
          <Icon name="arrow-left" :size="15" />
          实验主题
        </RouterLink>
        <div class="result-head__actions">
          <button type="button" class="btn btn--small" @click="downloadSession">
            <Icon name="download" :size="14" />
            导出
          </button>
          <RouterLink
            :to="{ name: 'scenario', params: { id: session.scenarioId } }"
            class="btn btn--small btn--primary"
          >
            <Icon name="refresh" :size="14" />
            再推演一次
          </RouterLink>
        </div>
      </header>

      <section class="result-hero">
        <div class="result-hero__main">
          <span class="result-kicker">{{ session.outcome.kicker }}</span>
          <div class="result-title">
            <h1>{{ session.outcome.title }}</h1>
            <span class="result-grade" :class="gradeClass">{{ session.grade }}</span>
          </div>
          <p class="result-scenario">
            {{ session.scenarioTitle }} · {{ session.scenarioSubtitle }}
          </p>
          <p class="result-description">{{ session.outcome.description }}</p>

          <div class="result-meta">
            <span><Icon name="clock" :size="15" />{{ formatDuration(session.durationMs) }}</span>
            <span><Icon name="route" :size="15" />{{ session.decisions.length }} {{ session.program ? '次程序决策' : '次决策' }}</span>
            <span><Icon name="check" :size="15" />{{ matchedRules.length }} 条规则命中</span>
          </div>
        </div>

        <div class="result-score">
          <div class="result-score__ring" :class="`ring--${session.grade.toLowerCase()}`">
            <svg viewBox="0 0 144 144" aria-hidden="true">
              <circle cx="72" cy="72" r="62" class="result-score__track" />
              <circle
                cx="72"
                cy="72"
                r="62"
                class="result-score__progress"
                :stroke-dasharray="circumference"
                :stroke-dashoffset="scoreOffset"
              />
            </svg>
            <div class="result-score__value">
              <strong>{{ session.score }}</strong>
              <span>/ 100</span>
            </div>
          </div>
          <div class="result-score__bands">
            <span>初始 <strong>{{ initialScore }}</strong></span>
            <span :class="{ 'is-down': scoreDelta < 0 }">
              变化 <strong>{{ scoreDelta >= 0 ? '+' : '' }}{{ scoreDelta }}</strong>
            </span>
            <span>{{ session.gradeLabel }}</span>
          </div>
        </div>
      </section>

      <blockquote class="result-advice">
        <Icon name="spark" :size="17" />
        <p>{{ session.outcome.advice }}</p>
      </blockquote>

      <section v-if="entry" class="report-card result-brief" aria-labelledby="result-brief-title">
        <header class="report-card__head">
          <h2 id="result-brief-title">实验说明</h2>
          <span class="report-card__count">{{ entry.scenario.brief.role }}</span>
        </header>

        <div class="result-brief__grid">
          <div class="result-brief__block">
            <span class="result-brief__label">实验目标</span>
            <p class="result-brief__text">{{ entry.scenario.brief.objective }}</p>
          </div>
          <div class="result-brief__block">
            <span class="result-brief__label">情境</span>
            <p class="result-brief__text">{{ entry.scenario.brief.premise }}</p>
          </div>
          <div class="result-brief__block">
            <span class="result-brief__label">约束条件</span>
            <ul class="result-brief__list">
              <li v-for="constraint in entry.scenario.brief.constraints" :key="constraint">
                {{ constraint }}
              </li>
            </ul>
          </div>
          <div class="result-brief__block">
            <span class="result-brief__label">伦理透镜</span>
            <p class="result-brief__text">{{ entry.scenario.brief.ethicsLens }}</p>
          </div>
        </div>
      </section>

      <StoryRoute v-if="entry" :scenario="entry.scenario" :session="session" />

      <div class="result-layout">
        <section class="report-card">
          <header class="report-card__head">
            <h2>规则命中</h2>
            <span class="report-card__count">
              {{ matchedRules.length }} / {{ session.rules.length }}
            </span>
          </header>

          <div class="rule-list">
            <div
              v-for="rule in matchedRules"
              :key="rule.id"
              class="rule-row"
            >
              <span class="rule-row__dot"></span>
              <span class="rule-row__label">{{ rule.label }}</span>
              <span v-if="rule.metricDeltas.length" class="rule-row__deltas">
                <span
                  v-for="delta in rule.metricDeltas"
                  :key="`${rule.id}-${delta.key}`"
                  :class="{ 'is-negative': delta.delta < 0 }"
                >
                  {{ delta.label }}
                  <strong>{{ delta.delta > 0 ? '+' : '' }}{{ delta.delta }}</strong>
                </span>
              </span>
            </div>

            <p v-if="missedCount" class="rule-note">
              另有 {{ missedCount }} 条规则未命中，未在报告中展开。
            </p>
          </div>
        </section>

        <aside class="result-side">
          <section class="report-card report-card--chart">
            <header class="report-card__head">
              <h2>五维结果</h2>
              <div class="radar-legend">
                <span><i class="radar-legend__initial"></i>初始</span>
                <span><i class="radar-legend__final"></i>最终</span>
              </div>
            </header>
            <div ref="chartHost" class="radar-chart" role="img" aria-label="五维伦理指标雷达图"></div>
            <div class="metric-breakdown">
              <div v-for="metric in session.metrics" :key="metric.key" class="metric-row">
                <div class="metric-row__head">
                  <span>{{ metric.label }}</span>
                  <strong>{{ metric.value }}</strong>
                  <em :class="{ 'is-negative': metric.value < metric.initial }">
                    {{ metric.value >= metric.initial ? '+' : '' }}{{ metric.value - metric.initial }}
                  </em>
                </div>
                <div class="metric-row__track">
                  <i :style="{ width: `${metric.value}%` }"></i>
                  <span :style="{ left: `${metric.initial}%` }"></span>
                </div>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  </main>

  <main v-else class="result-missing">
    <h1>找不到这次推演</h1>
    <p>会话可能已被清理，或只存在于另一台设备的浏览器里。</p>
    <RouterLink to="/" class="btn btn--primary">返回实验主题</RouterLink>
  </main>
</template>

<style scoped>
.result-page {
  flex: 1;
  padding: 28px 0 72px;
}

.result-container {
  max-width: 1180px;
}

.result-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding-bottom: 18px;
  border-bottom: 1px solid var(--line);
}

.result-back {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: var(--text-muted);
  font-size: 13px;
  text-decoration: none;
  transition: color 160ms ease;
}

.result-back:hover {
  color: var(--accent, var(--brand));
}

.result-head__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.result-hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 240px;
  gap: clamp(28px, 4vw, 56px);
  align-items: center;
  margin-top: 22px;
  padding: clamp(24px, 3.4vw, 36px);
  border: 1px solid var(--line);
  border-radius: 22px;
  background:
    radial-gradient(90% 120% at 100% 0%, rgba(var(--accent-rgb, var(--brand-rgb)), 0.08), transparent 62%),
    var(--panel-raised);
  box-shadow: var(--shadow-sm);
}

.result-kicker {
  display: inline-flex;
  padding: 5px 10px;
  border: 1px solid rgba(var(--accent-rgb, var(--brand-rgb)), 0.22);
  border-radius: 999px;
  background: rgba(var(--accent-rgb, var(--brand-rgb)), 0.06);
  color: var(--accent, var(--brand));
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.1em;
}

.result-title {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-top: 14px;
}

.result-title h1 {
  color: var(--text-strong);
  font-size: clamp(34px, 4.4vw, 50px);
  font-weight: 600;
  line-height: 1.12;
  letter-spacing: -0.04em;
}

.result-grade {
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  flex: none;
  border: 1px solid var(--line-strong);
  border-radius: 50%;
  background: #ffffff;
  font-family: var(--font-display);
  font-size: 19px;
  font-weight: 600;
}

.result-scenario {
  margin-top: 10px;
  color: var(--text-muted);
  font-size: 13.5px;
}

.result-description {
  max-width: 700px;
  margin-top: 16px;
  color: var(--text-muted);
  font-size: 14px;
  line-height: 1.9;
  text-wrap: pretty;
}

.result-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 22px;
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid var(--line);
  color: var(--text-muted);
  font-size: 12.5px;
}

.result-meta span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.result-score {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 18px;
  border: 1px solid var(--line);
  border-radius: 18px;
  background: var(--panel-solid);
  box-shadow: var(--shadow-sm);
}

.result-score__ring {
  position: relative;
  width: 150px;
  height: 150px;
}

.result-score__ring svg {
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}

.result-score__track {
  fill: none;
  stroke: rgba(22, 50, 79, 0.12);
  stroke-width: 4;
}

.result-score__progress {
  fill: none;
  stroke: var(--accent, var(--brand));
  stroke-width: 4;
  stroke-linecap: round;
  filter: drop-shadow(0 0 6px rgba(var(--accent-rgb, var(--brand-rgb)), 0.3));
}

.result-score__ring.ring--a .result-score__progress {
  stroke: var(--success);
}

.result-score__ring.ring--b .result-score__progress {
  stroke: var(--blue);
}

.result-score__ring.ring--c .result-score__progress {
  stroke: var(--warn);
}

.result-score__ring.ring--d .result-score__progress {
  stroke: var(--danger);
}

.result-score__value {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
}

.result-score__value strong {
  color: var(--text-strong);
  font-family: var(--font-display);
  font-size: 46px;
  font-weight: 550;
  line-height: 1;
}

.result-score__value span {
  color: var(--text-faint);
  font-size: 11px;
}

.result-score__bands {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 6px 14px;
  margin-top: 13px;
  color: var(--text-muted);
  font-size: 11px;
}

.result-score__bands strong {
  margin-left: 3px;
  color: var(--text-strong);
  font-weight: 600;
}

.result-score__bands strong.is-down,
.result-score__bands .is-down strong {
  color: var(--danger);
}

.result-advice {
  display: flex;
  align-items: flex-start;
  gap: 11px;
  margin: 18px 0;
  padding: 15px 18px;
  border: 1px solid var(--line);
  border-left: 2px solid rgba(var(--accent-rgb, var(--brand-rgb)), 0.5);
  border-radius: 0 12px 12px 0;
  background: rgba(var(--accent-rgb, var(--brand-rgb)), 0.045);
}

.result-advice :deep(svg) {
  margin-top: 2px;
  flex: none;
  color: var(--accent, var(--brand));
}

.result-advice p {
  color: var(--text-muted);
  font-size: 13.5px;
  line-height: 1.8;
}

.result-brief {
  margin: 18px 0;
}

.result-brief__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 16px 24px;
  padding: 16px 20px 18px;
}

.result-brief__label {
  display: block;
  margin-bottom: 6px;
  color: var(--text-faint);
  font-family: var(--font-mono);
  font-size: 10.5px;
  letter-spacing: 0.12em;
}

.result-brief__text {
  color: var(--text-muted);
  font-size: 13px;
  line-height: 1.8;
}

.result-brief__list {
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.result-brief__list li {
  position: relative;
  padding-left: 13px;
  color: var(--text-muted);
  font-size: 13px;
  line-height: 1.7;
}

.result-brief__list li::before {
  content: '';
  position: absolute;
  left: 0;
  top: 8px;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: rgba(var(--accent-rgb, var(--brand-rgb)), 0.55);
}

.result-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(300px, 0.75fr);
  align-items: start;
  gap: 18px;
  margin-top: 18px;
}

.report-card {
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 18px;
  background: var(--panel-raised);
  box-shadow: var(--shadow-sm);
}

.report-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 18px 20px 14px;
  border-bottom: 1px solid var(--line);
}

.report-card__head h2 {
  color: var(--text-strong);
  font-size: 19px;
  font-weight: 600;
  letter-spacing: -0.02em;
}

.report-card__count {
  color: var(--text-faint);
  font-family: var(--font-mono);
  font-size: 11px;
}

.rule-list {
  padding: 4px 20px 10px;
}

.rule-row {
  display: grid;
  grid-template-columns: 10px minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  padding: 11px 0;
  border-bottom: 1px solid var(--line);
}

.rule-row:last-child {
  border-bottom: 0;
}

.rule-row__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--success);
}

.rule-row__label {
  color: var(--text);
  font-size: 13px;
  line-height: 1.6;
}

.rule-note {
  padding: 12px 0 4px;
  color: var(--text-faint);
  font-size: 11.5px;
}

.rule-row__deltas {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 5px 10px;
  color: var(--text-muted);
  font-size: 11px;
}

.rule-row__deltas strong {
  color: var(--success);
  font-weight: 600;
}

.rule-row__deltas .is-negative strong {
  color: var(--danger);
}

.result-side {
  min-width: 0;
}

.report-card--chart {
  padding: 0 0 4px;
}

.radar-legend {
  display: flex;
  gap: 12px;
  color: var(--text-muted);
  font-size: 11px;
}

.radar-legend span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.radar-legend i {
  display: block;
  width: 12px;
  height: 2px;
  border-radius: 999px;
}

.radar-legend__initial {
  background: rgba(82, 102, 122, 0.5);
}

.radar-legend__final {
  background: var(--accent, var(--brand));
}

.radar-chart {
  width: 100%;
  height: 250px;
}

.metric-breakdown {
  padding: 4px 20px 16px;
}

.metric-row + .metric-row {
  margin-top: 12px;
}

.metric-row__head {
  display: flex;
  align-items: baseline;
  gap: 7px;
  color: var(--text-muted);
  font-size: 12px;
}

.metric-row__head strong {
  margin-left: auto;
  color: var(--text-strong);
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 600;
}

.metric-row__head em {
  color: var(--success);
  font-family: var(--font-mono);
  font-size: 10.5px;
  font-style: normal;
}

.metric-row__head em.is-negative {
  color: var(--danger);
}

.metric-row__track {
  position: relative;
  height: 3px;
  margin-top: 6px;
  border-radius: 999px;
  background: rgba(22, 50, 79, 0.08);
}

.metric-row__track i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--accent, var(--brand));
  opacity: 0.8;
}

.metric-row__track span {
  position: absolute;
  top: -2px;
  width: 1px;
  height: 7px;
  background: rgba(22, 50, 79, 0.32);
}

.result-missing {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  padding: 80px 24px;
  text-align: center;
}

.result-missing p {
  max-width: 420px;
  color: var(--text-muted);
  font-size: 14px;
  line-height: 1.8;
}

@media (max-width: 940px) {
  .result-hero {
    grid-template-columns: 1fr;
  }

  .result-score {
    align-items: flex-start;
    flex-direction: row;
    gap: 20px;
  }

  .result-layout {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 620px) {
  .result-page {
    padding-top: 18px;
  }

  .result-head {
    flex-wrap: wrap;
  }

  .result-title h1 {
    font-size: 32px;
  }

  .result-score {
    flex-direction: column;
    align-items: center;
  }

  .rule-row {
    grid-template-columns: 10px minmax(0, 1fr);
  }

  .rule-row__deltas {
    grid-column: 2;
    justify-content: flex-start;
  }
}
</style>
