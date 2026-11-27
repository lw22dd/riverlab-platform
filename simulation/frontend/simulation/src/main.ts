import { createApp } from 'vue'
import { createPinia } from 'pinia'
import 'tdesign-vue-next/es/style/index.css'
import '@/styles/global.css'
import '@/styles/portal.css'
import '@/styles/riverlab.css'
import '@/styles/chronicle-labels.css'
import App from '@/App.vue'
import router from '@/router/router'
import { revealDirective } from '@/directives/reveal'
import { usePreferencesStore } from '@/stores/preferences.store'
import { sessionService } from '@/services/session.service'

document.documentElement.setAttribute('theme-mode', 'light')
document.documentElement.setAttribute('data-theme', 'moral-lab')

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.directive('reveal', revealDirective)

// 在首次导航前创建一次 store，让路由守卫可以记录最近访问的场景，
// 并应用「减少动效」偏好。
usePreferencesStore(pinia).applyMotionMode()

app.use(router)
app.mount('#app')

// 登录态已存在时，补传上次离线/失败未写入 MySQL 的实验记录。
void sessionService.flushPending()
window.addEventListener('online', () => {
  void sessionService.flushPending()
})
