/**
 * Builds every runtime glyph set.
 *
 *   glyphset.json         unscii-8, 8x8, our full ~990-glyph palette
 *   glyphset-cp437.json   unscii-8 restricted to the CP437-class repertoire
 *                         (what a Dwarf Fortress square tileset carries)
 *   glyphset-spleen.json  spleen 5x8, parsed from BDF. BSD-2-Clause.
 *                         ASCII + braille + light box drawing only — no Latin-1.
 *
 * Usage: node tools/build-fonts.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';

// ---------------------------------------------------------------- unscii .hex
function readHex(path) {
  const map = new Map();
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.trim().match(/^([0-9A-Fa-f]+):([0-9A-Fa-f]+)$/);
    if (!m || m[2].length !== 16) continue;
    map.set(parseInt(m[1], 16), m[2]);
  }
  return map;
}

// ----------------------------------------------------------------- spleen BDF
function readBdf(path) {
  const map = new Map();
  const lines = readFileSync(path, 'utf8').split('\n');
  let cp = -1, rows = null;
  for (const raw of lines) {
    const line = raw.trim();
    if (line.startsWith('ENCODING ')) cp = parseInt(line.slice(9), 10);
    else if (line === 'BITMAP') rows = [];
    else if (line === 'ENDCHAR') {
      if (cp >= 0 && rows && rows.length === 8) map.set(cp, rows.join(''));
      cp = -1; rows = null;
    } else if (rows && /^[0-9A-Fa-f]{2}$/.test(line)) rows.push(line);
  }
  return map;
}

function emit(file, cell, codepoints, source, lookup) {
  const cps = [], bytes = [];
  let missing = 0;
  for (const cp of codepoints) {
    const hex = lookup.get(cp);
    if (!hex) { missing++; continue; }
    cps.push(cp);
    for (let i = 0; i < cell[1]; i++) bytes.push(parseInt(hex.slice(i * 2, i * 2 + 2), 16));
  }
  const out = { source, cell, count: cps.length, codepoints: cps, bits: Buffer.from(bytes).toString('base64') };
  writeFileSync(file, JSON.stringify(out));
  console.log(`${file.padEnd(34)} ${String(cps.length).padStart(4)} glyphs  (${missing} absent)  ${(JSON.stringify(out).length / 1024).toFixed(1)} kB`);
  return cps.length;
}

const range = (lo, hi) => Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);

// full palette
const FULL = [
  ...range(0x0020, 0x007e), ...range(0x00a0, 0x00ff),
  ...range(0x0100, 0x017f), ...range(0x0180, 0x024f),
  ...range(0x0370, 0x03ff), ...range(0x0400, 0x04ff),
  ...range(0x16a0, 0x16f8),
  ...range(0x2190, 0x21bb), ...range(0x2200, 0x22ff), ...range(0x2300, 0x23ff),
  ...range(0x2500, 0x257f), ...range(0x2580, 0x259f), ...range(0x25a0, 0x25ff),
  ...range(0x2660, 0x266f),
];

// CP437-class repertoire: printable ASCII plus the high half of code page 437.
const CP437_HIGH = [
  0x00c7, 0x00fc, 0x00e9, 0x00e2, 0x00e4, 0x00e0, 0x00e5, 0x00e7, 0x00ea, 0x00eb, 0x00e8, 0x00ef, 0x00ee, 0x00ec, 0x00c4, 0x00c5,
  0x00c9, 0x00e6, 0x00c6, 0x00f4, 0x00f6, 0x00f2, 0x00fb, 0x00f9, 0x00ff, 0x00d6, 0x00dc, 0x00a2, 0x00a3, 0x00a5, 0x20a7, 0x0192,
  0x00e1, 0x00ed, 0x00f3, 0x00fa, 0x00f1, 0x00d1, 0x00aa, 0x00ba, 0x00bf, 0x2310, 0x00ac, 0x00bd, 0x00bc, 0x00a1, 0x00ab, 0x00bb,
  0x2591, 0x2592, 0x2593, 0x2502, 0x2524, 0x2561, 0x2562, 0x2556, 0x2555, 0x2563, 0x2551, 0x2557, 0x255d, 0x255c, 0x255b, 0x2510,
  0x2514, 0x2534, 0x252c, 0x251c, 0x2500, 0x253c, 0x255e, 0x255f, 0x255a, 0x2554, 0x2569, 0x2566, 0x2560, 0x2550, 0x256c, 0x2567,
  0x2568, 0x2564, 0x2565, 0x2559, 0x2558, 0x2552, 0x2553, 0x256b, 0x256a, 0x2518, 0x250c, 0x2588, 0x2584, 0x258c, 0x2590, 0x2580,
  0x03b1, 0x00df, 0x0393, 0x03c0, 0x03a3, 0x03c3, 0x00b5, 0x03c4, 0x03a6, 0x0398, 0x03a9, 0x03b4, 0x221e, 0x03c6, 0x03b5, 0x2229,
  0x2261, 0x00b1, 0x2265, 0x2264, 0x2320, 0x2321, 0x00f7, 0x2248, 0x00b0, 0x2219, 0x00b7, 0x221a, 0x207f, 0x00b2, 0x25a0, 0x00a0,
];

const unscii = readHex('vendor/unscii/unscii-8.hex');
const spleen = readBdf('vendor/spleen/spleen-5x8.bdf');

// Ship EVERY glyph each font has. Restricting the atlas buys nothing — it is
// a few tens of kB — and it artificially caps what the art can reach for.
const allUnscii = [...unscii.keys()].filter((cp) => cp >= 0x20).sort((a, b) => a - b);
const allSpleen = [...spleen.keys()].filter((cp) => cp >= 0x20).sort((a, b) => a - b);

emit('public/assets/glyphset.json', [8, 8], allUnscii, 'unscii-8 (public domain) — complete', unscii);
emit('public/assets/glyphset-cp437.json', [8, 8], [...range(0x20, 0x7e), ...CP437_HIGH], 'unscii-8, CP437 repertoire', unscii);
emit('public/assets/glyphset-spleen.json', [5, 8], allSpleen, 'spleen 5x8 (BSD-2-Clause) F. Cambus — complete', spleen);
void FULL;
