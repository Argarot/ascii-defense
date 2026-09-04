#!/usr/bin/env node
/**
 * Import Daniil's sprite studies into content (session 22, 2026-09-04).
 *
 *   node tools/import-sprites.mjs
 *
 * Reads sources/sprites/*.json (the JSON his generators emit) and writes
 * sprite-format-v2 assets under packages/content/assets/sprites/, adding the
 * palette roles they need to palette.json. Idempotent: re-run after he
 * updates a study and the diff is the change.
 *
 * TWO INPUT SHAPES:
 *
 * 1. Tower studies ("states" with idleA/idleB, a named palette, and choice
 *    letters per tier). They carry NO per-glyph colour: the colour is a RULE
 *    in the generator (`tower_tile` in generate_ascii_defense_*.py), keyed on
 *    row, glyph and chosen path. Those four rules are ported below, verbatim
 *    in structure, with one substitution: the study painted each tower over a
 *    procedural grass tile; here the base under every glyph is the game's
 *    ground colour, because the board draws the ground itself. Every computed
 *    colour becomes a palette role (`tower.<id>.<name>` for the study's named
 *    colours, `tower.<id>.mix.<hex>` for mixed ones), so the sprite still
 *    names roles and a re-tint is still a palette edit.
 *
 * 2. The road family (already sprite-shaped, "tiers" 0..11 = the road codes
 *    in the generator's ROAD_ORDER, "frames" = static VARIANTS). Becomes one
 *    sprite whose states are the road letters and whose variants are
 *    `variations` (position-hashed by the view). Its colours are the
 *    generator's ROLE_COLOURS, mirrored here.
 *
 * Anything this script does not understand is an error, never a guess: a
 * study with a new rule needs the rule ported before it imports.
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SRC = join(ROOT, 'sources', 'sprites');
const OUT = join(ROOT, 'packages', 'content', 'assets', 'sprites');
const PALETTE = join(ROOT, 'packages', 'content', 'assets', 'palette.json');
const GRID = join(ROOT, 'packages', 'content', 'assets', 'grid.json');

const grid = JSON.parse(readFileSync(GRID, 'utf8'));
const [CELL_W, CELL_H] = grid.cell;
const palette = JSON.parse(readFileSync(PALETTE, 'utf8'));
const roles = palette.roles;

// ---- colour maths, ported from the generators -------------------------------
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const hx = (c) => '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const mix = (a, b, t) => { const A = rgb(a), B = rgb(b); return hx([0, 1, 2].map((i) => A[i] * (1 - t) + B[i] * t)); };
const lum = (h) => {
  const v = rgb(h).map((x) => { const q = x / 255; return q <= 0.04045 ? q / 12.92 : ((q + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
};
const contrast = (a, b) => { const la = lum(a), lb = lum(b); return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05); };
function ensureContrast(fg, bg, minimum = 5.0) {
  if (contrast(fg, bg) >= minimum) return fg;
  let white = mix(fg, '#ffffff', 0.22);
  for (let i = 0; i < 6; i++) {
    if (contrast(white, bg) >= minimum) return white;
    white = mix(white, '#ffffff', 0.22);
  }
  return white;
}

/** The ground under a tower: the board paints ground cells with this bg. */
const GROUND = roles['terrain.ground.dark'];

// ---- the four tower colouring rules ------------------------------------------
// Each returns {fg, bg} for a non-space glyph, or null to skip. `P` is the
// study's named palette; `seq` the choice path in the study's letters.

