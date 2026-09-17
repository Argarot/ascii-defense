/**
 * The ore sweep (2026-09-17; PRD sec 26, D30): the ladder's three numbers -
 * spawn chance, vein size, mining cycle - measured, not asked for
 * (CONTRIBUTING sec 6 rule 7).
 *
 *  1. THE CENSUS: how many veins the dice deal a map, per Threat, and what
 *     share of maps carries a tier-2 / tier-3 vein at a candidate chance.
 *     The target is stated in the doc this prints into; the constant is
 *     whichever candidate meets it.
 *  2. THE PROPERTY: a seed's board, rock and boons are the same map with
 *     and without the upgrade. Counted, not assumed.
 *  3. THE INCOME: the base world with Rich veins bought, a Refinery on the
 *     richest vein - what a run banks by tier on the maps that have a
 *     tier-2 vein and on the ones that do not.
 *
 *   node tools/ore-sweep.mjs [seeds=400]
 */
import { ORE_TIER_SPAWN, ORE_TIER_VEIN, THREAT_LEVELS, TileLibrary, createRng, generateMap, threatKnobs, type DifficultySpec, type GeneratedMap } from '@ascii-defense/engine';
import { validateEnemies, validateRelics, validateTowers, validateTree } from '@ascii-defense/content';
import treeJson from '@ascii-defense/content/assets/tree/nodes.json';
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
const content: LabContent = {
  lib: new TileLibrary(libraryJson.tiles),
  enemyDefs: must(validateEnemies.check(enemiesJson)).enemies,
  towerDefs: must(validateTowers.check(towersJson)).towers,
  relicDefs: must(validateRelics.check(relicsJson)).relics,
  tree: must(validateTree.check(treeJson)),
};
const pool = content.relicDefs.length;
const N = Number(process.argv[2] ?? 400);
const BOARD = { w: 7, h: 5 };
const THREATS = THREAT_LEVELS;
const mean = (a: number[]): number => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const pct = (x: number): string => (100 * x).toFixed(1) + '%';

function mapFor(seed: number, t: (typeof THREATS)[number], oreTierMax: number): GeneratedMap | null {
  const knobs = createRng(seed).stream('map');
  const { entries, targetPathCells } = threatKnobs(knobs, t);
  try {
    return generateMap(knobs, content.lib, { width: BOARD.w, height: BOARD.h, entries, targetPathCells, relicPoolSize: pool, specials: [], oreTierMax });
  } catch { return null; }
}

// ---- 1. the census ----------------------------------------------------------
const CANDIDATES = [0.011, 0.02, 0.03, 0.06, 0.1];
console.log(`## 1. the census - ${N} seeds per Threat on the app's ${BOARD.w}x${BOARD.h} board, no tier open\n`);
console.log(`| threat | veins dealt per map: mean (min-max) | maps with no vein | ${CANDIDATES.map((p) => `maps with a rare vein at p=${p}`).join(' | ')} |`);
console.log(`|---|---|---|${CANDIDATES.map(() => '---').join('|')}|`);
const veinCounts: Record<string, number[]> = {};
for (const t of THREATS) {
  const counts: number[] = [];
  for (let i = 1; i <= N; i++) { const m = mapFor(i * 7919 + 13, t, 1); if (m) counts.push(m.deposits.length); }
  veinCounts[t.name] = counts;
  const share = (p: number): number => mean(counts.map((n) => 1 - Math.pow(1 - p, n)));
  console.log(`| ${t.name} | ${mean(counts).toFixed(2)} (${Math.min(...counts)}-${Math.max(...counts)}) | ${pct(counts.filter((n) => n === 0).length / counts.length)} | ${CANDIDATES.map((p) => pct(share(p))).join(' | ')} |`);
}

// ---- 2. the property, and the shipped constants as the dice deal them -------
console.log(`\n## 2. the shipped constants, dealt - spawn ${ORE_TIER_SPAWN.join(' / ')}, vein scale ${ORE_TIER_VEIN.map((v) => v.toFixed(2)).join(' / ')}\n`);
console.log('| threat | tier open | maps with a tier-2 vein | maps with a tier-3 vein | tier-2 vein mean Ore | tier-3 vein mean Ore | tier-1 vein mean Ore | maps whose board, rock or boons moved |');
console.log('|---|---|---|---|---|---|---|---|');
const sameButVeins = (a: GeneratedMap, b: GeneratedMap): boolean =>
  JSON.stringify([a.board, a.rockContents, a.boons, a.entries, a.deposits.map((d) => [d.x, d.y])]) === JSON.stringify([b.board, b.rockContents, b.boons, b.entries, b.deposits.map((d) => [d.x, d.y])]);
