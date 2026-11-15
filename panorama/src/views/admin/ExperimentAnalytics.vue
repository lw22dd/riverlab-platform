<template>
  <div class="experiment-analytics">
    <!-- 页头 -->
    <div class="page-head">
      <div>
        <h1>实验数据</h1>
        <p>汇总仿真实验的完成情况、成绩分布、决策偏好与规则命中</p>
      </div>
      <div class="page-head-meta">
        <t-icon name="time" size="16" />
        <span>最近更新：{{ lastUpdated || '--' }}</span>
      </div>
    </div>

    <!-- 筛选区 -->
    <section class="panel filter-panel">
      <div class="filter-grid">
        <div class="filter-field">
          <span class="filter-label">日期范围</span>
          <t-date-range-picker
            v-model="filters.dateRange"
            :placeholder="['开始日期', '结束日期']"
            clearable
            style="width: 280px"
          />
        </div>

        <div class="filter-field">
          <span class="filter-label">实验场景</span>
          <t-select
            v-model="filters.scenarioId"
            :options="scenarioOptions"
            placeholder="全部场景"
            clearable
            filterable
            style="width: 220px"
          />
        </div>

        <div class="filter-field">
          <span class="filter-label">班级 ID</span>
          <t-input-number
            v-model="filters.classId"
            :min="1"
            :step="1"
            placeholder="全部班级"
            style="width: 160px"
          />
        </div>

        <div class="filter-actions">
          <t-button theme="primary" @click="handleQuery">
            <template #icon><t-icon name="search" /></template>
            查询
          </t-button>
          <t-button variant="outline" @click="handleReset">
            <template #icon><t-icon name="refresh" /></template>
            重置
          </t-button>
          <t-button
            variant="outline"
            theme="primary"
            :loading="exportLoading"
            @click="handleExport"
          >
            <template #icon><t-icon name="download" /></template>
            导出 CSV
          </t-button>
        </div>
      </div>
    </section>

    <!-- KPI 卡片 -->
    <div class="kpi-grid">
      <div
        v-for="item in kpiCards"
        :key="item.key"
        class="kpi-card"
        :class="`tone-${item.tone}`"
      >
        <div class="kpi-icon">
          <t-icon :name="item.icon" size="22" />
        </div>
        <div class="kpi-main">
          <div class="kpi-label">{{ item.label }}</div>
          <div class="kpi-value">
            <span>{{ item.value }}</span>
            <span v-if="item.unit" class="kpi-unit">{{ item.unit }}</span>
          </div>
          <div class="kpi-hint">{{ item.hint }}</div>
        </div>
      </div>
    </div>

    <!-- 等级分布 + 每日趋势 -->
    <div class="chart-grid chart-grid-main">
      <section class="panel chart-panel">
        <div class="panel-head">
          <div>
            <h2>等级分布</h2>
            <p>按 A / B / C / D 等级统计实验人次</p>
          </div>
          <span class="panel-tag">共 {{ formatNumber(overview?.sessions) }} 次</span>
        </div>
        <div class="chart-body">
          <div ref="gradeChartRef" class="chart-canvas"></div>
          <div v-if="overviewLoading" class="chart-mask">
            <t-loading size="small" text="加载中..." />
          </div>
          <div v-else-if="!hasGradeData" class="chart-mask">
            <div class="chart-empty">
              <t-icon name="chart" size="26" />
              <span>暂无等级分布数据</span>
            </div>
          </div>
        </div>
      </section>

      <section class="panel chart-panel">
        <div class="panel-head">
          <div>
            <h2>每日趋势</h2>
            <p>每日实验会话数与平均分变化</p>
          </div>
          <span class="panel-tag">覆盖 {{ trendPoints.length }} 天</span>
        </div>
        <div class="chart-body">
          <div ref="trendChartRef" class="chart-canvas"></div>
          <div v-if="overviewLoading" class="chart-mask">
            <t-loading size="small" text="加载中..." />
          </div>
          <div v-else-if="!hasTrendData" class="chart-mask">
            <div class="chart-empty">
              <t-icon name="chart" size="26" />
              <span>暂无每日趋势数据</span>
            </div>
          </div>
        </div>
      </section>
    </div>

    <!-- 场景对比 + 决策分布 -->
    <div class="chart-grid chart-grid-secondary">
      <section class="panel chart-panel">
        <div class="panel-head">
          <div>
            <h2>场景对比</h2>
            <p>各实验场景的会话数与参与学生数</p>
          </div>
          <span class="panel-tag">{{ scenarioStats.length }} 个场景</span>
        </div>
        <div class="chart-body">
          <div ref="scenarioChartRef" class="chart-canvas"></div>
          <div v-if="scenarioLoading" class="chart-mask">
            <t-loading size="small" text="加载中..." />
          </div>
          <div v-else-if="!hasScenarioData" class="chart-mask">
            <div class="chart-empty">
              <t-icon name="chart" size="26" />
              <span>暂无场景统计数据</span>
            </div>
          </div>
        </div>
      </section>

      <section class="panel chart-panel">
        <div class="panel-head">
          <div>
            <h2>决策选项分布</h2>
            <p>{{ filters.scenarioId ? '当前场景下各决策选项的选择次数' : '全部场景下各决策选项的选择次数' }}</p>
          </div>
          <span class="panel-tag">覆盖 {{ formatNumber(decisionStats?.total) }} 次会话</span>
        </div>
        <div class="chart-body">
          <div ref="decisionChartRef" class="chart-canvas"></div>
          <div v-if="decisionLoading" class="chart-mask">
            <t-loading size="small" text="加载中..." />
          </div>
          <div v-else-if="!hasDecisionData" class="chart-mask">
            <div class="chart-empty">
              <t-icon name="chart" size="26" />
              <span>暂无决策分布数据</span>
            </div>
          </div>
        </div>
      </section>
    </div>

    <!-- 规则命中 -->
    <section class="panel rules-panel">
      <div class="panel-head">
        <div>
          <h2>规则命中率</h2>
          <p>评分规则在所选场景 / 班级范围内的命中情况</p>
        </div>
        <span class="panel-tag">{{ ruleStats.length }} 条规则</span>
      </div>

      <div v-if="ruleLoading" class="inline-loading">
        <t-loading size="small" text="加载中..." />
      </div>
      <div v-else-if="ruleStats.length" class="rule-list">
        <div v-for="rule in ruleStats" :key="rule.rule_id" class="rule-row">
          <div class="rule-main">
            <div class="rule-label">{{ rule.label || rule.rule_id }}</div>
            <div class="rule-sub">命中 {{ formatNumber(rule.hits) }} / {{ formatNumber(rule.total) }} 次</div>
          </div>
          <t-tag size="small" variant="light" :theme="ruleKindMeta(rule.kind).theme">
            {{ ruleKindMeta(rule.kind).label }}
          </t-tag>
          <div class="rule-progress">
            <t-progress
              :percentage="rulePercent(rule.hit_rate)"
              :color="ruleKindMeta(rule.kind).color"
              :label="false"
              size="small"
            />
          </div>
          <div class="rule-rate">{{ formatRate(rule.hit_rate) }}</div>
        </div>
      </div>
      <div v-else class="inline-empty">暂无规则命中数据</div>
    </section>

    <!-- 最近会话 -->
    <section class="panel table-panel">
      <div class="panel-head table-head">
        <div>
          <h2>最近会话</h2>
          <p>共 {{ formatNumber(pagination.total) }} 条记录，点击任意一行查看实验详情</p>
        </div>
        <div class="table-tools">
          <t-input
            v-model="sessionKeyword"
            placeholder="搜索学号 / 姓名"
            clearable
            style="width: 220px"
            @enter="handleSessionSearch"
            @clear="handleSessionSearch"
          >
            <template #prefix-icon><t-icon name="search" /></template>
          </t-input>
          <t-button variant="outline" @click="refreshSessions">
            <template #icon><t-icon name="refresh" /></template>
            刷新
          </t-button>
        </div>
      </div>

      <t-table
        :data="sessions"
        :columns="sessionColumns"
        :loading="sessionsLoading"
        row-key="id"
        hover
        stripe
        empty="暂无实验会话数据"
        @row-click="handleRowClick"
      />

      <div class="table-footer">
        <span class="table-total">共 {{ formatNumber(pagination.total) }} 条</span>
        <t-pagination
          v-if="pagination.total > 0"
          v-model="pagination.current"
          v-model:page-size="pagination.pageSize"
          :total="pagination.total"
          :page-size-options="[10, 20, 50]"
          :show-jumper="true"
          @change="handlePageChange"
        />
      </div>
    </section>

    <!-- 实验详情抽屉 -->
    <t-drawer
      v-model:visible="detailVisible"
      header="实验详情"
      size="760px"
      :footer="false"
      @close="handleDrawerClosed"
    >
      <div class="detail-wrap">
        <div v-if="detailLoading" class="detail-loading">
          <t-loading text="正在加载实验详情..." />
        </div>

        <template v-else-if="detail">
          <div class="detail-hero">
            <div class="detail-hero-main">
              <div class="detail-hero-title">{{ detail.scenario_title || '未命名场景' }}</div>
              <div class="detail-hero-sub">
                {{ detail.nickname || detail.username || '-' }}
                · {{ detail.class_name || (detail.class_id ? `班级 ${detail.class_id}` : '-') }}
                · {{ formatTime(detail.finished_at) }}
              </div>
            </div>
            <div class="detail-hero-side">
              <div class="detail-score">
                {{ detail.score }}<span>分</span>
              </div>
              <span
                class="grade-pill"
                :class="`grade-${String(detail.grade || '').toLowerCase()}`"
              >
                {{ detail.grade_label || detail.grade || '-' }}
              </span>
            </div>
          </div>

          <t-descriptions :column="2" bordered class="detail-descriptions">
            <t-descriptions-item label="学生姓名">{{ detail.nickname || '-' }}</t-descriptions-item>
            <t-descriptions-item label="学号">{{ detail.username || '-' }}</t-descriptions-item>
            <t-descriptions-item label="班级">{{ detail.class_name || '-' }}</t-descriptions-item>
            <t-descriptions-item label="场景版本">{{ detail.scenario_version || '-' }}</t-descriptions-item>
            <t-descriptions-item label="领域">{{ domainLabel(detail.domain) }}</t-descriptions-item>
            <t-descriptions-item label="等级">{{ detail.grade_label || detail.grade || '-' }}</t-descriptions-item>
            <t-descriptions-item label="结局">{{ detail.outcome_title || '-' }}</t-descriptions-item>
            <t-descriptions-item label="用时">{{ formatDuration(detail.duration_ms) }}</t-descriptions-item>
            <t-descriptions-item label="开始时间">{{ formatTime(detail.started_at) }}</t-descriptions-item>
            <t-descriptions-item label="完成时间">{{ formatTime(detail.finished_at) }}</t-descriptions-item>
          </t-descriptions>

          <div class="detail-section">
            <div class="section-title">
              <span>决策记录</span>
              <span class="section-count">{{ detailDecisions.length }}</span>
            </div>
            <t-table
              v-if="detailDecisions.length"
              :data="detailDecisions"
              :columns="decisionColumns"
              row-key="_key"
              size="small"
              max-height="320"
            />
            <div v-else class="inline-empty">暂无决策记录</div>
          </div>

          <div class="detail-section">
            <div class="section-title">
              <span>规则结算</span>
              <span class="section-count">{{ detailRules.length }}</span>
            </div>
            <t-table
              v-if="detailRules.length"
              :data="detailRules"
              :columns="ruleColumns"
              row-key="id"
              size="small"
              max-height="300"
            />
            <div v-else class="inline-empty">暂无规则结算数据</div>
          </div>

          <div class="detail-section">
            <div class="section-title">
              <span>实验日志</span>
              <span class="section-count">{{ detailLogs.length }}</span>
            </div>
            <div v-if="detailLogs.length" class="log-list">
              <div
                v-for="(log, index) in detailLogs"
                :key="log.id ?? index"
                class="log-item"
              >
                <span
                  class="log-dot"
                  :style="{ backgroundColor: logKindMeta(log.kind).color }"
                ></span>
                <div class="log-main">
                  <div class="log-head">
                    <span class="log-kind">{{ logKindMeta(log.kind).label }}</span>
                    <span v-if="log.title" class="log-title">{{ log.title }}</span>
                    <span class="log-time">{{ formatTime(log.at) }}</span>
                  </div>
                  <div class="log-text">{{ log.text }}</div>
                </div>
              </div>
            </div>
            <div v-else class="inline-empty">暂无日志记录</div>
          </div>
        </template>
      </div>
    </t-drawer>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { MessagePlugin } from 'tdesign-vue-next'
