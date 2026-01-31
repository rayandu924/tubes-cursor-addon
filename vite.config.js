import { defineConfig } from 'vite';
import { resolve } from 'path';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { renameSync } from 'fs';

export default defineConfig({
  root: 'src',  // Source files in src/
  publicDir: '../public',
  server: {
    open: '/index.html',
    port: 5173,
    cors: true,
    headers: {
      'Access-Control-Allow-Origin': '*',
    }
  },
  plugins: [
    viteSingleFile(),
    {
      name: 'move-to-root',
      closeBundle() {
        // Move built index.html from dist/ to root
        try {
          renameSync('dist/index.html', 'index.html');
          console.log('✓ Moved dist/index.html to ./index.html');
        } catch (e) {
          console.error('Failed to move file:', e);
        }
      }
    }
  ],
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    assetsInlineLimit: 100000000,
    cssCodeSplit: false
  }
});
