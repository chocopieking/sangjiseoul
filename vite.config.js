import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react')) return 'vendor-react'
            if (id.includes('xlsx'))  return 'vendor-xlsx'
            if (id.includes('docx'))  return 'vendor-docx'
            return 'vendor'
          }
          if (id.includes('vendorsInitData'))  return 'data-vendors'
          if (id.includes('projectsInitData')) return 'data-projects'
        },
      },
    },
  },
})
