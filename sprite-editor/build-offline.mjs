import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const readText = (path) => readFileSync(join(root, path), 'utf8');
const readJson = (path) => JSON.parse(readText(path));

const spriteNames = ['bolt', 'mortar', 'frost', 'refinery', 'road_muted_cobble'];
const assets = {
  palette: readJson('packages/content/assets/palette.json'),
  grid: readJson('packages/content/assets/grid.json'),
  glyphset: readJson('packages/app/public/assets/glyphset-spleen.json'),
  sprites: Object.fromEntries(spriteNames.map((name) => [
    name,
    readJson(`packages/content/assets/sprites/${name}.json`),
  ])),
};

const result = await build({
  entryPoints: [join(here, 'app.js')],
  bundle: true,
  write: false,
  format: 'iife',
  platform: 'browser',
  target: ['chrome100', 'edge100', 'firefox100'],
  legalComments: 'none',
});

const css = readFileSync(join(here, 'styles.css'), 'utf8');
const javascript = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const embedded = JSON.stringify(assets).replace(/</g, '\\u003c');
let html = readFileSync(join(here, 'index.source.html'), 'utf8');
html = html.replace(/\s*<link rel="stylesheet" href="\.\/styles\.css">/, () => `\n    <style>\n${css}\n    </style>`);
html = html.replace(
  /\s*<script type="module" src="\.\/app\.js"><\/script>/,
  () => `\n    <script>window.__SPRITE_EDITOR_ASSETS__=${embedded};</script>\n    <script>${javascript}</script>`,
);

const output = join(here, 'ASCII Defense Sprite Editor.html');
writeFileSync(output, html);
writeFileSync(join(here, 'index.html'), html);
console.log(`wrote ${output} (${Math.round(Buffer.byteLength(html) / 1024)} KiB)`);
