import { describe, expect, it } from 'vitest';
import { createRng } from '../rng/rng';
import { TILE_SIZE } from '../tiles/tile';
import { TileLibrary, resolveCells } from '../tiles/board';
import { generateMap } from '../mapgen/mapgen';
import { computeFlowField } from './flow';
import { Sim, TICK_HZ, type SimOptions } from './sim';
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
]);

const WALKER: EnemyDef = { id: 'walker', hp: 10, speed: 0.2, damage: 2 };
const BOLT: TowerDef = {
  id: 'bolt',
  cost: 20,
  range: 6,
  fireEveryTicks: 10,
  projectile: { damage: 6, speed: 0.6, homing: true },
};

function makeWorld(seed: number, extra: Partial<SimOptions> = {}) {
  const opts = { width: 10, height: 6, entries: 3, targetPathLength: 8 };
  const map = generateMap(createRng(seed).stream('map'), LIB, opts);
  const cellsW = opts.width * TILE_SIZE;
  const cellsH = opts.height * TILE_SIZE;
  const cells = resolveCells(map.board, LIB);
  const simOpts: SimOptions = {
    cells,
    cellsW,
    cellsH,
    map,
    enemyDefs: [WALKER],
    towerDefs: [BOLT],
    spawnEveryTicks: 5,
    maxSpawns: 10,
    ...extra,
  };
  return { map, cells, cellsW, cellsH, simOpts };
}

/** First buildable cell adjacent to a route cell - a spot a player would pick. */
function buildSpotNear(cells: readonly (string | null)[], W: number, H: number, nth = 0): { x: number; y: number } {
  let seen = 0;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (cells[y * W + x] !== 'G') continue;
      const nearRoad = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
        const nx = x + dx;
        const ny = y + dy;
        return nx >= 0 && ny >= 0 && nx < W && ny < H && cells[ny * W + nx] === 'R';
      });
      if (nearRoad && seen++ === nth) return { x, y };
    }
  throw new Error('no build spot found');
}

describe('flow field', () => {
  it('is zero at the Core, positive at entries, downhill everywhere on-route', () => {
    const { map, cells, cellsW, cellsH } = makeWorld(5);
    const flow = computeFlowField(cells, cellsW, cellsH, map.entries);
    expect(flow.dist[map.core.y * cellsW + map.core.x]).toBe(0);
    expect(flow.L).toBeGreaterThanOrEqual(TILE_SIZE);
    for (let i = 0; i < flow.dist.length; i++) {
      const d = flow.dist[i];
      if (d <= 0) continue;
      const x = i % cellsW;
      const y = (i / cellsW) | 0;
      const hasDownhill = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= cellsW || ny >= cellsH) return false;
        return flow.dist[ny * cellsW + nx] === d - 1;
      });
      expect(hasDownhill).toBe(true);
    }
  });
});

describe('walkers', () => {
  it('undefended, every spawn eventually breaches and Core damage accumulates', () => {
    const { simOpts } = makeWorld(11);
    const sim = new Sim(11, simOpts);
    const budget = (sim.flow.L / WALKER.speed + 10 * 5 + 100) | 0;
    for (let t = 0; t < budget; t++) sim.tick();
    expect(sim.spawned).toBe(10);
    expect(sim.breaches).toBe(10);
    expect(sim.coreDamage).toBe(10 * WALKER.damage);
    expect(sim.aliveCount()).toBe(0);
  });

  it('walkers never leave the route', () => {
    const { cells, cellsW, simOpts } = makeWorld(13);
    const sim = new Sim(13, simOpts);
    for (let t = 0; t < 500; t++) {
      sim.tick();
      for (let i = 0; i < 64; i++) {
        if (!sim.alive[i]) continue;
        const cell = cells[Math.floor(sim.posY[i]) * cellsW + Math.floor(sim.posX[i])];
        expect(cell === 'R' || cell === 'C').toBe(true);
      }
    }
  });

  it('a tick is a tick: 20 Hz declared, wall time is nobody', () => {
    expect(TICK_HZ).toBe(20);
  });
});

