import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

function getBackendPort() {
  try {
    const port = readFileSync(resolve(__dirname, '..', 'backend', '.backend_port'), 'utf-8').trim()
    if (/^\d+$/.test(port)) return port
  } catch { /* backend not running yet */ }
  return '59332' // fallback default
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    proxy: {
      '/run': {
        target: `http://127.0.0.1:${getBackendPort()}`,
        changeOrigin: true,
      },
      '/mouse_position': {
        target: `http://127.0.0.1:${getBackendPort()}`,
        changeOrigin: true,
      },
      '/mouse_live': {
        target: `http://127.0.0.1:${getBackendPort()}`,
        changeOrigin: true,
      },
    },
  },
})
