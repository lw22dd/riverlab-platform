import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { fetchExperimentThemes } from '@/apis/experiment.api'
import type { ExperimentTheme } from '@/models/experiment.model'

export const useExperimentsStore = defineStore('experiments', () => {
  const themes = ref<ExperimentTheme[]>([])
  const loading = ref(false)
  const loaded = ref(false)
  const error = ref<string | null>(null)

  let inFlight: Promise<void> | null = null

  /**
   * 真正执行一次主题拉取，并维护 loading / error / loaded 三个视图状态。
   * 只由 `load` 调用，保证并发请求被合并。
   */
  async function run(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      themes.value = await fetchExperimentThemes()
      loaded.value = true
    } catch (caught) {
      error.value = caught instanceof Error ? caught.message : '实验主题加载失败'
    } finally {
      loading.value = false
    }
  }

  /**
   * 对外的唯一加载入口：复用进行中的请求，已加载过则直接返回，
   * 避免多个页面同时挂载时重复请求实验目录。
   */
  function load(force = false): Promise<void> {
    if (inFlight) return inFlight
    if (loaded.value && !force) return Promise.resolve()
    inFlight = run().finally(() => {
      inFlight = null
    })
    return inFlight
  }

  /** 供路由或组件在渲染前调用：未加载且不在加载中时才触发，不做重复请求。 */
  function ensureLoaded(): void {
    if (!loaded.value && !loading.value) void load()
  }

  /** 按主题 id 取详情页所需的数据，找不到时返回 undefined 交给视图展示缺失态。 */
  function getTheme(id: string): ExperimentTheme | undefined {
    return themes.value.find((theme) => theme.id === id)
  }

  const featuredTheme = computed(
    () => themes.value.find((theme) => theme.featured) ?? themes.value[0] ?? null,
  )

  const categories = computed(() =>
    Array.from(new Set(themes.value.map((theme) => theme.category))),
  )

  const variantCount = computed(() =>
    themes.value.reduce((total, theme) => total + theme.variants.length, 0),
  )

  const runningVariantCount = computed(() =>
    themes.value.reduce(
      (total, theme) =>
        total + theme.variants.filter((variant) => variant.status === 'ready').length,
      0,
    ),
  )

  return {
    themes,
    loading,
    loaded,
    error,
    featuredTheme,
    categories,
    variantCount,
    runningVariantCount,
    load,
    ensureLoaded,
    getTheme,
  }
})
