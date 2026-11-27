<template>
  <div class="china-map-container">
    <div ref="mapContainer" class="map-wrapper" v-loading="loading"></div>
    <div class="search-box">
      <t-input v-model="searchKeyword" placeholder="搜索景点或区域..." @enter="handleSearch" @change="handleSearchChange"
        clearable>
        <template #prefix-icon>
          <SearchIcon />
        </template>
      </t-input>

      <div v-if="showSearchResults" class="search-results">
        <div v-if="searchHistory.length > 0 && !searchKeyword.trim()" class="search-history">
          <div class="search-history-header">
            <span class="search-history-title">搜索历史</span>
            <button class="search-history-clear" @click="clearSearchHistory">清除</button>
          </div>
          <div class="search-history-tags">
            <span v-for="(term, index) in searchHistory.slice(0, 8)" :key="index" class="search-history-tag"
              @click="onHistoryTagClick(term)">
              {{ term }}
            </span>
          </div>
        </div>

        <div v-else-if="searchKeyword.trim() && searchResults.length === 0" class="search-empty">
          未找到「{{ searchKeyword }}」相关结果
        </div>

        <div v-else-if="searchResults.length > 0" class="search-result-list">
          <div v-for="result in searchResults" :key="result.id" class="search-result-item"
            @click="handleResultClick(result)">
            <span class="result-name">
              <template v-if="result.type === 'space'">🏛</template>
              <template v-else>🎥</template>
              {{ result.name }}
            </span>
            <span class="result-location">{{ result.location }}</span>
          </div>
        </div>
      </div>



      <div class="view-toggle">
        <t-button :variant="viewMode === 'map' ? 'base' : 'outline'" size="small"
          @click="$emit('viewModeChange', 'map')">
          🗺️
        </t-button>
        <t-button :variant="viewMode === 'card' ? 'base' : 'outline'" size="small"
          @click="$emit('viewModeChange', 'card')">
          📋
        </t-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { SearchIcon } from 'tdesign-icons-vue-next'
import * as echarts from 'echarts'
import { getChinaGeoJSON } from '@/apis/geo.api'
import SpaceApi from '@/apis/space.api'
import type { SpaceListItem, SpaceWithScenes } from '@/models/space.model'

const props = defineProps<{
  viewMode?: 'map' | 'card'
}>()

const emit = defineEmits<{
  (e: 'spaceClick', space: SpaceWithScenes): void
  (e: 'viewModeChange', mode: 'map' | 'card'): void
}>()

const mapContainer = ref<HTMLElement | null>(null)
const searchKeyword = ref('')
const searchResults = ref<any[]>([])
const showSearchResults = ref(false)
const loading = ref(true)
const spaceList = ref<SpaceListItem[]>([])

const searchHistory = ref<string[]>([])

let chartInstance: echarts.ECharts | null = null
let resizeObserver: ResizeObserver | null = null

// 首页带 ?space=<slug> 进来时请求定位某个景区：地图与列表都是异步就绪的，
// 先记下目标，等 series 数据落图后再应用，避免"点了没反应"。
let pendingFocus: { id: number; zoom: number } | null = null

const applyPendingFocus = () => {
  if (!pendingFocus || !chartInstance) return
  const target = spaceList.value.find((space) => space.id === pendingFocus!.id)
  if (!target) return

  const { zoom } = pendingFocus
  pendingFocus = null

  chartInstance.setOption({
    geo: {
      center: [target.longitude, target.latitude],
      zoom,
    },
  })
  chartInstance.dispatchAction({
    type: 'highlight',
    seriesIndex: 0,
    name: target.name,
  })
}

const loadSearchHistory = () => {
  try {
    const history = localStorage.getItem('searchHistory')
    if (history) {
      searchHistory.value = JSON.parse(history)
    }
  } catch (e) {
    searchHistory.value = []
  }
}

const saveSearchHistory = (keyword: string) => {
  const newHistory = [keyword, ...searchHistory.value.filter(h => h !== keyword)].slice(0, 10)
  searchHistory.value = newHistory
  localStorage.setItem('searchHistory', JSON.stringify(newHistory))
}

const clearSearchHistory = () => {
  searchHistory.value = []
  localStorage.setItem('searchHistory', '[]')
}

const loadSpaceList = async () => {
  try {
    loading.value = true
    const result = await SpaceApi.getSpaceList({ page: 1, page_size: 100 })
    if (result.code === 200 && result.data) {
      console.log(result.data)
      spaceList.value = result.data.spaces
      updateMapData()
    }
  } catch (error) {
    console.error('Failed to load space list:', error)
  } finally {
    loading.value = false
  }
}