import * as echarts from 'echarts'
import SimulationApi from '@/apis/simulation.api'
import type {
  AnalyticsOverview,
  DecisionAnalyticsData,
  RuleStat,
  ScenarioStat,
  SessionLogEntry,
  SessionPayload,
  SessionRuleResult,
  SimSessionDetail,
  SimSessionItem
} from '@/models/simulation.model'

/* ----------------------------- 基础状态 ----------------------------- */

const filters = reactive<{
  dateRange: string[]
  scenarioId?: string
  classId?: number | string
}>({
  dateRange: [],
  scenarioId: '',
  classId: undefined
})

const pagination = reactive({
  current: 1,
  pageSize: 10,
  total: 0
})

const sessionKeyword = ref('')

const overview = ref<AnalyticsOverview | null>(null)
const scenarioStats = ref<ScenarioStat[]>([])
const decisionStats = ref<DecisionAnalyticsData | null>(null)
const ruleStats = ref<RuleStat[]>([])
const sessions = ref<SimSessionItem[]>([])

const overviewLoading = ref(false)
const scenarioLoading = ref(false)
const decisionLoading = ref(false)
const ruleLoading = ref(false)
const sessionsLoading = ref(false)

const exportLoading = ref(false)
const lastUpdated = ref('')

/* ----------------------------- 详情状态 ----------------------------- */

