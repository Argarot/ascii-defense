/**
 * The build sweep (session 24, PR 4): difficulty measured the way a player
 * meets it on the boards the game actually generates now - the Core at the
 * east edge, the board nine tenths road, 8-12 entries. Mixed builds with an
 * ECONOMY (100 scrap, towers and upgrades bought as kills pay), placed at
 * the CHOKE (the shared tail before the Core) or SPREAD across the board,
 * plus the two questions the variant sweep left open:
 *
 *  - choke vs spread: does one entrance make the last slots the whole game?
 *  - Hailstorm at 60% vs 75% per shot, in a mixed build behind a Frost.
 *
 * Usage: node tools/build-sweep.mjs [seed ...]
 */
import { TILE_SIZE, TileLibrary, createRng, type DifficultySpec, type TowerDef } from '@ascii-defense/engine';
import { validateEnemies, validateRelics, validateTowers } from '@ascii-defense/content';
import libraryJson from '@ascii-defense/content/assets/tiles/library.json';
import enemiesJson from '@ascii-defense/content/assets/enemies/roster.json';
import towersJson from '@ascii-defense/content/assets/towers/roster.json';
import relicsJson from '@ascii-defense/content/assets/relics/pool.json';
import { runLab, type LabContent, type LabSpec, type TowerPlacement } from './lab';

declare const console: { log: (...args: unknown[]) => void };
declare const process: { argv: string[] };

function must<T>(r: { ok: true; value: T } | { ok: false; errors: unknown[] }): T {
  if (!r.ok) throw new Error('content invalid: ' + JSON.stringify(r.errors).slice(0, 200));
  return r.value;
}
const baseContent: LabContent = {
  lib: new TileLibrary(libraryJson.tiles),
  enemyDefs: must(validateEnemies.check(enemiesJson)).enemies,
  towerDefs: must(validateTowers.check(towersJson)).towers,
  relicDefs: must(validateRelics.check(relicsJson)).relics,
};

/** Standard, as protocol.ts ships it after PR 2 of session 23. */
const STANDARD: DifficultySpec = { hpLinear: 0.15, hpGeometric: 1.05, countBase: 6, countLinear: 4, countGeometric: 1 };
const MAX_WAVES = 40;
const BOARDS = [{ w: 7, h: 4 }, { w: 7, h: 5 }, { w: 12, h: 7 }];
const argSeeds = process.argv.slice(2).map(Number).filter((n) => Number.isInteger(n) && n > 0);
const SEEDS = argSeeds.length ? argSeeds : [945046, 12345, 777, 2024];

/** The app's knob derivation for a seed (protocol.ts Standard), minus the board - as sweep.ts does it. */
function demoKnobs(seed: number): { entries: number; targetPathCells: number } {
  const knobs = createRng(seed).stream('map');
  const entries = knobs.int(2, 5);
  const targetPathCells = (8 + Math.max(knobs.int(0, 18), knobs.int(0, 18))) * TILE_SIZE;
  return { entries, targetPathCells };
}

/** Hailstorm at a different per-shot multiplier: the roster cloned with one number changed. */
function withHailstorm(mul: number): LabContent {
  const towerDefs = baseContent.towerDefs.map((d) => {
    if (d.id !== 'bolt' || !d.tiers) return d;
    const tiers = d.tiers.map((t) => ({ ...t, choices: t.choices.map((c) => (c.name === 'Hailstorm' ? { ...c, mods: { ...c.mods, damageMul: mul } } : c)) }));
    return { ...d, tiers } as TowerDef;
  });
  return { ...baseContent, towerDefs };
}

const mixed = (at: TowerPlacement['at'], boltPath: [number, number, number]): TowerPlacement[] => [
  { towerId: 'bolt', choices: boltPath, at },
  { towerId: 'frost', choices: [1, 0, 1], at },
  { towerId: 'bolt', choices: boltPath, at },
  { towerId: 'mortar', choices: [1, 1, 0], at },
  { towerId: 'bolt', choices: boltPath, at },
];
const RAILBORE: [number, number, number] = [0, 0, 0];
const HAILSTORM: [number, number, number] = [0, 0, 1];

