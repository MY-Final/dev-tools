import { resolve } from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  root: resolve(__dirname),
  base: './',
  resolve: {
    alias: {
      '@renderer': resolve(__dirname, '../src/renderer/src')
    }
  },
  plugins: [react()],
  build: {
    outDir: resolve(__dirname, '../web-dist'),
    emptyOutDir: true,
    minify: 'esbuild',
    cssMinify: true,
    rollupOptions: {
      input: resolve(__dirname, 'index.html'),
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
    port: 4121
  }
})
