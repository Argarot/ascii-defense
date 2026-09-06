/**
 * Validate every content asset against its schema, then run the content
 * linter rules that schemas cannot express (ASSETS.md sec 6).
 *
 * Exit 0 with a summary, or exit 1 listing every finding. Run by CI and
 * runnable locally: node tools/validate-content.mjs
 *
 * Rules currently active:
 *   schema            every asset validates against its mapped schema
 *   sprite/cell       every sprite's cell equals content/assets/grid.json -
 *                     a mismatch used to crash the view on the first tower
 *   sprite/dims       every art, ink and bgInk grid (base, frames,
 *                     variations) matches the declared cell
 *   sprite/ink-keys   every ink and bgInk key appears in the sprite's inkMap
 *   sprite/roles      every inkMap role resolves in the palette
 *   sprite/glyphs     every art glyph exists in the shipped spleen atlas -
 *                     GLTerm draws NOTHING for an absent glyph, silently
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Ajv } from 'ajv';

const ASSET_DIR = 'packages/content/assets';
const SCHEMA_DIR = 'packages/content/schema';

// filename (or directory) -> schema. Extend as asset kinds appear.
// Tile SEMANTICS (center-or-nothing edges, route continuity) are engine rules
// and are checked by packages/harness/src/content.test.ts against the same
// code the game runs - not duplicated here.
const SCHEMA_FOR = {
  'palette.json': 'palette.schema.json',
  'sprites/': 'sprite.schema.json',
  'tiles/': 'tiles.schema.json',
  'enemies/': 'enemies.schema.json',
  'towers/': 'towers.schema.json',
  'relics/': 'relics.schema.json',
  'passives/': 'passives.schema.json',
  'terrain/': 'terrain.schema.json',
  'loot/': 'loot.schema.json',
  'grid.json': 'grid.schema.json',
};

/** The shipped font, so a glyph that would draw as nothing fails here. */
const ATLAS = JSON.parse(readFileSync('packages/app/public/assets/glyphset-spleen.json', 'utf8'));
const GLYPHS = new Set(ATLAS.codepoints);

const ajv = new Ajv({ allErrors: true, strictTypes: false });
const compiled = new Map();
const findings = [];
/** Advisory: printed, never fatal (see the contrast rule in lintSprite). */
const warnings = [];

function schemaFor(relPath) {
  for (const [prefix, schema] of Object.entries(SCHEMA_FOR)) {
    if (relPath === prefix || relPath.startsWith(prefix)) return schema;
  }
  return null;
}

function validate(relPath, doc) {
  const schemaFile = schemaFor(relPath);
  if (!schemaFile) {
    findings.push(`${relPath}: no schema mapped - add it to SCHEMA_FOR in tools/validate-content.mjs`);
    return null;
  }
  if (!compiled.has(schemaFile)) {
    compiled.set(schemaFile, ajv.compile(JSON.parse(readFileSync(join(SCHEMA_DIR, schemaFile), 'utf8'))));
  }
  const fn = compiled.get(schemaFile);
  if (!fn(doc)) {
    for (const e of fn.errors) findings.push(`${relPath}${e.instancePath || '/'}: ${e.message}`);
    return null;
  }
  return doc;
}

// ---- linter rules beyond schemas -------------------------------------------

/**
 * Towers (2026-09-06, Daniil's item 4): a beam has NO range - it reaches
 * to the road's turn however far that is - so the field is forbidden on
 * attack 'beam' and required everywhere else. A number on a beam would
 * be printed on a card and believed.
 */
function lintTowers(relPath, doc) {
  for (const t of doc.towers ?? []) {
    if (t.attack === 'beam' && t.range !== undefined) findings.push(`${relPath}: tower '${t.id}' is a beam and carries range ${t.range} - a beam reaches to the road's turn; remove the field`);
    if (t.attack !== 'beam' && t.range === undefined) findings.push(`${relPath}: tower '${t.id}' has no range - only a beam goes without one`);
  }
}

