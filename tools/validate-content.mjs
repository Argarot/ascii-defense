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

function lintSprite(relPath, sprite, palette, grid) {
  const [w, h] = sprite.cell;
  if (grid && (w !== grid.cell[0] || h !== grid.cell[1])) {
    findings.push(`${relPath}: cell [${w}, ${h}] does not match grid.json [${grid.cell}] - the view would index past its art`);
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
  }
  for (const [key, role] of Object.entries(sprite.inkMap)) {
    if (role !== null && role !== 'PATH' && palette && !(role in palette.roles)) {
      findings.push(`${relPath}: inkMap '${key}' names role '${role}', absent from palette`);
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
