<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { RouterLink, type RouteLocationRaw } from 'vue-router'
import type { ExperimentVariant } from '@/models/experiment.model'
import { useExperimentsStore } from '@/stores/experiments.store'
import ThemeCover from '@/components/home/ThemeCover.vue'
import Icon from '@/components/common/Icon.vue'

const props = defineProps<{
  themeId: string
}>()

const experiments = useExperimentsStore()

const theme = computed(() => experiments.getTheme(props.themeId))
const readyCount = computed(
  () => theme.value?.variants.filter((variant) => variant.status === 'ready').length ?? 0,
)

const accentStyle = computed(() =>
  theme.value
    ? {
        '--accent': theme.value.accent,
        '--accent-rgb': theme.value.accentRgb,
      }
    : undefined,
)

function scenarioRoute(variant: ExperimentVariant): RouteLocationRaw {
  return { name: 'scenario', params: { id: variant.scenarioId ?? '' } }
}

function isReady(variant: ExperimentVariant): boolean {
  return variant.status === 'ready' && Boolean(variant.scenarioId)
}

onMounted(() => experiments.ensureLoaded())
</script>

<template>
  <main class="theme-page" :style="accentStyle">
    <div class="p-container">
      <div v-if="!experiments.loaded && !experiments.error" class="theme-loading" aria-hidden="true">
        <div class="p-skeleton theme-loading__head"></div>
        <div class="theme-loading__grid">
          <div v-for="index in 2" :key="index" class="p-skeleton"></div>
        </div>
      </div>

      <template v-else-if="theme">
        <nav class="crumbs" aria-label="面包屑">
          <RouterLink to="/">实验主题</RouterLink>
          <span>/</span>
          <span class="crumbs__current">{{ theme.title }}</span>
        </nav>

        <header class="theme-head">
          <div class="theme-head__copy">
            <span class="theme-head__category">{{ theme.category }}</span>
            <h1>{{ theme.title }}</h1>
            <p class="theme-head__summary">{{ theme.summary }}</p>
            <p class="theme-head__description">{{ theme.description }}</p>
          </div>
          <div class="theme-head__art">
            <ThemeCover :theme="theme" eager />
          </div>
        </header>

        <section v-if="theme.principles.length" class="principle-section" aria-labelledby="principle-title">
          <div class="scenario-section__head">
            <h2 id="principle-title">实验原理</h2>
            <span class="scenario-section__count">{{ theme.principles.length }} 条伦理视角</span>
          </div>

          <div class="principle-grid">
            <article v-for="principle in theme.principles" :key="principle.title" class="principle-card">
              <h3>{{ principle.title }}</h3>
              <p>{{ principle.text }}</p>
            </article>
          </div>
        </section>

        <section v-if="theme.panorama" class="panorama-section" aria-labelledby="panorama-title">
          <a class="panorama-card" :href="theme.panorama.href">
            <div class="panorama-card__copy">
              <span class="panorama-card__eyebrow">实景延伸 · PANORAMA</span>
              <h2 id="panorama-title">{{ theme.panorama.title }}</h2>
              <p class="panorama-card__subtitle">{{ theme.panorama.subtitle }}</p>
              <p class="panorama-card__description">{{ theme.panorama.description }}</p>
              <div class="panorama-card__tags">
                <span v-for="tag in theme.panorama.tags" :key="tag">{{ tag }}</span>
              </div>
              <span class="panorama-card__action">
                进入全景漫游
                <Icon name="arrow-up-right" :size="14" />
              </span>
            </div>
            <div class="panorama-card__art" aria-hidden="true">
              <span class="panorama-card__grid"></span>
              <Icon name="compass" :size="72" :stroke-width="0.9" />
              <span class="panorama-card__art-label">DUJIANGYAN · 720°</span>
            </div>
          </a>
        </section>

        <section class="scenario-section" aria-labelledby="scenario-title">
          <div class="scenario-section__head">
            <h2 id="scenario-title">实验场景</h2>
            <span class="scenario-section__count">
              {{ readyCount }} / {{ theme.variants.length }} 个可运行
            </span>
          </div>

          <div class="scenario-grid">
            <article
              v-for="(variant, index) in theme.variants"
              :key="variant.id"
              class="scenario-card"
              :class="{ 'is-planned': !isReady(variant) }"
            >
              <div class="scenario-card__top">
                <span class="scenario-card__index">{{ String(index + 1).padStart(2, '0') }}</span>
                <span class="scenario-card__status" :class="isReady(variant) ? 'is-ready' : 'is-planned'">
                  {{ isReady(variant) ? '可运行' : '筹备中' }}
                </span>
              </div>

              <h3>{{ variant.title }}</h3>
              <p class="scenario-card__subtitle">{{ variant.subtitle }}</p>
              <p class="scenario-card__description">{{ variant.description }}</p>

              <div class="scenario-card__meta">
                <span v-if="variant.durationMinutes">
                  <Icon name="clock" :size="13" />
                  {{ variant.durationMinutes }} 分钟
                </span>
                <span v-if="variant.decisionCount">
                  <Icon name="route" :size="13" />
                  {{ variant.decisionCount }} 次决策
                </span>
              </div>

              <RouterLink
                v-if="isReady(variant)"
                :to="scenarioRoute(variant)"
                class="scenario-card__action"
              >
                进入实验
                <Icon name="arrow-right" :size="14" />
              </RouterLink>
              <span v-else class="scenario-card__action is-disabled">即将开放</span>
            </article>
          </div>
        </section>
      </template>

      <div v-else-if="experiments.error" class="p-empty theme-missing">
        <h3>主题加载失败</h3>
        <p>{{ experiments.error }}</p>
        <button type="button" class="p-btn p-btn--small" @click="experiments.load(true)">重新加载</button>
      </div>

      <div v-else class="p-empty theme-missing">
        <h3>没有找到这个主题</h3>
        <p>主题可能已被移除，请返回实验主题列表重新选择。</p>
        <RouterLink to="/" class="p-btn p-btn--small">返回实验主题</RouterLink>
      </div>
    </div>
  </main>