function lintSprite(relPath, sprite, palette, grid) {
  const [w, h] = sprite.cell;
  // The cell rule per KIND (session 25; ASSETS.md sec 3): board-sized art
  // equals grid.json; an enemy is a small walker; a relic is a slot icon.
  const kind = sprite.kind ?? 'tower';
  if (kind === 'enemy') {
    if (w < 1 || w > 5 || h < 1 || h > 3) findings.push(`${relPath}: enemy cell [${w}, ${h}] is outside 1x1..5x3 - a walker must fit on the road`);
  } else if (kind === 'relic') {
    if (w !== 4 || h !== 3) findings.push(`${relPath}: relic cell [${w}, ${h}] is not 4x3 - the inventory slot's interior`);
  } else if (grid && (w !== grid.cell[0] || h !== grid.cell[1])) {
    findings.push(`${relPath}: cell [${w}, ${h}] does not match grid.json [${grid.cell}] - the view would index past its art`);
  }
  if (kind === 'face') {
    for (const k of ['top', 'mid', 'bot']) if (!sprite.states[k]) findings.push(`${relPath}: a face sprite needs state '${k}'`);
  }
  // Every grid - base, each idle frame, each variation and ITS frames -
  // obeys the same dimension and key rules; a frame model that let frame 2
  // be a different size would push the failure to the renderer.
  const lintGrid = (label, kind, rows, keyed) => {
    if (rows.length !== h) findings.push(`${relPath}: ${label} ${kind} has ${rows.length} rows, cell declares ${h}`);
    rows.forEach((row, i) => {
      const cells = [...row];
      if (cells.length !== w) findings.push(`${relPath}: ${label} ${kind} row ${i} is ${cells.length} wide, cell declares ${w}`);
      for (const ch of cells) {
        if (keyed) {
          if (!(ch in sprite.inkMap)) findings.push(`${relPath}: ${label} ${kind} key '${ch}' missing from inkMap`);
        } else if (ch !== ' ' && !GLYPHS.has(ch.codePointAt(0))) {
          findings.push(`${relPath}: ${label} art glyph '${ch}' (U+${ch.codePointAt(0).toString(16)}) is not in the font`);
        }
      }
    });
  };
  const lintFrame = (label, f) => {
    lintGrid(label, 'art', f.art, false);
    lintGrid(label, 'ink', f.ink, true);
    if (f.bgInk) lintGrid(label, 'bgInk', f.bgInk, true);
  };
  for (const [key, st] of Object.entries(sprite.states)) {
    const label = `state '${key}'`;
    lintFrame(label, st);
    (st.frames ?? []).forEach((f, i) => lintFrame(`${label} frame ${i + 1}`, f));
    (st.variations ?? []).forEach((v, i) => {
      lintFrame(`${label} variation ${i + 1}`, v);
      (v.frames ?? []).forEach((f, j) => lintFrame(`${label} variation ${i + 1} frame ${j + 1}`, f));
    });
    for (const [seq, frames] of Object.entries(st.sequences ?? {})) frames.forEach((f, i) => lintFrame(`${label} ${seq} ${i + 1}`, f));
  }
  for (const [key, role] of Object.entries(sprite.inkMap)) {
    if (role !== null && role !== 'PATH' && palette && !(role in palette.roles)) {
      findings.push(`${relPath}: inkMap '${key}' names role '${role}', absent from palette`);
    }
  }
  // Contrast (WBS 2.32, from the road-sprite investigation of 2026-09-04):
  // a frame whose every glyph sits within CONTRAST_FLOOR luminance points of
  // its own background reads as a flat cell on screen - the cobble study's
  // crossing tier shipped that way. A WARNING today, because that study is
  // Daniil's to regenerate; promote to a finding once it is.
  if (palette) {
    const lum = (hex) => {
      const p = (i) => parseInt(hex.slice(i, i + 2), 16);
      return 0.2126 * p(1) + 0.7152 * p(3) + 0.0722 * p(5);
    };
    const CONTRAST_FLOOR = 30;
    const checkFrame = (label, f) => {
      if (!f.bgInk) return; // no per-glyph background: the ground role decides, not the sprite
      let glyphs = 0;
      let best = 0;
      f.art.forEach((row, y) => {
        const chars = [...row];
        const inks = [...f.ink[y]];
        const bgs = [...f.bgInk[y]];
        chars.forEach((ch, x) => {
          if (ch === ' ') return;
          const fgRole = sprite.inkMap[inks[x]];
          const bgRole = sprite.inkMap[bgs[x]];
          const fg = fgRole && fgRole !== 'PATH' ? palette.roles[fgRole] : null;
          const bg = bgRole && bgRole !== 'PATH' ? palette.roles[bgRole] : null;
          if (!fg || !bg) return;
          glyphs++;
          best = Math.max(best, Math.abs(lum(fg) - lum(bg)));
        });
      });
      if (glyphs > 0 && best < CONTRAST_FLOOR) {
        warnings.push(`${relPath}: ${label} - every glyph within ${CONTRAST_FLOOR} luminance points of its background (max ${best.toFixed(0)}); it will read as a flat cell`);
      }
    };
    for (const [key, st] of Object.entries(sprite.states)) {
      const label = `state '${key}'`;
      checkFrame(label, st);
      (st.frames ?? []).forEach((f, i) => checkFrame(`${label} frame ${i + 1}`, f));
      for (const [seq, frames] of Object.entries(st.sequences ?? {})) frames.forEach((f, i) => checkFrame(`${label} ${seq} ${i + 1}`, f));
      (st.variations ?? []).forEach((v, i) => {
        checkFrame(`${label} variation ${i + 1}`, v);
        (v.frames ?? []).forEach((f, j) => checkFrame(`${label} variation ${i + 1} frame ${j + 1}`, f));
      });
    }
  }
}

// ---- walk ------------------------------------------------------------------

function* walk(dir, rel = '') {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const relPath = rel + entry.name + (entry.isDirectory() ? '/' : '');
    if (entry.isDirectory()) yield* walk(join(dir, entry.name), relPath);
    else if (entry.name.endsWith('.json')) yield relPath;
  }
}

const docs = new Map();
for (const relPath of walk(ASSET_DIR)) {
  const doc = validate(relPath, JSON.parse(readFileSync(join(ASSET_DIR, relPath), 'utf8')));
  if (doc) docs.set(relPath, doc);
}

const palette = docs.get('palette.json') ?? null;
const grid = docs.get('grid.json') ?? null;
if (!grid) findings.push('grid.json is missing - sprites have no cell to be checked against');
let spriteCount = 0;
for (const [relPath, doc] of docs) {
  if (schemaFor(relPath) === 'sprite.schema.json') {
    spriteCount++;
    lintSprite(relPath, doc, palette, grid);
  }
  if (schemaFor(relPath) === 'towers.schema.json') lintTowers(relPath, doc);
}

if (warnings.length) {
  console.warn(`content validation: ${warnings.length} warning(s)`);
  for (const w of warnings) console.warn('  ' + w);
}
if (findings.length) {
  console.error(`content validation: ${findings.length} finding(s)`);
  for (const f of findings) console.error('  ' + f);
  process.exit(1);
}
console.log(
  `content validation: ${docs.size} asset(s) OK` +
    (spriteCount === 0 ? ' (sprite rules idle: no sprites authored yet)' : ` (${spriteCount} sprites linted)`),
);
