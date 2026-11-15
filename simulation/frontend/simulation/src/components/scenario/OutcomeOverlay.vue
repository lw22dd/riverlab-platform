<script setup lang="ts">
import { computed } from 'vue'
import { Button as TButton } from 'tdesign-vue-next'
import type { SessionRecord } from '@/models/session.model'
import { formatDuration } from '@/utils/format'
import Icon from '@/components/common/Icon.vue'

const props = defineProps<{
  session: SessionRecord
}>()

defineEmits<{
  result: []
  restart: []
  close: []
}>()

const circumference = 2 * Math.PI * 54
const offset = computed(() => circumference * (1 - props.session.score / 100))
const matchedRules = computed(() => props.session.rules.filter((rule) => rule.matched).length)
const gradeClass = computed(() => `grade--${props.session.grade.toLowerCase()}`)
</script>

<template>
  <div class="outcome" role="dialog" aria-modal="true" aria-labelledby="outcome-title">
    <div class="outcome__backdrop" aria-hidden="true"></div>
    <div class="outcome__card">
      <button type="button" class="outcome__close" aria-label="关闭结果摘要" @click="$emit('close')">
        <Icon name="close" :size="17" />
      </button>

      <header class="outcome__head">
        <span class="outcome__kicker">{{ session.outcome.kicker }}</span>
      </header>

      <div class="outcome__body">
        <div class="outcome__score">
          <div class="outcome__ring" :class="gradeClass">
            <svg viewBox="0 0 128 128">
              <circle cx="64" cy="64" r="54" class="outcome__ring-track" />
              <circle
                cx="64"
                cy="64"
                r="54"
                class="outcome__ring-progress"
                :stroke-dasharray="circumference"
                :stroke-dashoffset="offset"
              />
            </svg>
            <div class="outcome__ring-text">
              <strong>{{ session.score }}</strong>
              <span>/ 100</span>
            </div>
          </div>
          <div class="outcome__grade">
            <span>GRADE</span>
            <strong :class="gradeClass">{{ session.grade }}</strong>
            <em>{{ session.gradeLabel }}</em>
          </div>
          <div class="outcome__meta">
            <span><Icon name="clock" :size="12" />{{ formatDuration(session.durationMs) }}</span>
            <span><Icon name="route" :size="12" />{{ session.decisions.length }} 次决策</span>
            <span><Icon name="check" :size="12" />{{ matchedRules }} 条规则命中</span>
          </div>
        </div>

        <div class="outcome__story">
          <span class="outcome__eyebrow">YOUR OUTCOME</span>
          <h2 id="outcome-title">{{ session.outcome.title }}</h2>
          <p class="outcome__description">{{ session.outcome.description }}</p>
          <blockquote class="outcome__advice">
            <Icon name="spark" :size="14" />
            <span>{{ session.outcome.advice }}</span>
          </blockquote>
        </div>
      </div>

      <div class="outcome__metrics">
        <div v-for="metric in session.metrics" :key="metric.key" class="outcome-metric">
          <div class="outcome-metric__head">
            <span>{{ metric.label }}</span>
            <strong>{{ metric.value }}</strong>
            <em :class="{ 'is-negative': metric.value < metric.initial }">
              {{ metric.value >= metric.initial ? '+' : '' }}{{ metric.value - metric.initial }}
            </em>
          </div>
          <div class="outcome-metric__track">
            <i :style="{ width: `${metric.value}%` }"></i>
            <span :style="{ left: `${metric.initial}%` }"></span>
          </div>
        </div>
      </div>

      <div v-if="session.tags.length" class="outcome__tags">
        <span v-for="tag in session.tags.slice(0, 7)" :key="tag">{{ tag }}</span>
      </div>

      <footer class="outcome__foot">
        <div class="outcome__actions">
          <TButton theme="primary" size="large" class="outcome__primary" @click="$emit('result')">
            查看完整报告
            <Icon name="arrow-right" :size="16" />
          </TButton>
          <button type="button" class="btn" @click="$emit('restart')">
            <Icon name="refresh" :size="14" />
            再推演一次
          </button>
          <button type="button" class="btn btn--ghost" @click="$emit('close')">
            留在场景
          </button>
        </div>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.outcome {
  position: fixed;
  inset: 0;
  z-index: 90;
  display: grid;
  place-items: center;
  padding: 22px;
  overflow-y: auto;
}

