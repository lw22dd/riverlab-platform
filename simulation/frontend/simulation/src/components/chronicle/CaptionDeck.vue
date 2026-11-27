<script setup lang="ts">
import type { PhaseDef } from '@/three/chronicle'

const props = defineProps<{
  phase: PhaseDef
  currentIdx: number
  time: number
  total: number
  playing: boolean
  speed: number
  follow: boolean
}>()

const emit = defineEmits<{
  toggle: []
  reset: []
  seek: [seconds: number]
  speed: [value: number]
  follow: [value: boolean]
}>()

const SPEEDS = [0.5, 1, 1.5, 2]

const pad = (value: number): string => String(value).padStart(2, '0')

function clock(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds))
  return `${pad(Math.floor(safe / 60))}:${pad(safe % 60)}`
}

function onScrub(event: Event): void {
  emit('seek', Number((event.target as HTMLInputElement).value))
}
</script>

<template>
  <section class="deck">
    <div class="deck__caption">
      <p class="deck__meta">
        <span class="deck__no">{{ pad(currentIdx + 1) }}</span>
        <span class="deck__tag">{{ phase.tag }}</span>
        <span class="deck__rule" aria-hidden="true" />
      </p>
      <h2 class="deck__title">{{ phase.title }}</h2>
      <p class="deck__text">{{ phase.caption }}</p>
    </div>

    <div class="deck__transport">
      <button type="button" class="deck__btn deck__btn--play" @click="emit('toggle')">
        <span aria-hidden="true">{{ playing ? '❚❚' : '▶' }}</span>
        {{ playing ? '暂停' : '播放' }}
      </button>

      <button type="button" class="deck__btn" @click="emit('reset')">
        <span aria-hidden="true">↺</span>
        复位
      </button>

      <label class="deck__scrub">
        <span class="sr-only">时间轴</span>
        <input
          type="range"
          min="0"
          :max="props.total"
          step="0.05"
          :value="props.time"
          @input="onScrub"
        />
      </label>

      <span class="deck__clock">{{ clock(props.time) }} / {{ clock(props.total) }}</span>

      <div class="deck__speeds" role="group" aria-label="播放速度">
        <button
          v-for="value in SPEEDS"
          :key="value"
          type="button"
          class="deck__speed"
          :class="{ 'is-on': Math.abs(props.speed - value) < 0.01 }"
          @click="emit('speed', value)"
        >
          {{ value }}×
        </button>
      </div>

      <button
        type="button"
        class="deck__btn deck__btn--ghost"
        :class="{ 'is-on': props.follow }"
        :aria-pressed="props.follow"
        @click="emit('follow', !props.follow)"
      >
        跟拍
      </button>
    </div>
  </section>
</template>

<style scoped>
.deck {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px 18px 14px;
  border: 1px solid var(--rl-border);
  border-radius: var(--rl-r-md);
  background: color-mix(in srgb, var(--rl-surface) 88%, transparent);
  box-shadow: var(--rl-sh-lg);
  backdrop-filter: blur(16px);
}

.deck__meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 4px;
}

.deck__no {
  font-family: var(--rl-mono);
  font-size: 11px;
  color: var(--rl-accent);
  letter-spacing: 0.08em;
}

.deck__tag {
  padding: 1px 6px;
  border: 1px solid color-mix(in srgb, var(--rl-accent) 42%, transparent);
  border-radius: 999px;
  font-size: 10px;
  line-height: 1.5;
  color: var(--rl-accent);
  letter-spacing: 0.06em;
}

.deck__rule {
  flex: 1;
  height: 1px;
  background: linear-gradient(90deg, var(--rl-border), transparent);
}

.deck__title {
  margin: 0 0 6px;
  font-family: var(--rl-display);
  font-size: 22px;
  font-weight: 600;
  line-height: 1.2;
  letter-spacing: 0.02em;
  color: var(--rl-ink);
}

.deck__text {
  margin: 0;
  max-width: 74ch;
  font-size: 13px;
  line-height: 1.75;
  color: var(--rl-body);
  text-align: justify;
}

.deck__transport {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 10px;
  padding-top: 10px;
  border-top: 1px solid var(--rl-border);
}

.deck__btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 11px;
  border: 1px solid var(--rl-border);
  border-radius: var(--rl-r-sm);
  background: var(--rl-surface);
  font-size: 12px;
  font-weight: 500;
  color: var(--rl-body);
  cursor: pointer;
  transition: border-color 0.18s var(--ease-out), color 0.18s var(--ease-out), background 0.18s var(--ease-out);
}

.deck__btn:hover {
  border-color: var(--rl-primary);
  color: var(--rl-primary);
}

.deck__btn--play {
  border-color: var(--rl-primary);
  background: var(--rl-primary);
  color: #fff;
}

.deck__btn--play:hover {
  background: var(--rl-primary-hover);
  color: #fff;
}

.deck__btn--ghost.is-on {
  border-color: var(--rl-primary);
  background: var(--rl-primary-soft);
  color: var(--rl-primary);
}

.deck__scrub {
  flex: 1 1 180px;
  min-width: 140px;
  display: flex;
  align-items: center;
}

.deck__scrub input {
  width: 100%;
  height: 18px;
  margin: 0;
  background: transparent;
  appearance: none;
  cursor: pointer;
}

.deck__scrub input::-webkit-slider-runnable-track {
  height: 3px;
  border-radius: 3px;
  background: var(--rl-border);
}

.deck__scrub input::-webkit-slider-thumb {
  width: 12px;
  height: 12px;
  margin-top: -4.5px;
  border: 2px solid var(--rl-surface);
  border-radius: 50%;
  background: var(--rl-accent);
  box-shadow: 0 1px 3px rgb(var(--rl-primary-rgb) / 30%);
  appearance: none;
}

.deck__scrub input::-moz-range-track {
  height: 3px;
  border-radius: 3px;
  background: var(--rl-border);
}

.deck__scrub input::-moz-range-thumb {
  width: 12px;
  height: 12px;
  border: 2px solid var(--rl-surface);
  border-radius: 50%;
  background: var(--rl-accent);
}

.deck__clock {
  font-family: var(--rl-mono);
  font-size: 11px;
  color: var(--rl-muted);
  letter-spacing: 0.02em;
  white-space: nowrap;
}

.deck__speeds {
  display: inline-flex;
  padding: 2px;
  border: 1px solid var(--rl-border);
  border-radius: var(--rl-r-sm);
  background: var(--rl-bg-alt);
}

.deck__speed {
  padding: 3px 7px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  font-family: var(--rl-mono);
  font-size: 11px;
  color: var(--rl-muted);
  cursor: pointer;
}

.deck__speed.is-on {
  background: var(--rl-surface);
  color: var(--rl-primary);
  box-shadow: var(--rl-sh-sm);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

@media (max-width: 720px) {
  .deck {
    padding: 12px 14px;
  }

  .deck__title {
    font-size: 18px;
  }

  .deck__text {
    font-size: 12px;
    line-height: 1.7;
  }

  .deck__scrub {
    flex-basis: 100%;
    order: -1;
  }
}
</style>
