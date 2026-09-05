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
const pair = (at: TowerPlacement['at'], a: TowerPlacement, b: TowerPlacement, rest: TowerPlacement[]): TowerPlacement[] => [a, b, ...rest].map((t) => ({ ...t, at }));
const P = (towerId: string, choices: [number, number, number]): TowerPlacement => ({ towerId, choices, at: 'choke' });
const EIGHT: [string, TowerPlacement[]][] = [
  ['Laser line + Frost (Focus, Overheat, Cutter)', pair('choke', P('laser', [0, 0, 0]), P('frost', [1, 0, 1]), [P('laser', [0, 0, 0]), P('laser', [1, 1, 0]), P('bolt', RAILBORE)])],
  ['Missiles + Bastion + Railbore', pair('choke', P('missile', [0, 1, 0]), P('bastion', [0, 0, 0]), [P('bolt', RAILBORE), P('missile', [1, 0, 1]), P('bolt', RAILBORE)])],
  ['Tesla + Bastion + Frost', pair('choke', P('tesla', [0, 0, 0]), P('bastion', [0, 1, 0]), [P('frost', [1, 0, 1]), P('tesla', [1, 1, 0]), P('tesla', [0, 0, 1])])],
  ['Hailstorm (close quarters) line + Frost + Mortar', mixed('choke', HAILSTORM)],
  ['Bastion + four Railbores', pair('choke', P('bastion', [0, 1, 0]), P('bolt', RAILBORE), [P('bolt', RAILBORE), P('bolt', RAILBORE), P('bolt', RAILBORE)])],
];
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

console.log(`build sweep · Standard curve · seeds ${SEEDS.join(', ')} · horizon ${MAX_WAVES} · economy 100 scrap where noted\n`);
for (const board of BOARDS) {
  console.log(`## board ${board.w}x${board.h}\n`);
  console.log('| build | ' + SEEDS.map((s) => `death @${s}`).join(' | ') + ' | mean |');
  console.log('|---|' + SEEDS.map(() => '---').join('|') + '|---|');
  for (const b of BUILDS) {
    const deaths: (number | null)[] = [];
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
      } catch {
        deaths.push(-1);
      }
    }
    const nums = deaths.map((d) => (d === null ? MAX_WAVES + 1 : d === -1 ? 0 : d));
    const mean = nums.reduce((a, c) => a + c, 0) / nums.length;
    console.log(`| ${b.name} | ${deaths.map((d) => (d === null ? `>${MAX_WAVES}` : d === -1 ? 'n/a' : String(d))).join(' | ')} | ${mean.toFixed(1)} |`);
  }
  console.log('');
}
