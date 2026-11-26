import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig(({ mode }) => ({
  plugins: [vue()],
  clearScreen: false,
  server: { port: 1420, strictPort: true },
  build: { target: mode === 'android' ? 'chrome90' : 'es2022', outDir: mode === 'android' ? 'dist-android' : 'dist' },
  test: { include: ['tests/**/*.test.ts'] },
}))
