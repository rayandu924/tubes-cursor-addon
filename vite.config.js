import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: '.',
  publicDir: 'public',
  server: {
    open: '/dev.html',
    port: 5173,
    cors: true,
    headers: {
      'Access-Control-Allow-Origin': '*',
    }
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