const initMap = async () => {
  if (!mapContainer.value) return

  try {
    const chinaGeoJSON = await getChinaGeoJSON()
    // GeoJSON 是异步拉取的，期间组件可能已卸载（快速切路由 / HMR），
    // 此时 ref 已为 null，直接返回，避免 echarts.init 抛 invalid dom。
    if (!mapContainer.value) return

    echarts.registerMap('china', chinaGeoJSON)

    chartInstance = echarts.init(mapContainer.value, 'light', {
      renderer: 'canvas'
    })

    const option: echarts.EChartsOption = {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        backgroundColor: 'rgba(255,255,255,0.96)',
        borderColor: '#e2e9ee',
        borderWidth: 1,
        padding: [12, 16],
        textStyle: {
          color: '#14242e',
          fontSize: 13,
          fontFamily: 'Noto Sans SC, sans-serif'
        },
        extraCssText: 'border:1px solid #e2e9ee;border-radius:10px;box-shadow:0 10px 30px rgba(20,36,46,0.1);',
        formatter: (params: any) => {
          if (params.seriesType === 'effectScatter') {
            const space = spaceList.value.find(s => s.name === params.name)
            if (space) {
              return `<b style="font-size:14px;">${params.name}</b><br/>
                      <span style="color:#6e8593;">📍 ${space.province} ${space.city}</span><br/>
                      <span style="color:#6e8593;">🎥 ${space.scene_count} 个景点</span>`
            }
          }
          return params.name
        }
      },
      geo: {
        map: 'china',
        roam: true,
        zoom: 1.2,
        center: [104.5, 36],
        scaleLimit: { min: 0.8, max: 6 },
        label: {
          show: true,
          color: '#7d97a4',
          fontSize: 10,
          fontFamily: 'Noto Sans SC, sans-serif'
        },
        itemStyle: {
          areaColor: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: '#e8f1f4' },
              { offset: 1, color: '#d8e6eb' }
            ]
          },
          borderColor: '#a7c0ca',
          borderWidth: 1,
          shadowColor: 'rgba(15,110,132,0.12)',
          shadowBlur: 18
        },
        emphasis: {
          itemStyle: {
            areaColor: '#cfe3e9',
            borderColor: '#0f6e84',
            borderWidth: 1.3,
            shadowColor: 'rgba(15,110,132,0.2)',
            shadowBlur: 20
          },
          label: { show: true, color: '#14242e', fontWeight: 500 }
        },
        select: { disabled: true }
      },
      series: [
        {
          name: '景区',
          type: 'effectScatter',
          coordinateSystem: 'geo',
          data: [],
          symbolSize: 16,
          showEffectOn: 'render',
          rippleEffect: { brushType: 'stroke', scale: 3.5, period: 4 },
          label: {
            show: true,
            position: 'top',
            formatter: '{b}',
            fontSize: 12,
            fontWeight: 500,
            fontFamily: 'Noto Sans SC, sans-serif',
            color: '#14242e',
            textBorderColor: 'rgba(255,255,255,0.9)',
            textBorderWidth: 2.5,
            distance: 10
          },
          itemStyle: {
            shadowBlur: 12,
            shadowColor: 'rgba(0,0,0,0.4)'
          },
          zlevel: 1
        }
      ]
    }

    chartInstance.setOption(option)

    chartInstance.on('click', (params: any) => {
      if (params.seriesType === 'effectScatter') {
        const space = spaceList.value.find(s => s.name === params.name)
        if (space) {
          SpaceApi.getSpaceDetail(space.id).then(detailResult => {
            if (detailResult.code === 200 && detailResult.data) {
              emit('spaceClick', {
                ...space,
                scenes: detailResult.data.scenes || []
              })
            } else {
              emit('spaceClick', space)
            }
          })
        }
      }
    })

    const handleResize = () => {
      chartInstance?.resize()
    }
    window.addEventListener('resize', handleResize)

    resizeObserver = new ResizeObserver(() => {
      chartInstance?.resize()
    })
    if (mapContainer.value) {
      resizeObserver.observe(mapContainer.value)
    }

    // 如果初始化时已经有数据了（例如 loadSpaceList 先完成了），主动触发一次更新
    if (spaceList.value.length > 0) {
      updateMapData()
    }

    // 深链定位请求可能比图表初始化更早到达，这里补一次应用
    applyPendingFocus()

  } catch (error) {
    console.error('Failed to load map:', error)
  }
}

const updateMapData = () => {
  if (!chartInstance) return

  const colors = ['#0F6E84', '#C4703A', '#4E9A8E', '#3E7FB8', '#2F9E68', '#D99A2B', '#6E8593', '#8A5A44']

  const scatterData = spaceList.value.map((space, index) => ({
    name: space.name,
    value: [space.longitude, space.latitude, space.scene_count || 1],
    itemStyle: { color: colors[index % colors.length] },
    space
  }))

  chartInstance.setOption({
    series: [{
      data: scatterData
    }]
  })

  applyPendingFocus()
}

const handleSearchChange = (value: string) => {
  if (!value.trim()) {
    searchResults.value = []
    showSearchResults.value = searchHistory.value.length > 0
    return
  }

  showSearchResults.value = true
  const keyword = value.toLowerCase()
  const results: any[] = []

  spaceList.value.forEach(space => {
    if (space.name.toLowerCase().includes(keyword) ||
      space.province.toLowerCase().includes(keyword) ||
      space.city.toLowerCase().includes(keyword)) {
      results.push({
        id: space.id,
        name: space.name,
        location: `${space.province} ${space.city} · ${space.scene_count}个景点`,
        type: 'space',
        data: space
      })
    }
  })

  searchResults.value = results.slice(0, 8)
}

