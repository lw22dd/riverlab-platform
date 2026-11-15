import type { AuthState } from '@/models/auth.model'

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/+$/, '') || '/api/v1'
const AUTH_STORAGE_KEY = 'user'

export class ApiError extends Error {
  readonly status: number
  readonly code: number

  constructor(message: string, status: number, code = status) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

interface ApiEnvelope<T> {
  code: number
  msg: string
  data: T
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  /** 是否携带登录令牌，默认 true。 */
  auth?: boolean
  /** 401 时是否尝试刷新令牌，默认 true。 */
  refresh?: boolean
  body?: unknown
}

export function readStoredAuth(): AuthState | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<AuthState>
    if (!parsed || typeof parsed !== 'object') return null
    return {
      isLogin: Boolean(parsed.isLogin),
      userInfo: parsed.userInfo && typeof parsed.userInfo === 'object' ? parsed.userInfo : {},
      accessToken: typeof parsed.accessToken === 'string' ? parsed.accessToken : '',
      refreshToken: typeof parsed.refreshToken === 'string' ? parsed.refreshToken : '',
    }
  } catch {
    return null
  }
}

export function writeStoredAuth(state: AuthState): void {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(state))
}

export function clearStoredAuth(): void {
  localStorage.removeItem(AUTH_STORAGE_KEY)
}

export function hasAuthToken(): boolean {
  return Boolean(readStoredAuth()?.accessToken)
}

function updateStoredAccessToken(accessToken: string): void {
  const state = readStoredAuth()
  if (!state) return
  writeStoredAuth({ ...state, accessToken, isLogin: true })
}

function buildUrl(path: string): string {
  const base = API_BASE.endsWith('/') ? API_BASE.slice(0, -1) : API_BASE
  const normalized = path.startsWith('/') ? path : `/${path}`
  return `${base}${normalized}`
}

async function parseEnvelope<T>(response: Response): Promise<T> {
  let body: ApiEnvelope<T> | null = null
  try {
    body = (await response.json()) as ApiEnvelope<T>
  } catch {
    throw new ApiError('服务器返回了无法解析的响应', response.status)
  }
  if (!response.ok || body.code !== 200) {
    throw new ApiError(body.msg || `请求失败（${response.status}）`, response.status, body.code)
  }
  return body.data
}

let refreshPromise: Promise<string | null> | null = null
let redirecting = false

async function refreshAccessToken(): Promise<string | null> {
  const state = readStoredAuth()
  if (!state?.refreshToken) return null

  const response = await fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: state.refreshToken }),
  })
  if (!response.ok) return null
  const body = (await response.json()) as ApiEnvelope<{ access_token: string }>
  if (body.code !== 200 || !body.data?.access_token) return null

  updateStoredAccessToken(body.data.access_token)
  return body.data.access_token
}

function redirectToLogin(): void {
  if (redirecting || window.location.pathname === '/login') return
  redirecting = true
  clearStoredAuth()
  const redirect = `${window.location.pathname}${window.location.search}`
  window.location.assign(`/login?redirect=${encodeURIComponent(redirect)}`)
}

async function send(path: string, options: RequestOptions = {}): Promise<Response> {
  const { auth = true, refresh: _refresh, body, headers, ...rest } = options
  const state = readStoredAuth()
  const requestHeaders = new Headers(headers)
  if (body !== undefined && !(body instanceof FormData)) {
    requestHeaders.set('Content-Type', 'application/json')
  }
  if (auth && state?.accessToken) {
    requestHeaders.set('Authorization', `Bearer ${state.accessToken}`)
  }

  return fetch(buildUrl(path), {
    ...rest,
    headers: requestHeaders,
    body: body === undefined || body instanceof FormData ? (body as BodyInit | undefined) : JSON.stringify(body),
  })
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { auth = true, refresh = true } = options
  let response = await send(path, options)

  if (response.status === 401 && auth && refresh) {
    if (!refreshPromise) {
      refreshPromise = refreshAccessToken().finally(() => {
        refreshPromise = null
      })
    }
    const token = await refreshPromise
    if (token) {
      response = await send(path, options)
    } else {
      redirectToLogin()
      throw new ApiError('登录已过期，请重新登录', 401)
    }
  }

  if (response.status === 401 && auth) {
    redirectToLogin()
  }

  return parseEnvelope<T>(response)
}

export const http = {
  get<T>(path: string, params?: Record<string, string | number | boolean | undefined>): Promise<T> {
    const query = params
      ? new URLSearchParams(
          Object.entries(params)
            .filter(([, value]) => value !== undefined && value !== '')
            .map(([key, value]) => [key, String(value)]),
        ).toString()
      : ''
    return request<T>(query ? `${path}?${query}` : path)
  },

  post<T>(path: string, body?: unknown, options: Omit<RequestOptions, 'body'> = {}): Promise<T> {
    return request<T>(path, { ...options, method: 'POST', body })
  },
}
