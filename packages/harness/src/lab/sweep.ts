/**
 * The variant sweep (session 22, PR 5): every full upgrade path of every
 * fighting tower, five copies auto-placed, run headless on the SAME seeds at
 * the OLD board (12x7) and the NEW one (7x5, a 1920x1080 screen since D24),
 * at the shipped Standard curve. Two questions, both answered by a table
 * rather than an opinion:
 *
 *   1. Does a path win on every seed? Design round 1's gate says no path
 *      may dominate; the tower rework (D23) made each fork two roles.
 *   2. What did the smaller board do to difficulty? Fewer cells, shorter
 *      lanes, the L offset pulling the other way - measured, not guessed.
 *
 * Run: node tools/sweep.mjs [seeds...]
 */
declare const console: { log: (...args: unknown[]) => void };

import { TileLibrary, type DifficultySpec } from '@ascii-defense/engine';
import { validateEnemies, validateRelics, validateTowers } from '@ascii-defense/content';
import libraryJson from '@ascii-defense/content/assets/tiles/library.json';
import enemiesJson from '@ascii-defense/content/assets/enemies/roster.json';
import towersJson from '@ascii-defense/content/assets/towers/roster.json';
import relicsJson from '@ascii-defense/content/assets/relics/pool.json';
import { runLab, type LabContent, type LabSpec } from './lab';

const must = <T,>(r: { ok: true; value: T } | { ok: false; errors: unknown[] }): T => {
  if (!r.ok) throw new Error(JSON.stringify(r.errors));
  return r.value;
};

const content: LabContent = {
  lib: new TileLibrary(libraryJson.tiles),
  towerDefs: must(validateTowers.check(towersJson)).towers,
  enemyDefs: must(validateEnemies.check(enemiesJson)).enemies,
  relicDefs: must(validateRelics.check(relicsJson)).relics,
};

/** Standard, as protocol.ts ships it. */
const STANDARD: DifficultySpec = { hpLinear: 0.18, hpGeometric: 1.06, countBase: 6, countLinear: 4, countGeometric: 1 };
const MAX_WAVES = 40;
const BOARDS = [{ w: 12, h: 7 }, { w: 7, h: 5 }];
const PATHS: [number, number, number][] = [];
for (const a of [0, 1]) for (const b of [0, 1]) for (const c of [0, 1]) PATHS.push([a, b, c]);

const argSeeds = (globalThis as unknown as { process?: { argv: string[] } }).process?.argv.slice(2).map(Number).filter((n) => Number.isInteger(n) && n > 0) ?? [];
const SEEDS = argSeeds.length ? argSeeds : [945046, 12345, 777, 2024];

const pathName = (towerId: string, p: [number, number, number]): string =>
  p.map((o, tier) => content.towerDefs.find((d) => d.id === towerId)!.tiers![tier].choices[o].name).join(' / ');

console.log(`variant sweep · Standard curve · 5 towers per build · seeds ${SEEDS.join(', ')} · horizon ${MAX_WAVES}\n`);
for (const board of BOARDS) {
  console.log(`## board ${board.w}x${board.h}\n`);
  console.log('| tower | path | ' + SEEDS.map((s) => `death @${s}`).join(' | ') + ' | mean |');
  console.log('|---|---|' + SEEDS.map(() => '---').join('|') + '|---|');
  const rows: { tower: string; path: string; deaths: (number | null)[]; mean: number }[] = [];
  for (const towerId of ['bolt', 'mortar', 'frost']) {
    for (const p of PATHS) {
      const deaths: (number | null)[] = [];
      for (const seed of SEEDS) {
        const spec: LabSpec = {
          seed,
          map: { ...demoKnobs(seed), width: board.w, height: board.h },
          towers: Array.from({ length: 5 }, () => ({ towerId, choices: p, at: 'auto' as const })),
          relicIds: [],
          difficulty: STANDARD,
          maxWaves: MAX_WAVES,
        };
        try {
          deaths.push(runLab(spec, content).deathWave);
        } catch {
          deaths.push(-1); // could not place (no spot): reported, not hidden
        }
      }
      const finite = deaths.map((d) => (d === null ? MAX_WAVES + 1 : d === -1 ? 0 : d));
      const mean = finite.reduce((a, b) => a + b, 0) / finite.length;
      rows.push({ tower: towerId, path: pathName(towerId, p), deaths, mean });
    }
  }
  for (const r of rows) {
    console.log(`| ${r.tower} | ${r.path} | ${r.deaths.map((d) => (d === null ? `>${MAX_WAVES}` : d === -1 ? 'n/a' : String(d))).join(' | ')} | ${r.mean.toFixed(1)} |`);
  }
  // Dominance: a path that is best-or-equal on EVERY seed within its tower.
  for (const towerId of ['bolt', 'mortar', 'frost']) {
    const mine = rows.filter((r) => r.tower === towerId);
    const dominant = mine.filter((r) => SEEDS.every((_, i) => mine.every((o) => score(r.deaths[i]) >= score(o.deaths[i]))));
    console.log(`\n${towerId}: ${dominant.length === 0 ? 'no path dominates every seed' : 'DOMINANT on every seed: ' + dominant.map((d) => d.path).join('; ')}`);
  }
  console.log('');
}

function score(d: number | null): number {
  return d === null ? MAX_WAVES + 1 : d === -1 ? 0 : d;
}

/** The app's knob derivation for a seed (protocol.ts Standard), minus the board. */
function demoKnobs(seed: number): { entries: number; targetPathCells: number } {
  // Mirrors workerRuntime: the map stream's first two draws.
  const { createRng, TILE_SIZE } = engineRng();
  const knobs = createRng(seed).stream('map');
  const entries = knobs.int(2, 5);
  const targetPathCells = (8 + Math.max(knobs.int(0, 18), knobs.int(0, 18))) * TILE_SIZE;
  return { entries, targetPathCells };
}
import * as engine from '@ascii-defense/engine';
function engineRng(): { createRng: typeof engine.createRng; TILE_SIZE: number } {
  return { createRng: engine.createRng, TILE_SIZE: engine.TILE_SIZE };
}
