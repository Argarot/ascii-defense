#!/usr/bin/env node
/**
 * Placeholder sprites (session 25, 2026-09-05, Daniil: "you generate the
 * sprites that are not there yet, to the best of your ability... what you
 * make will be reworked by another agent").
 *
 *   node tools/placeholder-sprites.mjs
 *
 * Writes sprite-format-v2 files under packages/content/assets/sprites/ for
 * everything that has no study yet - the seven enemies, the sixteen relics,
 * the Core face - and adds the palette roles they name. Deterministic and
 * idempotent: the art lives HERE, in the same glyph-and-rule spirit as the
 * studies (a base grid, a second idle frame, one colour rule per glyph
 * class), so the art agent replaces a file by dropping a study into
 * sources/sprites/ and giving tools/import-sprites.mjs its rule; the
 * `source` field says which files are still placeholders.
 *
 * Kinds and cells (ASSETS.md sec 3):
 *   enemy  up to 5x3 glyphs, drawn centred on the walker's position
 *   relic  4x3 - the inventory slot's interior in the strip and the column
 *   face   8x5, three states (top, mid, bot) for the Core's three cells
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = join(ROOT, 'packages', 'content', 'assets', 'sprites');
const PALETTE = join(ROOT, 'packages', 'content', 'assets', 'palette.json');
const SOURCE = 'tools/placeholder-sprites.mjs (session 25 placeholder; a study in sources/sprites/ replaces it)';

const palette = JSON.parse(readFileSync(PALETTE, 'utf8'));
const ROLES = {
  'enemy.limb': '#8593a0',
  'enemy.boss': '#ff6a3d',
  'status.slowed': '#16303c',
  'relic.gold': '#e6c55a',
  'relic.copper': '#d4884a',
  'relic.ice': '#7fd8ff',
  'relic.blood': '#e2573f',
  'relic.stone': '#9aa5ad',
  'relic.steel': '#c9d6df',
  'relic.moss': '#7dc96b',
  'relic.void': '#b48cff',
  'relic.sand': '#d8c48a',
};
for (const [k, v] of Object.entries(ROLES)) palette.roles[k] ??= v;
palette.roles = Object.fromEntries(Object.entries(palette.roles).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
writeFileSync(PALETTE, JSON.stringify(palette, null, 2) + '\n');

/**
 * Build one frame: `rows` is the art; `roleOf(ch, x, y)` names the
 * foreground role for a glyph (null = transparent); `bgOf` the background
 * role or null for none. Ink keys are allocated per sprite through `keys`.
 */
function makeKeys() {
  const map = { '.': null };
  const byRole = new Map([[null, '.']]);
  let next = 'a'.charCodeAt(0);
  return {
    key(role) {
      if (byRole.has(role)) return byRole.get(role);
      const k = String.fromCharCode(next++);
      map[k] = role;
      byRole.set(role, k);
      return k;
    },
    inkMap: map,
  };
}
function frame(keys, rows, roleOf, bgOf = null) {
  const art = rows;
  const ink = rows.map((row, y) => [...row].map((ch, x) => (ch === ' ' ? '.' : keys.key(roleOf(ch, x, y)))).join(''));
  const out = { art, ink };
  if (bgOf) out.bgInk = rows.map((row, y) => [...row].map((ch, x) => (ch === ' ' ? '.' : keys.key(bgOf(ch, x, y)))).join(''));
  return out;
}
const STUDIES = join(ROOT, 'sources', 'sprites');
function write(id, sprite) {
  // A painted study of this id (docs/ART-AGENT.md) owns the sprite now.
  if (existsSync(join(STUDIES, `${id}.study.json`))) { console.log('skipped', `${id}.json`, '(a study exists)'); return; }
  writeFileSync(join(OUT, `${id}.json`), JSON.stringify({ $schema: '../../schema/sprite.schema.json', ...sprite }, null, 2) + '\n');
  console.log('wrote', `${id}.json`);
}

