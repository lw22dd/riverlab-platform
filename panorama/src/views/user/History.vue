<template>
  <div class="history-page">
    <Header />
    
    <div class="page-container">
      <div class="page-header">
        <h1 class="page-title">浏览历史</h1>
        <div class="page-actions">
          <span class="page-stats">共 {{ totalHistoryCount }} 条记录</span>
          <t-button theme="danger" variant="outline" @click="clearAllHistory">
            清除全部
          </t-button>
        </div>
      </div>

      <div class="history-list" v-if="groupedHistory.length > 0">
        <div v-for="group in groupedHistory" :key="group.date" class="history-group">
          <div class="group-header">
            <span class="group-date">{{ group.dateLabel }}</span>
            <span class="group-count">{{ group.items.length }} 条记录</span>
          </div>
          
          <div class="group-items">
            <div 
              v-for="item in group.items" 
              :key="item.id" 
              class="history-item"
              @click="handleItemClick(item)"
            >
              <div class="item-thumb">
                <img v-if="item.thumbnail_url" :src="item.thumbnail_url" :alt="item.name" />
                <div v-else class="item-thumb-placeholder">
                  <t-icon name="image" />
                </div>
              </div>
              <div class="item-info">
                <div class="item-name">{{ item.name }}</div>
                <div class="item-meta">
                  <span class="item-type">{{ item.type === 'space' ? '景区' : '景点' }}</span>
                  <span class="item-location" v-if="item.province">
                    <t-icon name="location" />
                    {{ item.province }} {{ item.city }}
                  </span>
                </div>
              </div>
              <div class="item-time">{{ formatTime(item.visitedAt) }}</div>
              <button class="item-remove" @click.stop="removeHistoryItem(item)">
                <t-icon name="close" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div v-else class="empty-state">
        <t-icon name="history" size="64" />
        <p>暂无浏览记录</p>
        <t-button theme="primary" @click="router.push('/')">去探索</t-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { MessagePlugin, DialogPlugin } from 'tdesign-vue-next'
import Header from '@/components/Header.vue'
import type { HistoryItem, HistoryGroup } from '@/models/user.model'

const router = useRouter()
const historyList = ref<HistoryItem[]>([])

const totalHistoryCount = computed(() => historyList.value.length)

const groupedHistory = computed(() => {
  const groups: Map<string, HistoryItem[]> = new Map()
  
  historyList.value.forEach(item => {
    const date = new Date(item.visitedAt).toDateString()
    if (!groups.has(date)) {
      groups.set(date, [])
    }
    groups.get(date)!.push(item)
  })

  const result: HistoryGroup[] = []
  const today = new Date().toDateString()
  const yesterday = new Date(Date.now() - 86400000).toDateString()

  groups.forEach((items, date) => {
    let dateLabel = new Date(date).toLocaleDateString('zh-CN', { 
      month: 'long', 
      day: 'numeric',
      weekday: 'long'
    })
    
    if (date === today) {
      dateLabel = '今天'
    } else if (date === yesterday) {
      dateLabel = '昨天'
    }
    
    result.push({
      date,
      dateLabel,
      items: items.sort((a, b) => 
        new Date(b.visitedAt).getTime() - new Date(a.visitedAt).getTime()
      )
    })
  })

  return result.sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  )
})

const loadHistory = () => {
  try {
    const data = localStorage.getItem('browseHistory')
    if (data) {
      historyList.value = JSON.parse(data)
    }
  } catch (e) {
    historyList.value = []
  }
}

const removeHistoryItem = (item: HistoryItem) => {
  const index = historyList.value.findIndex(h => 
    h.id === item.id && h.type === item.type && h.visitedAt === item.visitedAt
  )
  if (index > -1) {
    historyList.value.splice(index, 1)
    localStorage.setItem('browseHistory', JSON.stringify(historyList.value))
    MessagePlugin.success('已删除')
  }
}

const clearAllHistory = () => {
  const confirmDialog = DialogPlugin.confirm({
    header: '确认清除',
    body: '确定要清除所有浏览记录吗？此操作不可恢复。',
    onConfirm: () => {
      historyList.value = []
      localStorage.setItem('browseHistory', '[]')
      MessagePlugin.success('已清除所有浏览记录')
      confirmDialog.hide()
    }
  })
}

const handleItemClick = (item: HistoryItem) => {
  if (item.type === 'space') {
    router.push(`/?space=${item.id}`)
  } else if (item.scene_code) {
    sessionStorage.setItem('panoramaFrom', router.currentRoute.value.fullPath)
    router.push(`/panorama?id=${item.id}&scene=${item.scene_code}`)
  }
}

const formatTime = (dateStr: string) => {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

onMounted(() => {
  loadHistory()
})
</script>

<style scoped>
.history-page {
  min-height: 100vh;
  background: var(--rl-bg);
}

.page-container {
  max-width: 1000px;
  margin: 0 auto;
  padding: 24px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.page-title {
  color: var(--rl-ink);
  font-size: 28px;
  font-weight: 600;
  margin: 0;
}

.page-actions {
  display: flex;
  align-items: center;
  gap: 16px;
}

.page-stats {
  color: var(--rl-muted);
  font-size: 14px;
}

.history-group {
  margin-bottom: 24px;
}

.group-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--rl-border);
}

.group-date {
  color: var(--rl-ink);
  font-size: 16px;
  font-weight: 500;
}

.group-count {
  color: var(--rl-muted);
  font-size: 13px;
}

.group-items {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.history-item {
  display: flex;
  align-items: center;
  padding: 12px;
  background: var(--rl-surface);
  border: 1px solid var(--rl-border);
  border-radius: var(--rl-r-md);
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: var(--rl-sh-sm);
}

.history-item:hover {
  background: var(--rl-surface);
  border-color: var(--rl-border-strong);
  box-shadow: var(--rl-sh-md);
}

.item-thumb {
  width: 64px;
  height: 48px;
  border-radius: 6px;
  overflow: hidden;
  flex-shrink: 0;
  margin-right: 12px;
}

.item-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.item-thumb-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--rl-bg-alt);
  color: var(--rl-faint);
}

.item-name {
  color: var(--rl-ink);
  font-size: 15px;
  font-weight: 500;
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 12px;
  color: var(--rl-muted);
}

.item-type {
  padding: 2px 8px;
  background: var(--rl-primary-soft);
  border-radius: 4px;
  color: var(--rl-primary);
}

.item-location {
  display: flex;
  align-items: center;
  gap: 4px;
}

.item-time {
  color: var(--rl-faint);
  font-size: 13px;
  margin-right: 12px;
}

.item-remove {
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  color: var(--rl-faint);
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: all 0.2s;
}

.history-item:hover .item-remove {
  opacity: 1;
}

.item-remove:hover {
  background: var(--rl-danger-soft);
  color: var(--rl-danger);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
  color: var(--rl-muted);
}

.empty-state p {
  margin: 16px 0;
  font-size: 16px;
}

:deep(.t-button--theme-danger) {
  background: transparent;
  border-color: var(--rl-danger-bright);
  color: var(--rl-danger);
}

:deep(.t-button--theme-danger:hover) {
  background: var(--rl-danger-soft);
}
</style>
