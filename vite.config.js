import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: '.',
  server: {
    open: '/dev.html',
    port: 3000
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html')
      }
    },
    // Inline all assets for single-file addon
    assetsInlineLimit: 100000000,
    cssCodeSplit: false
  }
});