const handleSearch = () => {
  if (searchResults.value.length > 0) {
    handleResultClick(searchResults.value[0])
  }
}

const handleResultClick = async (result: any) => {
  searchKeyword.value = result.name
  showSearchResults.value = false

  saveSearchHistory(result.name)

  if (result.type === 'space') {
    const detailResult = await SpaceApi.getSpaceDetail(result.id)
    if (detailResult.code === 200 && detailResult.data) {
      emit('spaceClick', {
        ...result.data,
        scenes: detailResult.data.scenes || []
      })
    } else {
      emit('spaceClick', result.data)
    }
  }
}

const onHistoryTagClick = (term: string) => {
  searchKeyword.value = term
  handleSearchChange(term)
}

watch(() => props.viewMode, () => {
  setTimeout(() => {
    chartInstance?.resize()
  }, 100)
})

onMounted(async () => {
  loadSearchHistory()
  await initMap()
  await loadSpaceList()
})

onUnmounted(() => {
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
  if (chartInstance) {
    chartInstance.dispose()
    chartInstance = null
  }
})

defineExpose({
  /** 在地图上定位某个景区（供首页 ?space=<slug> 深链使用）。 */
  focusSpace: (spaceId: number, zoom = 3.2) => {
    pendingFocus = { id: spaceId, zoom }
    applyPendingFocus()
  }
})
</script>

<style scoped>
.china-map-container {
  position: relative;
  width: 100%;
  height: 100%;
  background: transparent; /* 改为透明以显示父级动态背景 */
}

.map-wrapper {
  width: 100%;
  height: 100%;
}

.search-box {
  position: absolute;
  top: 30px;
  left: 30px;
  width: 380px;
  z-index: 100;
  filter: drop-shadow(0 8px 24px rgba(20, 36, 46, 0.08));
}

.search-results {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: rgba(255, 255, 255, 0.96);
  backdrop-filter: blur(16px);
  border: 1px solid var(--rl-border);
  border-radius: 12px;
  margin-top: 12px;
  max-height: 400px;
  overflow-y: auto;
  box-shadow: 0 12px 40px rgba(20, 36, 46, 0.12);
}

.search-history {
  padding: 16px;
}

.search-history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.search-history-title {
  font-size: 13px;
  color: var(--rl-muted);
}

.search-history-clear {
  background: none;
  border: none;
  color: var(--rl-primary);
  font-size: 12px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.2s;
}

.search-history-clear:hover {
  background: var(--rl-primary-soft);
}

.search-history-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.search-history-tag {
  display: inline-block;
  padding: 6px 12px;
  background: var(--rl-bg-alt);
  border: 1px solid var(--rl-border);
  border-radius: 16px;
  font-size: 13px;
  color: var(--rl-body);
  cursor: pointer;
  transition: all 0.2s;
}

.search-history-tag:hover {
  background: var(--rl-primary-soft);
  border-color: rgba(15, 110, 132, 0.2);
  color: var(--rl-primary);
}

.search-empty {
  padding: 24px;
  text-align: center;
  color: var(--rl-muted);
  font-size: 13px;
}

.search-result-list {
  padding: 8px 0;
}

.search-result-item {
  padding: 12px 16px;
  cursor: pointer;
  transition: all 0.2s;
  border-bottom: 1px solid var(--rl-border);
}

.search-result-item:last-child {
  border-bottom: none;
}

.search-result-item:hover {
  background: var(--rl-primary-soft);
}

.result-name {
  display: block;
  color: var(--rl-ink);
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 4px;
}

.result-location {
  display: block;
  color: var(--rl-muted);
  font-size: 12px;
}

.view-toggle {
  position: absolute;
  top: 0;
  right: -56px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

:deep(.t-input) {
  background: var(--rl-surface) !important;
  backdrop-filter: blur(8px) !important;
  border: 1px solid var(--rl-border-strong) !important;
  border-radius: 12px !important;
  padding: 8px 16px !important;
  transition: all 0.3s !important;
}

:deep(.t-input:hover) {
  border-color: rgba(15, 110, 132, 0.4) !important;
  background: var(--rl-surface) !important;
}

:deep(.t-input.t-is-focused) {
  border-color: var(--rl-primary) !important;
  box-shadow: 0 0 0 3px rgba(15, 110, 132, 0.12) !important;
}

:deep(.t-input__inner) {
  color: var(--rl-ink) !important;
  font-size: 14px !important;
}

:deep(.t-input__inner::placeholder) {
  color: var(--rl-faint) !important;
}

:deep(.t-button) {
  background: var(--rl-surface);
  backdrop-filter: blur(8px);
  border: 1px solid var(--rl-border-strong);
  width: 44px;
  height: 44px;
  border-radius: 12px;
}

:deep(.t-button.t-button--variant-base) {
  background: var(--rl-primary);
  border-color: var(--rl-primary);
  box-shadow: 0 4px 12px rgba(15, 110, 132, 0.2);
}
</style>