const detailVisible = ref(false)
const detailLoading = ref(false)
const detail = ref<SimSessionDetail | null>(null)

/* ----------------------------- 工具函数 ----------------------------- */

const pad = (value: number) => String(value).padStart(2, '0')

const formatTime = (timestamp?: number | null) => {
  if (timestamp === undefined || timestamp === null || timestamp === 0) return '-'
  const date = new Date(Number(timestamp))
  if (Number.isNaN(date.getTime())) return '-'
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

const formatDuration = (durationMs?: number | null) => {
  if (durationMs === undefined || durationMs === null) return '-'
  const value = Number(durationMs)
  if (Number.isNaN(value)) return '-'
  return `${(value / 1000).toFixed(1)} 秒`
}

const formatNumber = (value?: number | null) => {
  if (value === undefined || value === null) return '--'
  const number = Number(value)
  if (Number.isNaN(number)) return '--'
  return number.toLocaleString('zh-CN')
}

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message) return error.message
  return fallback
}

const domainLabels: Record<string, string> = {
  autonomous: '自动驾驶',
  trolley: '电车难题',
  footbridge: '天桥困境',
  collapse: '建筑坍塌',
  dujiangyan: '都江堰'
}

const domainLabel = (domain?: string) => {
  if (!domain) return '-'
  return domainLabels[domain] || domain
}

interface RuleKindMeta {
  label: string
  theme: 'success' | 'danger' | 'default'
  color: string
}

const ruleKindMetaMap: Record<string, RuleKindMeta> = {
  positive: { label: '加分规则', theme: 'success', color: '#2f9e68' },
  negative: { label: '扣分规则', theme: 'danger', color: '#d65b4a' },
  neutral: { label: '中性规则', theme: 'default', color: '#6e8593' }
}

const ruleKindMeta = (kind?: string): RuleKindMeta => {
  if (kind && ruleKindMetaMap[kind]) return ruleKindMetaMap[kind]
  return ruleKindMetaMap.neutral
}

const rulePercent = (rate?: number) => {
  const value = Number(rate) * 100
  if (!Number.isFinite(value)) return 0
  return Math.min(100, Math.max(0, Math.round(value * 10) / 10))
}

const formatRate = (rate?: number) => {
  const value = Number(rate)
  if (!Number.isFinite(value)) return '0.0%'
  return `${(Math.min(1, Math.max(0, value)) * 100).toFixed(1)}%`
}

const logKindMetaMap: Record<string, { label: string; color: string }> = {
  system: { label: '系统', color: '#6e8593' },
  narrative: { label: '剧情', color: '#0f6e84' },
  decision: { label: '决策', color: '#4e9a8e' },
  consequence: { label: '后果', color: '#d99a2b' },
  inspect: { label: '观察', color: '#2f9e68' },
  warning: { label: '提示', color: '#d65b4a' }
}

const logKindMeta = (kind?: string) => {
  if (kind && logKindMetaMap[kind]) return logKindMetaMap[kind]
  return logKindMetaMap.system
}

/* ----------------------------- 查询参数 ----------------------------- */

const getClassId = (): number | undefined => {
  const raw = filters.classId
  const value = typeof raw === 'string' ? Number(raw) : raw
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return undefined
  return Math.trunc(value)
}

const buildDateClassQuery = () => {
  const range = Array.isArray(filters.dateRange) ? filters.dateRange : []
  return {
    from: range[0] || undefined,
    to: range[1] || undefined,
    class_id: getClassId()
  }
}

const buildAnalyticsQuery = () => ({
  ...buildDateClassQuery(),
  scenario_id: filters.scenarioId || undefined
})

const buildScenarioFilterQuery = () => ({
  scenario_id: filters.scenarioId || undefined,
  class_id: getClassId()
})

/* ----------------------------- 图表数据 ----------------------------- */

