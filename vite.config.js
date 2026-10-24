import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Third-party runtime, cached across app deploys.
          vendor: ['react', 'react-dom', 'react-router-dom', 'clsx', 'date-fns', 'lucide-react'],
          // Firebase SDK is large and changes independently of app code.
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore'],
          // Heavy spreadsheet lib: only pulled in by Reports/Transactions routes.
          xlsx: ['xlsx'],
        },
      },
    },
    chunkSizeWarningLimit: 800,
  },
})
