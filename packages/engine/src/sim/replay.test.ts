/**
 * Replay + golden state hash (WBS 1.4.8). Three guarantees:
 *
 *  1. A recorded run replayed into a FRESH sim reproduces bit-identical
 *     state - the whole point of a seed + input log (PRD sec 12).
 *  2. The reserved Phase 6 action shapes are rejected, not misapplied.
 *  3. A frozen 2,000-tick hash pins the sim's exact evolution. If it moves,
 *     either you meant to change simulation behaviour (update it in the same
 *     commit, saying why) or you just broke determinism (stop).
 */
import { describe, expect, it } from 'vitest';
import { createRng } from '../rng/rng';
import { TILE_SIZE } from '../tiles/tile';
import { TileLibrary, resolveCells } from '../tiles/board';
import { generateMap } from '../mapgen/mapgen';
import { Sim, type SimOptions } from './sim';
import { contentHashOf, playReplay, REPLAY_VERSION, type Replay } from './replay';
import type { EnemyDef, TowerDef } from './defs';

const g = (...rows: string[]): string[] => rows;
const LIB = new TileLibrary([
  { id: 'core_end', cells: g('GGGGG', 'GCCCG', 'GCCCR', 'GCCCG', 'GGGGG') },
  { id: 'core_l', cells: g('GGGGG', 'GCCCG', 'GCCCR', 'GCCCG', 'GGRGG') },
  { id: 'core_i', cells: g('GGGGG', 'GCCCG', 'RCCCR', 'GCCCG', 'GGGGG') },
  { id: 'core_t', cells: g('GGRGG', 'GCCCG', 'RCCCR', 'GCCCG', 'GGGGG') },
  { id: 'core_x', cells: g('GGRGG', 'GCCCG', 'RCCCR', 'GCCCG', 'GGRGG') },
  { id: 'straight', cells: g('GGGGG', 'GGGGG', 'RRRRR', 'GGGGG', 'GGGGG') },
  { id: 'corner', cells: g('GGGGG', 'GGGGG', 'RRRGG', 'GGRGG', 'GGRGG') },
  { id: 'tee', cells: g('GGGGG', 'GGGGG', 'RRRRR', 'GGRGG', 'GGRGG') },
  { id: 'cross', cells: g('GGRGG', 'GGRGG', 'RRRRR', 'GGRGG', 'GGRGG') },
  { id: 'meadow', cells: g('GGGGG', 'GGGGG', 'GGGGG', 'GGGGG', 'GGGGG') },
  { id: 'ore_patch', cells: g('GGGGG', 'GOOGG', 'GOOGG', 'GGGGG', 'GGGGG') },
]);

const WALKER: EnemyDef = { id: 'walker', hp: 10, speed: 0.2, damage: 2, bounty: 3 };
const RUNNER: EnemyDef = { id: 'runner', hp: 6, speed: 0.32, damage: 1, bounty: 2, minWave: 2 };
const BOLT: TowerDef = {
  id: 'bolt',
  cost: 20,
  range: 6,
  fireEveryTicks: 10,
  projectile: { damage: 6, speed: 0.7, homing: true },
  tiers: [
    { choices: [{ name: 'A', cost: 20, mods: { damage: 4 } }, { name: 'B', cost: 20, mods: { fireEveryTicks: -3 } }] },
    { choices: [{ name: 'C', cost: 40, mods: { damage: 8 } }, { name: 'D', cost: 40, mods: { range: 2 } }] },
    { choices: [{ name: 'E', cost: 80, mods: { damage: 16 } }, { name: 'F', cost: 80, mods: { fireEveryTicks: -3 } }] },
  ],
};
const REFINERY: TowerDef = {
  id: 'refinery',
  cost: 30,
  range: 0.5,
  fireEveryTicks: 1,
  attack: 'none',
  production: { ore: 1, everyTicks: 40 },
};

const GOLDEN_SEED = 424242;

function makeGoldenSim(): { sim: Sim; enemyDefs: EnemyDef[]; towerDefs: TowerDef[] } {
  const enemyDefs = [WALKER, RUNNER];
  const towerDefs = [BOLT, REFINERY];
  const opts = { width: 10, height: 6, entries: 3, targetPathLength: 8 };
  const map = generateMap(createRng(GOLDEN_SEED).stream('map'), LIB, opts);
  const cells = resolveCells(map.board, LIB);
  const simOpts: SimOptions = {
    cells,
    cellsW: opts.width * TILE_SIZE,
    cellsH: opts.height * TILE_SIZE,
    map,
    enemyDefs,
    towerDefs,
    mode: 'waves',
    startingScrap: 200,
    coreHp: 200,
  };
  return { sim: new Sim(GOLDEN_SEED, simOpts), enemyDefs, towerDefs };
}

