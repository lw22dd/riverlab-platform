<script setup lang="ts">
import type { ExperimentTheme } from '@/models/experiment.model'
import ThemeArtwork from './ThemeArtwork.vue'

withDefaults(
  defineProps<{
    theme: ExperimentTheme
    eager?: boolean
  }>(),
  { eager: false },
)
</script>

<template>
  <div class="theme-cover">
    <img
      v-if="theme.cover"
      :src="theme.cover"
      :alt="`${theme.title}主题封面`"
      class="theme-cover__image"
      :loading="eager ? 'eager' : 'lazy'"
      decoding="async"
    />
    <ThemeArtwork
      v-else
      :kind="theme.artwork"
      :accent="theme.accent"
      :accent-rgb="theme.accentRgb"
    />
    <span class="theme-cover__shade" aria-hidden="true"></span>
  </div>
</template>

<style scoped>
.theme-cover {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: var(--rl-bg-alt);
}

.theme-cover__image {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
}

.theme-cover__shade {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    linear-gradient(180deg, rgba(244, 247, 249, 0.16), transparent 30%, transparent 72%, rgba(244, 247, 249, 0.2)),
    radial-gradient(90% 80% at 50% 45%, transparent 58%, rgba(244, 247, 249, 0.16));
}
</style>
