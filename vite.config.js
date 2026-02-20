import { defineConfig } from 'vite'
import { widgetPlugin } from '@mywallpaper/vite-plugin'

export default defineConfig({
  plugins: [widgetPlugin({ entry: 'src/index.jsx', copyManifest: false })],
  build: { outDir: '.' },
})