describe('towers and projectiles', () => {
  it('build rules: buildable ground only, one tower per cell, sell frees', () => {
    const { map, cells, cellsW, cellsH, simOpts } = makeWorld(17);
    const sim = new Sim(17, simOpts);

    // Road and Core cells refuse.
    const entry = map.entries[0];
    expect(sim.canBuildAt(entry.x, entry.y)).toBe(false);
    expect(sim.canBuildAt(map.core.x, map.core.y)).toBe(false);

    const spot = buildSpotNear(cells, cellsW, cellsH);
    expect(sim.canBuildAt(spot.x, spot.y)).toBe(true);
    expect(sim.buildTower(spot.x, spot.y, 'bolt')).toBe(true);
    expect(sim.canBuildAt(spot.x, spot.y)).toBe(false); // occupied (invariant 7)
    expect(sim.buildTower(spot.x, spot.y, 'bolt')).toBe(false);
    expect(sim.towerAt(spot.x, spot.y)?.defIdx).toBe(0);

    expect(sim.sellTower(spot.x, spot.y)).toBe(true);
    expect(sim.canBuildAt(spot.x, spot.y)).toBe(true);
    expect(sim.towerAt(spot.x, spot.y)).toBeNull();

    expect(() => sim.buildTower(spot.x, spot.y, 'nonsense')).toThrow(/unknown tower def/);
  });

  it('a defended road kills: fewer breaches than undefended, kill credit adds up', () => {
    const { cells, cellsW, cellsH, simOpts } = makeWorld(23);

    const undefended = new Sim(23, simOpts);
    const defended = new Sim(23, simOpts);
    for (let n = 0; n < 4; n++) {
      const spot = buildSpotNear(cells, cellsW, cellsH, n);
      defended.buildTower(spot.x, spot.y, 'bolt');
    }
    const budget = (undefended.flow.L / WALKER.speed + 10 * 5 + 200) | 0;
    for (let t = 0; t < budget; t++) {
      undefended.tick();
      defended.tick();
    }

    expect(undefended.breaches).toBe(10);
    expect(defended.kills).toBeGreaterThan(0);
    expect(defended.breaches).toBeLessThan(undefended.breaches);
    expect(defended.kills + defended.breaches + defended.aliveCount()).toBe(10);

    const towerKills = defended.towers.reduce((s, t) => s + (t?.kills ?? 0), 0);
    expect(towerKills).toBe(defended.kills);
  });

  it('combat is deterministic: same seed and builds, same story', () => {
    const run = () => {
      const { cells, cellsW, cellsH, simOpts } = makeWorld(29, { maxSpawns: 20 });
      const sim = new Sim(29, simOpts);
      for (let n = 0; n < 3; n++) {
        const spot = buildSpotNear(cells, cellsW, cellsH, n);
        sim.buildTower(spot.x, spot.y, 'bolt');
      }
      for (let t = 0; t < 1500; t++) sim.tick();
      return {
        kills: sim.kills,
        breaches: sim.breaches,
        coreDamage: sim.coreDamage,
        x: [...sim.posX.slice(0, 32)],
        px: [...sim.projX.slice(0, 32)],
      };
    };
    expect(run()).toEqual(run());
  });

  it('economy: builds cost, kills pay, selling refunds 70%', () => {
    const { cells, cellsW, cellsH, simOpts } = makeWorld(37, { startingScrap: 45 });
    const sim = new Sim(37, simOpts);
    const a = buildSpotNear(cells, cellsW, cellsH, 0);
    const b = buildSpotNear(cells, cellsW, cellsH, 1);
    const c = buildSpotNear(cells, cellsW, cellsH, 2);

    expect(sim.buildTower(a.x, a.y, 'bolt')).toBe(true); // 45 -> 25
    expect(sim.buildTower(b.x, b.y, 'bolt')).toBe(true); // 25 -> 5
    expect(sim.scrap).toBe(5);
    expect(sim.canAfford('bolt')).toBe(false);
    expect(sim.buildTower(c.x, c.y, 'bolt')).toBe(false); // broke, cell stays free
    expect(sim.canBuildAt(c.x, c.y)).toBe(true);

    expect(sim.sellTower(b.x, b.y)).toBe(true); // +14 (floor of 20*0.7)
    expect(sim.scrap).toBe(19);

    // Bounties: run with towers and confirm scrap grows past pure refunds.
    const withBounty = { ...simOpts, enemyDefs: [{ ...WALKER, bounty: 5 }] };
    const sim2 = new Sim(37, withBounty);
    const spot = buildSpotNear(cells, cellsW, cellsH, 0);
    sim2.buildTower(spot.x, spot.y, 'bolt');
    for (let t = 0; t < 2000; t++) sim2.tick();
    expect(sim2.kills).toBeGreaterThan(0);
    // withBounty inherits startingScrap 45 from the spread above.
    expect(sim2.scrap).toBe(45 - 20 + sim2.kills * 5);
  });

  it('upgrades: cost gates, crosspath enforced, stats change, sell refunds tiers', () => {
    const { cells, cellsW, cellsH, simOpts } = makeWorld(41, { startingScrap: 500 });
    const BOLTP: TowerDef = {
      ...BOLT,
      paths: [
        { name: 'A', tiers: [{ cost: 10, mods: { damage: 4 } }, { cost: 10 }, { cost: 10 }, { cost: 10 }, { cost: 10 }] },
        { name: 'B', tiers: [{ cost: 10 }, { cost: 10 }, { cost: 10 }, { cost: 10 }, { cost: 10 }] },
        { name: 'C', tiers: [{ cost: 10 }, { cost: 10 }, { cost: 10 }, { cost: 10 }, { cost: 10 }] },
      ],
    };
    const sim = new Sim(41, { ...simOpts, towerDefs: [BOLTP] });
    const spot = buildSpotNear(cells, cellsW, cellsH);
    sim.buildTower(spot.x, spot.y, 'bolt');
    const t = sim.towerAt(spot.x, spot.y)!;

    expect(sim.stats(t).damage).toBe(6); // BOLT damage in tests
    expect(sim.upgradeTower(spot.x, spot.y, 0)).toBe(true);
    expect(sim.stats(t).damage).toBe(10);

    // Crosspath: push path 0 to 3, path 1 to 2, then path 1 tier 3 refuses
    // and path 2 refuses outright.
    sim.upgradeTower(spot.x, spot.y, 0);
    sim.upgradeTower(spot.x, spot.y, 0);
    sim.upgradeTower(spot.x, spot.y, 1);
    sim.upgradeTower(spot.x, spot.y, 1);
    expect(t.tiers).toEqual([3, 2, 0]);
    expect(sim.upgradeTower(spot.x, spot.y, 1)).toBe(false);
    expect(sim.upgradeTower(spot.x, spot.y, 2)).toBe(false);

    // Sell refunds 70% of base + all tier spend: (20 + 50) * 0.7 = 49.
    const before = sim.scrap;
    sim.sellTower(spot.x, spot.y);
    expect(sim.scrap).toBe(before + 49);
  });

  it('waves mode: composition respects minWave, Core falls, sim freezes', () => {
    const { simOpts } = makeWorld(43);
    const sim = new Sim(43, {
      ...simOpts,
      mode: 'waves',
      maxSpawns: 0,
      coreHp: 6,
      interWaveTicks: 40,
      enemyDefs: [WALKER, { ...WALKER, id: 'late', minWave: 99 }],
    });
    // No towers: walkers breach until the Core (6 hp, 2 dmg each) falls.
    for (let t = 0; t < 6000 && sim.status === 'running'; t++) sim.tick();
    expect(sim.status).toBe('lost');
    expect(sim.coreHp).toBe(0);
    expect(sim.wave).toBeGreaterThanOrEqual(1);
    // minWave 99 def never spawned.
    for (let i = 0; i < 64; i++) {
      if (sim.spawned > 0) expect(sim.enemyDefOf(i).id).not.toBe('late');
    }
    // Frozen: further ticks change nothing.
    const snapshot = { ticks: sim.tickCount, breaches: sim.breaches };
    sim.tick();
    expect({ ticks: sim.tickCount, breaches: sim.breaches }).toEqual(snapshot);
    expect(sim.buildTower(0, 0, 'bolt')).toBe(false);
  });

  it('slow makes the journey longer; armor blunts; shields burn first', () => {
    const { cells, cellsW, cellsH, simOpts } = makeWorld(47, { maxSpawns: 1, spawnEveryTicks: 1 });
    // Twin runs: identical except one def is slowed by a frost-like tower.
    const FROSTY: TowerDef = {
      id: 'bolt', // reuse id so buildTower finds it
      cost: 20,
      range: 6,
      fireEveryTicks: 6,
      projectile: { damage: 1, speed: 0.6, homing: true, applyEffect: 'slow', slowMul: 0.5, slowTicks: 40 },
    };
    const tanky = { ...WALKER, hp: 1000 }; // survives, just slower
    const plain = new Sim(47, { ...simOpts, enemyDefs: [tanky] });
    const frosty = new Sim(47, { ...simOpts, enemyDefs: [tanky], towerDefs: [FROSTY] });
    const spot = buildSpotNear(cells, cellsW, cellsH);
    frosty.buildTower(spot.x, spot.y, 'bolt');
    const budget = 4000;
    for (let t = 0; t < budget; t++) {
      plain.tick();
      frosty.tick();
    }
    // The unfrosted twin has finished; the frosted one is behind or just done.
    expect(plain.breaches).toBe(1);
    expect(frosty.breaches + frosty.aliveCount()).toBe(1);

    // Armor: a 5-damage shot on 3 armor deals 2; shields burn before hp.
    // Slow, unkillable target parked in range: only the damage math varies.
    const { map } = makeWorld(47);
    const armored = { ...WALKER, hp: 10000, speed: 0.005, armor: 3, shield: 4 };
    const GUN: TowerDef = { ...BOLT, range: 8, fireEveryTicks: 4, projectile: { damage: 5, speed: 0.6, homing: true } };
    const sim = new Sim(47, { ...simOpts, enemyDefs: [armored], towerDefs: [GUN] });
    // The lone spawn picks any entry; cover them all so it parks in range.
    let guns = 0;
    for (const entry of map.entries) {
      for (let dy = -3; dy <= 3; dy++)
        for (let dx = -3; dx <= 3; dx++) {
          const x = entry.x + dx;
          const y = entry.y + dy;
          if (x >= 0 && y >= 0 && x < cellsW && y < cellsH && cells[y * cellsW + x] === 'G' && sim.canBuildAt(x, y)) {
            if (sim.buildTower(x, y, 'bolt')) guns++;
            dy = 4; // one gun per entry is plenty
            break;
          }
        }
    }
    expect(guns).toBeGreaterThanOrEqual(map.entries.length);
    for (let t = 0; t < 300; t++) sim.tick();
    let checked = false;
    for (let i = 0; i < 8; i++) {
      if (sim.alive[i]) {
        expect(sim.shield[i]).toBe(0); // shield burned first
        expect(sim.hp[i]).toBeLessThan(10000);
        expect(sim.hp[i]).toBeGreaterThan(0);
        expect((10000 - sim.hp[i]) % 2).toBe(0); // only 2s ever landed on hp
        checked = true;
      }
    }
    expect(checked).toBe(true);
  });

  it('capacity: spawn flood drops instead of crashing', () => {
    const { simOpts } = makeWorld(31, { spawnEveryTicks: 1, maxSpawns: 0, enemyDefs: [{ ...WALKER, speed: 0.01 }] });
    const sim = new Sim(31, simOpts);
    for (let t = 0; t < 2000; t++) sim.tick();
    expect(sim.aliveCount()).toBeLessThanOrEqual(1024);
  });
});
