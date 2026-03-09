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
            if (id.includes('react') || id.includes('react-dom') || id.includes('scheduler')) {
              return 'react-vendor';
            }
            if (id.includes('octokit') || id.includes('@octokit')) {
              return 'octokit-vendor';
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
            if (id.includes('@dnd-kit')) {
              return 'dnd-vendor';
            }
            // Group other stable UI/utility libraries
            if (
              id.includes('lucide-react') ||
              id.includes('sonner') ||
              id.includes('zod') ||
              id.includes('zustand') ||
              id.includes('idb') ||
              id.includes('dompurify') ||
              id.includes('nanoid') ||
              id.includes('@tanstack/react-virtual')
            ) {
              return 'utils-vendor';
            }
          }
        },
      },
    },
  },
})
