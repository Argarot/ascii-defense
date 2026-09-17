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
          // Issue #321: this suite is full of CORPUS tests - two hundred maps, forty runs - whose time is pure CPU and
          // so scales with whatever else the machine is doing. Against vitest's 5s default eight of them went red
          // together on a loaded machine (2026-09-12) and green again unloaded, and a gate that fails on load trains
          // the next reader to ignore a red suite. Thirty seconds still fails a test that hangs; it no longer fails one
          // that is merely waiting its turn. The slowest measures ~7.5s loaded.
          testTimeout: 30_000,
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
