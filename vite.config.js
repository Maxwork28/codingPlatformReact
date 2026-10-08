import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Vendor groups → named chunks so the app shell stays small and heavy libraries cache independently.
const VENDOR_GROUPS = [
  ['vendor-react', ['react', 'react-dom', 'react-router', 'react-router-dom', 'react-redux', '@reduxjs/toolkit', 'redux', 'redux-thunk', 'immer', 'reselect', 'scheduler', 'use-sync-external-store']],
  ['vendor-ace', ['react-ace', 'ace-builds']],
  ['vendor-chart', ['chart.js', 'react-chartjs-2', '@kurkle/color']],
  ['vendor-net', ['socket.io-client', 'engine.io-client', 'engine.io-parser', 'socket.io-parser', 'axios']],
]

function packageNameFromId(id) {
  const normalized = id.replace(/\\/g, '/')
  const match = normalized.match(/node_modules\/(?:\.pnpm\/[^/]+\/node_modules\/)?((?:@[^/]+\/)?[^/]+)/)
  return match ? match[1] : null
}

function manualChunks(id) {
  if (!id.includes('node_modules')) return undefined
  const pkg = packageNameFromId(id)
  if (!pkg) return undefined
  if (pkg.startsWith('slate')) return 'vendor-slate'
  for (const [chunk, packages] of VENDOR_GROUPS) {
    if (packages.includes(pkg)) return chunk
  }
  return undefined
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss()],
  esbuild: {
    drop: mode === 'production' ? ['console', 'debugger'] : [],
  },
  build: {
    rollupOptions: {
      output: { manualChunks },
    },
  },
  server: {
    host: '0.0.0.0', // Listen on all network interfaces
    port: 5173, // Default Vite port
    strictPort: false, // If port is in use, try next available port
  },
}))
