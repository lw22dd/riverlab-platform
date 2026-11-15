<template>
  <div class="records-page">
    <Header />

    <div class="page-container">
      <div class="page-header">
        <div>
          <h1 class="page-title">实验记录</h1>
          <p class="page-subtitle">以下是已同步到平台的实验报告，点击任意记录查看完整结算。</p>
        </div>
        <div class="page-actions">
          <t-select
            v-model="scenarioId"
            :options="scenarioOptions"
            placeholder="全部场景"
            clearable
            style="width: 180px"
            @change="handleSearch"
          />
          <t-button theme="primary" @click="handleSearch">查询</t-button>
          <t-button variant="outline" @click="handleReset">重置</t-button>
        </div>
      </div>

      <div class="stats-row">
        <div class="stat-card">
          <span class="stat-label">实验次数</span>
          <strong class="stat-value">{{ total }}</strong>
        </div>
        <div class="stat-card">
          <span class="stat-label">本页平均分</span>
          <strong class="stat-value">{{ pageAverageScore }}</strong>
        </div>
        <div class="stat-card">
          <span class="stat-label">本页最高分</span>
          <strong class="stat-value">{{ pageBestScore }}</strong>
        </div>
      </div>

      <t-card :bordered="false" class="records-card">
        <t-table
          :data="records"
          :columns="columns"
          :loading="loading"
          row-key="id"
          hover
          stripe
          empty="还没有实验记录，完成一次实验后会自动出现在这里"
          @row-click="handleRowClick"
        >
          <template #grade="{ row }">
            <span class="grade-pill" :class="`grade-${String(row.grade || '').toLowerCase()}`">
              {{ row.grade_label || row.grade || '-' }}
            </span>
          </template>
          <template #operation="{ row }">
            <t-button variant="text" theme="primary" @click.stop="openDetail(row.id)">查看报告</t-button>
          </template>
        </t-table>

        <div class="table-footer">
          <span class="table-total">共 {{ total }} 条</span>
          <t-pagination
            v-if="total > 0"
            v-model="page"
            v-model:page-size="pageSize"
            :total="total"
            :page-size-options="[10, 20, 50]"
            :show-jumper="true"
            @change="loadRecords"
          />
        </div>
      </t-card>
    </div>

    <t-drawer
      v-model:visible="detailVisible"
      header="实验报告"
      size="760px"
      :footer="false"
      @close="handleDrawerClosed"
    >
      <div v-if="detailLoading" class="detail-loading">
        <t-loading text="正在加载实验报告..." />
      </div>

      <template v-else-if="detail">
        <div class="detail-hero">
          <div>
            <p class="detail-eyebrow">{{ detail.scenario_title || '未命名场景' }}</p>
            <h2>{{ payload?.scenarioSubtitle || detail.scenario_title || '实验报告' }}</h2>
            <p class="detail-meta">
              {{ formatTime(detail.finished_at) }} · 用时 {{ formatDuration(detail.duration_ms) }}
            </p>
          </div>
          <div class="detail-score">
            <strong>{{ detail.score }}</strong>
            <span>{{ detail.grade_label || detail.grade || '-' }}</span>
          </div>
        </div>

        <t-descriptions :column="2" bordered class="detail-descriptions">
          <t-descriptions-item label="实验场景">{{ detail.scenario_title || '-' }}</t-descriptions-item>
          <t-descriptions-item label="结局">{{ detail.outcome_title || '-' }}</t-descriptions-item>
          <t-descriptions-item label="场景版本">{{ detail.scenario_version || '-' }}</t-descriptions-item>
          <t-descriptions-item label="领域">{{ domainLabel(detail.domain) }}</t-descriptions-item>
          <t-descriptions-item label="开始时间">{{ formatTime(detail.started_at) }}</t-descriptions-item>
          <t-descriptions-item label="完成时间">{{ formatTime(detail.finished_at) }}</t-descriptions-item>
        </t-descriptions>

        <div v-if="payload?.outcome" class="outcome-box">
          <p class="outcome-kicker">{{ payload.outcome.kicker || '结局' }}</p>
          <h3>{{ payload.outcome.title || detail.outcome_title || '-' }}</h3>
          <p v-if="payload.outcome.description">{{ payload.outcome.description }}</p>
          <p v-if="payload.outcome.advice" class="outcome-advice">{{ payload.outcome.advice }}</p>
        </div>

        <div v-if="payload?.metrics?.length" class="detail-section">
          <div class="section-title">
            <span>指标结算</span>
            <span class="section-count">{{ payload.metrics.length }}</span>
          </div>
          <div class="metric-grid">
            <div v-for="metric in payload.metrics" :key="metric.key" class="metric-item">
              <span>{{ metric.label }}</span>
              <strong>{{ metric.value }}</strong>
            </div>
          </div>
        </div>

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
            max-height="300"
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
            max-height="280"
          />
          <div v-else class="inline-empty">暂无规则结算数据</div>
        </div>

        <div class="detail-section">
          <div class="section-title">
            <span>实验日志</span>
            <span class="section-count">{{ detailLogs.length }}</span>
          </div>
          <div v-if="detailLogs.length" class="log-list">
            <div v-for="log in detailLogs" :key="`${log.id}-${log.at}`" class="log-item">
              <span class="log-time">{{ formatTime(log.at) }}</span>
              <div>
                <strong v-if="log.title">{{ log.title }}</strong>
                <p>{{ log.text }}</p>
              </div>
            </div>
          </div>
          <div v-else class="inline-empty">暂无日志</div>
        </div>
      </template>
    </t-drawer>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { MessagePlugin } from 'tdesign-vue-next'
