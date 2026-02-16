import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    sourcemap: true,
    minify: 'terser', // Use terser for minification
  },
})
