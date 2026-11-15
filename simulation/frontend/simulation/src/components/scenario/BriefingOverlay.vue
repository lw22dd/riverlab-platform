<script setup lang="ts">
import { computed } from 'vue'
import { Button as TButton } from 'tdesign-vue-next'
import { countDecisionNodes, countDecisionOptions } from '@/data'
import type { ScenarioPackage } from '@/models/presentation.model'
import Icon from '@/components/common/Icon.vue'
import ScenarioGlyph from '@/components/home/ScenarioGlyph.vue'

const props = defineProps<{
  entry: ScenarioPackage
}>()

defineEmits<{
  start: []
  back: []
}>()

const scenario = computed(() => props.entry.scenario)
const isAutonomous = computed(() => scenario.value.domain === 'autonomous')
const decisionCount = computed(() => countDecisionNodes(scenario.value))
const branchCount = computed(() => countDecisionOptions(scenario.value))
const accentStyle = computed(() => ({
  '--accent': props.entry.presentation.accent,
  '--accent-rgb': props.entry.presentation.accentRgb,
}))
</script>

<template>
  <div class="briefing" role="dialog" aria-modal="true" aria-labelledby="briefing-title" :style="accentStyle">
    <div class="briefing__backdrop" aria-hidden="true"></div>
    <div class="briefing__frame">
      <header class="briefing__top">
        <div class="briefing__brandline">
          <span class="briefing__index">EXPERIMENT / {{ entry.presentation.order }}</span>
          <span class="briefing__dot"></span>
          <span>{{ entry.presentation.domainLabel }}</span>
        </div>
        <button type="button" class="briefing__close" aria-label="返回实验主题" @click="$emit('back')">
          <Icon name="close" :size="17" />
        </button>
      </header>

      <div class="briefing__body">
        <section class="briefing__hero">
          <div class="briefing__hero-copy">
            <span class="briefing__eyebrow">{{ isAutonomous ? 'BEFORE YOU CODE' : 'BEFORE YOU DECIDE' }}</span>
            <h1 id="briefing-title">
              {{ scenario.title }}
              <em>{{ scenario.subtitle }}</em>
            </h1>
            <p class="briefing__tagline">{{ scenario.tagline }}</p>
            <p class="briefing__description">{{ scenario.description }}</p>

            <div class="briefing__tags">
              <span v-for="tag in scenario.tags" :key="tag">{{ tag }}</span>
            </div>

            <div class="briefing__facts">
              <div>
                <strong>{{ decisionCount }}</strong>
                <span>{{ isAutonomous ? '程序决策' : '决策点' }}</span>
              </div>
              <div>
                <strong>{{ branchCount }}</strong>
                <span>可选分支</span>
              </div>
              <div>
                <strong>{{ scenario.rules.length }}</strong>
                <span>评分规则</span>
              </div>
              <div>
                <strong>{{ scenario.estimatedMinutes }}<small>min</small></strong>
                <span>预计用时</span>
              </div>
            </div>
          </div>

          <div class="briefing__visual" aria-hidden="true">
            <ScenarioGlyph :kind="entry.presentation.glyph" />
            <span class="briefing__visual-label">{{ scenario.difficulty }} / {{ entry.presentation.domainLabel }}</span>
          </div>
        </section>

        <aside class="briefing__panel">
          <div class="briefing__panel-head">
            <span class="mono-label">MISSION BRIEF</span>
          </div>

          <div class="briefing__role">
            <span>你的角色</span>
            <strong>{{ scenario.brief.role }}</strong>
          </div>

          <div class="briefing__section">
            <span class="briefing__label">情境</span>
            <p>{{ scenario.brief.premise }}</p>
          </div>

          <div class="briefing__section">
            <span class="briefing__label">目标</span>
            <p>{{ scenario.brief.objective }}</p>
          </div>

          <div class="briefing__section">
            <span class="briefing__label">约束条件</span>
            <ul class="briefing__constraints">
              <li v-for="constraint in scenario.brief.constraints" :key="constraint">
                <Icon name="chevron-right" :size="11" />
                {{ constraint }}
              </li>
            </ul>
          </div>

          <div class="briefing__lens">
            <span class="mono-label">ETHICS LENS</span>
            <p>{{ scenario.brief.ethicsLens }}</p>
          </div>

          <div class="briefing__actions">
            <TButton theme="primary" size="large" class="briefing__start" @click="$emit('start')">
              {{ isAutonomous ? '编写决策程序' : '进入推演' }}
              <Icon name="arrow-right" :size="16" />
            </TButton>
            <button type="button" class="btn btn--ghost" @click="$emit('back')">
              返回实验主题
            </button>
          </div>

          <p class="briefing__notice">
            <Icon name="info" :size="12" />
            {{ scenario.brief.safetyNotice }}
          </p>
        </aside>
      </div>

      <footer class="briefing__foot">
        <span v-if="isAutonomous" class="briefing__keys">
          程序运行后可暂停观察 ·
          <kbd>P</kbd> 暂停 ·
          <kbd>G</kbd> 图谱 ·
          <kbd>L</kbd> 日志
        </span>
        <span v-else class="briefing__keys"><kbd>1</kbd>—<kbd>4</kbd> 选择 · <kbd>Enter</kbd> 继续 · <kbd>G</kbd> 查看图谱</span>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.briefing {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: grid;
  place-items: center;
  padding: 22px;
  overflow-y: auto;
}

