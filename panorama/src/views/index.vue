<template>
  <div class="page-wrapper">
    <!-- 动态背景层 -->
    <div class="dynamic-background">
      <div class="bg-image" :style="{ backgroundImage: `url(${baseUrl}background.png)` }"></div>
      <div class="bg-overlay"></div>
      
      <!-- 星星闪烁层 -->
      <div class="stars-container">
        <div 
          v-for="star in stars" 
          :key="star.id" 
          class="star"
          :style="{
            left: star.left,
            top: star.top,
            width: star.size + 'px',
            height: star.size + 'px',
            animationDelay: star.delay + 's',
            animationDuration: star.duration + 's'
          }"
        ></div>
      </div>

      <div class="light-spots">
        <div class="light-spot spot-1"></div>
        <div class="light-spot spot-2"></div>
        <div class="light-spot spot-3"></div>
      </div>
    </div>

    <Header />
    <main class="main-content">
      <div class="map-section" v-show="viewMode === 'map'">
        <ChinaMap 
          ref="chinaMapRef" 
          :view-mode="viewMode"
          @space-click="handleSpaceClick"
          @view-mode-change="handleViewModeChange"
        />
      </div>
      
      <div class="card-section" v-show="viewMode === 'card'">
        <div class="card-view-header">
          <h2 class="card-view-title">全部景区</h2>
          <div class="card-view-toggle">
            <t-button 
              :variant="viewMode === 'map' ? 'base' : 'outline'" 
              size="small"
              @click="viewMode = 'map'"
            >
              🗺️ 地图
            </t-button>
            <t-button 
              :variant="viewMode === 'card' ? 'base' : 'outline'" 
              size="small"
              @click="viewMode = 'card'"
            >
              📋 卡片
            </t-button>
          </div>
        </div>
        
        <div class="card-view-grid" v-loading="loading">
          <div 
            v-for="space in spaceList" 
            :key="space.id" 
            class="space-card"
            @click="handleCardClick(space)"
          >
            <div class="space-card-cover">
              <img 
                v-if="space.slug" 
                :src="getCoverUrl(space.slug)" 
                :alt="space.name"
                @error="console.error('封面加载失败:', space.name, getCoverUrl(space.slug))"
              />
              <img 
                v-else-if="space.cover_url" 
                :src="space.cover_url" 
                :alt="space.name"
              />
              <div v-else class="space-card-cover-placeholder">
                <t-icon name="image" size="48" />
              </div>
              <div class="space-card-badge">{{ space.scene_count || 0 }} 个景点</div>
            </div>
            <div class="space-card-body">
              <h3 class="space-card-name">{{ space.name }}</h3>
              <p class="space-card-location">
                <t-icon name="location" />
                {{ space.province }} {{ space.city }}
              </p>
              <p class="space-card-desc">{{ space.description || '暂无描述' }}</p>
              <div class="space-card-footer">
                <span class="space-card-scenes">
                  <t-icon name="view-module" />
                  {{ space.scene_count || 0 }} 个场景
                </span>
                <span class="space-card-enter">进入漫游 →</span>
              </div>
            </div>
          </div>
        </div>
        
        <div v-if="!loading && spaceList.length === 0" class="card-empty">
          <t-icon name="map-location" size="64" />
          <p>暂无景区数据</p>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Header from '@/components/Header.vue'
import ChinaMap from '@/components/ChinaMap.vue'
import SpaceApi from '@/apis/space.api'
import type { SpaceListItem, SpaceWithScenes } from '@/models/space.model'
import { apiUrl } from '@/utils/apiBase'

const router = useRouter()
const route = useRoute()
const baseUrl = import.meta.env.BASE_URL
const chinaMapRef = ref<InstanceType<typeof ChinaMap> | null>(null)
const viewMode = ref<'map' | 'card'>('map')
const spaceList = ref<SpaceListItem[]>([])
const loading = ref(false)
const stars = ref<any[]>([])