const gradePieData = computed(() => {
  const grade = overview.value?.grade_distribution
  if (!grade) return []
  return [
    { name: 'A 优秀', value: grade.A || 0, itemStyle: { color: '#2f9e68' } },
    { name: 'B 良好', value: grade.B || 0, itemStyle: { color: '#0f6e84' } },
    { name: 'C 合格', value: grade.C || 0, itemStyle: { color: '#d99a2b' } },
    { name: 'D 待改进', value: grade.D || 0, itemStyle: { color: '#d65b4a' } }
  ]
})

const hasGradeData = computed(() => gradePieData.value.some(item => item.value > 0))

const trendPoints = computed(() =>
  [...(overview.value?.daily_trend ?? [])].sort((a, b) => a.date.localeCompare(b.date))
)

const hasTrendData = computed(() => trendPoints.value.length > 0)

const hasScenarioData = computed(() => scenarioStats.value.length > 0)

const topDecisions = computed(() =>
  [...(decisionStats.value?.items ?? [])].sort((a, b) => b.count - a.count).slice(0, 10)
)

const hasDecisionData = computed(() => topDecisions.value.length > 0)

const scenarioOptions = computed(() => [
  { label: '全部场景', value: '' },
  ...scenarioStats.value.map(item => ({
    label: item.scenario_title || item.scenario_id,
    value: item.scenario_id
  }))
])

const kpiCards = computed(() => {
  const data = overview.value
  return [
    {
      key: 'sessions',
      label: '会话数',
      value: data ? formatNumber(data.sessions) : '--',
      unit: '次',
      hint: '所选范围内完成的实验',
      icon: 'chart',
      tone: 'blue'
    },
    {
      key: 'students',
      label: '参与学生数',
      value: data ? formatNumber(data.students) : '--',
      unit: '人',
      hint: '去重后的参与学生',
      icon: 'usergroup',
      tone: 'green'
    },
    {
      key: 'avg-score',
      label: '平均分',
      value: data ? Number(data.avg_score).toFixed(1) : '--',
      unit: '分',
      hint: '满分 100 分',
      icon: 'star',
      tone: 'orange'
    },
    {
      key: 'avg-duration',
      label: '平均时长',
      value: data ? (Number(data.avg_duration_ms) / 1000).toFixed(1) : '--',
      unit: '秒',
      hint: '单次实验平均耗时',
      icon: 'time',
      tone: 'purple'
    }
  ]
})

/* ----------------------------- 图表实例 ----------------------------- */

const gradeChartRef = ref<HTMLDivElement | null>(null)
const trendChartRef = ref<HTMLDivElement | null>(null)
const scenarioChartRef = ref<HTMLDivElement | null>(null)
const decisionChartRef = ref<HTMLDivElement | null>(null)

let gradeChart: echarts.ECharts | null = null
let trendChart: echarts.ECharts | null = null
let scenarioChart: echarts.ECharts | null = null
let decisionChart: echarts.ECharts | null = null
let resizeObserver: ResizeObserver | null = null

const resizeCharts = () => {
  gradeChart?.resize()
  trendChart?.resize()
  scenarioChart?.resize()
  decisionChart?.resize()
}

const baseTooltip = {
  backgroundColor: '#ffffff',
  borderColor: '#e2e9ee',
  borderWidth: 1,
  padding: [10, 14] as [number, number],
  textStyle: { color: '#14242e', fontSize: 12 },
  extraCssText: 'box-shadow: 0 8px 24px rgba(20, 36, 46, 0.1); border-radius: 8px;'
}

const renderGradeChart = () => {
  if (!gradeChart) return
  gradeChart.setOption({
    tooltip: {
      ...baseTooltip,
      trigger: 'item',
      formatter: '{b}<br/>{c} 人次（{d}%）'
    },
    legend: {
      bottom: 0,
      left: 'center',
      itemWidth: 8,
      itemHeight: 8,
      icon: 'circle',
      textStyle: { color: '#3d5462', fontSize: 12 }
    },
    series: [
      {
        name: '等级分布',
        type: 'pie',
        radius: ['46%', '68%'],
        center: ['50%', '42%'],
        avoidLabelOverlap: true,
        itemStyle: {
          borderColor: '#ffffff',
          borderWidth: 3,
          borderRadius: 6
        },
        label: { show: false },
        labelLine: { show: false },
        emphasis: {
          scale: true,
          scaleSize: 4,
          label: {
            show: true,
            position: 'center',
            formatter: '{b}\n{c} 人次',
            fontSize: 15,
            fontWeight: 600,
            lineHeight: 22,
            color: '#14242e'
          }
        },
        data: gradePieData.value
      }
    ]
  }, true)
}

const renderTrendChart = () => {
  if (!trendChart) return
  const points = trendPoints.value
  trendChart.setOption({
    tooltip: {
      ...baseTooltip,
      trigger: 'axis',
      axisPointer: { type: 'line', lineStyle: { color: '#cfdae2' } }
    },
    legend: {
      top: 0,
      right: 0,
      itemWidth: 12,
      itemHeight: 6,
      icon: 'roundRect',
      textStyle: { color: '#3d5462', fontSize: 12 }
    },
    grid: { top: 44, left: 10, right: 18, bottom: 6, containLabel: true },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: points.map(item => item.date),
      axisLine: { lineStyle: { color: '#e2e9ee' } },
      axisTick: { show: false },
      axisLabel: { color: '#6e8593', fontSize: 12 }
    },
    yAxis: [
      {
        type: 'value',
        name: '会话数',
        minInterval: 1,
        nameTextStyle: { color: '#6e8593', padding: [0, 0, 0, 8] },
        axisLabel: { color: '#6e8593' },
        splitLine: { lineStyle: { color: '#edf2f5' } }
      },
      {
        type: 'value',
        name: '平均分',
        min: 0,
        max: 100,
        nameTextStyle: { color: '#6e8593' },
        axisLabel: { color: '#6e8593' },
        splitLine: { show: false }
      }
    ],
    series: [
      {
        name: '会话数',
        type: 'line',
        smooth: true,
        showSymbol: false,
        symbol: 'circle',
        symbolSize: 7,
        data: points.map(item => item.sessions),
        lineStyle: { width: 2.5, color: '#0f6e84' },
        itemStyle: { color: '#0f6e84' },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(15, 110, 132, 0.2)' },
            { offset: 1, color: 'rgba(15, 110, 132, 0.02)' }
          ])
        }
      },
      {
        name: '平均分',
        type: 'line',
        smooth: true,
        showSymbol: false,
        yAxisIndex: 1,
        data: points.map(item => item.avg_score),
        lineStyle: { width: 2.5, color: '#c4703a' },
        itemStyle: { color: '#c4703a' }
      }
    ]
  }, true)
}

