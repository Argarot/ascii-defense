import { defineConfig } from 'vitest/config';

// Node-environment unit tests only. Browser Mode (Playwright) for the renderer
// is WBS 1.1.6 and gets its own project entry when it lands.
export default defineConfig({
  test: {
    include: ['packages/*/src/**/*.test.ts'],
  },
});