.briefing__backdrop {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(70% 80% at 24% 12%, rgba(var(--accent-rgb), 0.14), transparent 62%),
    radial-gradient(60% 60% at 86% 88%, rgba(62, 127, 184, 0.06), transparent 70%),
    rgba(236, 244, 250, 0.72);
  backdrop-filter: blur(22px) saturate(115%);
}

.briefing__frame {
  position: relative;
  z-index: 1;
  width: min(1180px, 100%);
  max-height: calc(100svh - 44px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 26px;
  background:
    radial-gradient(120% 90% at 0% 0%, rgba(var(--accent-rgb), 0.05), transparent 48%),
    var(--panel-raised);
  box-shadow: var(--shadow-lg);
  color: var(--text);
  animation: briefing-in 600ms var(--ease-out) both;
}

.briefing__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 17px 23px;
  border-bottom: 1px solid var(--line);
}

.briefing__brandline {
  display: flex;
  align-items: center;
  gap: 10px;
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.16em;
  color: var(--text-faint);
}

.briefing__index {
  color: var(--accent);
}

.briefing__dot {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: var(--text-faint);
}

.briefing__close {
  display: grid;
  place-items: center;
  width: 33px;
  height: 33px;
  border: 1px solid var(--line);
  border-radius: 50%;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition:
    background 180ms ease,
    color 180ms ease;
}

.briefing__close:hover {
  background: rgba(22, 50, 79, 0.06);
  color: var(--text-strong);
}

.briefing__body {
  display: grid;
  grid-template-columns: minmax(0, 1.24fr) minmax(380px, 0.76fr);
  min-height: 0;
  overflow-y: auto;
}

.briefing__hero {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-height: 530px;
  padding: 38px 34px 25px 38px;
  overflow: hidden;
  background: linear-gradient(
    180deg,
    var(--panel-solid) 0%,
    rgba(var(--accent-rgb), 0.035) 62%,
    rgba(var(--accent-rgb), 0.075) 100%
  );
  border-right: 1px solid var(--line);
}

.briefing__hero::before {
  content: '';
  position: absolute;
  inset: 0;
  background:
    radial-gradient(72% 58% at 72% 62%, rgba(var(--accent-rgb), 0.12), transparent 68%),
    linear-gradient(180deg, transparent 58%, rgba(var(--accent-rgb), 0.04));
  pointer-events: none;
}

.briefing__hero-copy {
  position: relative;
  z-index: 1;
  max-width: 540px;
}

.briefing__eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.2em;
  color: var(--accent);
}

.briefing__eyebrow::before {
  content: '';
  width: 18px;
  height: 1px;
  background: currentColor;
}

.briefing__hero h1 {
  margin-top: 19px;
  font-size: clamp(44px, 5.4vw, 70px);
  font-weight: 600;
  line-height: 1.04;
  letter-spacing: -0.055em;
  color: var(--text-strong);
}

.briefing__hero h1 em {
  display: block;
  margin-top: 7px;
  font-size: 0.49em;
  font-style: normal;
  font-weight: 500;
  letter-spacing: -0.02em;
  color: var(--accent);
}

.briefing__tagline {
  max-width: 470px;
  margin-top: 24px;
  font-size: 16px;
  line-height: 1.75;
  color: var(--text);
}

.briefing__description {
  max-width: 500px;
  margin-top: 14px;
  font-size: 13px;
  line-height: 1.85;
  color: var(--text-muted);
}

.briefing__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 19px;
}

.briefing__tags span {
  padding: 4px 8px;
  border: 1px solid var(--line);
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.72);
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-muted);
}

.briefing__facts {
  display: flex;
  gap: 0;
  margin-top: 28px;
  padding-top: 18px;
  border-top: 1px solid var(--line);
}

.briefing__facts > div {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 82px;
  padding-left: 17px;
  border-left: 1px solid var(--line);
}

.briefing__facts > div:first-child {
  padding-left: 0;
  border-left: 0;
}

.briefing__facts strong {
  font-family: var(--font-display);
  font-size: 24px;
  font-weight: 500;
  color: var(--text-strong);
}

.briefing__facts strong small {
  margin-left: 2px;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-faint);
}

