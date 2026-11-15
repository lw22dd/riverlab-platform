import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

const PREFERENCE_KEY = 'moral-lab.preferences.v1'

interface StoredPreferences {
  reducedMotion?: boolean
  cinematicCamera?: boolean
}

/** 从 localStorage 读取上次保存的偏好；这里是全局设置状态。 */
function readPreferences(): StoredPreferences {
  try {
    const raw = window.localStorage.getItem(PREFERENCE_KEY)
    return raw ? (JSON.parse(raw) as StoredPreferences) : {}
  } catch {
    return {}
  }
}

/** 读取系统级的「减少动态效果」设置，作为首次访问时的默认值。 */
function systemPrefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

export const usePreferencesStore = defineStore('preferences', () => {
  const stored = typeof window !== 'undefined' ? readPreferences() : {}

  const reducedMotion = ref(stored.reducedMotion ?? systemPrefersReducedMotion())
  const cinematicCamera = ref(stored.cinematicCamera ?? !systemPrefersReducedMotion())

  /**
   * 把「减少动效」偏好同步到根元素的 class，
   * 让 CSS 侧的过渡与动画统一降级，而不需要每个组件各写一遍判断。
   */
  function applyMotionMode(): void {
    if (typeof document === 'undefined') return
    document.documentElement.classList.toggle('reduce-motion', reducedMotion.value)
  }

  /** 将当前偏好整体写回 localStorage；失败时静默忽略，不影响推演。 */
  function persist(): void {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(
        PREFERENCE_KEY,
        JSON.stringify({
          reducedMotion: reducedMotion.value,
          cinematicCamera: cinematicCamera.value,
        } satisfies StoredPreferences),
      )
    } catch {
      // 偏好设置并非关键数据，写入失败可以忽略。
    }
  }

  /** 切换「减少动效」并立即生效，供设置面板与快捷键共用。 */
  function toggleReducedMotion(): void {
    reducedMotion.value = !reducedMotion.value
    applyMotionMode()
  }

  applyMotionMode()
  // 任一偏好变化都自动写回 localStorage。
  watch([reducedMotion, cinematicCamera], persist)

  return {
    reducedMotion,
    cinematicCamera,
    toggleReducedMotion,
    applyMotionMode,
  }
})
