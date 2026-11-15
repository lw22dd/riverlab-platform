<script setup lang="ts">
import { computed, onMounted } from 'vue'
import ThemeCard from '@/components/home/ThemeCard.vue'
import { useExperimentsStore } from '@/stores/experiments.store'

const experiments = useExperimentsStore()

const themeCount = computed(() => experiments.themes.length)
const variantCount = computed(() => experiments.variantCount)
const readyCount = computed(() => experiments.runningVariantCount)

onMounted(() => experiments.ensureLoaded())
</script>

<template>
  <main class="home-page">
    <div class="p-container">
      <header class="home-head">
        <div class="home-head__copy">
          <span class="home-head__eyebrow">ETHICS SIMULATION</span>
          <h1>选择一个实验主题</h1>
          <p>
            每个主题下有若干场景。场景会写明时间、地点和你手上能用的条件；你在信息不全的时候做决定，事后要把依据讲清楚。
          </p>
        </div>
        <p class="home-head__meta">
          {{ themeCount }} 个主题 · {{ variantCount }} 个场景 · {{ readyCount }} 个可运行
        </p>
      </header>

      <div v-if="!experiments.loaded && !experiments.error" class="theme-grid" aria-hidden="true">
        <div v-for="index in 6" :key="index" class="p-skeleton skeleton-card"></div>
      </div>

      <div v-else-if="experiments.error" class="p-empty">
        <h3>主题加载失败</h3>
        <p>{{ experiments.error }}</p>
        <button type="button" class="p-btn p-btn--small" @click="experiments.load(true)">重新加载</button>
      </div>

      <div v-else class="theme-grid">
        <ThemeCard
          v-for="(theme, index) in experiments.themes"
          :key="theme.id"
          :theme="theme"
          :style="{ animationDelay: `${index * 60}ms` }"
        />
      </div>
    </div>
  </main>
</template>

<style scoped>
.home-page {
  flex: 1;
  padding: clamp(48px, 7vw, 84px) 0 clamp(64px, 9vw, 112px);
}

.home-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: clamp(28px, 6vw, 96px);
  padding-bottom: 32px;
  border-bottom: 1px solid var(--p-line);
}

.home-head__copy {
  max-width: 620px;
}

.home-head__eyebrow {
  display: block;
  color: var(--p-cyan);
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.16em;
}

.home-head h1 {
  margin: 14px 0 0;
  color: var(--p-text-strong);
  font-family: var(--font-display);
  font-size: clamp(30px, 4.2vw, 44px);
  font-weight: 560;
  line-height: 1.16;
  letter-spacing: -0.035em;
}

.home-head p {
  margin: 14px 0 0;
  color: var(--p-muted);
  font-size: 14px;
  line-height: 1.85;
}

.home-head__meta {
  flex: none;
  color: var(--p-faint);
  font-size: 12.5px;
  white-space: nowrap;
}

.theme-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(310px, 1fr));
  gap: 20px;
  margin-top: 36px;
}

.skeleton-card {
  aspect-ratio: 4 / 3;
  border-radius: 16px;
}

@media (max-width: 760px) {
  .home-head {
    align-items: flex-start;
    flex-direction: column;
    gap: 16px;
  }

  .theme-grid {
    grid-template-columns: 1fr;
    margin-top: 28px;
  }
}

@media (max-width: 460px) {
  .home-head h1 {
    font-size: 30px;
  }
}
</style>
