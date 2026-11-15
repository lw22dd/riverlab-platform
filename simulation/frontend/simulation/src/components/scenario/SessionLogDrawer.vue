<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { Drawer as TDrawer } from 'tdesign-vue-next'
import type { LogEntry } from '@/models/simulation.model'
import Icon from '@/components/common/Icon.vue'

const props = defineProps<{
  visible: boolean
  logs: LogEntry[]
}>()

const emit = defineEmits<{
  'update:visible': [visible: boolean]
}>()

const model = computed({
  get: () => props.visible,
  set: (value: boolean) => emit('update:visible', value),
})

const listRef = ref<HTMLElement | null>(null)

const KIND_LABELS: Record<LogEntry['kind'], string> = {
  system: 'SYSTEM',
  narrative: 'NARRATIVE',
  decision: 'DECISION',
  consequence: 'CONSEQUENCE',
  inspect: 'INSPECT',
  warning: 'WARNING',
}

function formatTime(elapsedMs: number): string {
  const seconds = Math.floor(elapsedMs / 1000)
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

watch(
  () => [props.visible, props.logs.length] as const,
  async ([visible]) => {
    if (!visible) return
    await nextTick()
    if (listRef.value) listRef.value.scrollTop = listRef.value.scrollHeight
  },
)
</script>

<template>
  <TDrawer
    v-model:visible="model"
    size="440px"
    :footer="false"
    :close-btn="true"
    class="session-drawer"
  >
    <template #header>
      <div class="log-head">
        <span class="mono-label">SESSION TRACE</span>
        <h2>演化日志</h2>
        <span>{{ logs.length }} 条记录 · 只读</span>
      </div>
    </template>

    <div ref="listRef" class="log-list">
      <article
        v-for="entry in logs"
        :key="entry.id"
        class="log-entry"
        :class="`log-entry--${entry.kind}`"
      >
        <div class="log-entry__rail">
          <span class="log-entry__dot"></span>
        </div>
        <div class="log-entry__content">
          <header>
            <span class="log-entry__kind">{{ KIND_LABELS[entry.kind] }}</span>
            <span v-if="entry.title" class="log-entry__title">{{ entry.title }}</span>
            <time>{{ formatTime(entry.elapsedMs) }}</time>
          </header>
          <p>{{ entry.text }}</p>
          <span v-if="entry.nodeId" class="log-entry__node">{{ entry.nodeId }}</span>
        </div>
      </article>

      <div v-if="!logs.length" class="log-empty">
        <Icon name="activity" :size="22" />
        <p>推演开始后，节点进入、选择与规则事件会记录在这里。</p>
      </div>
    </div>
  </TDrawer>
</template>

<style scoped>
.session-drawer {
  --td-drawer-bg: var(--panel-solid);
  --td-drawer-header-bg: var(--panel-solid);
  --td-drawer-footer-bg: var(--panel-solid);
  --td-bg-color-container: var(--panel-solid);
  --td-bg-color-container-hover: var(--bg-soft);
  --td-bg-color-container-active: var(--bg-soft);
  --td-mask-active: rgba(16, 42, 67, 0.24);
  --td-text-color-primary: var(--text-strong);
  --td-text-color-secondary: var(--text-muted);
}

.session-drawer :deep(.t-drawer__content-wrapper) {
  border-left: 1px solid var(--line);
  background: var(--panel-solid);
  box-shadow: var(--shadow-lg);
}

.session-drawer :deep(.t-drawer__content) {
  border-left: 1px solid var(--line);
  background: var(--panel-solid);
  box-shadow: var(--shadow-lg);
}

.session-drawer :deep(.t-drawer__header) {
  color: var(--text-strong);
  border-bottom: 1px solid var(--line);
}

.session-drawer :deep(.t-drawer__body) {
  background: var(--panel-solid);
  color: var(--text);
}

.session-drawer :deep(.t-drawer__close-btn) {
  color: var(--text-muted);
}

.session-drawer :deep(.t-drawer__close-btn:hover) {
  background: rgba(22, 50, 79, 0.06);
  color: var(--text-strong);
}

.log-head h2 {
  margin-top: 4px;
  font-size: 22px;
  font-weight: 550;
  letter-spacing: -0.03em;
  color: var(--text-strong);
}

.log-head span:last-child {
  display: inline-block;
  margin-top: 4px;
  font-family: var(--font-mono);
  font-size: 8px;
  color: var(--text-muted);
}

.log-list {
  position: relative;
  display: flex;
  flex-direction: column;
  padding: 6px 0 30px;
}

.log-entry {
  display: grid;
  grid-template-columns: 22px minmax(0, 1fr);
  gap: 8px;
  padding-bottom: 18px;
}

.log-entry__rail {
  position: relative;
  display: flex;
  justify-content: center;
}

.log-entry__rail::before {
  content: '';
  position: absolute;
  top: 12px;
  bottom: -18px;
  width: 1px;
  background: var(--line);
}

.log-entry:last-child .log-entry__rail::before {
  display: none;
}

.log-entry__dot {
  position: relative;
  z-index: 1;
  width: 7px;
  height: 7px;
  margin-top: 5px;
  border: 1px solid var(--line-strong);
  border-radius: 50%;
  background: var(--panel-solid);
}

.log-entry--decision .log-entry__dot {
  border-color: var(--warn);
  background: var(--warn);
  box-shadow: 0 0 0 3px rgba(169, 118, 26, 0.12);
}

.log-entry--consequence .log-entry__dot {
  border-color: var(--danger);
  background: var(--danger);
}

.log-entry--inspect .log-entry__dot {
  border-color: var(--blue);
  background: var(--blue);
}

.log-entry--system .log-entry__dot {
  border-color: var(--brand);
  background: var(--brand);
}

.log-entry__content {
  min-width: 0;
}

.log-entry__content header {
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex-wrap: wrap;
}

.log-entry__kind {
  font-family: var(--font-mono);
  font-size: 6.5px;
  letter-spacing: 0.1em;
  color: var(--text-muted);
}

.log-entry__title {
  font-size: 10px;
  font-weight: 500;
  color: var(--text);
}

.log-entry__content time {
  margin-left: auto;
  font-family: var(--font-mono);
  font-size: 7px;
  color: var(--text-muted);
}

.log-entry__content p {
  margin-top: 4px;
  font-size: 10.5px;
  line-height: 1.7;
  color: var(--text-muted);
  text-wrap: pretty;
}

.log-entry--decision .log-entry__content p {
  color: var(--text);
}

.log-entry__node {
  display: inline-block;
  margin-top: 5px;
  font-family: var(--font-mono);
  font-size: 6.5px;
  color: var(--text-faint);
  opacity: 0.9;
}

.log-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 60px 30px;
  color: var(--text-muted);
  text-align: center;
}

.log-empty p {
  max-width: 240px;
  font-size: 11px;
  line-height: 1.7;
}
</style>
