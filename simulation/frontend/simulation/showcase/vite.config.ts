import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'

const showRoot = fileURLToPath(new URL('.', import.meta.url))
const appSrc = fileURLToPath(new URL('../src', import.meta.url))
const outDir = fileURLToPath(new URL('../../../../showcase-dist', import.meta.url))

export default defineConfig({
  root: showRoot,
  base: './',
  publicDir: false,
  resolve: {
    alias: {
      '@': appSrc,
    },
  },
  build: {
    outDir,
    emptyOutDir: true,
    target: 'es2020',
    rollupOptions: {
      input: {
        index: fileURLToPath(new URL('./index.html', import.meta.url)),
        autonomous: fileURLToPath(new URL('./01-autonomous.html', import.meta.url)),
        trolley: fileURLToPath(new URL('./02-trolley.html', import.meta.url)),
        footbridge: fileURLToPath(new URL('./03-footbridge.html', import.meta.url)),
        collapse: fileURLToPath(new URL('./04-collapse.html', import.meta.url)),
        dujiangyan: fileURLToPath(new URL('./05-dujiangyan.html', import.meta.url)),
      },
    },
  },
})
