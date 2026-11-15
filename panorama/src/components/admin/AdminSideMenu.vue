<template>
  <div class="admin-side-menu">
    <t-menu
      v-model:value="activePath"
      theme="light"
      class="custom-side-menu"
      @change="handleMenuChange"
    >
      <template v-if="userStore.isAdmin">
        <t-menu-item value="/admin/users">
          <template #icon>
            <t-icon name="user" />
          </template>
          <span>用户管理</span>
        </t-menu-item>

        <t-menu-item value="/admin/batch-register">
          <template #icon>
            <t-icon name="upload" />
          </template>
          <span>批量注册</span>
        </t-menu-item>

        <t-menu-item value="/admin/spaces">
          <template #icon>
            <t-icon name="file" />
          </template>
          <span>空间管理</span>
        </t-menu-item>
      </template>

      <t-menu-item value="/admin/experiments">
        <template #icon>
          <t-icon name="chart" />
        </template>
        <span>实验数据</span>
      </t-menu-item>

      <t-menu-item v-if="userStore.isAdmin" value="/admin/logs">
        <template #icon>
          <t-icon name="history" />
        </template>
        <span>日志管理</span>
      </t-menu-item>
    </t-menu>
    
    <div class="menu-footer">
      <div class="version-tag">v1.0.0 Stable</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useUserStore } from '@/stores/user.store'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()
const activePath = ref(route.path)

watch(
  () => route.path,
  (newPath) => {
    activePath.value = newPath
  }
)

const handleMenuChange = (value: string) => {
  router.push(value)
}
</script>

<style scoped>
.admin-side-menu {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: var(--rl-surface);
  padding: 12px 0;
}

.custom-side-menu {
  flex: 1;
  border-right: none;
}

:deep(.t-menu) {
  width: 100% !important;
}

:deep(.t-menu__item) {
  height: 48px;
  line-height: 48px;
  margin: 4px 12px;
  border-radius: 10px;
  width: auto !important;
  transition: all 0.25s cubic-bezier(0.34, 0.69, 0.1, 1);
  color: var(--rl-body);
}

:deep(.t-menu__item:hover) {
  background-color: var(--rl-bg-alt);
  color: var(--rl-ink);
}

:deep(.t-menu__item.t-is-active) {
  background: linear-gradient(135deg, rgba(15, 110, 132, 0.12), rgba(15, 110, 132, 0.05));
  color: var(--rl-primary);
  font-weight: 600;
}

:deep(.t-menu__item.t-is-active::after) {
  display: none;
}

:deep(.t-menu__item .t-icon) {
  font-size: 18px;
  margin-right: 8px;
  transition: transform 0.3s;
}

:deep(.t-menu__item:hover .t-icon) {
  transform: scale(1.1);
}

.menu-footer {
  padding: 16px 24px;
  border-top: 1px solid var(--rl-border);
  display: flex;
  justify-content: center;
}

.version-tag {
  font-size: 12px;
  color: var(--rl-faint);
  font-family: 'JetBrains Mono', monospace;
}
</style>
