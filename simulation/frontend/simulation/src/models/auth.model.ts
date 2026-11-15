export interface AuthUser {
  id?: number
  username?: string
  nickname?: string
  email?: string
  phone?: string
  avatar?: string
  role_id?: number
  role?: {
    id: number
    name: string
  }
  is_super_admin?: boolean
  class_id?: number
}

/**
 * 与主平台（全景后台）共享的 localStorage['user'] 结构。
 * 只允许统一登录页写入完整登录态，其他页面只读取或清理。
 */
export interface AuthState {
  isLogin: boolean
  userInfo: AuthUser
  accessToken: string
  refreshToken: string
}
