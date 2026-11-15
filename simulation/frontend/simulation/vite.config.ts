import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: true,
    port: 5174,
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY_TARGET || 'http://localhost:7000',
        changeOrigin: true,
      },
      // 本地开发时把全景模块转发到它自己的 Vite 端口，生产环境由 Nginx 处理。
      '/panorama': {
        target: process.env.VITE_PANORAMA_PROXY_TARGET || 'http://localhost:5173',
        changeOrigin: true,
      },
    },
  },
})