function boltRule(P, seq, frame, y, x, ch) {
  let bg = GROUND;
  let fg;
  const recess = '[]{}()<>:;';
  const hailUpper = seq.length >= 3 && seq[2] === 'H';
  if (ch === 'o' || ch === 'O') {
    bg = mix(P.turret_deep, P.turret_mid, 0.24 + frame * 0.08);
    fg = mix(P.breech, '#ffffff', frame * 0.10);
  } else if ((y === 1 && x >= 5) || (hailUpper && y === 0 && x >= 5)) {
    bg = mix(bg, P.steel_shadow, 0.16);
    fg = ch === '>' ? P.bolt_tip : mix(P.bolt_shaft, P.bolt_tip, frame * 0.10);
  } else if (seq.length >= 2 && seq[1] === 'S' && y === 0 && x <= 1) {
    bg = mix(bg, P.turret_deep, 0.25);
    fg = P.scope;
  } else if (seq.length >= 2 && seq[1] === 'L' && y === 2 && x <= 2) {
    bg = mix(bg, P.steel_shadow, 0.62);
    fg = P.loader;
  } else if (seq.length >= 1 && seq[0] === 'G' && '():'.includes(ch)) {
    bg = mix(bg, P.turret_deep, 0.48);
    fg = P.seal;
  } else if (y <= 1) {
    if (recess.includes(ch)) bg = mix(bg, P.turret_deep, 0.68);
    else if ('^+#=Hx'.includes(ch)) bg = mix(bg, P.turret_deep, 0.22);
    const base = y === 0 || '/\\.-'.includes(ch) ? P.turret_high : P.turret_edge;
    fg = mix(base, '#ffffff', frame * 0.025);
  } else if (y === 2 || y === 3) {
    if ('[]H!|:;)(}{'.includes(ch)) bg = mix(bg, P.steel_shadow, 0.28);
    fg = y === 2 ? P.steel_high : P.steel_mid;
  } else {
    bg = mix(bg, P.steel_shadow, 0.20);
    fg = "_'".includes(ch) ? P.steel_low : P.steel_mid;
  }
  return { fg: ensureContrast(fg, bg, 4.7), bg };
}

function mortarRule(P, seq, frame, y, x, ch) {
  let bg = GROUND;
  let fg;
  const heavy = seq.length >= 1 && seq[0] === 'H';
  const wide = seq.length >= 1 && seq[0] === 'W';
  const siege = seq.length >= 2 && seq[1] === 'S';
  const drum = seq.length >= 2 && seq[1] === 'D';
  const bunker = seq.length >= 3 && seq[2] === 'B';
  const carpet = seq.length >= 3 && seq[2] === 'C';
  if (ch === 'M') {
    bg = mix(P.armour_deep, P.shadow, 0.42);
    fg = frame === 0 ? P.muzzle : P.muzzle_faded;
  } else if (bunker && y <= 1 && '[]|'.includes(ch)) {
    bg = mix(bg, P.armour_deep, 0.70);
    fg = mix(P.legendary, P.armour_high, 0.18);
  } else if (carpet && ((y === 1 && x <= 1) || (y === 2 && (x === 0 || x === 7)))) {
    bg = mix(bg, P.armour_deep, 0.50);
    const pulse = (y === 1 && x === 1) || (y === 2 && x === 7);
    fg = pulse && frame === 1 ? P.brass : P.shell;
  } else if (siege && y === 3 && x >= 4) {
    bg = mix(bg, P.shadow, 0.45);
    fg = '!|'.includes(ch) ? P.shell : P.armour_high;
  } else if (drum && y === 3 && x >= 4) {
    bg = mix(bg, P.armour_deep, 0.54);
    fg = '=-'.includes(ch) ? P.brass : P.armour_high;
  } else if (heavy && ((y === 2 && '[]'.includes(ch)) || y === 4)) {
    bg = mix(bg, P.shadow, 0.28);
    fg = '/\\[]'.includes(ch) ? P.armour_edge : P.gun_low;
  } else if (wide && y === 4) {
    bg = mix(bg, P.armour_deep, 0.22);
    fg = '/\\'.includes(ch) ? P.wide : P.gun_low;
  } else if (y <= 2) {
    bg = mix(bg, P.shadow, 0.18);
    fg = '/\\|'.includes(ch) ? P.gun_high : P.brass;
  } else if (y === 3) {
    bg = mix(bg, P.shadow, 0.16);
    fg = P.gun_mid;
  } else {
    bg = mix(bg, P.shadow, 0.20);
    fg = '/\\'.includes(ch) ? P.armour_edge : P.gun_low;
  }
  return { fg: ensureContrast(fg, bg, 4.7), bg };
}

function frostPulseCells(seq, rows) {
  const cells = new Set(['3,0']);
  outer: for (let y = 0; y < 3; y++) for (let x = 0; x < rows[y].length; x++) if ('+*x'.includes(rows[y][x])) { cells.add(`${x},${y}`); break outer; }
  if (seq.startsWith('I')) [...rows[0]].forEach((ch, x) => { if (ch === '^') cells.add(`${x},0`); });
  if (seq.length >= 2 && seq[1] === 'W') { cells.add('0,1'); cells.add('6,1'); }
  if (seq.length >= 2 && seq[1] === 'R') [...rows[3]].forEach((ch, x) => { if (ch === '=') cells.add(`${x},3`); });
  if (seq.length >= 3) [...rows[2]].forEach((ch, x) => { if (':+^/\\'.includes(ch)) cells.add(`${x},2`); });
  return cells;
}

