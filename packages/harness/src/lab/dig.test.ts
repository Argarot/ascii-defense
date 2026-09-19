/**
 * Digging (PRD sec 32.2, D43; Rework I, PR 2) on the app's own maps with the
 * prototype's switch on: one layer of sight held CELL BY CELL against a plain
 * restatement of the rule, a pad under every rock, one crew with a queue, a
 * flat price - and prospecting untouched with the switch off.
 */
import { describe, expect, it } from 'vitest';
import { REWORK_DIG, Sim, THREAT_LEVELS, TICK_HZ, TileLibrary, createRng, generateMap, isRoad, mapCells, reworkKnobs, reworkRules, threatKnobs, type CellType, type EnemyDef, type TowerDef } from '@ascii-defense/engine';
import libraryJson from '@ascii-defense/content/assets/tiles/library.json';

const lib = new TileLibrary(libraryJson.tiles);
const WALKER: EnemyDef = { id: 'walker', hp: 10, speed: 0.25, damage: 1 };
const BOLT: TowerDef = { id: 'bolt', cost: 20, range: 6, fireEveryTicks: 10, projectile: { damage: 6, speed: 0.6, homing: true } };
const SEED = 3 * 7919 + 13;

function world(seed: number, rework: boolean, scrap = 1000): { sim: Sim; W: number; H: number; cells: (CellType | null)[] } {
  const t = THREAT_LEVELS[1];
  const knobs = createRng(seed).stream('map');
  const map = generateMap(knobs, lib, { width: 7, height: 5, ...threatKnobs(knobs, t), relicPoolSize: 54, specials: [], ...(rework ? reworkKnobs(t) : {}) });
  const cells = mapCells(map, lib);
  const sim = new Sim(seed, { cells, cellsW: map.cellsW, cellsH: map.cellsH, map, enemyDefs: [WALKER], towerDefs: [BOLT], maxSpawns: 0, coreHp: 1_000_000, startingScrap: scrap, rework: rework ? reworkRules() : undefined });
  return { sim, W: map.cellsW, H: map.cellsH, cells };
}
const open = (c: CellType | null): boolean => c !== null && (c === 'G' || c === 'O' || c === 'C' || isRoad(c));
/** The rule, said plainly: a cell is known when an open cell is within one step of it, diagonals included. */
function touchesOpen(sim: Sim, W: number, H: number, x: number, y: number): boolean {
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < W && ny < H && open(sim.cellAt(nx, ny))) return true;
    }
  return false;
}
const rocks = (sim: Sim, W: number, H: number, known: boolean): { x: number; y: number }[] => {
  const out: { x: number; y: number }[] = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (sim.cellAt(x, y) === 'R' && sim.cellKnown(x, y) === known) out.push({ x, y });
  return out;
};
const run = (sim: Sim, ticks: number): void => { for (let i = 0; i < ticks; i++) sim.tick(); };

describe('digging: one layer of sight', () => {
  it('every cell of the board is known exactly when an open cell touches it - checked cell by cell', () => {
    const { sim, W, H } = world(SEED, true);
    let unknown = 0;
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const c = sim.cellAt(x, y);
        if (c !== 'R' && c !== 'D') continue;
        expect(sim.cellKnown(x, y), `cell ${x},${y} (${c})`).toBe(touchesOpen(sim, W, H, x, y));
        if (!sim.cellKnown(x, y)) unknown++;
      }
    expect(unknown).toBeGreaterThan(100); // most of the ground is behind something
  });

  it('a rock the player cannot see into cannot be dug; one they can, can', () => {
    const { sim, W, H } = world(SEED, true);
    const hidden = rocks(sim, W, H, false)[0];
    const seen = rocks(sim, W, H, true)[0];
    expect(hidden && seen).toBeTruthy();
    expect(sim.prospect(hidden.x, hidden.y)).toBe(false);
    expect(sim.prospect(seen.x, seen.y)).toBe(true);
  });

  it('a finished dig is a pad, and it opens the cells around it: the tunnel', () => {
    const { sim, W, H } = world(SEED, true);
    // A seen rock with a hidden cell beside it: digging it must reveal that neighbour.
    const pick = rocks(sim, W, H, true).find((r) => [-1, 0, 1].some((dy) => [-1, 0, 1].some((dx) => { const c = sim.cellAt(r.x + dx, r.y + dy); return (c === 'R' || c === 'D') && !sim.cellKnown(r.x + dx, r.y + dy); })));
    expect(pick, 'a rock at the edge of sight').toBeTruthy();
    const before: string[] = [];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (!sim.cellKnown(pick!.x + dx, pick!.y + dy)) before.push(`${pick!.x + dx},${pick!.y + dy}`);
    expect(sim.prospect(pick!.x, pick!.y)).toBe(true);
    run(sim, REWORK_DIG.seconds * TICK_HZ - 1);
    expect(sim.cellAt(pick!.x, pick!.y)).toBe('R'); // slow: forty-five seconds, to the tick
    run(sim, 1);
    expect(sim.cellAt(pick!.x, pick!.y)).toBe('G');
    expect(sim.canBuildAt(pick!.x, pick!.y)).toBe(true);
    for (const k of before) { const [x, y] = k.split(',').map(Number); expect(sim.cellKnown(x, y), `${k} is seen from the new pad`).toBe(true); }
  });
});

