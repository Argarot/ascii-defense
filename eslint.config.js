// Lint is where CONTRIBUTING's invariants 1-3 stop being prose and start
// failing builds. Each block below names the invariant it enforces; if you are
// tempted to disable a rule here, the invariant is what you are disabling.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import boundaries from 'eslint-plugin-boundaries';
import globals from 'globals';

// One place to say who may import whom. Mirrors the layer table in
// ARCHITECTURE §1: each layer may import only from layers above it.
const LAYERS = ['engine', 'content', 'render', 'view', 'bot', 'harness', 'app'];
const ALLOWED_IMPORTS = {
  engine: ['engine'],
  content: ['content'],
  render: ['render'],
  view: ['view', 'engine', 'content', 'render'],
  bot: ['bot', 'engine', 'content'],
  harness: ['harness', 'engine', 'content', 'bot'],
  app: ['app', 'engine', 'content', 'render', 'view'],
};

// Packages that must stay headless: no DOM globals, ever (invariant 2/3).
// Their tsconfigs already omit the DOM lib; this catches what tsc cannot,
// e.g. globalThis.document reached through `any`.
const HEADLESS = ['engine', 'content', 'bot', 'harness'];

export default tseslint.config(
  {
    ignores: [
      'dist/',
      '**/dist-types/',
      'node_modules/',
      'vendor/',
      'REXPaint-v*/',
      // Codegen output: linting it means linting the generator's style.
      'packages/content/src/generated/',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,

  // ---- Invariant 1: Math.random is banned. Everything routes through the
  // seeded PRNG with named streams; unseeded randomness silently destroys
  // replays, calibration and the golden tests.
  {
    files: ['**/*.{ts,mts,js,mjs}'],
    rules: {
      'no-restricted-properties': [
        'error',
        {
          object: 'Math',
          property: 'random',
          message:
            'Banned (CONTRIBUTING invariant 1): use the seeded PRNG in @ascii-defense/engine rng with a named stream.',
        },
      ],
    },
  },

  // ---- Invariant 3: layer import boundaries.
  {
    files: ['packages/**/*.ts'],
    plugins: { boundaries },
    settings: {
      'import/resolver': {
        // Resolves @ascii-defense/* through package.json exports so the
        // boundary check sees through workspace symlinks.
        typescript: {
          project: ['packages/*/tsconfig.json'],
          noWarnOnMultipleProjects: true,
        },
      },
      'boundaries/elements': LAYERS.map((layer) => ({
        type: layer,
        pattern: `packages/${layer}/**/*`,
        partialMatch: false,
      })),
    },
    rules: {
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          message:
            'Layer violation (CONTRIBUTING invariant 3): {{ from.type }} may not import {{ to.type }}. See ARCHITECTURE §1.',
          policies: Object.entries(ALLOWED_IMPORTS).map(([from, allow]) => ({
            from: { element: { type: from } },
            allow: allow.map((to) => ({ to: { element: { type: to } } })),
          })),
        },
      ],
    },
  },

  // ---- Invariant 2/3: headless packages know no DOM and no Node platform.
  // The engine runs identically in the browser, in Vitest and in the harness;
  // platform APIs of either kind are how that dies.
  {
    files: HEADLESS.map((p) => `packages/${p}/**/*.ts`),
    rules: {
      'no-restricted-globals': [
        'error',
        ...[
          'window',
          'document',
          'navigator',
          'localStorage',
          'sessionStorage',
          'requestAnimationFrame',
          'cancelAnimationFrame',
          'fetch',
        ].map((name) => ({
          name,
          message: `Headless package (CONTRIBUTING invariant 2): no platform APIs in ${HEADLESS.join('/')}.`,
        })),
      ],
    },
  },

  // Packages that ship in the browser bundle, plus the pure-logic ones, may
  // not touch Node builtins. The harness is deliberately exempt: it is the
  // Node CLI whose job is IO.
  {
    files: ['engine', 'content', 'bot', 'render', 'view', 'app'].map(
      (p) => `packages/${p}/**/*.ts`,
    ),
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['node:*'],
              message:
                'No Node builtins here: this package must run in the browser (or stay pure logic). Do IO in harness and pass data in.',
            },
          ],
        },
      ],
    },
  },

  // tools/ are Node build scripts; they legitimately use Node globals.
  {
    files: ['tools/**/*.mjs'],
    languageOptions: { globals: { ...globals.node } },
  },
);