const renderScenarioChart = () => {
  if (!scenarioChart) return
  const items = scenarioStats.value
  scenarioChart.setOption({
    tooltip: {
      ...baseTooltip,
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: any) => {
        const list = Array.isArray(params) ? params : [params]
        const item = items[list[0]?.dataIndex ?? -1]
        if (!item) return ''
        return [
          `<div style="font-weight:600;margin-bottom:4px;">${item.scenario_title || item.scenario_id}</div>`,
          `<div>会话数：${item.sessions}</div>`,
          `<div>参与学生：${item.students}</div>`,
          `<div>平均分：${Number(item.avg_score).toFixed(1)}</div>`,
          `<div>平均用时：${formatDuration(item.avg_duration_ms)}</div>`
        ].join('')
      }
    },
    legend: {
      top: 0,
      right: 0,
      itemWidth: 12,
      itemHeight: 6,
      icon: 'roundRect',
      textStyle: { color: '#3d5462', fontSize: 12 }
    },
    grid: { top: 44, left: 10, right: 16, bottom: 4, containLabel: true },
    xAxis: {
      type: 'category',
      data: items.map(item => item.scenario_title || item.scenario_id),
      axisLine: { lineStyle: { color: '#e2e9ee' } },
      axisTick: { show: false },
      axisLabel: {
        color: '#6e8593',
        fontSize: 11,
        interval: 0,
        rotate: items.length > 4 ? 24 : 0,
        formatter: (value: string) => (value.length > 8 ? `${value.slice(0, 8)}…` : value)
      }
    },
    yAxis: [
      {
        type: 'value',
        name: '数量',
        minInterval: 1,
        nameTextStyle: { color: '#6e8593', padding: [0, 0, 0, 8] },
        axisLabel: { color: '#6e8593' },
        splitLine: { lineStyle: { color: '#edf2f5' } }
      }
    ],
    series: [
      {
        name: '会话数',
        type: 'bar',
        barMaxWidth: 26,
        data: items.map(item => item.sessions),
        itemStyle: {
          borderRadius: [4, 4, 0, 0],
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: '#0f6e84' },
            { offset: 1, color: '#79b7c4' }
          ])
        }
      },
      {
        name: '参与学生',
        type: 'bar',
        barMaxWidth: 26,
        data: items.map(item => item.students),
        itemStyle: {
          borderRadius: [4, 4, 0, 0],
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: '#4e9a8e' },
            { offset: 1, color: '#a8cfc9' }
          ])
        }
      }
    ]
  }, true)
}

const renderDecisionChart = () => {
  if (!decisionChart) return
  const items = [...topDecisions.value].reverse()
  decisionChart.setOption({
    tooltip: {
      ...baseTooltip,
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: any) => {
        const list = Array.isArray(params) ? params : [params]
        const item = items[list[0]?.dataIndex ?? -1]
        if (!item) return ''
        return [
          `<div style="font-weight:600;margin-bottom:4px;">${item.node_title || item.node_id}</div>`,
          `<div>选项：${item.label || item.option_id}</div>`,
          `<div>选择次数：${item.count}</div>`
        ].join('')
      }
    },
    grid: { top: 12, left: 10, right: 48, bottom: 6, containLabel: true },
    xAxis: {
      type: 'value',
      minInterval: 1,
      axisLabel: { color: '#6e8593' },
      splitLine: { lineStyle: { color: '#edf2f5' } }
    },
    yAxis: {
      type: 'category',
      data: items.map(item => `${item.node_title || item.node_id} · ${item.label || item.option_id}`),
      axisTick: { show: false },
      axisLine: { show: false },
      axisLabel: {
        color: '#3d5462',
        fontSize: 12,
        width: 210,
        overflow: 'truncate'
      }
    },
    series: [
      {
        name: '选择次数',
        type: 'bar',
        barMaxWidth: 14,
        data: items.map(item => item.count),
        itemStyle: {
          borderRadius: [0, 7, 7, 0],
          color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
            { offset: 0, color: '#4e9a8e' },
            { offset: 1, color: '#8fc3bb' }
          ])
        },
        label: {
          show: true,
          position: 'right',
          color: '#3d5462',
          fontSize: 12
        }
      }
    ]
  }, true)
}

const renderAllCharts = () => {
  renderGradeChart()
  renderTrendChart()
  renderScenarioChart()
  renderDecisionChart()
}

const initCharts = () => {
  if (gradeChartRef.value) gradeChart = echarts.init(gradeChartRef.value)
  if (trendChartRef.value) trendChart = echarts.init(trendChartRef.value)
  if (scenarioChartRef.value) scenarioChart = echarts.init(scenarioChartRef.value)
  if (decisionChartRef.value) decisionChart = echarts.init(decisionChartRef.value)

  const observe = (element: HTMLElement | null) => {
    if (element) resizeObserver?.observe(element)
  }

  resizeObserver = new ResizeObserver(resizeCharts)
  observe(gradeChartRef.value)
  observe(trendChartRef.value)
  observe(scenarioChartRef.value)
  observe(decisionChartRef.value)
  window.addEventListener('resize', resizeCharts)

  renderAllCharts()
}

/* ----------------------------- 数据加载 ----------------------------- */

const loadOverview = async () => {
  overviewLoading.value = true
  try {
    const result = await SimulationApi.getOverview(buildAnalyticsQuery())
    if (result.code === 200 && result.data) {
      overview.value = result.data
    }
    await nextTick()
    renderGradeChart()
    renderTrendChart()
  } finally {
    overviewLoading.value = false
  }
}

