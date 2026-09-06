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
import { TileLibrary } from '../tiles/board';
import { mapCells, generateMap } from '../mapgen/mapgen';
import { Sim, type SimOptions } from './sim';
import { contentHashOf, playReplay, REPLAY_VERSION, type Replay } from './replay';
import type { EnemyDef, TowerDef } from './defs';

const g = (...rows: string[]): string[] => rows;
const LIB = new TileLibrary([
  { id: 'straight', cells: g('GGGGG', 'GGGGG', 'XXXXX', 'GGGGG', 'GGGGG') },
  { id: 'corner', cells: g('GGGGG', 'GGGGG', 'XXXGG', 'GGXGG', 'GGXGG') },
  { id: 'tee', cells: g('GGGGG', 'GGGGG', 'XXXXX', 'GGXGG', 'GGXGG') },
  { id: 'cross', cells: g('GGXGG', 'GGXGG', 'XXXXX', 'GGXGG', 'GGXGG') },
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
  const opts = { width: 10, height: 6, entries: 3, targetPathCells: 40 };
  const map = generateMap(createRng(GOLDEN_SEED).stream('map'), LIB, opts);
  const cells = mapCells(map, LIB);
  const simOpts: SimOptions = {
    cells,
    cellsW: map.cellsW,
    cellsH: map.cellsH,
    map,
    enemyDefs,
    towerDefs,
    mode: 'waves',
    firstWaveWaits: false,
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
      const nearRoad = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => sim.cellAt(x + dx, y + dy) === 'X');
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
    // 465947152 -> 3768274921 on 2026-08-16 (playtest-4 round): the map
    // generator fills enclosed voids and allows plain ground in the outer
    // ring, changing the golden seed's map - an intended generation change;
    // the round-trip test above still proves bit-identical replay.
    // 3768274921 -> 2003059284 on 2026-08-17 (WBS 2.19, playtest 8): a fired
    // shot always resolves - projectiles carry a committed aim point (two new
    // hashed lanes), homing shots re-acquire instead of evaporating when
    // their target dies, and detonation is one point-based rule. An intended
    // combat-behaviour change; round-trip replay still proves bit-identical.
    // 2003059284 -> 185380119 on 2026-08-18 (playtest 12): the outer fill
    // ring ALWAYS places terrain - the old stay-void roll put voids inside
    // the landmass and nearer the road than the void rule permits (enclosed
    // holes and cap-converted slots re-rolled as ring). One fewer rng draw
    // per ring slot changes the golden seed's map - an intended generation
    // change; round-trip replay still proves bit-identical.
    // 185380119 -> 3560523584 on 2026-08-19 (2.27 rebuild, PR 2): the road
    // carve was rebuilt constraint-first against spec sec 12 - the path
    // target is cell-denominated per entry and never relaxed, and branch
    // starts and anchor joints gate on tile availability. Different draw
    // pattern on the map stream = different golden map, intended and
    // stable across repeated runs; round-trip replay still proves
    // bit-identical.
    // 3560523584 -> 1729252059 on 2026-08-19 (2.27 rebuild, PR 3): the
    // terrain half - void share drawn from the D14 curve (one new roll),
    // enclosed-void repair pass deleted (D11), ore floor deleted (D12,
    // two fewer shuffle spends), caches uniform over all ground (D16).
    // Same rebuild arc, same reasons; round-trip replay bit-identical.
    // 1729252059 -> 3616661931 on 2026-09-03 (design round 1, PR 1): the
    // wave clock runs launch-to-launch (40 s default) instead of waiting
    // for the last enemy, the next wave is composed one wave ahead (the
    // waves stream is spent earlier), boss waves replace the elite surge,
    // enemy hp carries the path-length offset, and three new lanes are
    // hashed (boss flag, last-hit tick, the next queue). An intended
    // tempo change; round-trip replay still proves bit-identical.
    // 3616661931 -> 1817380755 on 2026-09-03 (design round 1, PR 2): three
    // new hashed lanes (relics bought, rerolls bought, Core hp maximum - a
    // consumable can now raise it). No behaviour change on this run;
    // round-trip replay still proves bit-identical.
    // 1817380755 -> 304351235 on 2026-09-03 (design round 1, PR 5, the tower
    // rework): a tower's pulse count and three new projectile lanes (pierce,
    // shield multiplier, armour-ignoring) are hashed; volleys and slows now
    // read the folded stats. No behaviour change on this run's untiered
    // bolts; round-trip replay still proves bit-identical.
    // 304351235 -> 423829641 on 2026-09-05 (session 24, PR 1, the Core at
    // the edge): the golden map itself changed - the Core is a three-cell
    // face past the east border instead of a tile near the centre, the
    // road tree roots at the east border, and the cell grid is one column
    // wider. Same rules, different world; round-trip replay still proves
    // bit-identical.
    // 423829641 -> 622218226 on 2026-09-05 (session 24, PR 2, the board
    // fills): the carve is v4 - specials first, walks planned to one lane
    // length, entries emergent until the board is nine tenths road. The
    // golden map changed again; the sim did not. Round-trip replay still
    // proves bit-identical. (622218226 -> 1486502285 within the same PR:
    // the walk's weighting changed while the carve was tuned on the sweep.)
    // 1486502285 -> 3921408197 on 2026-09-05 (session 26, PR 3, tower
    // facing): facing and beam heat joined the per-tower hash. The golden
    // world and its rules did not change - every tower now carries two more
    // hashed numbers (facing east, heat 1). Round-trip replay still proves
    // bit-identical.
    // 3921408197 -> 1825542629 on 2026-09-06 (session 28, PR 1, the passive
    // layer): the passive offer wave, the held passives and the standing
    // passive offer joined the hash (three more lanes, all zero/empty in the
    // golden world - it has no passive pool). Round-trip replay still proves
    // bit-identical.
    // 1825542629 -> 3921408197 on 2026-09-06 evening: the passive layer folded
    // back into the relic pool (Daniil: passives are relics) and its three
    // lanes left the hash - the value is the pre-passive one again, which is
    // the proof that nothing else moved.
    // 3921408197 -> 4031597317 on 2026-09-06 (session 29, PR 4, Ore by tier):
    // the purse is three tiers long from the start and every tier is hashed -
    // two more lanes, both zero in the golden world (no tiered vein). No
    // behaviour change on this run; round-trip replay still proves bit-identical.
    expect(sim.hashState()).toBe(4031597317);
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
