<script setup lang="ts">
import type { PhaseDef } from '@/three/chronicle'

const props = defineProps<{
  phases: PhaseDef[]
  currentIdx: number
  /** 当前这一幕的进度 0–1 */
  progress: number
  playing: boolean
}>()

const emit = defineEmits<{ select: [index: number] }>()

const pad = (value: number): string => String(value).padStart(2, '0')

function barWidth(index: number): string {
  if (index < props.currentIdx) return '100%'
  if (index > props.currentIdx) return '0%'
  return `${Math.round(Math.min(1, Math.max(0, props.progress)) * 100)}%`
}
</script>

<template>
  <nav class="rail" aria-label="营造时序">
    <header class="rail__head">
      <span class="rl-eyebrow">SEQUENCE</span>
      <span class="rail__count">{{ pad(currentIdx + 1) }} / {{ pad(phases.length) }}</span>
    </header>

    <ol class="rail__list">
      <li v-for="(phase, index) in phases" :key="phase.id">
        <button
          type="button"
          class="rail__item"
          :class="{ 'is-active': index === currentIdx, 'is-past': index < currentIdx }"
          :aria-current="index === currentIdx ? 'step' : undefined"
          @click="emit('select', index)"
        >
          <span class="rail__no">{{ pad(index + 1) }}</span>
          <span class="rail__body">
            <span class="rail__title">{{ phase.title }}</span>
            <span class="rail__tag">{{ phase.tag }} · {{ phase.seconds }}s</span>
          </span>
          <span class="rail__bar" aria-hidden="true"><i :style="{ width: barWidth(index) }" /></span>
        </button>
      </li>
    </ol>

    <p class="rail__hint">
      {{ playing ? '播放中' : '已暂停' }} · 空格切换 · ← → 微调 · 1–8 跳段
    </p>
  </nav>
</template>

<style scoped>
.rail {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 0;
  padding: 14px;
  border: 1px solid var(--rl-border);
  border-radius: var(--rl-r-md);
  background: color-mix(in srgb, var(--rl-surface) 84%, transparent);
  box-shadow: var(--rl-sh-md);
  backdrop-filter: blur(14px);
}

.rail__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--rl-border);
}

.rail__count {
  font-family: var(--rl-mono);
  font-size: 11px;
  color: var(--rl-muted);
  letter-spacing: 0.04em;
}

.rail__list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  list-style: none;
  scrollbar-width: thin;
}

.rail__item {
  position: relative;
  display: grid;
  grid-template-columns: 22px 1fr;
  gap: 2px 8px;
  width: 100%;
  padding: 7px 8px 9px;
  border: 0;
  border-radius: var(--rl-r-sm);
  background: transparent;
  color: var(--rl-body);
  text-align: left;
  cursor: pointer;
  transition: background 0.18s var(--ease-out), color 0.18s var(--ease-out);
}

.rail__item:hover {
  background: var(--rl-primary-soft);
}

.rail__item.is-active {
  background: color-mix(in srgb, var(--rl-accent) 12%, var(--rl-surface));
  color: var(--rl-ink);
}

.rail__item.is-active::before {
  content: '';
  position: absolute;
  inset: 6px auto 6px 0;
  width: 2px;
  border-radius: 2px;
  background: var(--rl-accent);
}

.rail__no {
  font-family: var(--rl-mono);
  font-size: 10px;
  line-height: 1.6;
  color: var(--rl-faint);
}

.rail__item.is-active .rail__no,
.rail__item.is-past .rail__no {
  color: var(--rl-accent);
}

.rail__body {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.rail__title {
  font-size: 13px;
  font-weight: 600;
  line-height: 1.35;
  letter-spacing: 0.01em;
}

.rail__tag {
  font-size: 10px;
  color: var(--rl-muted);
  letter-spacing: 0.02em;
}

.rail__bar {
  grid-column: 2;
  height: 2px;
  margin-top: 3px;
  overflow: hidden;
  border-radius: 2px;
  background: var(--rl-border);
}

.rail__bar i {
  display: block;
  height: 100%;
  border-radius: 2px;
  background: var(--rl-primary);
  transition: width 0.12s linear;
}

.rail__item.is-active .rail__bar i {
  background: var(--rl-accent);
}

.rail__hint {
  margin: 0;
  padding-top: 8px;
  border-top: 1px solid var(--rl-border);
  font-size: 10px;
  color: var(--rl-faint);
  letter-spacing: 0.02em;
}

@media (max-width: 1080px) {
  .rail {
    padding: 10px;
  }

  .rail__list {
    flex-direction: row;
    gap: 6px;
    overflow-x: auto;
    overflow-y: hidden;
  }

  .rail__item {
    grid-template-columns: 1fr;
    min-width: 108px;
    padding: 6px 8px 8px;
  }

  .rail__no {
    display: none;
  }

  .rail__hint {
    display: none;
  }
}
</style>