function frostRule(P, seq, frame, y, x, ch, ctx) {
  let bg = GROUND;
  let fg;
  const active = ctx.pulse.has(`${x},${y}`);
  const deep = seq.startsWith('D');
  const shards = seq.startsWith('I');
  const wide = seq.length >= 2 && seq[1] === 'W';
  const rapid = seq.length >= 2 && seq[1] === 'R';
  const absolute = seq.length >= 3 && seq[2] === 'A';
  const shatter = seq.length >= 3 && seq[2] === 'S';
  if (y <= 2) {
    const enclosure = '[]{}()<>'.includes(ch) || absolute || (y === 1 && '/\\'.includes(ch));
    bg = mix(bg, P.ice_deep, enclosure ? 0.57 : 0.22);
    if (ch === 'F') fg = frame === 0 ? P.core : P.legendary;
    else if (active || '+*x:^'.includes(ch)) fg = frame === 0 ? P.pulse_dim : P.pulse;
    else if (shatter && y === 2) fg = P.ice_high;
    else if (shards && y === 0 && '^/\\'.includes(ch)) fg = P.ice_high;
    else if (wide && y === 1 && (x === 1 || x === 7)) fg = P.ice_edge;
    else fg = '/\\|_='.includes(ch) ? P.steel_high : P.ice_edge;
  } else if (y === 3) {
    bg = mix(bg, P.steel_shadow, 0.25);
    if (deep && '[]'.includes(ch)) fg = P.ice_high;
    else if (rapid && ch === '=') fg = frame === 0 ? P.pulse_dim : P.pulse;
    else fg = P.steel_high;
  } else {
    bg = mix(bg, P.steel_shadow, 0.22);
    fg = '^='.includes(ch) ? P.ice_edge : P.steel_mid;
  }
  return { fg: ensureContrast(fg, bg), bg };
}

function refineryProcessCells(seq, rows) {
  const cells = new Set();
  rows.forEach((row, y) => [...row].forEach((ch, x) => { if ('R#Vv*'.includes(ch)) cells.add(`${x},${y}`); }));
  if (seq.startsWith('W')) [...rows[0]].forEach((ch, x) => { if (ch === '=') cells.add(`${x},0`); });
  if (seq.startsWith('C')) [...rows[2]].forEach((ch, x) => { if (ch === '=') cells.add(`${x},2`); });
  if (seq.length >= 2 && seq[1] === 'S') [...rows[1]].forEach((ch, x) => { if (ch === '^') cells.add(`${x},1`); });
  if (seq.length >= 2 && seq[1] === 'A') [...rows[2]].forEach((ch, x) => { if ('+[]'.includes(ch)) cells.add(`${x},2`); });
  return cells;
}

function refineryRule(P, seq, frame, y, x, ch, ctx) {
  let bg = GROUND;
  let fg;
  const hot = ctx.process.has(`${x},${y}`);
  const wide = seq.startsWith('W');
  const fast = seq.startsWith('C');
  const survey = seq.length >= 2 && seq[1] === 'S';
  const auto = seq.length >= 2 && seq[1] === 'A';
  const mother = seq.length >= 3 && seq[2] === 'M';
  const perpetual = seq.length >= 3 && seq[2] === 'P';
  const enclosed = '[](){}'.includes(ch) || (y <= 2 && '#*=+'.includes(ch));
  bg = mix(bg, enclosed ? P.brown_deep : P.steel_shadow, enclosed ? 0.55 : 0.23);
  if (ch === 'R') fg = frame === 0 ? P.ore : P.legendary;
  else if ('Vv'.includes(ch) || (mother && y === 4)) fg = frame === 0 ? P.brass_mid : P.brass_high;
  else if (hot || '#*^+'.includes(ch)) fg = frame === 0 ? P.ore_dim : P.brass_high;
  else if ((wide && y === 0) || (perpetual && (y === 0 || y === 1 || y === 3))) fg = '.-='.includes(ch) ? P.brass_edge : P.steel_high;
  else if (fast && y === 2 && ch === '=') fg = frame === 0 ? P.brass_mid : P.brass_high;
  else if (survey && y === 1 && ch === '^') fg = P.brass_high;
  else if (auto && y === 2 && '[]+'.includes(ch)) fg = P.brown_edge;
  else fg = y <= 2 ? P.steel_high : P.steel_mid;
  return { fg: ensureContrast(fg, bg), bg };
}

