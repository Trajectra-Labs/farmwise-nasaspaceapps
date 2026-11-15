/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

const src = (p: string) => fileURLToPath(new URL(`./src/${p}`, import.meta.url))

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Feature modules import shared pieces through these aliases (see docs/INTEGRATION_NOTES.md).
      '@fw/contracts': src('contracts/farmwise.ts'),
      '@fw/ui': src('ui/fw-compat.tsx'),
      '@fw/core': src('core/index.ts'),
      '@fw/nasa': src('data/nasa/index.ts'),
      '@fw/simulated': src('data/simulated/index.ts'),
      '@': src(''),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/recharts') || id.includes('node_modules/d3-') || id.includes('node_modules/victory-vendor')) return 'charts'
          if (id.includes('node_modules/leaflet') || id.includes('node_modules/react-leaflet')) return 'map'
          return undefined
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
  },
})
