import type { SessionRecord } from '@/models/session.model'
import { hasAuthToken, http } from './http'

interface UploadResponse {
  id: string
  received_at: number
}

/**
 * 会话同步接口。
 *
 * 本地 localStorage 始终是事实来源；登录后额外镜像到后端。
 * 未登录或网络失败时由 sessionService 静默保留本地快照。
 */
export const sessionApi = {
  get enabled(): boolean {
    return hasAuthToken()
  },

  /** 幂等保存会话快照（按 session.id 覆盖）。 */
  async save(session: SessionRecord): Promise<void> {
    await http.post<UploadResponse>('/sim/sessions', session)
  },
}