/** id -> { rule, context builder, study file }. */
const TOWERS = {
  bolt: { file: 'ascii-defense-bolt-upgrade-tree-12.json', rule: boltRule, ctx: () => ({}) },
  mortar: { file: 'ascii-defense-mortar-upgrade-tree-15.json', rule: mortarRule, ctx: () => ({}) },
  frost: { file: 'ascii-defense-frost-upgrade-tree-aligned-17.json', rule: frostRule, ctx: (seq, rows) => ({ pulse: frostPulseCells(seq, rows) }) },
  refinery: { file: 'ascii-defense-refinery-upgrade-tree-20.json', rule: refineryRule, ctx: (seq, rows) => ({ process: refineryProcessCells(seq, rows) }) },
};

// ---- ink key allocation ---------------------------------------------------------
const KEY_ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

class InkMap {
  constructor() { this.byRole = new Map(); this.map = { '.': null }; }
  key(role) {
    if (this.byRole.has(role)) return this.byRole.get(role);
    const k = KEY_ALPHABET[this.byRole.size];
    if (k === undefined) throw new Error(`more than ${KEY_ALPHABET.length} roles in one sprite`);
    this.byRole.set(role, k);
    this.map[k] = role;
    return k;
  }
}

/** Register a colour as a palette role; returns the role name. */
function roleFor(prefix, named, hex) {
  const name = named.get(hex.toLowerCase());
  const role = name ? `${prefix}.${name}` : `${prefix}.mix.${hex.slice(1).toLowerCase()}`;
  if (roles[role] !== undefined && roles[role].toLowerCase() !== hex.toLowerCase()) {
    throw new Error(`palette role ${role} already exists with a different colour (${roles[role]} vs ${hex})`);
  }
  roles[role] = hex.toLowerCase();
  return role;
}

function assertDims(rows, what) {
  if (rows.length !== CELL_H || rows.some((r) => [...r].length !== CELL_W)) throw new Error(`${what}: not ${CELL_W}x${CELL_H}`);
}

// ---- towers ---------------------------------------------------------------------
function importTower(id, spec) {
  const study = JSON.parse(readFileSync(join(SRC, spec.file), 'utf8'));
  const P = study.palette;
  const named = new Map(Object.entries(P).map(([n, h]) => [h.toLowerCase(), n]));
  const prefix = `tower.${id}`;
  const ink = new InkMap();
  const tiers = ['T1', 'T2', 'T3'].map((t) => Object.keys(study.choices[t]));
  const frameMs = Number((/(\d+)\s*ms/.exec(study.meta.animation ?? '') ?? [])[1] ?? 720);

  const paint = (seq, rows, frame) => {
    assertDims(rows, `${id} ${seq || 'BASE'} frame ${frame}`);
    const ctx = spec.ctx(seq, rows);
    const art = [], inkRows = [], bgRows = [];
    rows.forEach((row, y) => {
      let a = '', i = '', b = '';
      [...row].forEach((ch, x) => {
        if (ch === ' ') { a += ' '; i += '.'; b += '.'; return; }
        const { fg, bg } = spec.rule(P, seq, frame, y, x, ch, ctx);
        a += ch;
        i += ink.key(roleFor(prefix, named, fg));
        b += ink.key(roleFor(prefix, named, bg));
      });
      art.push(a); inkRows.push(i); bgRows.push(b);
    });
    return { art, ink: inkRows, bgInk: bgRows };
  };

  const states = {};
  for (const st of study.states) {
    const seq = st.path === 'BASE' ? '' : st.path;
    // Study letters -> option indices, tier by tier ('RSB' -> '000').
    const key = [...seq].map((letter, ti) => {
      const idx = tiers[ti].indexOf(letter);
      if (idx === -1) throw new Error(`${id}: unknown letter '${letter}' at tier ${ti + 1} in path ${st.path}`);
      return String(idx);
    }).join('');
    const base = paint(seq, st.idleA, 0);
    const alt = paint(seq, st.idleB, 1);
    states[key] = { ...base, frames: [alt] };
  }
  const expected = 1 + 2 + 4 + 8;
  if (Object.keys(states).length !== expected) throw new Error(`${id}: ${Object.keys(states).length} states, expected ${expected}`);
  return {
    $schema: '../../schema/sprite.schema.json',
    id,
    cell: [CELL_W, CELL_H],
    frameMs,
    source: `sources/sprites/${spec.file} via tools/import-sprites.mjs`,
    states,
    inkMap: ink.map,
  };
}

