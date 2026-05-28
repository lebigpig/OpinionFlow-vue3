import { fileURLToPath, URL } from 'node:url'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import { PROXY_TARGET } from './src/config.js'

// ── 读取 key.properties ──
function loadKeyProperties() {
  try {
    const raw = readFileSync(resolve(__dirname, 'key.properties'), 'utf-8')
    const map = {}
    for (const line of raw.split('\n')) {
      const m = line.match(/^\s*([\w.-]+)\s*=\s*['"]?(.+?)['"]?\s*$/)
      if (m) map[m[1].trim()] = m[2].trim()
    }
    return map
  } catch {
    return {}
  }
}
const keys = loadKeyProperties()

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueDevTools(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  define: {
    __TAVILY_API_KEY__: JSON.stringify(keys.tavilykey || ''),
  },
  server: {
    proxy: {
      '/api': {
        target: PROXY_TARGET,
        changeOrigin: true,
      },
    },
  },
})