for (const t of THREATS)
  for (const open of [2, 3]) {
    let with2 = 0; let with3 = 0; let moved = 0; let maps = 0;
    const a1: number[] = []; const a2: number[] = []; const a3: number[] = [];
    for (let i = 1; i <= N; i++) {
      const seed = i * 7919 + 13;
      const base = mapFor(seed, t, 1); const m = mapFor(seed, t, open);
      if (!base || !m) continue;
      maps++;
      if (!sameButVeins(base, m)) moved++;
      if (m.deposits.some((d) => d.tier === 2)) with2++;
      if (m.deposits.some((d) => d.tier === 3)) with3++;
      for (const d of m.deposits) (d.tier === 3 ? a3 : d.tier === 2 ? a2 : a1).push(d.amount);
    }
    console.log(`| ${t.name} | ${open} | ${pct(with2 / maps)} | ${pct(with3 / maps)} | ${mean(a2).toFixed(1)} | ${a3.length ? mean(a3).toFixed(1) : '-'} | ${mean(a1).toFixed(1)} | ${moved} / ${maps} |`);
  }

// ---- 3. the income ----------------------------------------------------------
const STANDARD: DifficultySpec = THREAT_LEVELS[1].difficulty;
const RAILBORE: [number, number, number] = [0, 0, 0];
const at = (towerId: string, choices: [number, number, number], where: TowerPlacement['at']): TowerPlacement => ({ towerId, choices, at: where });
const BASE_BUILD: TowerPlacement[] = [at('refinery', [0, 0, 0], 'vein'), at('bolt', RAILBORE, 'choke'), at('frost', [1, 0, 1], 'choke'), at('bolt', RAILBORE, 'choke'), at('mortar', [1, 1, 0], 'choke'), at('bolt', RAILBORE, 'choke')];
const INCOME_SEEDS = Math.min(N, 120);
console.log(`\n## 3. the income - the base world + Rich veins bought, Standard, a Refinery on the richest vein, ${INCOME_SEEDS} seeds\n`);
const std = THREATS[1];
const banked: { has2: boolean; ore: number[]; death: number }[] = [];
for (let i = 1; i <= INCOME_SEEDS; i++) {
  const seed = i * 7919 + 13;
  const knobs = createRng(seed).stream('map');
  const { entries, targetPathCells } = threatKnobs(knobs, std);
  const mapOpts = { width: BOARD.w, height: BOARD.h, entries, targetPathCells };
  const spec: LabSpec = { seed, map: mapOpts, towers: BASE_BUILD, relicIds: [], unlocks: ['ore_t2'], difficulty: STANDARD, maxWaves: 40, economy: { startingScrap: 100 } };
  try {
    const rep = runLab(spec, content);
    // The lab's own map for this spec (a fresh 'map' stream, as makeWorld deals it).
    const probe = generateMap(createRng(seed).stream('map'), content.lib, { ...mapOpts, relicPoolSize: pool, specials: [], oreTierMax: 2 });
    banked.push({ has2: probe.deposits.some((d) => d.tier === 2), ore: [...rep.oreEnd], death: rep.deathWave ?? 40 });
  } catch { /* a seed the carve refuses is not an income reading */ }
}
const rich = banked.filter((b) => b.has2); const plain = banked.filter((b) => !b.has2);
console.log('| maps | runs | tier-1 banked, mean | tier-2 banked, mean (max) | death wave, mean |');
console.log('|---|---|---|---|---|');
console.log(`| with a tier-2 vein | ${rich.length} | ${mean(rich.map((b) => b.ore[0])).toFixed(1)} | ${mean(rich.map((b) => b.ore[1])).toFixed(1)} (${Math.max(0, ...rich.map((b) => b.ore[1]))}) | ${mean(rich.map((b) => b.death)).toFixed(1)} |`);
console.log(`| without | ${plain.length} | ${mean(plain.map((b) => b.ore[0])).toFixed(1)} | ${mean(plain.map((b) => b.ore[1])).toFixed(1)} | ${mean(plain.map((b) => b.death)).toFixed(1)} |`);
console.log(`| every run | ${banked.length} | ${mean(banked.map((b) => b.ore[0])).toFixed(1)} | ${mean(banked.map((b) => b.ore[1])).toFixed(2)} | ${mean(banked.map((b) => b.death)).toFixed(1)} |`);
