import { createRouter, createWebHistory } from 'vue-router'
import { getScenario } from '@/data'
import { sessionService } from '@/services/session.service'
import { useAuthStore } from '@/stores/auth.store'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  scrollBehavior(to, _from, savedPosition) {
    if (savedPosition) return savedPosition
    if (to.hash) return { el: to.hash, top: 92, behavior: 'smooth' }
    return { top: 0 }
  },
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/auth/LoginView.vue'),
      meta: { title: '登录', public: true },
    },
    {
      path: '/',
      name: 'home',
      component: () => import('@/views/home/HomeView.vue'),
      meta: { title: '实验主题', portal: true },
    },
    {
      path: '/experiments/:themeId',
      name: 'theme',
      component: () => import('@/views/experiments/ThemeDetailView.vue'),
      props: true,
      meta: { title: '实验详情', portal: true },
    },
    {
      path: '/scenario/:id',
      name: 'scenario',
      component: () => import('@/views/scenario/ScenarioView.vue'),
      meta: { title: '实验运行中', immersive: true },
      props: true,
    },
    {
      path: '/result/:sessionId',
      name: 'result',
      component: () => import('@/views/result/ResultView.vue'),
      meta: { title: '推演结果' },
      props: true,
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/',
    },
  ],
})

router.beforeEach((to) => {
  const auth = useAuthStore()

  if (to.meta.public === true) {
    return auth.isLogin ? { name: 'home' } : true
  }

  if (!auth.isLogin) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  if (to.name === 'scenario') {
    const id = String(to.params.id)
    if (!getScenario(id)) {
      return { name: 'home', query: { missingScenario: id } }
    }
  }

  if (to.name === 'result') {
    const sessionId = String(to.params.sessionId)
    if (!sessionService.has(sessionId)) {
      return { name: 'home', query: { missingSession: sessionId } }
    }
  }

  return true
})

router.afterEach((to) => {
  const title = typeof to.meta.title === 'string' ? to.meta.title : '伦理仿真实验室'
  document.title = `${title} · MORAL / LAB`
})

export default router
