const AMAP_KEY = import.meta.env.VITE_AMAP_KEY || ''
const AMAP_SECURITY_KEY = import.meta.env.VITE_AMAP_SECURITY_KEY || ''

let amapLoaded = false
let amapLoading = false
let amapCallbacks: { resolve: () => void; reject: (e: Error) => void }[] = []

declare global {
  interface Window {
    AMap: any
    _AMapSecurityConfig?: {
      securityJsCode: string
    }
  }
}

export function loadAmapScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.AMap) {
      amapLoaded = true
      resolve()
      return
    }

    if (amapLoading) {
      amapCallbacks.push({ resolve, reject })
      return
    }

    // 没有 Key 时不要让 L7 回退到 @antv/l7-maps 内置的演示 Key：
    // 该 Key 有域名白名单，在 localhost 会报 INVALID_USER_DOMAIN。
    if (!AMAP_KEY) {
      reject(new Error('未配置 VITE_AMAP_KEY，无法加载高德地图。请在 panorama/.env 中配置 JS API Key 和安全密钥。'))
      return
    }

    amapLoading = true

    // 配置安全密钥（JS API 2.0 必填）
    if (AMAP_SECURITY_KEY) {
      window._AMapSecurityConfig = {
        securityJsCode: AMAP_SECURITY_KEY,
      }
    } else {
      console.warn('[AMap] 未配置 VITE_AMAP_SECURITY_KEY，JS API 2.0 可能会返回 INVALID_USER_SCODE')
    }

    const script = document.createElement('script')
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${AMAP_KEY}`
    script.async = true

    script.onload = () => {
      if (!window.AMap) {
        amapLoading = false
        const error = new Error('高德地图 SDK 已加载但未挂载 window.AMap，请检查 Key 是否有效')
        amapCallbacks.forEach(cb => cb.reject(error))
        amapCallbacks = []
        reject(error)
        return
      }
      amapLoaded = true
      amapLoading = false
      amapCallbacks.forEach(cb => cb.resolve())
      amapCallbacks = []
      resolve()
    }

    script.onerror = () => {
      amapLoading = false
      const error = new Error('Failed to load AMap SDK')
      amapCallbacks.forEach(cb => cb.reject(error))
      amapCallbacks = []
      reject(error)
    }

    document.head.appendChild(script)
  })
}

export function isAmapLoaded(): boolean {
  return amapLoaded
}

export function getAmapKey(): string {
  return AMAP_KEY
}
