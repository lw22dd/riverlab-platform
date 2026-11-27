import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router'
import index from '@/views/index.vue'
import Login from '@/views/Login.vue'
import UserCenter from '@/views/user/UserCenter.vue'
import AdminLayout from '@/views/admin/AdminLayout.vue'
import UserDetail from '@/views/user/UserDetail.vue'
import ExperimentRecords from '@/views/user/ExperimentRecords.vue'
import UserManagement from '@/views/admin/UserManagement.vue'
import SpaceManagement from '@/views/admin/SpaceManagement.vue'
import SpaceMapEditor from '@/views/admin/SpaceMapEditor.vue'
import LogManagement from '@/views/admin/LogManagement.vue'
import ExperimentAnalytics from '@/views/admin/ExperimentAnalytics.vue'
import Favorites from '@/views/user/Favorites.vue'
import History from '@/views/user/History.vue'
import ExcelUpload from '@/components/admin/ExcelUpload.vue'
import PanoramaViewer from '@/components/PanoramaViewer.vue'
import SpaceDetail from '@/views/SpaceDetail.vue'

const routes: RouteRecordRaw[] = [
  // 保留 query，仿真侧旧的 /panorama/?space=<slug> 入口仍能把目标景区带进首页。
  { path: '/', redirect: (to) => ({ name: 'home', query: to.query }) },
  { path: '/index', component: index, name: 'home', meta: { requiresAuth: true } },
  {
    path: '/login',
    name: 'login',
    beforeEnter: () => {
      // 统一登录入口在仿真主平台，全景侧不再保留独立登录页。
      if (hasAuthToken()) return { path: '/index' }
      window.location.replace('/login?redirect=%2Fpanorama%2Findex')
      return false
    },
    component: Login,
  },
  { path: '/user/center', component: UserCenter, name: 'userCenter' },
  { path: '/user/experiments', component: ExperimentRecords, name: 'userExperiments' },
  { path: '/user/:id', component: UserDetail, name: 'userDetail' },
  { path: '/favorites', component: Favorites, name: 'favorites' },
  { path: '/history', component: History, name: 'history' },
  { path: '/space/:id', component: SpaceDetail, name: 'spaceDetail', meta: { requiresAuth: true } },
  {
    path: '/admin',
    component: AdminLayout,
    name: 'admin',
    children: [
      { path: '', component: UserManagement, name: 'adminHome' },
      { path: 'users', component: UserManagement, name: 'adminUsers' },
      { path: 'batch-register', component: ExcelUpload, name: 'adminBatchRegister' },
      { path: 'spaces', component: SpaceManagement, name: 'adminSpaces' },
      { path: 'spaces/:id/map', component: SpaceMapEditor, name: 'spaceMapEditor' },
      { path: 'experiments', component: ExperimentAnalytics, name: 'adminExperiments' },
      { path: 'logs', component: LogManagement, name: 'adminLogs' }
    ]
  },
  { path: '/panorama', component: PanoramaViewer, name: 'panorama' },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

function hasAuthToken(): boolean {
  try {
    const raw = localStorage.getItem('user')
    if (!raw) return false
    const parsed = JSON.parse(raw) as { accessToken?: string }
    return Boolean(parsed?.accessToken)
  } catch {
    return false
  }
}

function redirectToMainLogin(): void {
  const redirect = `${window.location.pathname}${window.location.search}`
  window.location.replace(`/login?redirect=${encodeURIComponent(redirect)}`)
}

router.beforeEach((to) => {
  if (to.name === 'login') return true

  if (!hasAuthToken()) {
    redirectToMainLogin()
    return false
  }

  return true
})

export default router
