/**
 * 平台统一 API 基地址。
 *
 * 生产环境保持为空，走同源 `/api/v1`；本地需要直连后端时可通过
 * `VITE_API_BASE_URL=http://localhost:7000` 指定源站。
 */
export const API_ORIGIN = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/+$/, '') || ''

export const API_V1_BASE = API_ORIGIN ? `${API_ORIGIN}/api/v1` : '/api/v1'

export function apiUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`
  return `${API_V1_BASE}${normalized}`
}

export function websocketUrl(token: string): string {
  const origin = API_ORIGIN || `${window.location.protocol}//${window.location.host}`
  const parsed = new URL(origin, window.location.origin)
  const protocol = parsed.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${parsed.host}/api/v1/ws?token=${encodeURIComponent(token)}`
}