import Header from '@/components/Header.vue'
import SimulationApi from '@/apis/simulation.api'
import type {
  SessionDecisionRecord,
  SessionListQuery,
  SessionLogEntry,
  SessionPayload,
  SessionRuleResult,
  SimSessionDetail,
  SimSessionItem
} from '@/models/simulation.model'

const route = useRoute()

const scenarioId = ref('')
const page = ref(1)
const pageSize = ref(10)
const total = ref(0)
const records = ref<SimSessionItem[]>([])
const loading = ref(false)

const detailVisible = ref(false)
const detailLoading = ref(false)
const detail = ref<SimSessionDetail | null>(null)

const scenarioOptions = [
  { label: '都江堰建造', value: 'dujiangyan-build' },
  { label: '电车悖论', value: 'trolley-problem' },
  { label: '桥上推人', value: 'trolley-footbridge' },
  { label: '自动驾驶', value: 'autonomous-driving' },
  { label: '大楼倒塌', value: 'building-collapse' }
]

const columns = [
  { colKey: 'scenario_title', title: '实验场景', minWidth: 200, ellipsis: true },
  { colKey: 'score', title: '分数', width: 80, align: 'center' as const },
  { colKey: 'grade', title: '等级', width: 100, align: 'center' as const, cell: (_h: any, { row }: any) => row.grade_label || row.grade || '-' },
  { colKey: 'outcome_title', title: '结局', minWidth: 160, ellipsis: true },
  {
    colKey: 'duration_ms',
    title: '用时',
    width: 110,
    align: 'right' as const,
    cell: (_h: any, { row }: any) => formatDuration(row.duration_ms)
  },
  {
    colKey: 'finished_at',
    title: '完成时间',
    width: 180,
    cell: (_h: any, { row }: any) => formatTime(row.finished_at)
  },
  { colKey: 'operation', title: '报告', width: 100, align: 'center' as const }
]

const decisionColumns = [
  {
    colKey: 'nodeTitle',
    title: '决策节点',
    minWidth: 150,
    ellipsis: true,
    cell: (_h: any, { row }: any) => row.nodeTitle || row.nodeId || '-'
  },
  {
    colKey: 'label',
    title: '选择',
    minWidth: 180,
    ellipsis: true,
    cell: (_h: any, { row }: any) => row.label || row.optionId || '-'
  },
  {
    colKey: 'elapsedMs',
    title: '用时',
    width: 100,
    align: 'right' as const,
    cell: (_h: any, { row }: any) => formatDuration(row.elapsedMs)
  },
  {
    colKey: 'timedOut',
    title: '状态',
    width: 80,
    align: 'center' as const,
    cell: (_h: any, { row }: any) => (row.timedOut ? '超时' : '正常')
  }
]