.outcome__backdrop {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(55% 55% at 50% 40%, rgba(15, 110, 132, 0.1), transparent 66%),
    rgba(236, 244, 250, 0.74);
  backdrop-filter: blur(20px) saturate(115%);
}

.outcome__card {
  position: relative;
  z-index: 1;
  width: min(900px, 100%);
  max-height: calc(100svh - 44px);
  overflow-y: auto;
  padding: 24px 28px 24px;
  border: 1px solid var(--line);
  border-radius: 25px;
  background:
    radial-gradient(110% 80% at 0% 0%, rgba(var(--brand-rgb), 0.05), transparent 50%),
    var(--panel-raised);
  box-shadow: var(--shadow-lg);
  color: var(--text);
  animation: outcome-in 620ms var(--ease-out) both;
}

.outcome__close {
  position: absolute;
  top: 18px;
  right: 18px;
  display: grid;
  place-items: center;
  width: 31px;
  height: 31px;
  border: 1px solid var(--line);
  border-radius: 50%;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition:
    background 160ms ease,
    color 160ms ease;
}

.outcome__close:hover {
  background: rgba(22, 50, 79, 0.06);
  color: var(--text-strong);
}

.outcome__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 30px;
  padding-right: 38px;
}

.outcome__kicker {
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.16em;
  color: var(--brand);
}

.outcome__body {
  display: grid;
  grid-template-columns: 208px minmax(0, 1fr);
  gap: 35px;
  align-items: center;
  margin-top: 16px;
  padding: 20px 0 21px;
  border-top: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
}

.outcome__score {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.outcome__ring {
  position: relative;
  width: 156px;
  height: 156px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(15, 110, 132, 0.06) 0 58%, transparent 59%);
}

.outcome__ring svg {
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}

.outcome__ring-track {
  fill: none;
  stroke: rgba(22, 50, 79, 0.1);
  stroke-width: 5;
}

.outcome__ring-progress {
  fill: none;
  stroke: var(--brand);
  stroke-width: 5;
  stroke-linecap: round;
  filter: drop-shadow(0 0 7px rgba(15, 110, 132, 0.28));
}

.outcome__ring.grade--a .outcome__ring-progress {
  stroke: var(--success);
  filter: drop-shadow(0 0 7px rgba(47, 158, 104, 0.25));
}

.outcome__ring.grade--b .outcome__ring-progress {
  stroke: var(--blue);
  filter: drop-shadow(0 0 7px rgba(62, 127, 184, 0.24));
}

.outcome__ring.grade--c .outcome__ring-progress {
  stroke: var(--warn);
  filter: drop-shadow(0 0 7px rgba(169, 118, 26, 0.22));
}

.outcome__ring.grade--d .outcome__ring-progress {
  stroke: var(--danger);
  filter: drop-shadow(0 0 7px rgba(195, 76, 60, 0.22));
}

.outcome__ring-text {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: baseline;
  justify-content: center;
  padding-top: 56px;
}

.outcome__ring-text strong {
  font-family: var(--font-display);
  font-size: 48px;
  font-weight: 500;
  line-height: 1;
  color: var(--text-strong);
}

.outcome__ring-text span {
  margin-left: 3px;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-muted);
}

.outcome__grade {
  display: flex;
  align-items: baseline;
  gap: 7px;
  margin-top: 4px;
  font-family: var(--font-mono);
}

.outcome__grade span {
  font-size: 10px;
  color: var(--text-muted);
}

.outcome__grade strong {
  font-family: var(--font-display);
  font-size: 22px;
  font-weight: 600;
}

.outcome__grade em {
  font-style: normal;
  font-size: 11px;
  color: var(--text-muted);
}

.grade--a {
  color: var(--success);
}

.grade--b {
  color: var(--blue);
}

.grade--c {
  color: var(--warn);
}

.grade--d {
  color: var(--danger);
}

