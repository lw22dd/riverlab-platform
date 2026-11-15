<template>
  <div class="pano-topbar">
    <div class="pano-topbar-left">
      <t-button theme="default" variant="outline" @click="$emit('back')" class="back-btn">
        ← 返回
      </t-button>
      <span class="pano-title">{{ title }}</span>
    </div>
    <div class="pano-topbar-right">
      <t-button
        v-if="isAdmin"
        :theme="editMode ? 'primary' : 'default'"
        variant="outline"
        @click="$emit('update:editMode', !editMode)"
        class="action-btn"
      >
        {{ editMode ? '退出编辑' : '编辑热点' }}
      </t-button>
      <t-button theme="default" variant="outline" @click="$emit('minimap')" class="action-btn">
        小地图
      </t-button>
      <t-button theme="default" variant="outline" @click="$emit('fullscreen')" class="action-btn">
        ⛶ 全屏
      </t-button>
    </div>
    <div v-if="editMode" class="edit-hint-bar">
      编辑模式：点击空白处添加热点，点击热点进行编辑
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title: string
  isAdmin: boolean
  editMode: boolean
}>()

defineEmits<{
  (e: 'back'): void
  (e: 'minimap'): void
  (e: 'fullscreen'): void
  (e: 'update:editMode', value: boolean): void
}>()
</script>

<style scoped>
.pano-topbar {
  position: absolute;
  top: 16px;
  left: 16px;
  right: 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid var(--rl-border);
  border-radius: 12px;
  box-shadow: var(--rl-sh-md);
  backdrop-filter: blur(14px);
  z-index: 100;
}

.pano-topbar-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.pano-topbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.pano-title {
  color: var(--rl-ink);
  font-size: 17px;
  font-weight: 600;
}

.back-btn,
.action-btn {
  background: var(--rl-surface) !important;
  border: 1px solid var(--rl-border-strong) !important;
  color: var(--rl-body) !important;
}

.back-btn:hover,
.action-btn:hover {
  background: var(--rl-primary-soft) !important;
  border-color: var(--rl-primary) !important;
  color: var(--rl-primary) !important;
}

.edit-hint-bar {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  right: 0;
  padding: 6px 16px;
  border-radius: 8px;
  background: var(--rl-warning-soft);
  border: 1px solid rgba(217, 154, 43, 0.28);
  color: var(--rl-warning);
  font-size: 12.5px;
  text-align: center;
  backdrop-filter: blur(10px);
}
</style>