import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url))

export default defineConfig({
  root: here('.'),
  base: './',
  publicDir: false,
  server: {
    host: '127.0.0.1',
    port: 5175,
    strictPort: true,
    fs: { allow: [here('..')] },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2022',
    lib: {
      entry: here('src/main.ts'),
      name: 'Dujiangyan',
      formats: ['iife'],
      fileName: () => 'dujiangyan.js',
    },
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
})