const loadScenarioStats = async () => {
  scenarioLoading.value = true
  try {
    const result = await SimulationApi.getScenarios(buildDateClassQuery())
    if (result.code === 200 && result.data) {
      scenarioStats.value = result.data.items ?? []
    }
    await nextTick()
    renderScenarioChart()
  } finally {
    scenarioLoading.value = false
  }
}

const loadDecisionStats = async () => {
  decisionLoading.value = true
  try {
    const result = await SimulationApi.getDecisions(buildScenarioFilterQuery())
    if (result.code === 200 && result.data) {
      decisionStats.value = result.data
    }
    await nextTick()
    renderDecisionChart()
  } finally {
    decisionLoading.value = false
  }
}

const loadRuleStats = async () => {
  ruleLoading.value = true
  try {
    const result = await SimulationApi.getRules(buildScenarioFilterQuery())
    if (result.code === 200 && result.data) {
      ruleStats.value = result.data.items ?? []
    }
  } finally {
    ruleLoading.value = false
  }
}

const loadSessions = async () => {
  sessionsLoading.value = true
  try {
    const result = await SimulationApi.getSessions({
      ...buildAnalyticsQuery(),
      page: pagination.current,
      page_size: pagination.pageSize,
      keyword: sessionKeyword.value.trim() || undefined
    })
    if (result.code === 200 && result.data) {
      sessions.value = result.data.items ?? []
      pagination.total = result.data.total ?? 0
    }
  } finally {
    sessionsLoading.value = false
  }
}

const loadAll = async () => {
  const results = await Promise.allSettled([
    loadOverview(),
    loadScenarioStats(),
    loadDecisionStats(),
    loadRuleStats(),
    loadSessions()
  ])
  if (results.some(item => item.status === 'rejected')) {
    MessagePlugin.error('部分实验数据加载失败，请稍后重试')
  }
  lastUpdated.value = formatTime(Date.now())
}

const refreshSessions = async () => {
  try {
    await loadSessions()
  } catch (error) {
    MessagePlugin.error(getErrorMessage(error, '获取会话列表失败'))
  }
}

/* ----------------------------- 交互事件 ----------------------------- */

const handleQuery = async () => {
  pagination.current = 1
  await loadAll()
}

const handleReset = async () => {
  filters.dateRange = []
  filters.scenarioId = ''
  filters.classId = undefined
  sessionKeyword.value = ''
  pagination.current = 1
  await loadAll()
}

const handleSessionSearch = () => {
  pagination.current = 1
  refreshSessions()
}

const handlePageChange = (context: { current: number; pageSize: number }) => {
  pagination.current = context.current
  pagination.pageSize = context.pageSize
  refreshSessions()
}

const handleExport = async () => {
  exportLoading.value = true
  try {
    const blob = await SimulationApi.exportCsv(buildAnalyticsQuery())
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'sim-sessions.csv'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.setTimeout(() => window.URL.revokeObjectURL(url), 0)
    MessagePlugin.success('导出成功')
  } catch (error) {
    MessagePlugin.error(getErrorMessage(error, '导出失败，请稍后重试'))
  } finally {
    exportLoading.value = false
  }
}

const handleRowClick = (context: any) => {
  const row = context && typeof context === 'object' && 'row' in context ? context.row : context
  const id = row?.id
  if (id) {
    openDetail(String(id))
  }
}

const openDetail = async (id: string) => {
  detailVisible.value = true
  detailLoading.value = true
  detail.value = null
  try {
    const result = await SimulationApi.getSessionDetail(id)
    if (result.code === 200 && result.data) {
      detail.value = result.data
    } else {
      MessagePlugin.error(result.msg || '获取实验详情失败')
      detailVisible.value = false
    }
  } catch (error) {
    MessagePlugin.error(getErrorMessage(error, '获取实验详情失败'))
    detailVisible.value = false
  } finally {
    detailLoading.value = false
  }
}

const handleDrawerClosed = () => {
  detail.value = null
}

/* ----------------------------- 详情派生数据 ----------------------------- */

const detailPayload = computed<SessionPayload | null>(() => {
  const raw = detail.value?.payload
  if (!raw) return null
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as SessionPayload
    } catch {
      return null
    }
  }
  return raw
})

const detailDecisions = computed(() =>
  (detailPayload.value?.decisions ?? []).map((item, index) => ({
    ...item,
    _key: `${item.nodeId || 'node'}-${item.optionId || 'option'}-${index}`
  }))
)

const detailRules = computed<SessionRuleResult[]>(() => detailPayload.value?.rules ?? [])

const detailLogs = computed<SessionLogEntry[]>(() => detailPayload.value?.logs ?? [])

/* ----------------------------- 表格列定义 ----------------------------- */

const sessionColumns = [
  {
    colKey: 'username',
    title: '学生',
    minWidth: 150,
    cell: (h: any, { row }: { row: SimSessionItem }) =>
      h('div', { class: 'student-cell' }, [
        h('span', { class: 'student-name' }, row.nickname || row.username || '-'),
        h('span', { class: 'student-id' }, row.username || '')
      ])
  },
  {
    colKey: 'class_name',
    title: '班级',
    minWidth: 110,
    ellipsis: true,
    cell: (_h: any, { row }: { row: SimSessionItem }) =>
      row.class_name || (row.class_id ? `班级 ${row.class_id}` : '-')
  },
  {
    colKey: 'scenario_title',
    title: '实验场景',
    minWidth: 170,
    ellipsis: true
  },
  {
    colKey: 'score',
    title: '分数',
    width: 80,
    align: 'center' as const
  },
  {
    colKey: 'grade',
    title: '等级',
    width: 96,
    align: 'center' as const,
    cell: (h: any, { row }: { row: SimSessionItem }) =>
      h(
        'span',
        { class: ['grade-pill', `grade-${String(row.grade || '').toLowerCase()}`] },
        row.grade_label || row.grade || '-'
      )
  },
  {
    colKey: 'outcome_title',
    title: '结局',
    minWidth: 140,
    ellipsis: true
  },
  {
    colKey: 'duration_ms',
    title: '用时',
    width: 100,
    align: 'right' as const,
    cell: (_h: any, { row }: { row: SimSessionItem }) => formatDuration(row.duration_ms)
  },
  {
    colKey: 'finished_at',
    title: '完成时间',
    width: 168,
    cell: (_h: any, { row }: { row: SimSessionItem }) => formatTime(row.finished_at)
  }
]

