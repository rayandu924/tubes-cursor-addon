import { defineConfig } from 'vite';
import { resolve } from 'path';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { renameSync, copyFileSync } from 'fs';

// Check if we're building the cursor module
const isCursorBuild = process.env.BUILD_CURSOR === 'true';

export default defineConfig({
  root: 'src',
  publicDir: '../public',
  server: {
    open: '/index.html',
    port: 5173,
    cors: true,
    headers: {
      'Access-Control-Allow-Origin': '*',
    }
  },
  plugins: isCursorBuild ? [
    {
      name: 'copy-cursor-to-root',
      closeBundle() {
        try {
          copyFileSync('dist/cursor.js', 'cursor.js');
          console.log('✓ Copied dist/cursor.js to ./cursor.js');
        } catch (e) {
          console.error('Failed to copy cursor.js:', e);
        }
      }
    }
  ] : [
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
  build: isCursorBuild ? {
    // Library build for cursor.js
    outDir: '../dist',
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, 'src/tubes-cursor-clean.js'),
      name: 'TubesCursor',
      formats: ['es'],
      fileName: () => 'cursor.js'
    },
    rollupOptions: {
      // Don't externalize anything - bundle all dependencies
      external: [],
    },
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false,
      }
    }
  } : {
    // Default single-file HTML build
    outDir: '../dist',
    emptyOutDir: true,
    assetsInlineLimit: 100000000,
    cssCodeSplit: false
  }
});