</template>

<style scoped>
.theme-page {
  flex: 1;
  padding: 0 0 clamp(64px, 9vw, 112px);
}

.crumbs {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 26px 0 0;
  color: var(--p-faint);
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.1em;
}

.crumbs a {
  color: var(--p-muted);
  text-decoration: none;
  transition: color 160ms ease;
}

.crumbs a:hover {
  color: var(--p-cyan);
}

.crumbs__current {
  color: var(--p-text);
}

.theme-head {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(280px, 380px);
  gap: clamp(32px, 6vw, 80px);
  align-items: center;
  padding: clamp(36px, 5vw, 60px) 0 clamp(40px, 6vw, 64px);
  border-bottom: 1px solid var(--p-line);
}

.theme-head__category {
  color: var(--accent);
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.14em;
}

.theme-head h1 {
  margin: 12px 0 0;
  color: var(--p-text-strong);
  font-family: var(--font-display);
  font-size: clamp(34px, 4.8vw, 54px);
  font-weight: 560;
  line-height: 1.1;
  letter-spacing: -0.04em;
}

.theme-head__summary {
  margin: 20px 0 0;
  color: var(--p-text);
  font-size: 15.5px;
  line-height: 1.75;
}

.theme-head__description {
  margin: 12px 0 0;
  max-width: 640px;
  color: var(--p-muted);
  font-size: 14px;
  line-height: 1.85;
}

.theme-head__art {
  overflow: hidden;
  border: 1px solid var(--p-line);
  border-radius: var(--p-radius-lg);
  background: var(--rl-bg-alt);
  box-shadow: var(--shadow-md);
}

.theme-head__art :deep(.theme-cover) {
  aspect-ratio: 16 / 10;
  height: auto;
}

.principle-section {
  padding-top: clamp(30px, 4vw, 44px);
}

.principle-section h2 {
  margin: 0;
  color: var(--p-text-strong);
  font-family: var(--font-display);
  font-size: clamp(24px, 3vw, 30px);
  font-weight: 560;
  letter-spacing: -0.025em;
}

.principle-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 14px;
}

.principle-card {
  padding: 18px 18px 17px;
  border: 1px solid var(--p-line);
  border-left: 2px solid rgba(var(--accent-rgb), 0.5);
  border-radius: 0 var(--p-radius-md) var(--p-radius-md) 0;
  background: var(--p-surface);
}

.principle-card h3 {
  margin: 0;
  color: var(--p-text-strong);
  font-family: var(--font-display);
  font-size: 16px;
  font-weight: 560;
  letter-spacing: -0.01em;
}

.principle-card p {
  margin: 8px 0 0;
  color: var(--p-muted);
  font-size: 13px;
  line-height: 1.8;
}

.scenario-section {
  padding-top: clamp(36px, 5vw, 56px);
}

.scenario-section__head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 22px;
}

.scenario-section h2 {
  margin: 0;
  color: var(--p-text-strong);
  font-family: var(--font-display);
  font-size: clamp(24px, 3vw, 30px);
  font-weight: 560;
  letter-spacing: -0.025em;
}

.scenario-section__count {
  color: var(--p-faint);
  font-size: 12px;
}

.scenario-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 18px;
}

.scenario-card {
  display: flex;
  flex-direction: column;
  padding: 22px 22px 20px;
  border: 1px solid var(--p-line);
  border-radius: var(--p-radius-md);
  background: var(--p-surface);
  box-shadow: var(--shadow-sm);
  transition:
    border-color 220ms ease,
    box-shadow 220ms ease;
}

.scenario-card:hover {
  border-color: rgba(var(--accent-rgb), 0.36);
  box-shadow: var(--shadow-md);
}

.scenario-card.is-planned {
  opacity: 0.72;
}

.scenario-card.is-planned:hover {
  border-color: var(--p-line);
  background: var(--p-surface);
  box-shadow: var(--shadow-sm);
}

.scenario-card__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.scenario-card__index {
  color: var(--accent);
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.1em;
}

.scenario-card__status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 9px;
  border: 1px solid var(--p-line);
  border-radius: 999px;
  color: var(--p-faint);
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.08em;
}

