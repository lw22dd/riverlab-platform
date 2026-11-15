<script setup lang="ts">
import { computed } from 'vue'
import type { Tone } from '@/models/common.model'
import type { DecisionNode } from '@/models/scenario.model'
import Icon from '@/components/common/Icon.vue'

const props = defineProps<{
  node: DecisionNode
  remainingMs: number | null
  totalMs: number | null
  autoChoice?: string | null
  autoReason?: string | null
}>()

defineEmits<{
  choose: [optionId: string]
}>()

interface OptionView {
  id: string
  label: string
  summary: string
  detail?: string
  tone?: Tone
  badge?: string
}

const ratio = computed(() => {
  if (props.remainingMs === null || !props.totalMs) return 1
  return Math.max(0, Math.min(1, props.remainingMs / props.totalMs))
})

const timerText = computed(() => {
  if (props.remainingMs === null) return ''
  const seconds = Math.max(0, Math.ceil(props.remainingMs / 1000))
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
})

const urgent = computed(() => props.remainingMs !== null && props.remainingMs <= 10_000)

const defaultOption = computed(() => {
  if (!props.node.timeoutOptionId) return props.node.options.find((option) => option.timeoutDefault)
  return props.node.options.find((option) => option.id === props.node.timeoutOptionId)
})

function toneColor(tone: Tone | undefined): string {
  switch (tone) {
    case 'positive':
      return '126, 226, 184'
    case 'caution':
      return '245, 188, 120'
    case 'danger':
      return '255, 127, 110'
    case 'info':
      return '139, 184, 255'
    default:
      return '188, 204, 222'
  }
}

function choiceStyle(option: OptionView) {
  return { '--tone-rgb': toneColor(option.tone) }
}
</script>

<template>
  <section class="decision-ui" aria-live="polite">
    <div class="decision-dock">
      <div class="decision-copy">
        <header class="decision-caption">
          <span class="decision-caption__kicker">{{ node.kicker ?? '决策点' }}</span>
          <h2>{{ node.prompt }}</h2>
          <p v-if="node.context">{{ node.context }}</p>
        </header>

        <div v-if="autoChoice" class="decision-auto">
          <span class="decision-auto__label">程序自动选择</span>
          <span>{{ autoReason }}</span>
        </div>
      </div>

      <div class="decision-choices" role="group" :aria-label="node.prompt">
        <header class="choice-rail__head">
          <span>剧情走向</span>
          <em>CHOOSE</em>
        </header>

        <div v-if="remainingMs !== null && !autoChoice" class="choice-time" :class="{ 'is-urgent': urgent }">
          <span class="choice-time__track">
            <i :style="{ width: `${ratio * 100}%` }"></i>
          </span>
          <span class="choice-rail__keys">1—{{ node.options.length }} · 选择行动</span>
          <span class="choice-time__value">{{ timerText }}</span>
        </div>

        <div class="choice-list">
          <button
            v-for="(option, index) in node.options"
            :key="option.id"
            type="button"
            class="choice"
            :class="{ 'is-auto-choice': option.id === autoChoice }"
            :style="choiceStyle(option)"
            :disabled="Boolean(autoChoice)"
            @click="$emit('choose', option.id)"
          >
            <span class="choice__key">{{ index + 1 }}</span>
            <span class="choice__copy">
              <span class="choice__label">
                <strong>{{ option.label }}</strong>
                <em v-if="option.badge">{{ option.badge }}</em>
              </span>
              <span class="choice__summary">{{ option.summary }}</span>
            </span>
            <span class="choice__arrow" aria-hidden="true">
              <Icon name="chevron-right" :size="16" />
            </span>
          </button>
        </div>

        <div v-if="!autoChoice" class="choice-rail__meta">
          <span v-if="defaultOption" class="choice-rail__default">
            超时默认 · {{ defaultOption.label }}
          </span>
          <span v-else>选择一个行动继续</span>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.decision-ui {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.decision-dock {
  position: absolute;
  left: 50%;
  bottom: 0;
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(400px, 0.9fr);
  align-items: start;
  gap: clamp(24px, 2.4vw, 34px);
  width: min(1290px, calc(100% - 40px));
  max-height: calc(100svh - 88px);
  padding: 20px 24px calc(18px + env(safe-area-inset-bottom, 0px));
  border: 1px solid var(--line);
  border-radius: 20px 20px 0 0;
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(24px) saturate(130%);
  box-shadow: var(--shadow-lg);
  overflow-y: auto;
  translate: -50% 0;
  pointer-events: auto;
  animation: dock-in 420ms var(--ease-out) both;
}

.decision-copy {
  min-width: 0;
}

.decision-choices {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 10px;
  align-self: start;
  padding-left: clamp(20px, 2vw, 30px);
  border-left: 1px solid var(--line);
}

.choice-rail__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 2px;
  color: var(--warn);
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.choice-rail__head::before {
  content: '';
  width: 16px;
  height: 1px;
  margin-right: -6px;
  background: currentColor;
  opacity: 0.7;
}

.choice-rail__head span {
  flex: 1;
}

.choice-rail__head em {
  flex: none;
  color: var(--text-faint);
  font-size: 9px;
  font-style: normal;
  letter-spacing: 0.12em;
}

.decision-caption {
  padding-bottom: 0;
}

.decision-caption__kicker {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--warn);
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.12em;
}