const decisionColumns = [
  {
    colKey: 'nodeTitle',
    title: '决策节点',
    minWidth: 140,
    ellipsis: true,
    cell: (_h: any, { row }: { row: { nodeTitle?: string; nodeId?: string } }) =>
      row.nodeTitle || row.nodeId || '-'
  },
  {
    colKey: 'label',
    title: '选择',
    minWidth: 150,
    ellipsis: true,
    cell: (_h: any, { row }: { row: { label?: string; optionId?: string } }) =>
      row.label || row.optionId || '-'
  },
  {
    colKey: 'elapsedMs',
    title: '用时',
    width: 96,
    align: 'right' as const,
    cell: (_h: any, { row }: { row: { elapsedMs?: number } }) => formatDuration(row.elapsedMs)
  },
  {
    colKey: 'timedOut',
    title: '状态',
    width: 80,
    align: 'center' as const,
    cell: (_h: any, { row }: { row: { timedOut?: boolean } }) => (row.timedOut ? '超时' : '正常')
  },
  {
    colKey: 'at',
    title: '时间',
    width: 168,
    cell: (_h: any, { row }: { row: { at?: number } }) => formatTime(row.at)
  }
]

const ruleColumns = [
  {
    colKey: 'label',
    title: '规则',
    minWidth: 160,
    ellipsis: true
  },
  {
    colKey: 'kind',
    title: '类型',
    width: 96,
    cell: (_h: any, { row }: { row: SessionRuleResult }) => ruleKindMeta(row.kind).label
  },
  {
    colKey: 'matched',
    title: '结果',
    width: 88,
    align: 'center' as const,
    cell: (h: any, { row }: { row: SessionRuleResult }) =>
      h(
        'span',
        { class: row.matched ? 'text-success' : 'text-muted' },
        row.matched ? '命中' : '未命中'
      )
  },
  {
    colKey: 'description',
    title: '说明',
    minWidth: 200,
    ellipsis: true,
    cell: (_h: any, { row }: { row: SessionRuleResult }) => row.description || '-'
  }
]

/* ----------------------------- 生命周期 ----------------------------- */

onMounted(() => {
  initCharts()
  loadAll()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', resizeCharts)
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
  gradeChart?.dispose()
  trendChart?.dispose()
  scenarioChart?.dispose()
  decisionChart?.dispose()
  gradeChart = null
  trendChart = null
  scenarioChart = null
  decisionChart = null
})
</script>

<style scoped>
.experiment-analytics {
  height: 100%;
  overflow-y: auto;
  padding-right: 6px;
  color: var(--rl-body);
}

/* 页头 */
.page-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
}

.page-head h1 {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.page-head p {
  margin: 6px 0 0;
  font-size: 13px;
  color: var(--rl-muted);
}

.page-head-meta {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--rl-muted);
  white-space: nowrap;
}

/* 通用面板 */
.panel {
  background: var(--rl-surface);
  border: 1px solid var(--rl-border);
  border-radius: var(--rl-r-md);
  box-shadow: var(--rl-sh-sm);
  padding: 20px 22px;
  margin-bottom: 16px;
}

.panel-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 14px;
}

.panel-head h2 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}

.panel-head p {
  margin: 5px 0 0;
  font-size: 12px;
  color: var(--rl-muted);
}

.panel-tag {
  flex-shrink: 0;
  padding: 3px 10px;
  border-radius: 999px;
  background: var(--rl-primary-soft);
  color: var(--rl-primary);
  font-size: 12px;
  line-height: 18px;
}

/* 筛选区 */
.filter-panel {
  padding: 18px 22px;
}

.filter-grid {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 16px 20px;
}

.filter-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.filter-label {
  font-size: 12px;
  color: var(--rl-muted);
}

.filter-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-left: auto;
  padding-bottom: 1px;
}

/* KPI */
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
  margin-bottom: 16px;
}

.kpi-card {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 20px;
  background: var(--rl-surface);
  border: 1px solid var(--rl-border);
  border-radius: var(--rl-r-md);
  box-shadow: var(--rl-sh-sm);
  overflow: hidden;
  transition: transform 0.2s, box-shadow 0.2s;
}

.kpi-card::after {
  content: '';
  position: absolute;
  right: -28px;
  top: -28px;
  width: 92px;
  height: 92px;
  border-radius: 50%;
  opacity: 0.1;
  background: currentColor;
}

.kpi-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--rl-sh-md);
}

.kpi-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  border-radius: 12px;
  background: currentColor;
}

.kpi-icon .t-icon {
  color: #ffffff;
}

.kpi-main {
  min-width: 0;
}

.kpi-label {
  font-size: 13px;
  color: var(--rl-muted);
}

.kpi-value {
  margin-top: 6px;
  font-size: 28px;
  font-weight: 700;
  line-height: 1.15;
  color: var(--rl-ink);
  font-variant-numeric: tabular-nums;
}

.kpi-unit {
  margin-left: 5px;
  font-size: 12px;
  font-weight: 500;
  color: var(--rl-muted);
}

.kpi-hint {
  margin-top: 6px;
  font-size: 12px;
  color: var(--rl-faint);
}

.tone-blue {
  color: var(--rl-primary);
}

.tone-green {
  color: var(--rl-success);
}

.tone-orange {
  color: var(--rl-accent);
}

.tone-purple {
  color: var(--rl-celadon);
}

/* 图表 */
.chart-grid {
  display: grid;
  gap: 16px;
  margin-bottom: 16px;
}

