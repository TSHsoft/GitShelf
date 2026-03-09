import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // Split out large, independent leaf libraries
            if (id.includes('octokit') || id.includes('@octokit')) {
              return 'github-vendor';
            }
            if (
              id.includes('react-markdown') ||
              id.includes('rehype') ||
              id.includes('remark') ||
              id.includes('micromark') ||
              id.includes('vfile') ||
              id.includes('unist')
            ) {
              return 'markdown-vendor';
            }
          }
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
})
