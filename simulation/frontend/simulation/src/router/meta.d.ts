import 'vue-router'

declare module 'vue-router' {
  interface RouteMeta {
    title?: string
    /** 不显示站点页头的全屏页面（场景运行页）。 */
    immersive?: boolean
    /** 带站点页头的深色门户外壳（主题列表与详情）。 */
    portal?: boolean
  }
}