.decision-caption__kicker::before {
  content: '';
  width: 5px;
  height: 5px;
  flex: none;
  border: 1px solid currentColor;
  transform: rotate(45deg);
}

.decision-caption h2 {
  margin-top: 8px;
  color: var(--text-strong);
  font-size: clamp(20px, 1.7vw, 25px);
  font-weight: 600;
  line-height: 1.4;
  letter-spacing: -0.02em;
  text-wrap: pretty;
}

.decision-caption p {
  margin-top: 8px;
  color: var(--text-muted);
  font-size: 13.5px;
  line-height: 1.7;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  overflow: hidden;
}

.decision-auto {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  margin-top: 14px;
  padding: 9px 11px;
  border: 1px solid rgba(var(--accent-rgb), 0.2);
  border-radius: 9px;
  background: rgba(var(--accent-rgb), 0.06);
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.55;
}

.decision-auto__label {
  flex: none;
  color: var(--accent);
  font-family: var(--font-mono);
  font-size: 9.5px;
  letter-spacing: 0.08em;
}

.choice-time {
  display: flex;
  align-items: center;
  gap: 12px;
}

.choice-time__track {
  position: relative;
  flex: 1;
  height: 3px;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(22, 50, 79, 0.1);
}

.choice-time__track i {
  position: absolute;
  inset: 0 auto 0 0;
  display: block;
  border-radius: inherit;
  background: var(--warn);
  transition: width 120ms linear;
}

.choice-time__value {
  flex: none;
  color: var(--warn);
  font-family: var(--font-mono);
  font-size: 11px;
}

.choice-time.is-urgent .choice-time__track i {
  background: var(--danger);
  animation: time-pulse 900ms ease-in-out infinite;
}

.choice-time.is-urgent .choice-time__value {
  color: var(--danger);
}

.choice-rail__keys {
  flex: none;
  color: var(--text-faint);
  font-family: var(--font-mono);
  font-size: 10px;
  white-space: nowrap;
}

.choice-rail__meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 16px;
  margin: 0;
  color: var(--text-faint);
  font-size: 11px;
}

.choice-rail__default {
  overflow: hidden;
  color: var(--warn);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.choice-list {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 8px;
}

.choice {
  position: relative;
  display: grid;
  grid-template-columns: 20px minmax(0, 1fr) 14px;
  align-items: start;
  gap: 10px;
  width: 100%;
  padding: 10px 11px 10px 13px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.46);
  color: inherit;
  text-align: left;
  cursor: pointer;
  transition:
    background 180ms ease,
    border-color 180ms ease;
}