.scenario-card__status::before {
  content: '';
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: currentColor;
}

.scenario-card__status.is-ready {
  border-color: rgba(47, 158, 104, 0.24);
  color: var(--p-green);
}

.scenario-card__status.is-planned {
  border-color: rgba(217, 154, 43, 0.24);
  color: var(--p-amber);
}

.scenario-card h3 {
  margin: 16px 0 0;
  color: var(--p-text-strong);
  font-family: var(--font-display);
  font-size: 22px;
  font-weight: 560;
  letter-spacing: -0.02em;
}

.scenario-card__subtitle {
  margin: 5px 0 0;
  color: var(--accent);
  font-size: 13px;
}

.scenario-card__description {
  margin: 12px 0 0;
  color: var(--p-muted);
  font-size: 13.5px;
  line-height: 1.8;
}

.scenario-card__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 18px;
  margin-top: 16px;
  color: var(--p-faint);
  font-family: var(--font-mono);
  font-size: 11px;
}

.scenario-card__meta span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.scenario-card__action {
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 20px;
  padding: 11px 15px;
  border: 1px solid rgba(var(--accent-rgb), 0.34);
  border-radius: 9px;
  background: rgba(var(--accent-rgb), 0.08);
  color: var(--accent);
  font-size: 13px;
  text-decoration: none;
  transition:
    background 200ms ease,
    border-color 200ms ease;
}

.scenario-card__action:hover {
  border-color: rgba(var(--accent-rgb), 0.55);
  background: rgba(var(--accent-rgb), 0.14);
}

.scenario-card__action.is-disabled {
  justify-content: center;
  border-color: var(--p-line);
  background: transparent;
  color: var(--p-faint);
  pointer-events: none;
}

.theme-loading {
  padding-top: 40px;
}

.theme-loading__head {
  height: 260px;
  border-radius: 16px;
}

.theme-loading__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 18px;
  margin-top: 40px;
}

.theme-loading__grid > div {
  height: 260px;
  border-radius: 14px;
}

.theme-missing {
  margin-top: 48px;
}

.panorama-section {
  padding-top: clamp(30px, 4vw, 44px);
}

.panorama-card {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(220px, 320px);
  gap: clamp(20px, 4vw, 48px);
  align-items: stretch;
  overflow: hidden;
  padding: clamp(24px, 4vw, 40px);
  border: 1px solid rgba(15, 110, 132, 0.24);
  border-radius: var(--p-radius-lg);
  background:
    radial-gradient(520px 300px at 92% 0%, rgba(15, 110, 132, 0.1), transparent 70%),
    var(--p-surface);
  color: inherit;
  text-decoration: none;
  box-shadow: var(--shadow-sm);
  transition:
    border-color 220ms ease,
    transform 220ms ease,
    box-shadow 220ms ease;
}

.panorama-card:hover {
  border-color: rgba(15, 110, 132, 0.46);
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.panorama-card__eyebrow {
  color: var(--p-cyan);
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.16em;
}

.panorama-card h2 {
  margin: 10px 0 0;
  color: var(--p-text-strong);
  font-family: var(--font-display);
  font-size: clamp(26px, 3.4vw, 36px);
  font-weight: 560;
  letter-spacing: -0.03em;
}

.panorama-card__subtitle {
  margin: 8px 0 0;
  color: var(--p-cyan);
  font-size: 13.5px;
}

.panorama-card__description {
  max-width: 640px;
  margin: 14px 0 0;
  color: var(--p-muted);
  font-size: 13.5px;
  line-height: 1.85;
}

.panorama-card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 18px;
}

.panorama-card__tags span {
  padding: 5px 10px;
  border: 1px solid var(--p-line);
  border-radius: 999px;
  color: var(--p-muted);
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.06em;
}

.panorama-card__action {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-top: 22px;
  color: var(--p-cyan);
  font-size: 13px;
}

.panorama-card__art {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  min-height: 190px;
  border: 1px solid var(--p-line);
  border-radius: var(--p-radius-md);
  background: var(--rl-primary-soft);
  color: var(--p-cyan);
  overflow: hidden;
}

.panorama-card__grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(15, 110, 132, 0.08) 1px, transparent 1px),
    linear-gradient(90deg, rgba(15, 110, 132, 0.08) 1px, transparent 1px);
  background-size: 24px 24px;
  mask-image: radial-gradient(circle at 50% 50%, black, transparent 78%);
}

.panorama-card__art-label {
  position: relative;
  color: var(--p-faint);
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.18em;
}

@media (max-width: 980px) {
  .panorama-card {
    grid-template-columns: 1fr;
  }

  .panorama-card__art {
    min-height: 140px;
  }

  .theme-head {
    grid-template-columns: 1fr;
  }

  .theme-head__art {
    max-width: 520px;
  }
}

@media (max-width: 720px) {
  .scenario-section__head {
    align-items: flex-start;
    flex-direction: column;
    gap: 10px;
  }

  .scenario-grid,
  .theme-loading__grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 520px) {
  .theme-head {
    gap: 26px;
    padding-top: 30px;
  }

  .scenario-card {
    padding: 18px 18px 16px;
  }
}
</style>
