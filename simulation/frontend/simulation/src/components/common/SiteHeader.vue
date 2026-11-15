<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { usePreferencesStore } from '@/stores/preferences.store'
import { useAuthStore } from '@/stores/auth.store'
import { http } from '@/apis/http'
import Icon from './Icon.vue'

const route = useRoute()
const router = useRouter()
const preferences = usePreferencesStore()
const auth = useAuthStore()

const onThemes = computed(() => route.name === 'home' || route.name === 'theme')
const initial = computed(() => auth.displayName.charAt(0).toUpperCase())

function openPanorama(path: string): void {
  window.location.assign(path)
}

async function logout(): Promise<void> {
  try {
    await http.post('/user/logout')
  } catch {
    // 令牌可能已过期，本地清理仍然继续。
  }
  auth.clear()
  await router.replace('/login')
}
</script>

<template>
  <header class="site-header">
    <div class="site-header__inner">
      <RouterLink to="/" class="brand" aria-label="伦理仿真实验平台首页">
        <span class="brand__mark" aria-hidden="true">
          <svg viewBox="0 0 44 44" fill="none">
            <path d="M22 3.5 38 12.5v19L22 40.5 6 31.5v-19L22 3.5Z" stroke="currentColor" stroke-width="1.2" />
            <path d="M15.5 27.5 28.5 16.5" stroke="currentColor" stroke-width="1.3" />
            <circle cx="15.5" cy="16.5" r="2.4" fill="currentColor" />
            <circle cx="28.5" cy="27.5" r="2.4" fill="currentColor" />
          </svg>
        </span>
        <span class="brand__text">
          <span class="brand__name">MORAL <i>/</i> LAB</span>
          <span class="brand__sub">伦理仿真实验平台</span>
        </span>
      </RouterLink>

      <nav class="site-nav" aria-label="主导航">
        <RouterLink to="/" class="site-nav__link" :class="{ 'is-active': onThemes }">
          实验主题
        </RouterLink>
        <button
          type="button"
          class="motion-toggle"
          :aria-pressed="preferences.reducedMotion"
          :aria-label="preferences.reducedMotion ? '开启界面动效' : '关闭界面动效'"
          :title="preferences.reducedMotion ? '开启界面动效' : '关闭界面动效'"
          @click="preferences.toggleReducedMotion()"
        >
          <Icon :name="preferences.reducedMotion ? 'pause' : 'spark'" :size="14" />
        </button>

        <div class="header-user">
          <span class="header-user__avatar" aria-hidden="true">{{ initial }}</span>
          <span class="header-user__name">{{ auth.displayName }}</span>
          <button type="button" class="header-user__link" @click="openPanorama('/panorama/user/experiments')">
            实验记录
          </button>
          <button type="button" class="header-user__link" @click="openPanorama('/panorama/user/center')">
            个人中心
          </button>
          <button
            v-if="auth.canUseAdmin"
            type="button"
            class="header-user__link"
            @click="openPanorama('/panorama/admin')"
          >
            平台后台
          </button>
          <button type="button" class="header-user__link is-danger" @click="logout">退出</button>
        </div>
      </nav>
    </div>
  </header>
</template>

<style scoped>
.site-header {
  position: sticky;
  top: 0;
  z-index: 50;
  border-bottom: 1px solid var(--p-line);
  background: rgba(255, 255, 255, 0.86);
  backdrop-filter: blur(18px) saturate(140%);
}

.site-header__inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  width: 100%;
  max-width: var(--p-container);
  height: 68px;
  margin: 0 auto;
  padding-inline: clamp(20px, 4.6vw, 56px);
}

.brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  flex: none;
  color: var(--p-text-strong);
  text-decoration: none;
}

.brand__mark {
  width: 32px;
  height: 32px;
  color: var(--p-cyan);
}

.brand__mark svg {
  width: 100%;
  height: 100%;
}

.brand__text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  line-height: 1;
}

.brand__name {
  font-family: var(--font-display);
  font-size: 14px;
  font-weight: 650;
  letter-spacing: 0.16em;
}

.brand__name i {
  margin: 0 1px;
  color: var(--p-cyan);
  font-style: normal;
}

.brand__sub {
  font-size: 10px;
  letter-spacing: 0.18em;
  color: var(--p-faint);
}

.site-nav {
  display: flex;
  align-items: center;
  gap: 10px;
}

.site-nav__link {
  padding: 8px 13px;
  border-radius: 999px;
  color: var(--p-muted);
  font-size: 13.5px;
  text-decoration: none;
  transition:
    color 180ms ease,
    background 180ms ease;
}

.site-nav__link:hover {
  color: var(--p-text-strong);
  background: var(--rl-primary-soft);
}

.site-nav__link.is-active {
  color: var(--p-cyan);
  background: var(--rl-primary-soft);
}

.header-user {
  display: flex;
  align-items: center;
  gap: 9px;
  margin-left: 4px;
  padding-left: 12px;
  border-left: 1px solid var(--p-line);
}

.header-user__avatar {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border: 1px solid var(--p-line-strong);
  border-radius: 50%;
  color: var(--p-cyan);
  font-family: var(--font-mono);
  font-size: 11px;
}

.header-user__name {
  max-width: 120px;
  overflow: hidden;
  color: var(--p-muted);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.header-user__link {
  padding: 5px 8px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--p-faint);
  font-size: 12px;
  cursor: pointer;
  transition:
    color 160ms ease,
    background 160ms ease;
}

.header-user__link:hover {
  color: var(--p-text-strong);
  background: var(--rl-primary-soft);
}

.header-user__link.is-danger:hover {
  color: var(--rl-danger);
  background: var(--rl-danger-soft);
}

.motion-toggle {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  padding: 0;
  border: 1px solid var(--p-line);
  border-radius: 50%;
  background: transparent;
  color: var(--p-faint);
  cursor: pointer;
  transition:
    color 180ms ease,
    border-color 180ms ease;
}

.motion-toggle:hover {
  border-color: var(--p-line-strong);
  color: var(--p-text-strong);
}

@media (max-width: 560px) {
  .site-header__inner {
    height: 60px;
  }

  .brand__sub {
    display: none;
  }

  .brand__name {
    font-size: 12px;
  }
}
</style>
