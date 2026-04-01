import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(), 
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      manifest: {
        name: 'GitShelf',
        short_name: 'GitShelf',
        description: 'Organize your GitHub Stars',
        theme_color: '#000000',
        background_color: '#000000',
        display: 'standalone',
        icons: [
          {
            src: '/favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml'
          }
        ],
        // Web Manifest Share Target
        share_target: {
          action: '/?share_target=true',
          method: 'GET',
          params: {
            title: 'title',
            text: 'text',
            url: 'url'
          }
        }
      }
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        bridge: path.resolve(__dirname, 'ext-bridge.html'),
      },
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('octokit') || id.includes('@octokit')) {
              return 'github-vendor'
            }
            if (
              id.includes('react-markdown') ||
              id.includes('rehype') ||
              id.includes('remark') ||
              id.includes('micromark') ||
              id.includes('vfile') ||
              id.includes('unist')
            ) {
              return 'markdown-vendor'
            }
          }
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
})
