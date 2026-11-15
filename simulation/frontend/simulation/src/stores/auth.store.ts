import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { AuthState, AuthUser } from '@/models/auth.model'
import { clearStoredAuth, readStoredAuth, writeStoredAuth } from '@/apis/http'

export const useAuthStore = defineStore('auth', () => {
  const isLogin = ref(false)
  const userInfo = ref<AuthUser>({})
  const accessToken = ref('')
  const refreshToken = ref('')

  function hydrate(): void {
    const state = readStoredAuth()
    isLogin.value = Boolean(state?.isLogin && state.accessToken)
    userInfo.value = state?.userInfo ?? {}
    accessToken.value = state?.accessToken ?? ''
    refreshToken.value = state?.refreshToken ?? ''
  }

  function persist(): void {
    const state: AuthState = {
      isLogin: isLogin.value,
      userInfo: userInfo.value,
      accessToken: accessToken.value,
      refreshToken: refreshToken.value,
    }
    writeStoredAuth(state)
  }

  function setSession(token: string, refresh: string, user: AuthUser): void {
    isLogin.value = true
    accessToken.value = token
    refreshToken.value = refresh
    userInfo.value = user
    persist()
  }

  function clear(): void {
    isLogin.value = false
    userInfo.value = {}
    accessToken.value = ''
    refreshToken.value = ''
    clearStoredAuth()
  }

  const displayName = computed(
    () => userInfo.value.nickname || userInfo.value.username || '已登录用户',
  )
  const isAdmin = computed(
    () => userInfo.value.is_super_admin === true || userInfo.value.role?.name === 'admin',
  )
  const isTeacher = computed(() => userInfo.value.role?.name === 'teacher')
  const canUseAdmin = computed(() => isAdmin.value || isTeacher.value)

  hydrate()

  return {
    isLogin,
    userInfo,
    accessToken,
    refreshToken,
    displayName,
    isAdmin,
    isTeacher,
    canUseAdmin,
    setSession,
    clear,
    hydrate,
  }
})