// ---- roads ------------------------------------------------------------------------
const ROAD_FILE = 'ascii-defense-complete-road-sprites-31.json';
/** The generator's ROAD_ORDER: tier index -> engine cell letter. */
const ROAD_ORDER = ['|', '-', 'L', 'J', 'F', '7', 'T', 'U', 'E', '3', 'X', 'B'];
/** The generator's ROLE_COLOURS (approved Muted River Cobble family). */
const ROAD_ROLES = {
  'terrain.road.cobble.bg0': '#374149',
  'terrain.road.cobble.bg1': '#39434b',
  'terrain.road.cobble.bg2': '#343e45',
  'terrain.road.cobble.bg3': '#3b454d',
  'terrain.road.cobble.bg4': '#354047',
  'terrain.road.cobble.ink0': '#49565d',
  'terrain.road.cobble.ink1': '#4e5b62',
  'terrain.road.cobble.ink2': '#536168',
  'terrain.road.cobble.ink3': '#59676e',
  'terrain.road.cobble.ink4': '#5f6d74',
  'terrain.road.cobble.ink5': '#65747b',
  'terrain.road.cobble.ink6': '#6d7c82',
  'terrain.road.cobble.ink7': '#76858a',
  'terrain.road.cobble.edge': '#c9d8d5',
  'terrain.road.cobble.rail': '#b7c5c3',
  'terrain.road.cobble.deck': '#59676e',
  'terrain.road.cobble.under': '#4b5960',
};

function importRoads() {
  const src = JSON.parse(readFileSync(join(SRC, ROAD_FILE), 'utf8'));
  if (src.cell[0] !== CELL_W || src.cell[1] !== CELL_H) throw new Error(`roads: cell ${src.cell} is not ${CELL_W}x${CELL_H}`);
  for (const [role, hex] of Object.entries(ROAD_ROLES)) roles[role] = hex;
  for (const role of Object.values(src.inkMap)) if (!(role in ROAD_ROLES)) throw new Error(`roads: unknown role ${role}`);
  const states = {};
  const tiers = Object.keys(src.tiers);
  if (tiers.length !== ROAD_ORDER.length) throw new Error(`roads: ${tiers.length} tiers, expected ${ROAD_ORDER.length}`);
  for (const [tier, body] of Object.entries(src.tiers)) {
    const letter = ROAD_ORDER[Number(tier)];
    if (letter === undefined) throw new Error(`roads: tier ${tier} has no letter`);
    const strip = (f) => { assertDims(f.art, `roads ${letter}`); return { art: f.art, ink: f.ink, bgInk: f.bgInk }; };
    states[letter] = { ...strip(body), variations: (body.frames ?? []).map(strip) };
  }
  return {
    $schema: '../../schema/sprite.schema.json',
    id: 'road_muted_cobble',
    cell: [CELL_W, CELL_H],
    source: `sources/sprites/${ROAD_FILE} via tools/import-sprites.mjs`,
    states,
    inkMap: src.inkMap,
  };
}

// ---- run ----------------------------------------------------------------------------
const written = [];
for (const [id, spec] of Object.entries(TOWERS)) {
  const sprite = importTower(id, spec);
  writeFileSync(join(OUT, `${id}.json`), JSON.stringify(sprite, null, 2) + '\n');
  written.push(`${id}: ${Object.keys(sprite.states).length} states, ${Object.keys(sprite.inkMap).length - 1} roles, ${sprite.frameMs} ms`);
}
const road = importRoads();
writeFileSync(join(OUT, 'road_muted_cobble.json'), JSON.stringify(road, null, 2) + '\n');
written.push(`road_muted_cobble: ${Object.keys(road.states).length} states x ${1 + (road.states['|'].variations?.length ?? 0)} variations`);
// Palette: sorted for stable diffs, the file's own order otherwise untouched.
writeFileSync(PALETTE, JSON.stringify(palette, null, 2) + '\n');
console.log(written.join('\n'));
console.log(`palette: ${Object.keys(roles).length} roles`);
void readdirSync;
