<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ApiError, http } from '@/apis/http'
import { useAuthStore } from '@/stores/auth.store'
import { sessionService } from '@/services/session.service'
import type { AuthUser } from '@/models/auth.model'

interface LoginData {
  access_token: string
  refresh_token: string
  token_type: string
  user: AuthUser
}

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const username = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')

const canSubmit = computed(() => username.value.trim().length > 0 && password.value.length > 0)

function safeRedirect(value: unknown): string {
  if (typeof value !== 'string') return '/'
  if (!value.startsWith('/') || value.startsWith('//')) return '/'
  if (value.startsWith('/login')) return '/'
  return value
}

async function submit(): Promise<void> {
  if (!canSubmit.value || loading.value) return
  loading.value = true
  error.value = ''

  try {
    const data = await http.post<LoginData>(
      '/auth/login',
      { username: username.value.trim(), password: password.value },
      { auth: false, refresh: false },
    )
    auth.setSession(data.access_token, data.refresh_token, data.user)
    void sessionService.flushPending()

    const redirect = safeRedirect(route.query.redirect)
    if (redirect === '/panorama' || redirect.startsWith('/panorama/')) {
      window.location.assign(redirect)
      return
    }
    await router.replace(redirect)
  } catch (caught) {
    error.value =
      caught instanceof ApiError ? caught.message : caught instanceof Error ? caught.message : '登录失败'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <main class="login-page">
    <div class="login-atmosphere" aria-hidden="true">
      <span class="login-orbit login-orbit--one"></span>
      <span class="login-orbit login-orbit--two"></span>
    </div>

    <section class="login-brand">
      <div class="login-brand__mark" aria-hidden="true">
        <svg viewBox="0 0 44 44" fill="none">
          <path d="M22 3.5 38 12.5v19L22 40.5 6 31.5v-19L22 3.5Z" stroke="currentColor" stroke-width="1.2" />
          <path d="M15.5 27.5 28.5 16.5" stroke="currentColor" stroke-width="1.3" />
          <circle cx="15.5" cy="16.5" r="2.4" fill="currentColor" />
          <circle cx="28.5" cy="27.5" r="2.4" fill="currentColor" />
        </svg>
      </div>
      <p class="login-brand__eyebrow">MORAL / LAB</p>
      <h1>伦理仿真<br />实验平台</h1>
      <p class="login-brand__sub">
        把伦理问题放进可执行的场景里：选择、后果、评分与复盘，都留在同一条推演路径上。
      </p>
      <div class="login-brand__tags">
        <span>3D 仿真</span>
        <span>都江堰全景</span>
        <span>学习记录</span>
      </div>
    </section>

    <section class="login-panel">
      <div class="login-panel__head">
        <p class="login-panel__eyebrow">平台统一入口</p>
        <h2>登录你的账户</h2>
        <p class="login-panel__hint">仿真实验与全景漫游共用同一套账号体系。</p>
      </div>

      <form class="login-form" @submit.prevent="submit">
        <label class="login-field">
          <span>用户名 / 学号</span>
          <input
            v-model="username"
            type="text"
            autocomplete="username"
            placeholder="请输入用户名或学号"
            :disabled="loading"
          />
        </label>

        <label class="login-field">
          <span>密码</span>
          <input
            v-model="password"
            type="password"
            autocomplete="current-password"
            placeholder="请输入密码"
            :disabled="loading"
          />
        </label>

        <p v-if="error" class="login-error" role="alert">{{ error }}</p>

        <button class="login-submit" type="submit" :disabled="!canSubmit || loading">
          {{ loading ? '登录中…' : '进入平台' }}
        </button>
      </form>

      <p class="login-panel__foot">账号由课程管理员统一创建；忘记密码请联系任课教师。</p>
    </section>
  </main>
</template>

<style scoped>
.login-page {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(360px, 480px);
  gap: clamp(40px, 7vw, 110px);
  align-items: center;
  min-height: 100svh;
  padding: clamp(32px, 6vw, 88px);
  overflow: hidden;
  background:
    radial-gradient(900px 620px at 78% -10%, rgba(15, 110, 132, 0.1), transparent 64%),
    radial-gradient(720px 520px at 8% 92%, rgba(196, 112, 58, 0.07), transparent 70%),
    linear-gradient(145deg, #f7fafb 0%, var(--rl-bg) 52%, var(--rl-bg-alt) 100%);
  color: var(--p-text);
}

.login-atmosphere {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image:
    linear-gradient(rgba(20, 36, 46, 0.028) 1px, transparent 1px),
    linear-gradient(90deg, rgba(20, 36, 46, 0.028) 1px, transparent 1px);
  background-size: 84px 84px;
  mask-image: radial-gradient(ellipse 90% 72% at 50% 0%, black 8%, transparent 86%);
}

.login-orbit {
  position: absolute;
  border: 1px solid rgba(15, 110, 132, 0.12);
  border-radius: 50%;
}

.login-orbit--one {
  width: 520px;
  height: 520px;
  right: -120px;
  top: -180px;
}

.login-orbit--two {
  width: 760px;
  height: 760px;
  right: -240px;
  top: -300px;
  border-color: rgba(15, 110, 132, 0.07);
}

.login-brand,
.login-panel {
  position: relative;
  z-index: 1;
}

.login-brand__mark {
  width: 44px;
  height: 44px;
  color: var(--p-cyan);
}

.login-brand__mark svg {
  width: 100%;
  height: 100%;
}

.login-brand__eyebrow,
.login-panel__eyebrow {
  margin: 26px 0 0;
  color: var(--p-cyan);
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.18em;
}

.login-brand h1 {
  margin: 14px 0 0;
  color: var(--p-text-strong);
  font-family: var(--font-display);
  font-size: clamp(42px, 6vw, 76px);
  font-weight: 560;
  line-height: 1.06;
  letter-spacing: -0.05em;
}

.login-brand__sub {
  max-width: 520px;
  margin: 24px 0 0;
  color: var(--p-muted);
  font-size: 15px;
  line-height: 1.85;
}

.login-brand__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 30px;
}

.login-brand__tags span {
  padding: 7px 12px;
  border: 1px solid var(--p-line);
  border-radius: 999px;
  background: var(--p-surface);
  color: var(--p-muted);
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.06em;
}

.login-panel {
  padding: clamp(28px, 4vw, 44px);
  border: 1px solid var(--p-line);
  border-radius: var(--p-radius-xl);
  background: var(--p-surface);
  box-shadow: var(--p-shadow);
}

.login-panel h2 {
  margin: 10px 0 0;
  color: var(--p-text-strong);
  font-size: clamp(24px, 3vw, 32px);
  font-weight: 560;
  letter-spacing: -0.03em;
}

.login-panel__hint {
  margin: 10px 0 0;
  color: var(--p-faint);
  font-size: 13px;
}

.login-form {
  display: grid;
  gap: 18px;
  margin-top: 30px;
}

.login-field {
  display: grid;
  gap: 8px;
}

.login-field span {
  color: var(--p-muted);
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.1em;
}

.login-field input {
  width: 100%;
  padding: 13px 15px;
  border: 1px solid var(--p-line-strong);
  border-radius: 10px;
  outline: none;
  background: var(--rl-surface);
  color: var(--p-text-strong);
  font-size: 14px;
  transition:
    border-color 160ms ease,
    box-shadow 160ms ease;
}

.login-field input::placeholder {
  color: var(--p-faint);
}

.login-field input:focus {
  border-color: var(--p-cyan);
  box-shadow: 0 0 0 3px rgba(15, 110, 132, 0.1);
}

.login-field input:disabled {
  opacity: 0.6;
}

.login-error {
  margin: 0;
  padding: 10px 12px;
  border: 1px solid rgba(195, 76, 60, 0.24);
  border-radius: 10px;
  background: var(--rl-danger-soft);
  color: var(--rl-danger);
  font-size: 13px;
}

.login-submit {
  margin-top: 4px;
  padding: 13px 18px;
  border: 1px solid var(--p-cyan);
  border-radius: 10px;
  background: var(--p-cyan);
  color: #ffffff;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.08em;
  cursor: pointer;
  box-shadow: 0 10px 24px rgba(15, 110, 132, 0.2);
  transition:
    transform 160ms ease,
    border-color 160ms ease,
    background 160ms ease,
    box-shadow 160ms ease;
}

.login-submit:hover:not(:disabled) {
  border-color: var(--rl-primary-hover);
  background: var(--rl-primary-hover);
  transform: translateY(-1px);
  box-shadow: 0 14px 30px rgba(15, 110, 132, 0.24);
}

.login-submit:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.login-panel__foot {
  margin: 22px 0 0;
  color: var(--p-faint);
  font-size: 12px;
  line-height: 1.7;
}

@media (max-width: 900px) {
  .login-page {
    grid-template-columns: 1fr;
    align-content: center;
    gap: 36px;
  }

  .login-brand__sub {
    max-width: none;
  }
}
</style>