.choice::before {
  content: '';
  position: absolute;
  left: 0;
  top: 9px;
  bottom: 9px;
  width: 2px;
  border-radius: 2px;
  background: rgb(var(--tone-rgb));
  opacity: 0.45;
  transition: opacity 180ms ease;
}

.choice:hover,
.choice:focus-visible {
  border-color: rgba(var(--tone-rgb), 0.4);
  background: rgba(var(--tone-rgb), 0.07);
}

.choice:hover::before,
.choice:focus-visible::before {
  opacity: 1;
}

.choice:disabled {
  cursor: default;
}

.choice.is-auto-choice {
  border-color: rgba(var(--tone-rgb), 0.58);
  background: rgba(var(--tone-rgb), 0.11);
}

.choice.is-auto-choice::before {
  opacity: 1;
}

.choice.is-auto-choice .choice__arrow {
  opacity: 1;
  transform: translateX(0);
}

.choice__key {
  display: grid;
  place-items: center;
  width: 20px;
  height: 20px;
  border: 1px solid var(--line-strong);
  border-radius: 50%;
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: 10px;
  transition:
    border-color 180ms ease,
    background 180ms ease,
    color 180ms ease;
}

.choice:hover .choice__key,
.choice:focus-visible .choice__key {
  border-color: rgba(var(--tone-rgb), 0.6);
  background: rgba(var(--tone-rgb), 0.1);
  color: rgb(var(--tone-rgb));
}

.choice__copy {
  display: block;
  min-width: 0;
}

.choice__label {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
}

.choice__label strong {
  color: var(--text-strong);
  font-size: 14px;
  font-weight: 600;
  line-height: 1.45;
  transition: color 180ms ease;
}

.choice:hover .choice__label strong,
.choice:focus-visible .choice__label strong {
  color: rgb(var(--tone-rgb));
}

.choice__label em {
  flex: none;
  color: rgb(var(--tone-rgb));
  font-family: var(--font-mono);
  font-size: 9.5px;
  font-style: normal;
  letter-spacing: 0.04em;
  white-space: nowrap;
}

.choice__summary {
  display: -webkit-box;
  margin-top: 3px;
  overflow: hidden;
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.5;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
}

.choice__arrow {
  display: grid;
  place-items: center;
  margin-top: 2px;
  color: rgb(var(--tone-rgb));
  opacity: 0;
  transform: translateX(-4px);
  transition:
    opacity 180ms ease,
    transform 200ms var(--ease-out);
}

.choice:hover .choice__arrow,
.choice:focus-visible .choice__arrow {
  opacity: 1;
  transform: translateX(0);
}

@keyframes dock-in {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes time-pulse {
  0%,
  100% {
    opacity: 0.55;
  }
  50% {
    opacity: 1;
  }
}

@media (max-width: 1080px) {
  .decision-dock {
    grid-template-columns: minmax(0, 1fr);
    gap: 14px;
  }

  .decision-choices {
    padding-left: 0;
    padding-top: 14px;
    border-left: 0;
    border-top: 1px solid var(--line);
  }

  .choice-list {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 860px) {
  .decision-dock {
    bottom: 0;
    width: calc(100% - 24px);
    max-height: 70svh;
    padding: 14px 16px calc(12px + env(safe-area-inset-bottom, 0px));
    border-radius: 16px 16px 0 0;
    overflow-y: auto;
    background: rgba(255, 255, 255, 0.82);
  }

  .decision-caption h2 {
    margin-top: 6px;
    font-size: 17px;
  }

  .decision-caption p {
    margin-top: 5px;
    font-size: 12px;
    -webkit-line-clamp: 2;
    line-clamp: 2;
  }

  .choice-list {
    grid-template-columns: 1fr;
  }

  .choice {
    padding: 8px 10px 8px 12px;
  }

  .choice__label strong {
    font-size: 12.5px;
  }
}

@media (max-width: 600px) {
  .decision-caption p,
  .choice-rail__default {
    display: none;
  }

  .choice__summary {
    -webkit-line-clamp: 1;
    line-clamp: 1;
  }
}
</style>
