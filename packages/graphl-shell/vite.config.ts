import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Library build (dist/index.js + .d.ts) and, under `npm run dev`, the fixture harness (index.html +
// dev/). Port 5177 sits beside ui-shell (5176), ui-flow (5174) and a content repo (5173).
// `external` is load-bearing: the engine is a PEER, so bundling it would ship a second react-flow store.
export default defineConfig({
  plugins: [react()],
  server: { port: 5177 },
  build: {
    lib: { entry: 'src/index.ts', formats: ['es'], fileName: 'index' },
    sourcemap: true,
    rollupOptions: {
      external: [
        'react',
        'react-dom',
        'react/jsx-runtime',
        '@graphlearning/flow',
        'lucide-react',
        'react-markdown',
        'remark-gfm',
      ],
    },
  },
})
