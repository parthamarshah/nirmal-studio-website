import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The /admin app is built by its OWN vite pass, not as a second entry of the site build.
//
// A shared build would let Rollup put React in a chunk both entries import — which is
// harmless in itself, but it re-splits the PUBLIC site's bundle to suit the admin, and
// Phase 1d tuned that graph deliberately (see progress.md: initial JS, chunk count and
// cold Slow-4G timings were all measured). Building separately keeps the public output
// byte-for-byte what it was before /admin existed, and makes "no admin code reaches a
// visitor" structural: the two module graphs never meet.
//
// The cost is that the admin ships its own copy of React. For an internal tool two
// people use, on a page the public site never links to, that is the right trade.
//
// `emptyOutDir: false` matters: this runs after the site build and must not wipe it.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    rollupOptions: {
      input: { admin: 'admin/index.html' },
      // Everything the admin ships lives UNDER /admin/, so the single `/admin/*` rule
      // in public/_headers (noindex, no-store) covers the JavaScript and CSS too, not
      // just the HTML. A meta tag cannot speak for an asset, and assets parked at the
      // root would have quietly fallen outside that rule.
      output: {
        entryFileNames: 'admin/assets/[name]-[hash].js',
        chunkFileNames: 'admin/assets/[name]-[hash].js',
        assetFileNames: 'admin/assets/[name]-[hash][extname]',
      },
    },
  },
})