// ---- enemies: a body glyph class in the enemy's own colour, limbs in grey ---
// Two frames = a walk cycle. Cells are small: a walker never covers the road.
const ENEMIES = {
  grunt: { role: 'enemy.eye', body: '@', cell: [3, 2], frames: [['(@)', '/ \\'], ['(@)', '\\ /']] },
  skitter: { role: 'enemy.fast', body: 'x', cell: [3, 2], frames: [['-x-', "' '"], ['~x~', '. .']] },
  swarmling: { role: 'enemy.swarm', body: 'm', cell: [2, 1], frames: [['m '], [' m']] },
  brute: { role: 'enemy.brute', body: 'B#', cell: [4, 3], frames: [['[##]', '|BB|', '/  \\'], ['[##]', '|BB|', '|  |']] },
  shell: { role: 'enemy.shell', body: 'S', cell: [3, 2], frames: [['(S)', '\\_/'], ['(S)', '/_\\']] },
  husk: { role: 'enemy.husk', body: 'H', cell: [4, 3], frames: [['/HH\\', '|..|', '|__|'], ['/HH\\', '|. |', '|__|']] },
  juggernaut: { role: 'enemy.boss', body: 'J#=', cell: [5, 3], frames: [['[=J=]', '|###|', '/___\\'], ['[=J=]', '|#.#|', '/___\\']] },
};
for (const [id, e] of Object.entries(ENEMIES)) {
  const keys = makeKeys();
  const roleOf = (ch) => (e.body.includes(ch) ? e.role : 'enemy.limb');
  const [base, ...rest] = e.frames.map((rows) => frame(keys, rows, roleOf));
  write(`enemy_${id}`, { id: `enemy_${id}`, kind: 'enemy', cell: e.cell, frameMs: 360, source: SOURCE, states: { '': { ...base, frames: rest } }, inkMap: keys.inkMap });
}

// ---- relics: a 4x3 icon, one colour each, a dimmer second class for the frame --
const RELICS = {
  overflow: { role: 'relic.copper', rows: ['o->o', '   |', '   o'], dim: '->|' },
  frostbite: { role: 'relic.ice', rows: [' \\|/', ' -*-', ' /|\\'], dim: '\\|/-' },
  tithe: { role: 'relic.gold', rows: [' $$ ', '$  $', ' $$ '] },
  splinter: { role: 'relic.blood', rows: ['*\\/*', ' ** ', '*/\\*'], dim: '\\/' },
  vein_tap: { role: 'relic.stone', rows: [' /\\ ', '#||#', '####'], dim: '#' },
  loadbearing: { role: 'relic.steel', rows: ['/==\\', '|  |', '|__|'], dim: '/\\|' },
  second_wind: { role: 'relic.moss', rows: [' .. ', '(++)', " '' "], dim: ".()'" },
  quarry: { role: 'relic.stone', rows: ['/\\/\\', '####', '####'], dim: '#' },
  toll: { role: 'relic.gold', rows: ['|--|', '|$$|', '|  |'], dim: '|-' },
  bounty_board: { role: 'relic.gold', rows: ['+--+', '|$?|', '+--+'], dim: '+-|' },
  orbital: { role: 'relic.void', rows: ['\\||/', ' || ', ' ** '], dim: '\\/' },
  stasis: { role: 'relic.ice', rows: ['/--\\', '|::|', '\\--/'], dim: '/\\-|' },
  deep_vein: { role: 'relic.copper', rows: ['\\oo/', ' ## ', '/##\\'], dim: '\\/' },
  sandbags: { role: 'relic.sand', rows: ['(__)', '(__)', '(__)'], dim: '()' },
  flashbang: { role: 'ui.text', rows: [' \\|/', '-()-', ' /|\\'], dim: '()' },
  ore_pocket: { role: 'terrain.ore.lit', rows: [' /\\ ', '/oo\\', '\\__/'], dim: '/\\_' },
  // ---- session 28, PR 4: the pool grown ----
  ricochet: { role: 'relic.copper', rows: ['o\\  ', ' \\o ', '  \\o'], dim: '\\' },
  cold_snap: { role: 'relic.ice', rows: ['*  *', ' ** ', '*  *'] },
  kindling: { role: 'fx.ember', rows: [' ^^ ', '^^^^', '|__|'], dim: '|_' },
  salvage_rights: { role: 'relic.steel', rows: ['[$$]', '|<>|', '[__]'], dim: '[]|_' },
  bulk_order: { role: 'relic.gold', rows: ['[][]', '[][]', '[][]'], dim: '' },
  cheap_upgrades: { role: 'relic.gold', rows: [' ^^ ', ' ^^ ', '.$$.'], dim: '.' },
  wide_net: { role: 'relic.steel', rows: ['#-#-', '-#-#', '#-#-'], dim: '-' },
  grounding_rod: { role: 'tower.tesla.arc', rows: [' |  ', ' |~ ', '_|__'], dim: '_' },
  long_fuse: { role: 'relic.blood', rows: ['~~~*', '   *', ' (*)'], dim: '~()' },
  sniper_nest: { role: 'relic.steel', rows: ['=+= ', ' |  ', '/|\\ '], dim: '/\\' },
  bloodstone: { role: 'relic.blood', rows: [' /\\ ', '<##>', ' \\/ '], dim: '/\\<>' },
  rush_bonus: { role: 'relic.gold', rows: ['>>> ', ' $$ ', '>>> '], dim: '>' },
  scavenger: { role: 'relic.copper', rows: ['/--\\', '|$$|', '\\__/'], dim: '/\\-|_' },
  prospectors_eye: { role: 'relic.sand', rows: [' __ ', '(oo)', ' \\/ '], dim: '_\\/' },
  iron_will: { role: 'relic.steel', rows: ['|##|', '|##|', '|##|'], dim: '|' },
  frost_nova: { role: 'relic.ice', rows: ['\\*/ ', '-*- ', '/*\\ '], dim: '\\/-' },
  scrap_rain: { role: 'relic.gold', rows: ["' ' ", ' $ $', "' ' "], dim: "'" },
  emergency_repair: { role: 'relic.moss', rows: [' ++ ', '++++', ' ++ '] },
  foundry: { role: 'fx.ember', rows: ['[==]', '|##|', '|__|'], dim: '[]|=_' },
  thick_walls: { role: 'relic.stone', rows: ['####', '#  #', '####'], dim: '' },
  permafrost_engine: { role: 'relic.ice', rows: ['{**}', '{**}', '<==>'], dim: '{}<>=' },
  tollbooth: { role: 'relic.gold', rows: ['|$$|', '|--|', '|  |'], dim: '|-' },
  bunker: { role: 'relic.stone', rows: ['/##\\', '|##|', '|##|'], dim: '/\\|' },
  quarry_master: { role: 'relic.copper', rows: ['/\\/\\', '#oo#', '####'], dim: '#' },
  doomsday: { role: 'relic.void', rows: ['\\||/', '*||*', '/**\\'], dim: '\\/' },
};
for (const [id, r] of Object.entries(RELICS)) {
  const keys = makeKeys();
  const roleOf = (ch) => (r.dim && r.dim.includes(ch) ? 'ui.dim' : r.role);
  write(`relic_${id}`, { id: `relic_${id}`, kind: 'relic', cell: [4, 3], source: SOURCE, states: { '': frame(keys, r.rows, roleOf) }, inkMap: keys.inkMap });
}

