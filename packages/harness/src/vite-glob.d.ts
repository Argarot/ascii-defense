/**
 * Vitest runs on Vite, whose `import.meta.glob` can load source files as raw
 * text. The harness tsconfig has no DOM or vite/client types (invariant 2 -
 * headless packages stay lib ES2022), so the one signature the tests use is
 * declared here instead of pulling in the whole client surface.
 */
interface ImportMeta {
  glob(
    pattern: string | readonly string[],
    options: { query: '?raw'; import: 'default'; eager: true },
  ): Record<string, string>;
}
