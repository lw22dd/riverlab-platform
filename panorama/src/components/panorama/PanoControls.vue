<template>
  <div class="pano-controls">
    <t-button theme="default" variant="outline" size="small" @click="$emit('reset')" title="重置视角">
      ⟲
    </t-button>
    <t-button
      :theme="autoRotate ? 'primary' : 'default'"
      variant="outline"
      size="small"
      @click="$emit('toggleRotate')"
      title="自动旋转"
    >
      ↻
    </t-button>
    <t-button theme="default" variant="outline" size="small" @click="$emit('zoomIn')" title="放大">
      +
    </t-button>
    <t-button theme="default" variant="outline" size="small" @click="$emit('zoomOut')" title="缩小">
      −
    </t-button>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  autoRotate: boolean
}>()

defineEmits<{
  (e: 'reset'): void
  (e: 'toggleRotate'): void
  (e: 'zoomIn'): void
  (e: 'zoomOut'): void
}>()
</script>

<style scoped>
.pano-controls {
  position: absolute;
  right: 24px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: 100;
}

.pano-controls :deep(.t-button) {
  width: 40px;
  height: 40px;
  padding: 0;
  background: rgba(255, 255, 255, 0.92) !important;
  border: 1px solid var(--rl-border-strong) !important;
  color: var(--rl-body) !important;
  backdrop-filter: blur(10px);
  box-shadow: var(--rl-sh-sm);
  font-size: 18px;
}

.pano-controls :deep(.t-button:hover) {
  background: var(--rl-primary-soft) !important;
  border-color: var(--rl-primary) !important;
  color: var(--rl-primary) !important;
}

.pano-controls :deep(.t-button.t-button--theme-primary) {
  background: var(--rl-primary) !important;
  border-color: var(--rl-primary) !important;
  color: #fff !important;
}
</style>