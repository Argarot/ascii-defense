/**
 * Validate every content asset against its schema, then run the content
 * linter rules that schemas cannot express (ASSETS.md sec 6).
 *
 * Exit 0 with a summary, or exit 1 listing every finding. Run by CI and
 * runnable locally: node tools/validate-content.mjs
 *
 * Rules currently active:
 *   schema     every asset validates against its mapped schema
 *   sprite/dims       art and ink grids match the declared cell   (no sprites yet)
 *   sprite/ink-keys   every ink glyph appears in the sprite's inkMap
 *   sprite/roles      every inkMap role resolves in the palette
 *
 * The sprite rules are exercised the moment the first REXPaint import lands
 * (M1 Phase 2); they run against zero files until then, which is reported so
 * nobody mistakes "no findings" for "checked".
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
};

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

function lintSprite(relPath, sprite, palette) {
  const [w, h] = sprite.cell;
  // Every frame - the base pair and each entry of the idle cycle (WBS 4.1) -
  // obeys the same dimension and ink rules; a frame model that let frame 2
  // be a different size would push the failure to the renderer.
  const lintFrame = (tier, label, art, ink) => {
    if (art.length !== h) findings.push(`${relPath}: tier ${tier} ${label} art has ${art.length} rows, cell declares ${h}`);
    if (ink.length !== h) findings.push(`${relPath}: tier ${tier} ${label} ink has ${ink.length} rows, cell declares ${h}`);
    art.forEach((row, i) => {
      if ([...row].length !== w) findings.push(`${relPath}: tier ${tier} ${label} art row ${i} is ${[...row].length} glyphs, cell declares ${w}`);
    });
    ink.forEach((row, i) => {
      if ([...row].length !== w) findings.push(`${relPath}: tier ${tier} ${label} ink row ${i} is ${[...row].length} keys, cell declares ${w}`);
      for (const key of row) {
        if (!(key in sprite.inkMap)) findings.push(`${relPath}: tier ${tier} ${label} ink key '${key}' missing from inkMap`);
      }
    });
  };
  for (const [tier, { art, ink, frames }] of Object.entries(sprite.tiers)) {
    lintFrame(tier, 'base', art, ink);
    (frames ?? []).forEach((f, i) => lintFrame(tier, `frame ${i + 1}`, f.art, f.ink));
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
let spriteCount = 0;
for (const [relPath, doc] of docs) {
  if (schemaFor(relPath) === 'sprite.schema.json') {
    spriteCount++;
    lintSprite(relPath, doc, palette);
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