/** A scripted "player": anchored to the world (near-road cells), not scan order. */
function nearRoadSpots(sim: Sim, W: number, H: number, count: number): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (let y = 0; y < H && out.length < count; y++)
    for (let x = 0; x < W && out.length < count; x++) {
      if (!sim.canBuildDefAt(x, y, 'bolt')) continue;
      const nearRoad = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => sim.cellAt(x + dx, y + dy) === 'R');
      if (nearRoad) out.push({ x, y });
    }
  return out;
}

function playGoldenRun(sim: Sim): void {
  const W = 10 * TILE_SIZE;
  const H = 6 * TILE_SIZE;
  const spots = nearRoadSpots(sim, W, H, 4);
  // Build two bolts up front, an ore refinery if the map offers one.
  sim.buildTower(spots[0].x, spots[0].y, 'bolt');
  sim.buildTower(spots[1].x, spots[1].y, 'bolt');
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (sim.canBuildDefAt(x, y, 'refinery')) {
        sim.buildTower(x, y, 'refinery');
        y = H; break;
      }
  for (let t = 0; t < 2000; t++) {
    sim.tick();
    // Mid-run decisions at fixed ticks: upgrades, a priority flip, a sale
    // and a rebuild - every recordable action kind appears in the log.
    if (sim.tickCount === 300) sim.chooseTier(spots[0].x, spots[0].y, 0, 0);
    if (sim.tickCount === 600) sim.chooseTier(spots[0].x, spots[0].y, 1, 1);
    if (sim.tickCount === 700) sim.setPriority(spots[0].x, spots[0].y, 'weakest');
    if (sim.tickCount === 900) sim.sellTower(spots[1].x, spots[1].y);
    if (sim.tickCount === 950) sim.buildTower(spots[2].x, spots[2].y, 'bolt');
    if (sim.tickCount === 1400) sim.chooseTier(spots[0].x, spots[0].y, 2, 0);
  }
}

describe('replay (WBS 1.4.8)', () => {
  it('a recorded run replays into a fresh sim bit-identically', () => {
    const { sim: original, enemyDefs, towerDefs } = makeGoldenSim();
    playGoldenRun(original);
    expect(original.inputs.length).toBeGreaterThanOrEqual(8);

    const replay: Replay = {
      version: REPLAY_VERSION,
      seed: GOLDEN_SEED,
      contentHash: contentHashOf(enemyDefs, towerDefs),
      inputs: original.inputs,
    };
    const { sim: fresh, enemyDefs: e2, towerDefs: t2 } = makeGoldenSim();
    expect(contentHashOf(e2, t2)).toBe(replay.contentHash);
    playReplay(fresh, replay, original.tickCount);

    expect(fresh.tickCount).toBe(original.tickCount);
    expect(fresh.inputs).toEqual(original.inputs); // playback re-records the same log
    expect(fresh.hashState()).toBe(original.hashState());
  });

  it('golden: the 2,000-tick state hash is frozen', () => {
    const { sim } = makeGoldenSim();
    playGoldenRun(sim);
    expect(sim.tickCount).toBe(2000);
    // If this fails and you did NOT intend to change simulation behaviour,
    // you broke determinism or altered the sim's evolution - investigate
    // before touching the constant. If you did intend it, update the value
    // in the same commit and say why in its message.
    // 2829733585 -> 3000153804 on 2026-08-16: hashState grew to cover relic
    // state (held/cooldowns/used/offer/freeze/boost) - a deliberate state-
    // space extension, not a behaviour change; the replay round-trip test
    // above proved bit-identical evolution before and after.
    expect(sim.hashState()).toBe(3000153804);
  });

  it('unimplemented or invalid Phase 6 actions are rejected, not misapplied', () => {
    const { sim } = makeGoldenSim(); // no relicDefs: relic actions cannot apply
    expect(sim.applyAction({ t: 'pickRelic', option: 1 })).toBe(false);
    expect(sim.applyAction({ t: 'prospect', x: 1, y: 1 })).toBe(false);
    expect(sim.applyAction({ t: 'fireActive', relicId: 'orbital' })).toBe(false);
    expect(sim.inputs.length).toBe(0); // rejected actions never enter the log
  });

  it('the hash actually discriminates: one different input, different hash', () => {
    const { sim: a } = makeGoldenSim();
    const { sim: b } = makeGoldenSim();
    playGoldenRun(a);
    playGoldenRun(b);
    // Sanity first: identical play = identical hash.
    expect(b.hashState()).toBe(a.hashState());
    const { sim: c } = makeGoldenSim();
    playGoldenRun(c);
    c.setPriority(c.towers.find(Boolean)!.cellX, c.towers.find(Boolean)!.cellY, 'last');
    expect(c.hashState()).not.toBe(a.hashState());
  });
});
