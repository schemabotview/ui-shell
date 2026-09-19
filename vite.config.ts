import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// One config, two jobs (mirrors ui-flow):
//   `npm run dev`   — serves index.html + dev/, a fixture app with throwaway courses + scenes, so a
//                     shell change is visible here before it reaches a content repo
//   `npm run build` — library build: dist/index.js, then tsc emits dist/index.d.ts
//
// `external` is load-bearing, and the list is longer than ui-flow's: @graphlearning/flow is a PEER,
// not a dependency. Bundling it would put a second engine (and a second react-flow store) inside
// this package — the content repo pins the engine itself, and must get exactly one copy.
// Port 5176 leaves 5173 for a content repo and 5174 for ui-flow; all three run side by side.
export default defineConfig({
  plugins: [react()],
  server: { port: 5176 },
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