const ruleColumns = [
  { colKey: 'label', title: '规则', minWidth: 180, ellipsis: true },
  {
    colKey: 'kind',
    title: '类型',
    width: 100,
    cell: (_h: any, { row }: { row: SessionRuleResult }) => ruleKindMeta(row.kind).label
  },
  {
    colKey: 'matched',
    title: '结果',
    width: 90,
    align: 'center' as const,
    cell: (_h: any, { row }: { row: SessionRuleResult }) => (row.matched ? '命中' : '未命中')
  },
  {
    colKey: 'description',
    title: '说明',
    minWidth: 220,
    ellipsis: true,
    cell: (_h: any, { row }: { row: SessionRuleResult }) => row.description || '-'
  }
]

const payload = computed<SessionPayload | null>(() => {
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
  (payload.value?.decisions ?? []).map((item: SessionDecisionRecord, index: number) => ({
    ...item,
    _key: `${item.nodeId || 'node'}-${item.optionId || 'option'}-${index}`
  }))
)

const detailRules = computed<SessionRuleResult[]>(() => payload.value?.rules ?? [])
const detailLogs = computed<SessionLogEntry[]>(() => payload.value?.logs ?? [])

const pageAverageScore = computed(() => {
  if (!records.value.length) return '--'
  const sum = records.value.reduce((totalScore, item) => totalScore + Number(item.score || 0), 0)
  return (sum / records.value.length).toFixed(1)
})

const pageBestScore = computed(() => {
  if (!records.value.length) return '--'
  return String(Math.max(...records.value.map((item) => Number(item.score || 0))))
})

function formatTime(value?: number): string {
  if (!value) return '-'
  return new Date(value).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function formatDuration(value?: number): string {
  if (value === undefined || value === null) return '-'
  const seconds = Math.max(0, Math.round(value / 1000))
  if (seconds < 60) return `${seconds} 秒`
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return `${minutes} 分 ${rest} 秒`
}

function domainLabel(value?: string): string {
  const map: Record<string, string> = {
    moral: '道德哲学',
    engineering: '工程伦理',
    algorithm: '算法伦理',
    medical: '生命伦理'
  }
  return value ? map[value] || value : '-'
}

function ruleKindMeta(kind?: string): { label: string; theme: string } {
  if (kind === 'positive') return { label: '正向', theme: 'success' }
  if (kind === 'negative') return { label: '负向', theme: 'danger' }
  return { label: '中性', theme: 'default' }
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

async function loadRecords(): Promise<void> {
  loading.value = true
  try {
    const query: SessionListQuery = {
      page: page.value,
      page_size: pageSize.value,
      scenario_id: scenarioId.value || undefined
    }
    const result = await SimulationApi.getSessions(query)
    if (result.code === 200 && result.data) {
      records.value = result.data.items ?? []
      total.value = result.data.total ?? 0
    } else {
      MessagePlugin.error(result.msg || '实验记录加载失败')
    }
  } catch (error) {
    MessagePlugin.error(getErrorMessage(error, '实验记录加载失败'))
  } finally {
    loading.value = false
  }
}

function handleSearch(): void {
  page.value = 1
  void loadRecords()
}

function handleReset(): void {
  scenarioId.value = ''
  page.value = 1
  void loadRecords()
}

function handleRowClick({ row }: { row: SimSessionItem }): void {
  void openDetail(row.id)
}

async function openDetail(id: string): Promise<void> {
  detailVisible.value = true
  detailLoading.value = true
  detail.value = null
  try {
    const result = await SimulationApi.getSessionDetail(id)
    if (result.code === 200 && result.data) {
      detail.value = result.data
    } else {
      MessagePlugin.error(result.msg || '获取实验报告失败')
      detailVisible.value = false
    }
  } catch (error) {
    MessagePlugin.error(getErrorMessage(error, '获取实验报告失败'))
    detailVisible.value = false
  } finally {
    detailLoading.value = false
  }
}

function handleDrawerClosed(): void {
  detail.value = null
}

onMounted(async () => {
  await loadRecords()
  const recordId = route.query.record
  if (typeof recordId === 'string' && recordId) {
    void openDetail(recordId)
  }
})
</script>

<style scoped>
.records-page {
  min-height: 100vh;
  background: var(--rl-bg);
}

.page-container {
  max-width: 1120px;
  margin: 0 auto;
  padding: 28px 24px 48px;
}

.page-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 20px;
}

.page-title {
  margin: 0;
  color: var(--rl-ink);
  font-size: 28px;
  font-weight: 700;
}

.page-subtitle {
  margin: 8px 0 0;
  color: var(--rl-muted);
  font-size: 13px;
}

.page-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.stats-row {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
  margin-bottom: 16px;
}

.stat-card {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding: 18px 20px;
  border: 1px solid var(--rl-border);
  border-radius: 14px;
  background: #fff;
}

.stat-label {
  color: var(--rl-muted);
  font-size: 13px;
}

.stat-value {
  color: var(--rl-ink);
  font-size: 26px;
  font-weight: 700;
}

.records-card {
  border-radius: 16px;
  box-shadow: 0 12px 30px rgba(16, 42, 67, 0.06);
}

.grade-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 54px;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
}

.grade-a {
  background: rgba(21, 128, 61, 0.1);
  color: #15803d;
}

.grade-b {
  background: rgba(180, 83, 9, 0.1);
  color: #b45309;
}

.grade-c {
  background: rgba(82, 102, 122, 0.1);
  color: #52667a;
}

.grade-d {
  background: rgba(220, 38, 38, 0.1);
  color: #dc2626;
}

.table-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding-top: 18px;
}