interface Build { name: string; towers: TowerPlacement[]; content: LabContent; economy: LabSpec['economy'] }
// Session 26: one type alone against the mixed build - the proof that no
// single type clears the waves once resistances decide fights.
const soloKinetic = (at: TowerPlacement['at']): TowerPlacement[] => [
  { towerId: 'bolt', choices: RAILBORE, at }, { towerId: 'bolt', choices: RAILBORE, at }, { towerId: 'mortar', choices: [1, 1, 0], at },
  { towerId: 'bolt', choices: RAILBORE, at }, { towerId: 'missile', choices: [0, 1, 0], at },
];
const soloEnergy = (at: TowerPlacement['at']): TowerPlacement[] => [
  { towerId: 'tesla', choices: [0, 0, 0], at }, { towerId: 'frost', choices: [1, 0, 1], at }, { towerId: 'tesla', choices: [1, 0, 0], at },
  { towerId: 'frost', choices: [1, 0, 1], at }, { towerId: 'tesla', choices: [0, 1, 1], at },
];
const bothTypes = (at: TowerPlacement['at']): TowerPlacement[] => [
  { towerId: 'bolt', choices: RAILBORE, at }, { towerId: 'tesla', choices: [0, 0, 0], at }, { towerId: 'frost', choices: [1, 0, 1], at },
  { towerId: 'mortar', choices: [1, 1, 0], at }, { towerId: 'bolt', choices: RAILBORE, at },
];
// Session 26 PR 5: every tower in a pair with a partner it should want.
const P = (towerId: string, choices: [number, number, number]): TowerPlacement => ({ towerId, choices, at: 'choke' });
// Session 27 PR 6: the instruments - a Laser goes 'inline' (aimed along the
// most road), a Bastion 'adjacent' (touching the last tower placed).
const A = (towerId: string, choices: [number, number, number], at: TowerPlacement['at']): TowerPlacement => ({ towerId, choices, at });
const EIGHT: [string, TowerPlacement[]][] = [
  // A Railbore opens (2026-09-06 evening, the Laser at 110): a build that opens with an unaffordable tower places nothing.
  ['Railbore, then a Laser line, aimed (Capacitor, Fast Cycle, Cutter) + Frost', [P('bolt', RAILBORE), A('laser', [0, 0, 0], 'inline'), P('frost', [1, 0, 1]), A('laser', [0, 0, 0], 'inline'), A('laser', [1, 1, 1], 'inline')]],
  ['Missiles + Bastion (adjacent) + Railbore', [P('missile', [0, 1, 0]), A('bastion', [0, 0, 0], 'adjacent'), P('bolt', RAILBORE), P('missile', [1, 0, 1]), P('bolt', RAILBORE)]],
  ['Tesla + Bastion (adjacent) + Frost', [P('tesla', [0, 0, 0]), A('bastion', [0, 1, 0], 'adjacent'), P('frost', [1, 0, 1]), P('tesla', [1, 1, 0]), P('tesla', [0, 0, 1])]],
  ['Hailstorm (close quarters) line + Frost + Mortar', mixed('choke', HAILSTORM)],
  ['Railbore, then Bastion (adjacent), then three Railbores', [P('bolt', RAILBORE), A('bastion', [0, 1, 0], 'adjacent'), P('bolt', RAILBORE), P('bolt', RAILBORE), P('bolt', RAILBORE)]],
];
/** The crowd bodies: a crowd role's value shows in how many of these fell, not on the death wave. */
const CROWD = new Set(['swarmling', 'skitter']);
const BUILDS: Build[] = [
  ...EIGHT.map(([name, towers]) => ({ name: `choke, ${name}, economy`, towers, content: baseContent, economy: { startingScrap: 100 } })),
  { name: 'choke, KINETIC only (3 Railbore + Mortar + Missiles), economy', towers: soloKinetic('choke'), content: baseContent, economy: { startingScrap: 100 } },
  { name: 'choke, ENERGY only (3 Tesla + 2 Frost), economy', towers: soloEnergy('choke'), content: baseContent, economy: { startingScrap: 100 } },
  { name: 'choke, BOTH types (2 Railbore + Tesla + Frost + Mortar), economy', towers: bothTypes('choke'), content: baseContent, economy: { startingScrap: 100 } },
  { name: 'choke, Railbore line + Frost + Mortar, economy', towers: mixed('choke', RAILBORE), content: baseContent, economy: { startingScrap: 100 } },
  { name: 'spread, same build, economy', towers: mixed('auto', RAILBORE), content: baseContent, economy: { startingScrap: 100 } },
  { name: 'choke, Hailstorm 60% line + Frost + Mortar, economy', towers: mixed('choke', HAILSTORM), content: baseContent, economy: { startingScrap: 100 } },
  { name: 'choke, Hailstorm 75% line + Frost + Mortar, economy', towers: mixed('choke', HAILSTORM), content: withHailstorm(0.75), economy: { startingScrap: 100 } },
  { name: 'choke, same build, unlimited scrap (capability)', towers: mixed('choke', RAILBORE), content: baseContent, economy: undefined },
  { name: 'choke, Hailstorm (close quarters) line + Frost + Mortar, unlimited scrap (capability)', towers: mixed('choke', HAILSTORM), content: baseContent, economy: undefined },
];

/**
 * Session 28, PR 6: the relic sweep. The reference build with a random set
 * of six held relics - drawn by a seeded LCG from the pool minus
 * consumables (the lab never uses one) and fusion-only relics - at a rarity
 * that cycles common, rare, epic across the sets. The spread of the death
 * waves across sets is the number the layer is bounded by (Daniil's power
 * target, 2026-09-06: a reference build with six random relics on Standard
 * lands between 16 and 24; a set past 24 on every seed is flagged).
 */