.chart-grid-main {
  grid-template-columns: minmax(300px, 1fr) minmax(0, 2fr);
}

.chart-grid-secondary {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.chart-panel {
  margin-bottom: 0;
}

.chart-body {
  position: relative;
  height: 306px;
}

.chart-canvas {
  width: 100%;
  height: 100%;
}

.chart-mask {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.86);
  border-radius: 10px;
  z-index: 2;
}

.chart-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: var(--rl-faint);
  font-size: 13px;
}

/* 规则列表 */
.rules-panel {
  padding-bottom: 12px;
}

.rule-list {
  display: flex;
  flex-direction: column;
}

.rule-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 96px minmax(140px, 220px) 64px;
  align-items: center;
  gap: 16px;
  padding: 13px 4px;
  border-bottom: 1px solid var(--rl-border);
}

.rule-row:last-child {
  border-bottom: none;
}

.rule-main {
  min-width: 0;
}

.rule-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--rl-ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rule-sub {
  margin-top: 3px;
  font-size: 12px;
  color: var(--rl-faint);
}

.rule-progress :deep(.t-progress) {
  margin-bottom: 0;
}

.rule-rate {
  text-align: right;
  font-size: 13px;
  font-weight: 600;
  color: var(--rl-body);
  font-variant-numeric: tabular-nums;
}

/* 会话表格 */
.table-panel {
  margin-bottom: 8px;
}

.table-head {
  align-items: center;
}

.table-tools {
  display: flex;
  align-items: center;
  gap: 10px;
}

.table-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding-top: 16px;
}

.table-total {
  font-size: 12px;
  color: var(--rl-muted);
}

.student-cell {
  display: flex;
  flex-direction: column;
  line-height: 1.35;
}

.student-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--rl-ink);
}

.student-id {
  font-size: 12px;
  color: var(--rl-muted);
}

:deep(.t-table) {
  border-radius: 10px;
}

:deep(.t-table tbody tr) {
  cursor: pointer;
}

:deep(.t-table tbody tr:hover) {
  background: var(--rl-bg-alt);
}

/* 等级标签 */
.grade-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 46px;
  padding: 1px 8px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  line-height: 20px;
}

.grade-a {
  color: #1f7a50;
  background: var(--rl-success-soft);
}

.grade-b {
  color: var(--rl-primary);
  background: var(--rl-primary-soft);
}

.grade-c {
  color: #8a6215;
  background: var(--rl-warning-soft);
}

.grade-d {
  color: var(--rl-danger);
  background: var(--rl-danger-soft);
}

/* 空 / 加载状态 */
.inline-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 120px;
}

.inline-empty {
  padding: 28px 0;
  text-align: center;
  font-size: 13px;
  color: var(--rl-faint);
}

.text-success {
  color: var(--rl-success);
}

.text-muted {
  color: var(--rl-faint);
}

/* 详情抽屉 */
.detail-wrap {
  min-height: 200px;
}

.detail-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 260px;
}

.detail-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 18px 20px;
  margin-bottom: 16px;
  border-radius: var(--rl-r-md);
  background: linear-gradient(135deg, var(--rl-primary-soft) 0%, var(--rl-surface) 100%);
  border: 1px solid rgba(15, 110, 132, 0.14);
}

.detail-hero-main {
  min-width: 0;
}

.detail-hero-title {
  font-size: 17px;
  font-weight: 700;
  color: var(--rl-ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.detail-hero-sub {
  margin-top: 6px;
  font-size: 12px;
  color: var(--rl-muted);
}

.detail-hero-side {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.detail-score {
  font-size: 30px;
  font-weight: 700;
  line-height: 1;
  color: var(--rl-primary);
  font-variant-numeric: tabular-nums;
}

.detail-score span {
  margin-left: 3px;
  font-size: 12px;
  font-weight: 500;
  color: var(--rl-muted);
}

.detail-descriptions :deep(.t-descriptions__label) {
  width: 96px;
}

.detail-section {
  margin-top: 22px;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  padding-left: 10px;
  border-left: 3px solid var(--rl-primary);
  font-size: 14px;
  font-weight: 600;
  color: var(--rl-ink);
  line-height: 1;
}

.section-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 18px;
  padding: 0 6px;
  border-radius: 999px;
  background: var(--rl-bg-alt);
  font-size: 11px;
  font-weight: 500;
  color: var(--rl-muted);
}

.log-list {
  max-height: 320px;
  overflow-y: auto;
  padding: 4px 4px 4px 2px;
}

.log-item {
  display: flex;
  gap: 10px;
  padding: 9px 0;
  border-bottom: 1px dashed var(--rl-border);
}

.log-item:last-child {
  border-bottom: none;
}

.log-dot {
  width: 8px;
  height: 8px;
  margin-top: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.log-main {
  min-width: 0;
  flex: 1;
}

.log-head {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}

.log-kind {
  padding: 1px 7px;
  border-radius: 4px;
  background: var(--rl-bg-alt);
  color: var(--rl-body);
  font-size: 11px;
}

.log-title {
  color: var(--rl-ink);
  font-weight: 500;
}

.log-time {
  margin-left: auto;
  color: var(--rl-faint);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

.log-text {
  margin-top: 4px;
  font-size: 12px;
  line-height: 1.6;
  color: var(--rl-body);
  word-break: break-word;
}

/* 响应式 */
@media (max-width: 1280px) {
  .kpi-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 1100px) {
  .chart-grid-main,
  .chart-grid-secondary {
    grid-template-columns: minmax(0, 1fr);
  }

  .chart-body {
    height: 288px;
  }
}

@media (max-width: 860px) {
  .page-head {
    align-items: flex-start;
    flex-direction: column;
  }

  .filter-actions {
    margin-left: 0;
  }

  .table-head {
    align-items: flex-start;
    flex-direction: column;
  }

  .rule-row {
    grid-template-columns: minmax(0, 1fr) 88px;
    row-gap: 8px;
  }

  .rule-progress {
    grid-column: 1 / -1;
  }

  .rule-rate {
    text-align: left;
  }

  .table-footer {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