.briefing__facts span {
  font-size: 11.5px;
  color: var(--text-muted);
}

.briefing__visual {
  position: relative;
  z-index: 1;
  height: 190px;
  margin-top: 6px;
  opacity: 0.85;
}

.briefing__visual :deep(.glyph) {
  height: 100%;
}

.briefing__visual-label {
  position: absolute;
  right: 12px;
  bottom: 2px;
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.14em;
  color: var(--text-faint);
}

.briefing__panel {
  display: flex;
  flex-direction: column;
  padding: 25px 25px 19px;
  min-height: 0;
  overflow-y: auto;
  background: var(--panel-solid);
}

.briefing__panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
}

.briefing__role {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 18px;
  padding: 13px 14px;
  border: 1px solid rgba(var(--accent-rgb), 0.2);
  border-left: 2px solid var(--accent);
  border-radius: 0 9px 9px 0;
  background: rgba(var(--accent-rgb), 0.07);
}

.briefing__role span {
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.1em;
  color: var(--text-muted);
}

.briefing__role strong {
  font-size: 14px;
  font-weight: 500;
  color: var(--text);
}

.briefing__section {
  margin-top: 17px;
}

.briefing__label {
  display: inline-block;
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.14em;
  color: var(--text-muted);
}

.briefing__section p {
  margin-top: 6px;
  font-size: 13px;
  line-height: 1.75;
  color: var(--text-muted);
}

.briefing__constraints {
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin: 7px 0 0;
  padding: 0;
  list-style: none;
}

.briefing__constraints li {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  font-size: 12.5px;
  line-height: 1.55;
  color: var(--text-muted);
}

.briefing__constraints :deep(svg) {
  margin-top: 2px;
  color: var(--accent);
}

.briefing__lens {
  margin-top: 18px;
  padding-top: 14px;
  border-top: 1px solid var(--line);
}

.briefing__lens p {
  margin-top: 6px;
  font-size: 12.5px;
  line-height: 1.65;
  color: var(--text-muted);
}

.briefing__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 9px;
  margin-top: 22px;
}

.briefing__start {
  min-height: 46px;
  padding-inline: 22px;
  border-color: var(--brand) !important;
  background: var(--brand) !important;
  color: #ffffff !important;
  box-shadow: 0 12px 26px rgba(var(--brand-rgb), 0.18);
}

.briefing__start:hover {
  border-color: #0c5b6d !important;
  background: #0c5b6d !important;
}

.briefing__start :deep(svg) {
  margin-left: 3px;
}

.briefing__notice {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin-top: 13px;
  font-size: 11px;
  line-height: 1.6;
  color: var(--text-muted);
}

.briefing__notice :deep(svg) {
  margin-top: 1px;
  flex: none;
}

.briefing__foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 9px 20px;
  padding: 12px 23px;
  border-top: 1px solid var(--line);
  background: rgba(244, 248, 252, 0.72);
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.07em;
  color: var(--text-muted);
}

.briefing__foot > span:first-child {
  display: inline-flex;
  align-items: center;
  gap: 7px;
}

.briefing__keys {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  color: var(--text-faint);
}

.briefing__keys kbd {
  display: inline-grid;
  place-items: center;
  min-width: 16px;
  height: 16px;
  padding: 0 3px;
  border: 1px solid var(--line-strong);
  border-bottom-width: 2px;
  border-radius: 3px;
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-muted);
}

@keyframes briefing-in {
  from {
    opacity: 0;
    transform: translateY(26px) scale(0.988);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@media (max-width: 900px) {
  .briefing {
    padding: 10px;
    align-items: start;
  }

  .briefing__frame {
    max-height: calc(100svh - 20px);
    border-radius: 19px;
  }

  .briefing__body {
    grid-template-columns: 1fr;
  }

  .briefing__hero {
    min-height: auto;
    padding: 28px 22px 10px;
    border-right: 0;
    border-bottom: 1px solid var(--line);
  }

  .briefing__hero h1 {
    font-size: clamp(38px, 10vw, 55px);
  }

  .briefing__visual {
    height: 150px;
    margin-top: 9px;
  }

  .briefing__panel {
    padding: 21px 22px 18px;
  }

  .briefing__facts > div {
    min-width: 65px;
  }

  .briefing__foot {
    display: none;
  }
}

@media (max-width: 560px) {
  .briefing__brandline span:last-child,
  .briefing__brandline span:nth-last-child(2) {
    display: none;
  }

  .briefing__hero {
    padding-top: 23px;
  }

  .briefing__description {
    font-size: 13px;
  }

  .briefing__facts {
    flex-wrap: wrap;
    gap: 12px 0;
  }

  .briefing__actions .btn,
  .briefing__actions :deep(.t-button) {
    flex: 1;
  }
}
</style>