const RELIC_SETS = 8;
const RELICS_PER_SET = 6;
function relicSet(n: number): { id: string; rarity: number }[] {
  const pool = baseContent.relicDefs.filter((r) => r.kind !== 'consumable' && !r.fusionOnly);
  let x = 2654435761 + n * 40503;
  const next = (): number => { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; return x; };
  const picked: { id: string; rarity: number }[] = [];
  const used = new Set<number>();
  while (picked.length < RELICS_PER_SET && used.size < pool.length) {
    const i = next() % pool.length;
    if (used.has(i)) continue;
    used.add(i);
    picked.push({ id: pool[i].id, rarity: Math.max(['common', 'rare', 'epic'].indexOf(pool[i].rarity), n % 3) });
  }
  return picked;
}
const RELIC_BOARD = { w: 7, h: 5 };
const RELICS_ONLY = process.argv.includes('--relics');

if (!RELICS_ONLY) console.log(`build sweep · Standard curve · seeds ${SEEDS.join(', ')} · horizon ${MAX_WAVES} · economy 100 scrap where noted\n`);
for (const board of RELICS_ONLY ? [] : BOARDS) {
  console.log(`## board ${board.w}x${board.h}\n`);
  console.log('| build | ' + SEEDS.map((s) => `death @${s}`).join(' | ') + ' | mean | crowd kills | all kills |');
  console.log('|---|' + SEEDS.map(() => '---').join('|') + '|---|---|---|');
  for (const b of BUILDS) {
    const deaths: (number | null)[] = [];
    let crowd = 0;
    let all = 0;
    for (const seed of SEEDS) {
      const spec: LabSpec = {
        seed,
        map: { width: board.w, height: board.h, ...demoKnobs(seed) },
        towers: b.towers,
        relicIds: [],
        difficulty: STANDARD,
        maxWaves: MAX_WAVES,
        economy: b.economy,
      };
      try {
        const r = runLab(spec, b.content);
        deaths.push(r.deathWave);
        for (const [id, k] of Object.entries(r.killsByDef)) { all += k; if (CROWD.has(id)) crowd += k; }
      } catch {
        deaths.push(-1);
      }
    }
    const nums = deaths.map((d) => (d === null ? MAX_WAVES + 1 : d === -1 ? 0 : d));
    const mean = nums.reduce((a, c) => a + c, 0) / nums.length;
    console.log(`| ${b.name} | ${deaths.map((d) => (d === null ? `>${MAX_WAVES}` : d === -1 ? 'n/a' : String(d))).join(' | ')} | ${mean.toFixed(1)} | ${(crowd / SEEDS.length).toFixed(0)} | ${(all / SEEDS.length).toFixed(0)} |`);
  }
  console.log('');
}

// ---- the relic sweep (session 28, PR 6) ----
console.log(`## relic sets on ${RELIC_BOARD.w}x${RELIC_BOARD.h} - the reference build (Railbore line + Frost + Mortar, choke, economy) with six held relics\n`);
console.log('| set | relics (rarity) | ' + SEEDS.map((s) => `death @${s}`).join(' | ') + ' | mean |');
console.log('|---|---|' + SEEDS.map(() => '---').join('|') + '|---|');
const means: number[] = [];
const flagged: string[] = [];
const noRelics: number[] = [];
for (let n = -1; n < RELIC_SETS; n++) {
  const set = n < 0 ? [] : relicSet(n);
  const deaths: (number | null)[] = [];
  for (const seed of SEEDS) {
    const spec: LabSpec = { seed, map: { width: RELIC_BOARD.w, height: RELIC_BOARD.h, ...demoKnobs(seed) }, towers: mixed('choke', RAILBORE), relicIds: [], relics: set, difficulty: STANDARD, maxWaves: MAX_WAVES, economy: { startingScrap: 100 } };
    try { deaths.push(runLab(spec, baseContent).deathWave); } catch { deaths.push(-1); }
  }
  const nums = deaths.map((d) => (d === null ? MAX_WAVES + 1 : d === -1 ? 0 : d));
  const mean = nums.reduce((a, c) => a + c, 0) / nums.length;
  if (n < 0) noRelics.push(mean); else means.push(mean);
  const label = n < 0 ? 'no relics (reference)' : set.map((r) => `${r.id} (${['c', 'r', 'e'][r.rarity]})`).join(', ');
  if (n >= 0 && nums.every((d) => d > 24)) flagged.push(`set ${n + 1}`);
  console.log(`| ${n < 0 ? 'ref' : n + 1} | ${label} | ${deaths.map((d) => (d === null ? `>${MAX_WAVES}` : d === -1 ? 'n/a' : String(d))).join(' | ')} | ${mean.toFixed(1)} |`);
}
const lo = Math.min(...means);
const hi = Math.max(...means);
console.log(`\nspread across ${RELIC_SETS} sets: ${lo.toFixed(1)} to ${hi.toFixed(1)} (reference without relics ${noRelics[0].toFixed(1)}); target band 16-24; past 24 on every seed: ${flagged.length ? flagged.join(', ') : 'none'}\n`);
