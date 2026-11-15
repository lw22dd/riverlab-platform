import { sessionApi } from '@/apis/session.api'
import type { SessionRecord } from '@/models/session.model'

const BASE_STORAGE_KEY = 'moral-lab.sessions.v1'
const PENDING_SYNC_KEY = 'moral-lab.pending-sync.v1'
const MAX_SESSIONS = 60

interface StoredAuthUser {
  userInfo?: {
    id?: number | string
  }
}

/**
 * 本地记录按登录用户隔离，避免同一台电脑换账号后看到别人的结果。
 * 未登录时落在一个独立的 guest 命名空间，登录后不会互相污染。
 */
function currentUserScope(): string {
  try {
    const raw = window.localStorage.getItem('user')
    if (!raw) return 'guest'
    const parsed = JSON.parse(raw) as StoredAuthUser
    const id = parsed?.userInfo?.id
    return id !== undefined && id !== null && String(id) !== '' ? String(id) : 'guest'
  } catch {
    return 'guest'
  }
}

function storageKey(): string {
  return `${BASE_STORAGE_KEY}:${currentUserScope()}`
}

function pendingKey(): string {
  return `${PENDING_SYNC_KEY}:${currentUserScope()}`
}

function canUseStorage(): boolean {
  try {
    return typeof window !== 'undefined' && Boolean(window.localStorage)
  } catch {
    return false
  }
}

function readAll(): SessionRecord[] {
  if (!canUseStorage()) return []
  try {
    const raw = window.localStorage.getItem(storageKey())
    if (!raw) return []
    // 读取时做最小结构校验，损坏或旧版本数据直接降级为空列表。
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (item): item is SessionRecord =>
        Boolean(
          item &&
            typeof item === 'object' &&
            'id' in item &&
            typeof (item as SessionRecord).id === 'string' &&
            'finishedAt' in item &&
            typeof (item as SessionRecord).finishedAt === 'number',
        ),
    )
  } catch {
    return []
  }
}

function writeAll(sessions: SessionRecord[]): void {
  if (!canUseStorage()) return
  try {
    window.localStorage.setItem(storageKey(), JSON.stringify(sessions))
  } catch (error) {
    console.warn('[sessionService] 写入本地存储失败', error)
  }
}

function readPending(): string[] {
  if (!canUseStorage()) return []
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(pendingKey()) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

function writePending(ids: string[]): void {
  if (!canUseStorage()) return
  try {
    window.localStorage.setItem(pendingKey(), JSON.stringify(Array.from(new Set(ids))))
  } catch (error) {
    console.warn('[sessionService] 写入待同步队列失败', error)
  }
}

function addPending(id: string): void {
  const ids = readPending()
  if (!ids.includes(id)) writePending([...ids, id])
}

function removePending(id: string): void {
  writePending(readPending().filter((item) => item !== id))
}

async function syncToBackend(session: SessionRecord): Promise<boolean> {
  // 先入队再请求：即使页面在请求返回前被关闭，下次启动/登录仍能补传。
  addPending(session.id)
  if (!sessionApi.enabled) return false
  try {
    await sessionApi.save(session)
    removePending(session.id)
    return true
  } catch (error) {
    console.warn('[sessionService] 后端同步失败，已加入待补传队列', error)
    return false
  }
}

let flushing = false

async function flushPending(): Promise<void> {
  if (flushing || !sessionApi.enabled) return
  flushing = true
  try {
    for (const id of readPending()) {
      const session = readAll().find((item) => item.id === id)
      if (!session) {
        removePending(id)
        continue
      }
      const synced = await syncToBackend(session)
      if (!synced) break
    }
  } finally {
    flushing = false
  }
}

/**
 * 持久化被刻意设计成一层薄适配器，仿真内核从不依赖它。
 *
 * 配置 `VITE_API_BASE_URL` 后，已结束的会话会额外镜像到 REST 后端；
 * localStorage 始终是离线优先的事实来源。
 */
export const sessionService = {
  list(limit = MAX_SESSIONS): SessionRecord[] {
    return readAll()
      .sort((a, b) => b.finishedAt - a.finishedAt)
      .slice(0, limit)
  },

  get(id: string): SessionRecord | null {
    return readAll().find((session) => session.id === id) ?? null
  },

  has(id: string): boolean {
    return readAll().some((session) => session.id === id)
  },

  save(session: SessionRecord): void {
    // 同一 id 覆盖旧快照，并按完成时间保留最近 60 条。
    const sessions = readAll().filter((existing) => existing.id !== session.id)
    sessions.unshift(session)
    sessions.sort((a, b) => b.finishedAt - a.finishedAt)
    writeAll(sessions.slice(0, MAX_SESSIONS))
    void syncToBackend(session)
  },

  /** 重试登录前/离线时未成功同步的会话。 */
  flushPending,

  remove(id: string): void {
    writeAll(readAll().filter((session) => session.id !== id))
  },

  clear(): void {
    writeAll([])
  },

  toJSON(session: SessionRecord): string {
    return JSON.stringify(session, null, 2)
  },
}
