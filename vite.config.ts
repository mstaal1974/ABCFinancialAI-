import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Quiet the >500 kB warning for the main bundle; the real fix is the
    // manual chunk split below which keeps the app code itself small.
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks: {
          // Charting library is ~400 kB on its own — isolate it so the
          // initial page render doesn't have to parse it inline.
          recharts: ['recharts'],
          // Icon set tree-shakes well but still benefits from being split.
          icons: ['lucide-react'],
        },
      },
    },
  },
})