.table-total {
  color: var(--rl-muted);
  font-size: 13px;
}

.detail-loading {
  display: grid;
  place-items: center;
  min-height: 240px;
}

.detail-hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
  padding-bottom: 18px;
  border-bottom: 1px solid var(--rl-border);
}

.detail-eyebrow {
  margin: 0;
  color: #0f6e84;
  font-size: 12px;
  letter-spacing: 0.08em;
}

.detail-hero h2 {
  margin: 6px 0 0;
  color: var(--rl-ink);
  font-size: 22px;
}

.detail-meta {
  margin: 8px 0 0;
  color: var(--rl-muted);
  font-size: 13px;
}

.detail-score {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
}

.detail-score strong {
  color: #0f6e84;
  font-size: 38px;
  line-height: 1;
}

.detail-score span {
  color: var(--rl-muted);
  font-size: 13px;
}

.detail-descriptions {
  margin-top: 18px;
}

.outcome-box {
  margin-top: 18px;
  padding: 18px 20px;
  border: 1px solid rgba(15, 110, 132, 0.16);
  border-radius: 12px;
  background: rgba(15, 110, 132, 0.04);
}

.outcome-kicker {
  margin: 0;
  color: #0f6e84;
  font-size: 11px;
  letter-spacing: 0.1em;
}

.outcome-box h3 {
  margin: 6px 0 0;
  color: var(--rl-ink);
  font-size: 18px;
}

.outcome-box p {
  margin: 8px 0 0;
  color: var(--rl-muted);
  font-size: 13px;
  line-height: 1.8;
}

.outcome-box .outcome-advice {
  color: #b45309;
}

.detail-section {
  margin-top: 24px;
}

.section-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
  color: var(--rl-ink);
  font-size: 14px;
  font-weight: 600;
}

.section-count {
  color: var(--rl-muted);
  font-size: 12px;
  font-weight: 400;
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 10px;
}

.metric-item {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding: 12px 14px;
  border: 1px solid var(--rl-border);
  border-radius: 10px;
  background: #fff;
}

.metric-item span {
  color: var(--rl-muted);
  font-size: 12px;
}

.metric-item strong {
  color: var(--rl-ink);
  font-size: 18px;
}

.log-list {
  display: grid;
  gap: 8px;
  max-height: 320px;
  overflow-y: auto;
}

.log-item {
  display: grid;
  grid-template-columns: 96px minmax(0, 1fr);
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid var(--rl-border);
  border-radius: 9px;
  background: #fff;
}

.log-time {
  color: var(--rl-muted);
  font-family: var(--font-mono, monospace);
  font-size: 11px;
}

.log-item strong {
  color: var(--rl-ink);
  font-size: 12px;
}

.log-item p {
  margin: 2px 0 0;
  color: var(--rl-muted);
  font-size: 12px;
  line-height: 1.7;
}

.inline-empty {
  padding: 18px;
  border: 1px dashed var(--rl-border);
  border-radius: 10px;
  color: var(--rl-muted);
  font-size: 13px;
  text-align: center;
}

@media (max-width: 900px) {
  .page-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .stats-row {
    grid-template-columns: 1fr;
  }
}
</style>
