/**
 * Builds the runtime glyph set from unscii-8's .hex bitmap source.
 *
 * We ship 1-bit glyph bitmaps rather than a font file. The renderer expands
 * them into an atlas texture at load. That guarantees pixel-exact 8x8 glyphs
 * with no font loading, no hinting, no antialiasing and no fallback risk --
 * a webfont at 8px is at the mercy of the browser's rasteriser.
 *
 * unscii-8 is public domain (the GPL exception covers only unscii-16-full and
 * Unifont-derived files, which we do not use).
 *
 * Usage: node tools/build-glyphset.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';

const SRC = 'vendor/unscii/unscii-8.hex';
const OUT = 'public/assets/glyphset.json';

/** Ranges we actually draw with. Everything else is dead weight in the atlas. */
const RANGES = [
  [0x0020, 0x007e, 'ascii printable'],
  [0x00a0, 0x00ff, 'latin-1 supplement'],
  [0x2190, 0x21bb, 'arrows'],
  [0x2500, 0x257f, 'box drawing'],
  [0x2580, 0x259f, 'block elements'],
  [0x25a0, 0x25ff, 'geometric shapes'],
  [0x2660, 0x266f, 'card suits + music'],
];

const glyphs = new Map();
for (const line of readFileSync(SRC, 'utf8').split('\n')) {
  const m = line.trim().match(/^([0-9A-Fa-f]+):([0-9A-Fa-f]+)$/);
  if (!m) continue;
  const cp = parseInt(m[1], 16);
  const hex = m[2];
  if (hex.length !== 16) continue; // 8x8 only; 32-char entries are double-width
  glyphs.set(cp, hex);
}

const codepoints = [];
const bytes = [];
let missing = 0;
for (const [lo, hi, name] of RANGES) {
  let got = 0;
  for (let cp = lo; cp <= hi; cp++) {
    const hex = glyphs.get(cp);
    if (!hex) { missing++; continue; }
    codepoints.push(cp);
    for (let i = 0; i < 8; i++) bytes.push(parseInt(hex.slice(i * 2, i * 2 + 2), 16));
    got++;
  }
  console.log(`  ${name.padEnd(22)} ${String(got).padStart(4)} glyphs`);
}

const out = {
  source: 'unscii-8 (public domain) — https://github.com/viznut/unscii',
  cell: [8, 8],
  count: codepoints.length,
  codepoints,
  bits: Buffer.from(bytes).toString('base64'),
};
writeFileSync(OUT, JSON.stringify(out));
console.log(`\n${codepoints.length} glyphs, ${missing} absent from font`);
console.log(`wrote ${OUT} (${(JSON.stringify(out).length / 1024).toFixed(1)} kB)`);
