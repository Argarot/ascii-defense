import { defineConfig } from 'vite';

// Project Pages are served from https://<user>.github.io/<repo>/, so every asset
// URL in a production build needs that prefix. The dev server serves from root.
// Deriving this from Vite's own `command` keeps local `preview` byte-identical
// to what CI publishes — no @types/node, no env-var guessing.
//
// `isPreview` matters: `vite preview` runs with command === 'serve', but it
// serves the already-built dist whose URLs are baked with the Pages base. Base
// must therefore match at preview too, or every asset 404s behind the SPA
// fallback's misleading 200.
export default defineConfig(({ command, isPreview }) => ({
  base: command === 'build' || isPreview ? '/ascii-defense/' : '/',
  build: {
    target: 'es2022',
    // The Pages workflow uploads <repo>/dist, and keeping that path stable
    // means the workflow never needs to know the package layout.
    outDir: '../../dist',
    emptyOutDir: true,
    // Bundles go to dist/build/, keeping dist/assets/ purely the art library
    // copied from public/. Without this both land in dist/assets and a bundled
    // file could shadow a sprite.
    assetsDir: 'build',
  },
}));
