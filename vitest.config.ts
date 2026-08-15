import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';

// Two projects because the renderer cannot be tested in Node (no WebGL) and
// the engine must never need a browser (invariant 2). The split keeps either
// side from quietly growing a dependency on the other's environment.
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'node',
          include: ['packages/*/src/**/*.test.ts'],
          exclude: ['**/*.browser.test.ts', '**/node_modules/**'],
        },
      },
      {
        test: {
          name: 'browser',
          include: ['packages/*/src/**/*.browser.test.ts'],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: 'chromium' }],
            // The demo page is irrelevant to tests; never reuse its server.
            api: { port: 5199 },
          },
        },
      },
    ],
  },
});