describe('digging: what is under a rock, what it costs, who digs', () => {
  it('there is a pad under EVERY rock - and boon ground where the map dealt a find; never a vein, never a cache', () => {
    const { sim, W, H } = world(SEED, true, 1_000_000);
    const map = (sim as unknown as { opts: { map: { rockContents: { x: number; y: number; yields: string }[] } } }).opts.map;
    let dug = 0; let boons = 0;
    // Dig outward until nothing seen is left: every rock the tunnel can reach.
    for (let round = 0; round < 40; round++) {
      const seen = rocks(sim, W, H, true).filter((r) => sim.prospectJobAt(r.x, r.y) === null).slice(0, REWORK_DIG.crews + REWORK_DIG.queue);
      if (seen.length === 0) break;
      for (const r of seen) if (sim.prospect(r.x, r.y)) dug++;
      run(sim, REWORK_DIG.seconds * TICK_HZ * (REWORK_DIG.crews + REWORK_DIG.queue));
      for (const r of seen) {
        expect(sim.cellAt(r.x, r.y), `rock ${r.x},${r.y}`).toBe('G');
        const dealt = map.rockContents.find((c) => c.x === r.x && c.y === r.y)?.yields;
        expect(sim.boonAt(r.x, r.y) !== null, `rock ${r.x},${r.y} dealt '${dealt}'`).toBe(dealt === 'cache');
        if (dealt === 'cache') boons++;
      }
    }
    expect(dug).toBeGreaterThan(10);
    expect(sim.caches.length).toBe(0);
    expect(sim.ore.every((o) => o === 0)).toBe(true);
    void boons;
  });

  it('the price is flat - sixty - and paid when the dig is ordered', () => {
    const { sim, W, H } = world(SEED, true, 100);
    const [a, b] = rocks(sim, W, H, true);
    expect(sim.prospectCost()).toBe(60);
    expect(sim.prospect(a.x, a.y)).toBe(true);
    expect(sim.scrap).toBe(40);
    expect(sim.prospect(b.x, b.y)).toBe(false); // forty is not sixty
  });

  it('one crew: a second dig waits for the first, and the queue behind the crew is short', () => {
    const { sim, W, H } = world(SEED, true, 10_000);
    const seen = rocks(sim, W, H, true);
    const cap = REWORK_DIG.crews + REWORK_DIG.queue;
    expect(seen.length).toBeGreaterThan(cap);
    for (let i = 0; i < cap; i++) expect(sim.prospect(seen[i].x, seen[i].y), `dig ${i + 1}`).toBe(true);
    expect(sim.prospect(seen[cap].x, seen[cap].y), 'the queue is full').toBe(false);
    run(sim, REWORK_DIG.seconds * TICK_HZ);
    expect(sim.cellAt(seen[0].x, seen[0].y)).toBe('G');
    expect(sim.cellAt(seen[1].x, seen[1].y), 'the second rock has not been touched yet').toBe('R');
    expect(sim.prospectJobAt(seen[1].x, seen[1].y)?.remaining).toBe(REWORK_DIG.seconds * TICK_HZ);
    run(sim, REWORK_DIG.seconds * TICK_HZ);
    expect(sim.cellAt(seen[1].x, seen[1].y)).toBe('G');
  });
});

describe('digging: the switch', () => {
  it('off, everything is known, prospecting costs what it did, and rock still hides what it hid', () => {
    const { sim, W, H } = world(SEED, false);
    expect(sim.digRules).toBeUndefined();
    expect(sim.prospectCost()).toBe(25);
    expect(rocks(sim, W, H, false).length).toBe(0);
    expect(sim.digSight()).toBeNull();
  });
});
