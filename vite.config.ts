import { defineConfig } from 'vite';

// Project Pages are served from https://<user>.github.io/<repo>/, so every asset
// URL in a production build needs that prefix. The dev server serves from root.
// Deriving this from Vite's own `command` keeps local `preview` byte-identical
// to what CI publishes — no @types/node, no env-var guessing.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/ascii-defense/' : '/',
  build: {
    target: 'es2022',
    outDir: 'dist',
  },
}));
