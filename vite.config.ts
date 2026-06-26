import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@renderer': resolve('src/app')
    }
  },
  build: {
    minify: 'esbuild',
    cssMinify: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-codemirror': ['@uiw/react-codemirror', '@codemirror/lang-json'],
          'vendor-ui': [
            '@radix-ui/react-scroll-area',
            '@radix-ui/react-separator',
            '@radix-ui/react-slot',
            '@radix-ui/react-tooltip',
            'class-variance-authority',
            'clsx',
            'tailwind-merge'
          ]
        }
      }
    }
  },
  server: {
    port: 4120
  }
})