const initStars = () => {
  const count = 150 // 增加星星数量
  const result = []
  for (let i = 0; i < count; i++) {
    result.push({
      id: i,
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 100}%`,
      size: Math.random() * 1.5 + 0.5, // 细小的星星
      delay: Math.random() * 5,
      duration: Math.random() * 3 + 10
    })
  }
  stars.value = result
}

const getCoverUrl = (slug: string) => {
  return apiUrl(`/res/covers/${slug}`)
}

const loadSpaceList = async () => {
  try {
    loading.value = true
    const result = await SpaceApi.getSpaceList({ page: 1, page_size: 100 })
    if (result.code === 200 && result.data) {
      console.log("全景景区列表:", result.data.spaces)
      // 打印每个空间的 slug 和生成的封面 URL
      result.data.spaces.forEach((space: any) => {
        console.log(`Space ${space.name}: slug=${space.slug}, coverUrl=${getCoverUrl(space.slug)}`)
      })
      spaceList.value = result.data.spaces

      const targetSlug = typeof route.query.space === 'string' ? route.query.space : ''
      if (targetSlug) {
        const target = spaceList.value.find((space) => space.slug === targetSlug)
        if (target) {
          router.replace({ name: 'spaceDetail', params: { id: target.id } })
        }
      }
    }
  } catch (error) {
    console.error('Failed to load space list:', error)
  } finally {
    loading.value = false
  }
}

const handleSpaceClick = (space: SpaceWithScenes) => {
  router.push({ name: 'spaceDetail', params: { id: space.id } })
}

const handleViewModeChange = (mode: 'map' | 'card') => {
  viewMode.value = mode
}

const handleCardClick = async (space: SpaceListItem) => {
  router.push({ name: 'spaceDetail', params: { id: space.id } })
}

onMounted(() => {
  initStars()
  loadSpaceList()
})
</script>

<style scoped>
.page-wrapper {
  position: relative;
  height: 100vh;
  background: var(--rl-bg);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* 动态背景样式 */
.dynamic-background {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 0;
  overflow: hidden;
}

.bg-image {
  position: absolute;
  top: -10%;
  left: -10%;
  width: 120%;
  height: 120%;
  background-size: cover;
  background-position: center;
  filter: brightness(1.08) saturate(0.7) blur(2px);
  opacity: 0.08;
  animation: bg-pan 60s linear infinite alternate;
}

.bg-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: radial-gradient(circle at center, rgba(244, 247, 249, 0.2) 0%, rgba(244, 247, 249, 0.86) 100%),
              linear-gradient(to bottom, rgba(244, 247, 249, 0.45) 0%, rgba(237, 242, 245, 0.92) 100%);
}

/* 星星样式 */
.stars-container {
  display: none;
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.star {
  position: absolute;
  background: var(--rl-primary);
  border-radius: 50%;
  box-shadow: 0 0 6px rgba(15, 110, 132, 0.24);
  opacity: 0;
  animation: twinkle linear infinite;
}

@keyframes twinkle {
  0% { opacity: 0; transform: scale(0.5); }
  50% { opacity: 0.8; transform: scale(1.2); }
  100% { opacity: 0; transform: scale(0.5); }
}

.light-spots {
  display: none;
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
}

.light-spot {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.16;
  mix-blend-mode: multiply;
  animation: float 20s ease-in-out infinite alternate;
}

.spot-1 {
  width: 400px;
  height: 400px;
  background: rgba(15, 110, 132, 0.28);
  top: 10%;
  left: 10%;
  animation-delay: 0s;
}

.spot-2 {
  width: 500px;
  height: 500px;
  background: rgba(196, 112, 58, 0.16);
  bottom: 10%;
  right: 10%;
  animation-delay: -5s;
}

.spot-3 {
  width: 300px;
  height: 300px;
  background: rgba(78, 154, 142, 0.14);
  top: 40%;
  right: 20%;
  animation-delay: -10s;
}

@keyframes bg-pan {
  from { transform: scale(1) translate(0, 0); }
  to { transform: scale(1.1) translate(-2%, -2%); }
}

@keyframes float {
  0% { transform: translate(0, 0) scale(1); }
  50% { transform: translate(5%, 5%) scale(1.1); }
  100% { transform: translate(-5%, 2%) scale(0.9); }
}

.main-content {
  position: relative;
  width: 100%;
  flex: 1;
  display: flex;
  overflow: hidden;
  z-index: 1; /* 确保在背景之上 */
}

.map-section {
  position: relative;
  flex: 1;
  height: 100%;
  min-width: 0;
}

.card-section {
  flex: 1;
  height: 100%;
  overflow-y: auto;
  background: rgba(255, 255, 255, 0.78);
  backdrop-filter: blur(10px);
  border-left: 1px solid var(--rl-border);
  padding: 24px;
}

.card-view-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  padding: 0 8px;
}

.card-view-title {
  font-size: 24px;
  font-weight: 600;
  color: var(--rl-ink);
  margin: 0;
}

.card-view-toggle {
  display: flex;
  gap: 8px;
}

.card-view-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 24px;
}

.space-card {
  background: var(--rl-surface);
  border: 1px solid var(--rl-border);
  border-radius: var(--rl-r-md);
  overflow: hidden;
  cursor: pointer;
  box-shadow: var(--rl-sh-sm);
  transition: all 0.35s cubic-bezier(0.165, 0.84, 0.44, 1);
}

.space-card:hover {
  transform: translateY(-4px);
  background: var(--rl-surface);
  box-shadow: var(--rl-sh-md);
  border-color: var(--rl-border-strong);
}

.space-card-cover {
  position: relative;
  height: 180px;
  overflow: hidden;
}

.space-card-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.5s ease;
}

.space-card:hover .space-card-cover img {
  transform: scale(1.1);
}

.space-card-cover-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--rl-bg-alt) 0%, var(--rl-surface-2) 100%);
  color: var(--rl-faint);
}

.space-card-badge {
  position: absolute;
  top: 12px;
  right: 12px;
  padding: 6px 12px;
  background: rgba(15, 110, 132, 0.92);
  backdrop-filter: blur(4px);
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
  color: #fff;
  box-shadow: 0 4px 12px rgba(15, 110, 132, 0.24);
}

.space-card-body {
  padding: 20px;
}

.space-card-name {
  font-size: 18px;
  font-weight: 600;
  color: var(--rl-ink);
  margin: 0 0 8px;
}

.space-card-location {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--rl-muted);
  margin: 0 0 12px;
}

.space-card-desc {
  font-size: 14px;
  color: var(--rl-body);
  line-height: 1.6;
  margin: 0 0 16px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.space-card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 16px;
  border-top: 1px solid var(--rl-border);
}

.space-card-scenes {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--rl-muted);
}

.space-card-enter {
  font-size: 13px;
  color: var(--rl-primary);
  font-weight: 600;
  transition: all 0.3s;
}

.space-card:hover .space-card-enter {
  color: var(--rl-primary-hover);
  transform: translateX(4px);
}

.card-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
  color: var(--rl-muted);
}

.card-empty p {
  margin-top: 16px;
  font-size: 16px;
}

:deep(.t-button) {
  background: var(--rl-surface);
  border: 1px solid var(--rl-border-strong);
  color: var(--rl-body);
}

:deep(.t-button:hover) {
  background: var(--rl-bg-alt);
  border-color: var(--rl-primary);
  color: var(--rl-ink);
}

:deep(.t-button.t-button--variant-base) {
  background: var(--rl-primary);
  border-color: var(--rl-primary);
  color: #fff;
  box-shadow: 0 4px 12px rgba(15, 110, 132, 0.2);
}

:deep(.t-loading) {
  color: var(--rl-primary);
}
</style>
