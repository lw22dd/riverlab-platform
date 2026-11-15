<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import type { ExperimentTheme } from '@/models/experiment.model'
import Icon from '@/components/common/Icon.vue'
import ThemeCover from './ThemeCover.vue'

const props = defineProps<{
  theme: ExperimentTheme
}>()

const readyCount = computed(
  () => props.theme.variants.filter((variant) => variant.status === 'ready').length,
)

const cardStyle = computed(() => ({
  '--accent': props.theme.accent,
  '--accent-rgb': props.theme.accentRgb,
}))
</script>

<template>
  <RouterLink
    :to="{ name: 'theme', params: { themeId: theme.id } }"
    class="theme-card"
    :style="cardStyle"
    :aria-label="`查看${theme.title}主题及其${theme.variants.length}个实验场景`"
  >
    <div class="theme-card__media">
      <ThemeCover :theme="theme" />
      <span class="theme-card__index">{{ theme.index }}</span>
    </div>

    <div class="theme-card__body">
      <div class="theme-card__meta">
        <span class="theme-card__category">{{ theme.category }}</span>
      </div>
      <h3>{{ theme.title }}</h3>
      <p class="theme-card__summary">{{ theme.summary }}</p>

      <div class="theme-card__footer">
        <span class="theme-card__count">
          {{ readyCount }} / {{ theme.variants.length }} 个场景可运行
        </span>
        <span class="theme-card__enter">
          查看场景
          <Icon name="arrow-right" :size="14" />
        </span>
      </div>
    </div>
  </RouterLink>
</template>

<style scoped>
.theme-card {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  border: 1px solid var(--p-line);
  border-radius: var(--p-radius-lg);
  background: var(--p-surface);
  color: var(--p-text);
  text-decoration: none;
  box-shadow: var(--shadow-sm);
  animation: theme-card-in 520ms var(--ease-out) backwards;
  transition:
    transform 260ms var(--ease-out),
    border-color 260ms ease,
    box-shadow 260ms ease;
}

@keyframes theme-card-in {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.theme-card:hover {
  transform: translateY(-4px);
  border-color: rgba(var(--accent-rgb), 0.4);
  box-shadow: var(--shadow-md);
}

.theme-card__media {
  position: relative;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  border-bottom: 1px solid var(--p-line);
  background: var(--rl-bg-alt);
}

.theme-card__media :deep(.theme-cover) {
  height: 100%;
  transition: transform 600ms var(--ease-out);
}

.theme-card:hover .theme-card__media :deep(.theme-cover) {
  transform: scale(1.03);
}

.theme-card__index {
  position: absolute;
  top: 14px;
  left: 14px;
  padding: 4px 9px;
  border: 1px solid rgba(var(--accent-rgb), 0.24);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.9);
  color: color-mix(in srgb, var(--accent) 68%, var(--p-text-strong));
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.08em;
  backdrop-filter: blur(6px);
}

.theme-card__body {
  display: flex;
  flex: 1;
  flex-direction: column;
  padding: 18px 20px 20px;
}

.theme-card__meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.theme-card__category {
  color: color-mix(in srgb, var(--accent) 68%, var(--p-text-strong));
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.1em;
}

.theme-card h3 {
  margin: 10px 0 0;
  color: var(--p-text-strong);
  font-family: var(--font-display);
  font-size: 23px;
  font-weight: 560;
  letter-spacing: -0.02em;
}

.theme-card__summary {
  margin: 8px 0 0;
  color: var(--p-muted);
  font-size: 13.5px;
  line-height: 1.75;
}

.theme-card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: auto;
  padding-top: 18px;
}

.theme-card__count {
  color: var(--p-faint);
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.02em;
}

.theme-card__enter {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  flex: none;
  color: color-mix(in srgb, var(--accent) 72%, var(--p-text-strong));
  font-size: 12px;
  transition: gap 200ms ease;
}

.theme-card:hover .theme-card__enter {
  gap: 9px;
}

@media (max-width: 560px) {
  .theme-card h3 {
    font-size: 21px;
  }

  .theme-card__body {
    padding: 16px 16px 18px;
  }
}
</style>