// ---- tower trees: a base in two frames, a glyph patch per choice, one colour rule -----
// State keys follow the sprite format ('' base, '0', '01', '010'...): the
// patches of every committed choice are laid over the base in tier order,
// so fifteen states come from a base and six patches - the studies' own
// economy, without the studies' hand.
const TOWERS = {
  tesla: {
    roles: { 'tower.tesla.coil': '#c9d6df', 'tower.tesla.core': '#7fe7ff', 'tower.tesla.arc': '#5cd6ff', 'tower.tesla.copper': '#d4884a' },
    ground: 'tower.ground',
    frames: [
      [' .-~-.  ', ' ( * )  ', '  }|{   ', '  ||    ', '|/_||_\\|'],
      [' .-~-.  ', ' ( + )  ', '  {|}   ', '  ||    ', '|/_||_\\|'],
    ],
    // [tier][option] -> rows to overwrite (index -> text)
    patches: [
      [{ 0: '-.-~-.- ' }, { 1: ' (*)(*) ' }],
      [{ 2: ' }}|{{  ' }, { 4: '#/_||_\\#' }],
      [{ 1: ' ( @ )  ' }, { 0: '~.-~-.~ ' }],
    ],
    roleOf: (ch) => ('*+@'.includes(ch) ? 'tower.tesla.core' : ch === '~' ? 'tower.tesla.arc' : ch === '=' || ch === '#' ? 'tower.tesla.copper' : 'tower.tesla.coil'),
  },
  laser: {
    roles: { 'tower.laser.body': '#c9d6df', 'tower.laser.lens': '#ff9a3d', 'tower.laser.beam': '#ffd27f', 'tower.laser.dark': '#506978' },
    ground: 'tower.ground',
    frames: [
      ['  .==.  ', ' [|##|] ', '  |==|  ', '   ||   ', '|/_||_\\|'],
      ['  .==.  ', ' [|++|] ', '  |==|  ', '   ||   ', '|/_||_\\|'],
    ],
    patches: [
      [{ 0: ' .====. ' }, { 1: '[||##||]' }],
      [{ 2: '  |##|  ' }, { 3: '  =||=  ' }],
      [{ 1: ' [|XX|] ' }, { 0: ' <.==.> ' }],
    ],
    roleOf: (ch) => ('#+X'.includes(ch) ? 'tower.laser.lens' : ch === '=' ? 'tower.laser.beam' : '<>'.includes(ch) ? 'tower.laser.lens' : '_'.includes(ch) ? 'tower.laser.dark' : 'tower.laser.body'),
  },
  bastion: {
    roles: { 'tower.bastion.wall': '#b8a98a', 'tower.bastion.banner': '#e2b23f', 'tower.bastion.dark': '#5a5040', 'tower.bastion.glow': '#ffe9a8' },
    ground: 'tower.ground',
    frames: [
      ['  |>    ', ' [====] ', ' |    | ', ' |_/\\_| ', '|/_||_\\|'],
      ['  |>>   ', ' [====] ', ' |    | ', ' |_/\\_| ', '|/_||_\\|'],
    ],
    patches: [
      [{ 0: '  |>*   ' }, { 2: ' |=  =| ' }],
      [{ 1: '[======]' }, { 3: ' |#/\\_| ' }],
      [{ 0: ' *|>>*  ' }, { 2: ' |o  o| ' }],
    ],
    roleOf: (ch) => ('>*'.includes(ch) ? 'tower.bastion.banner' : ch === 'o' || ch === '#' ? 'tower.bastion.glow' : ch === '_' ? 'tower.bastion.dark' : 'tower.bastion.wall'),
  },
  missile: {
    roles: { 'tower.missile.tube': '#8a9a7a', 'tower.missile.warhead': '#e2573f', 'tower.missile.frame': '#9eb3bf', 'tower.missile.rack': '#506978' },
    ground: 'tower.ground',
    frames: [
      [' /\\  /\\ ', ' || ||  ', '[||=||] ', ' ====== ', '|/_||_\\|'],
      [' /\\  /\\ ', ' || ||  ', '[||-||] ', ' ====== ', '|/_||_\\|'],
    ],
    patches: [
      [{ 0: ' /#\\/#\\ ' }, { 2: '[||o||] ' }],
      [{ 0: '/\\/\\/\\/\\' }, { 3: ' =*==*= ' }],
      [{ 1: ' |#||#| ' }, { 0: '/\\/\\/\\/\\', 1: ' |||||| ' }],
    ],
    roleOf: (ch, x, y) => ('#o*'.includes(ch) ? 'tower.missile.warhead' : ch === '=' || ch === '-' ? 'tower.missile.rack' : y <= 2 && '/\\|'.includes(ch) ? 'tower.missile.tube' : 'tower.missile.frame'),
  },
};
for (const [id, t] of Object.entries(TOWERS)) {
  for (const [k, v] of Object.entries(t.roles)) palette.roles[k] ??= v;
  const keys = makeKeys();
  const states = {};
  const apply = (rows, choices) => {
    const out = rows.slice();
    choices.forEach((opt, tier) => {
      for (const [row, text] of Object.entries(t.patches[tier][opt])) out[Number(row)] = text;
    });
    return out;
  };
  const keysOf = [[]];
  for (const a of [0, 1]) keysOf.push([a]);
  for (const a of [0, 1]) for (const b of [0, 1]) keysOf.push([a, b]);
  for (const a of [0, 1]) for (const b of [0, 1]) for (const c of [0, 1]) keysOf.push([a, b, c]);
  for (const choices of keysOf) {
    const [base, ...rest] = t.frames.map((rows) => frame(keys, apply(rows, choices), t.roleOf));
    // Placeholder sequences, the importer's rule (a twinkle, not a jump).
    const alt = rest[0] ?? base;
    const sequences = { fire: [{ ...alt, ms: 100 }], cool: [{ ...base, ms: 150 }], charge: [{ ...alt, ms: 100 }, { ...base, ms: 100 }] };
    states[choices.join('')] = { ...base, frames: rest, sequences };
  }
  write(id, { id, kind: 'tower', cell: [8, 5], frameMs: 720, source: SOURCE, states, inkMap: keys.inkMap });
}
palette.roles = Object.fromEntries(Object.entries(palette.roles).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
writeFileSync(PALETTE, JSON.stringify(palette, null, 2) + '\n');

// ---- the Core face: three stacked cells; the road arrives at the middle one's west edge --
{
  const keys = makeKeys();
  const lit = 'terrain.core.lit';
  const mid = 'terrain.core.mid';
  const dark = 'terrain.core.dark';
  const roleOf = (ch) => ('.:'.includes(ch) ? mid : '#=()'.includes(ch) ? lit : mid);
  const bgOf = () => dark;
  const top = [['  .--.  ', ' /    \\ ', '|  ..  |', '| :..: |', '|______|'], ['  .--.  ', ' /    \\ ', '|  ..  |', '| .::. |', '|______|']];
  const midRows = [['|      |', '| /--\\ |', '<=(  )=|', '| \\--/ |', '|      |'], ['|      |', '| /--\\ |', '<=(..)=|', '| \\--/ |', '|      |']];
  const bot = [['|      |', '| |##| |', '| |##| |', '/______\\', '""""""""'], ['|      |', '| |##| |', '| |#=| |', '/______\\', '""""""""']];
  const state = (frames) => {
    const [base, ...rest] = frames.map((rows) => frame(keys, rows, roleOf, bgOf));
    return { ...base, frames: rest };
  };
  write('core_face', { id: 'core_face', kind: 'face', cell: [8, 5], frameMs: 900, source: SOURCE, states: { top: state(top), mid: state(midRows), bot: state(bot) }, inkMap: keys.inkMap });
}