.outcome__ring.grade--a {
  background: radial-gradient(circle, #ecfdf5 0 58%, transparent 59%);
}

.outcome__ring.grade--b {
  background: radial-gradient(circle, #eff6ff 0 58%, transparent 59%);
}

.outcome__ring.grade--c {
  background: radial-gradient(circle, #fffbeb 0 58%, transparent 59%);
}

.outcome__ring.grade--d {
  background: radial-gradient(circle, #fef2f2 0 58%, transparent 59%);
}

.outcome__grade strong {
  padding: 1px 8px;
  border-radius: 8px;
}

.outcome__grade strong.grade--a {
  background: #dcfce7;
  color: #166534;
}

.outcome__grade strong.grade--b {
  background: #dbeafe;
  color: #1d4ed8;
}

.outcome__grade strong.grade--c {
  background: #fef3c7;
  color: #92400e;
}

.outcome__grade strong.grade--d {
  background: #fee2e2;
  color: #b91c1c;
}

.outcome__meta {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 6px 10px;
  margin-top: 12px;
  font-family: var(--font-mono);
  font-size: 10.5px;
  color: var(--text-muted);
}

.outcome__meta span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.outcome__story {
  min-width: 0;
}

.outcome__eyebrow {
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.16em;
  color: var(--text-faint);
}

.outcome__story h2 {
  margin-top: 8px;
  font-size: clamp(28px, 3.5vw, 40px);
  font-weight: 550;
  line-height: 1.16;
  letter-spacing: -0.04em;
  color: var(--text-strong);
}

.outcome__description {
  margin-top: 13px;
  font-size: 13.5px;
  line-height: 1.85;
  color: var(--text-muted);
}

.outcome__advice {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 15px 0 0;
  padding-left: 12px;
  border-left: 2px solid rgba(var(--brand-rgb), 0.28);
  font-size: 12.5px;
  line-height: 1.7;
  color: var(--text-muted);
}

.outcome__advice :deep(svg) {
  margin-top: 2px;
  flex: none;
  color: var(--brand);
}

.outcome__metrics {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 14px;
  padding: 18px 0 16px;
}

.outcome-metric__head {
  display: flex;
  align-items: baseline;
  gap: 4px;
  font-size: 11px;
  color: var(--text-muted);
}

.outcome-metric__head strong {
  margin-left: auto;
  font-family: var(--font-mono);
  font-size: 11.5px;
  font-weight: 500;
  color: var(--text);
}

.outcome-metric__head em {
  font-style: normal;
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--success);
}

.outcome-metric__head em.is-negative {
  color: var(--danger);
}

.outcome-metric__track {
  position: relative;
  height: 3px;
  margin-top: 6px;
  border-radius: 999px;
  background: rgba(22, 50, 79, 0.08);
}

.outcome-metric__track i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, rgba(15, 110, 132, 0.28), var(--brand));
}

.outcome-metric__track span {
  position: absolute;
  top: -2px;
  width: 1px;
  height: 7px;
  background: rgba(22, 50, 79, 0.32);
}

.outcome__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 0 0 17px;
}

.outcome__tags span {
  padding: 4px 8px;
  border: 1px solid var(--line);
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.72);
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-muted);
}

.outcome__foot {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 18px;
  padding-top: 18px;
  border-top: 1px solid var(--line);
}

.outcome__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.outcome__primary {
  min-height: 44px;
  border-color: var(--brand) !important;
  background: var(--brand) !important;
  color: #ffffff !important;
  box-shadow: 0 12px 26px rgba(var(--brand-rgb), 0.18);
}

.outcome__primary:hover {
  border-color: #0c5b6d !important;
  background: #0c5b6d !important;
}

.outcome__primary :deep(svg) {
  margin-left: 3px;
}

@keyframes outcome-in {
  from {
    opacity: 0;
    transform: translateY(30px) scale(0.985);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@media (max-width: 760px) {
  .outcome {
    padding: 10px;
    align-items: start;
  }

  .outcome__card {
    max-height: calc(100svh - 20px);
    padding: 20px 18px;
    border-radius: 19px;
  }

  .outcome__body {
    grid-template-columns: 1fr;
    gap: 18px;
    padding-top: 16px;
  }

  .outcome__score {
    flex-direction: row;
    flex-wrap: wrap;
    justify-content: flex-start;
    gap: 14px;
  }

  .outcome__ring {
    width: 112px;
    height: 112px;
  }

  .outcome__ring-text {
    padding-top: 39px;
  }

  .outcome__ring-text strong {
    font-size: 35px;
  }

  .outcome__grade {
    flex-direction: column;
    gap: 2px;
    align-items: flex-start;
  }

  .outcome__meta {
    justify-content: flex-start;
    width: 100%;
    margin-top: 0;
  }

  .outcome__metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 11px 18px;
  }

  .outcome__foot {
    flex-direction: column;
    align-items: stretch;
  }

  .outcome__actions {
    justify-content: stretch;
  }

  .outcome__actions > * {
    flex: 1;
  }
}
</style>
