import { describe, expect, it } from 'vitest';
import { createRng } from '../rng/rng';
import { TILE_SIZE } from '../tiles/tile';
import { TileLibrary, resolveCells } from '../tiles/board';
import { generateMap } from '../mapgen/mapgen';
import { computeFlowField } from './flow';
import { EVENT_CAP, Sim, TICK_HZ, type SimOptions } from './sim';
import type { EnemyDef, TowerDef } from './defs';

const g = (...rows: string[]): string[] => rows;
const LIB = new TileLibrary([
  { id: 'core_end', cells: g('GGGGG', 'GCCCG', 'GCCCX', 'GCCCG', 'GGGGG') },
  { id: 'core_l', cells: g('GGGGG', 'GCCCG', 'GCCCX', 'GCCCG', 'GGXGG') },
  { id: 'core_i', cells: g('GGGGG', 'GCCCG', 'XCCCX', 'GCCCG', 'GGGGG') },
  { id: 'core_t', cells: g('GGXGG', 'GCCCG', 'XCCCX', 'GCCCG', 'GGGGG') },
  { id: 'core_x', cells: g('GGXGG', 'GCCCG', 'XCCCX', 'GCCCG', 'GGXGG') },
  { id: 'straight', cells: g('GGGGG', 'GGGGG', 'XXXXX', 'GGGGG', 'GGGGG') },
  { id: 'corner', cells: g('GGGGG', 'GGGGG', 'XXXGG', 'GGXGG', 'GGXGG') },
  { id: 'tee', cells: g('GGGGG', 'GGGGG', 'XXXXX', 'GGXGG', 'GGXGG') },
  { id: 'cross', cells: g('GGXGG', 'GGXGG', 'XXXXX', 'GGXGG', 'GGXGG') },
  { id: 'meadow', cells: g('GGGGG', 'GGGGG', 'GGGGG', 'GGGGG', 'GGGGG') },
  { id: 'ore_patch', cells: g('GGGGG', 'GOOGG', 'GOOGG', 'GGGGG', 'GGGGG') },
]);

const WALKER: EnemyDef = { id: 'walker', hp: 10, speed: 0.2, damage: 2 };
const BOLT: TowerDef = {
  id: 'bolt',
  cost: 20,
  range: 6,
  fireEveryTicks: 10,
  projectile: { damage: 6, speed: 0.6, homing: true },
};
const REFINERY: TowerDef = {
  id: 'refinery',
  cost: 30,
  range: 0.5,
  fireEveryTicks: 1,
  attack: 'none',
  production: { ore: 1, everyTicks: 40 },
  tiers: [
    { choices: [{ name: 'Wide Bore', cost: 30, mods: { production: 1 } }, { name: 'Fast Cycle', cost: 30, mods: { productionEveryTicks: -15 } }] },
    { choices: [{ name: 'Deep Drill', cost: 60, mods: { production: 1 } }, { name: 'Twin Shaft', cost: 60, mods: { productionEveryTicks: -15 } }] },
    { choices: [{ name: 'Mother Lode', cost: 120, mods: { production: 2 } }, { name: 'Perpetual', cost: 120, mods: { productionEveryTicks: -10 } }] },
  ],
};

/** First cell of the wanted type, or throw - fixtures anchor to the world. */
function cellOfType(cells: readonly (string | null)[], W: number, H: number, type: string): { x: number; y: number } {
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) if (cells[y * W + x] === type) return { x, y };
  throw new Error(`no ${type} cell on this board`);
}

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
        return nx >= 0 && ny >= 0 && nx < W && ny < H && cells[ny * W + nx] === 'X';
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
        expect(cell === 'X' || cell === 'C').toBe(true);
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

  it('choices: cost gates, order enforced, exclusive, stats change, sell refunds', () => {
    const { cells, cellsW, cellsH, simOpts } = makeWorld(41, { startingScrap: 500 });
    const BOLTT: TowerDef = {
      ...BOLT,
      tiers: [
        { choices: [{ name: 'A1', cost: 10, mods: { damage: 4 } }, { name: 'B1', cost: 10 }] },
        { choices: [{ name: 'A2', cost: 20 }, { name: 'B2', cost: 20 }] },
        { choices: [{ name: 'A3', cost: 40 }, { name: 'B3', cost: 40 }] },
      ],
    };
    const sim = new Sim(41, { ...simOpts, towerDefs: [BOLTT] });
    const spot = buildSpotNear(cells, cellsW, cellsH);
    sim.buildTower(spot.x, spot.y, 'bolt');
    const t = sim.towerAt(spot.x, spot.y)!;

    expect(sim.stats(t).damage).toBe(6); // BOLT test damage
    expect(sim.chooseTier(spot.x, spot.y, 1, 0)).toBe(false); // tier 2 locked
    expect(sim.chooseTier(spot.x, spot.y, 0, 0)).toBe(true);
    expect(sim.stats(t).damage).toBe(10);
    expect(sim.chooseTier(spot.x, spot.y, 0, 1)).toBe(false); // committed = final
    expect(sim.chooseTier(spot.x, spot.y, 1, 1)).toBe(true);
    expect(sim.chooseTier(spot.x, spot.y, 2, 0)).toBe(true);
    expect(t.choices).toEqual([0, 1, 0]);

    // Sell refunds 70% of base + all committed choices: (20+10+20+40)*0.7 = 63.
    const before = sim.scrap;
    sim.sellTower(spot.x, spot.y);
    expect(sim.scrap).toBe(before + 63);
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

  it('pulse towers hit everything in range on cooldown, no projectiles', () => {
    const { map, cellsW, cellsH, simOpts } = makeWorld(53, { maxSpawns: 1, spawnEveryTicks: 1 });
    const PULSER: TowerDef = {
      id: 'bolt',
      cost: 20,
      range: 8,
      fireEveryTicks: 10,
      attack: 'pulse',
      projectile: { damage: 3, speed: 1, applyEffect: 'slow', slowMul: 0.5, slowTicks: 20 },
    };
    const parked = { ...WALKER, hp: 10000, speed: 0.005 };
    const sim = new Sim(53, { ...simOpts, enemyDefs: [parked], towerDefs: [PULSER] });
    for (const entry of map.entries) {
      for (let dy = -3; dy <= 3; dy++) {
        let placed = false;
        for (let dx = -3; dx <= 3; dx++) {
          const x = entry.x + dx;
          const y = entry.y + dy;
          if (x >= 0 && y >= 0 && x < cellsW && y < cellsH && sim.canBuildAt(x, y)) {
            if (sim.buildTower(x, y, 'bolt')) placed = true;
            break;
          }
        }
        if (placed) break;
      }
    }
    for (let t = 0; t < 300; t++) sim.tick();
    // No projectiles ever; damage lands in exact pulse-damage multiples.
    let anyProj = 0;
    for (let i = 0; i < sim.projAlive.length; i++) anyProj += sim.projAlive[i];
    expect(anyProj).toBe(0);
    expect(sim.events.some((e) => e.kind === 'pulse')).toBe(true);
    let checked = false;
    for (let i = 0; i < 8; i++) {
      if (sim.alive[i]) {
        expect(sim.hp[i]).toBeLessThan(10000);
        expect((10000 - sim.hp[i]) % 3).toBe(0);
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

describe('production - Refinery and Ore (1.4.6)', () => {
  // Ore is mined only ON a vein (PRD sec 5.3); the timer holds off-vein so a
  // future prospected vein resumes an idle Refinery instead of paying out a
  // stalled cycle instantly.

  it('on a vein: first yield after one full cycle, then every cycle', () => {
    const { cells, cellsW, cellsH, simOpts } = makeWorld(11, { towerDefs: [BOLT, REFINERY] });
    const sim = new Sim(11, simOpts);
    const spot = cellOfType(cells, cellsW, cellsH, 'O');
    expect(sim.buildTower(spot.x, spot.y, 'refinery')).toBe(true);
    for (let t = 0; t < 39; t++) sim.tick();
    expect(sim.ore[0]).toBe(0); // cycle not yet complete
    sim.tick();
    expect(sim.ore[0]).toBe(1);
    for (let t = 0; t < 40; t++) sim.tick();
    expect(sim.ore[0]).toBe(2);
  });

  it('placement is exclusive both ways: refinery only ON ore, fighters only OFF it', () => {
    const { cells, cellsW, cellsH, simOpts } = makeWorld(11, { towerDefs: [BOLT, REFINERY] });
    const sim = new Sim(11, simOpts);
    const ground = buildSpotNear(cells, cellsW, cellsH); // a G cell
    const vein = cellOfType(cells, cellsW, cellsH, 'O');
    // Refinery refuses ground; bolt refuses the vein (ore is Refinery ground).
    expect(sim.canBuildDefAt(ground.x, ground.y, 'refinery')).toBe(false);
    expect(sim.buildTower(ground.x, ground.y, 'refinery')).toBe(false);
    expect(sim.canBuildDefAt(vein.x, vein.y, 'bolt')).toBe(false);
    expect(sim.buildTower(vein.x, vein.y, 'bolt')).toBe(false);
    // And the pairings that SHOULD work still do.
    expect(sim.canBuildDefAt(ground.x, ground.y, 'bolt')).toBe(true);
    expect(sim.canBuildDefAt(vein.x, vein.y, 'refinery')).toBe(true);
    // Refused builds never enter the replay log.
    expect(sim.inputs.length).toBe(0);
  });

  it('tier choices fold into yield and cycle speed', () => {
    const { cells, cellsW, cellsH, simOpts } = makeWorld(11, { towerDefs: [BOLT, REFINERY] });
    const sim = new Sim(11, simOpts);
    const spot = cellOfType(cells, cellsW, cellsH, 'O');
    sim.buildTower(spot.x, spot.y, 'refinery');
    expect(sim.chooseTier(spot.x, spot.y, 0, 0)).toBe(true); // Wide Bore: +1/cycle
    for (let t = 0; t < 40; t++) sim.tick();
    expect(sim.ore[0]).toBe(2);
  });

  it('startingOre carries a previous run in (the demo reroll bank)', () => {
    const { simOpts } = makeWorld(11, { startingOre: 7 });
    const sim = new Sim(11, simOpts);
    expect(sim.ore[0]).toBe(7);
  });

  it('a producer never targets, fires, or holds a priority region', () => {
    const { cells, cellsW, cellsH, simOpts } = makeWorld(11, {
      towerDefs: [REFINERY],
      spawnEveryTicks: 2,
      maxSpawns: 30,
    });
    const sim = new Sim(11, simOpts);
    const spot = cellOfType(cells, cellsW, cellsH, 'O');
    sim.buildTower(spot.x, spot.y, 'refinery');
    for (let t = 0; t < 600; t++) sim.tick();
    let anyProj = 0;
    for (let i = 0; i < sim.projAlive.length; i++) anyProj += sim.projAlive[i];
    expect(anyProj).toBe(0);
    expect(sim.kills).toBe(0);
    expect(sim.ore[0]).toBeGreaterThan(0); // it spent the whole time mining
  });
});

describe('finite ore + the run ends (session 13)', () => {
  it('a vein depletes, the cell reverts to ground, the refinery goes idle', () => {
    const { map, cells, cellsW, cellsH, simOpts } = makeWorld(11, { towerDefs: [BOLT, REFINERY] });
    const sim = new Sim(11, simOpts);
    const spot = cellOfType(cells, cellsW, cellsH, 'O');
    const dep = map.deposits.find((d) => d.x === spot.x && d.y === spot.y)!;
    expect(dep).toBeDefined();
    sim.buildTower(spot.x, spot.y, 'refinery');
    // Mine until dry: amount cycles at 1/cycle, then the world changes.
    for (let t = 0; t < (dep.amount + 2) * 40; t++) sim.tick();
    expect(sim.ore[0]).toBe(dep.amount); // every unit mined, not one more
    expect(sim.cellAt(spot.x, spot.y)).toBe('G'); // spent veins are ground
    expect(sim.depositAt(spot.x, spot.y)!.left).toBe(0);
    const before = sim.ore[0];
    for (let t = 0; t < 200; t++) sim.tick();
    expect(sim.ore[0]).toBe(before); // idle forever after
  });

  it('holding the final wave WINS; a won run stays won', () => {
    const { simOpts } = makeWorld(61, { mode: 'waves', coreHp: 100000, finalWave: 2 });
    const sim = new Sim(61, simOpts);
    let guard = 0;
    while (sim.status === 'running' && guard++ < 100000) {
      sim.tick();
      if (sim.offer) sim.pickRelic(0);
    }
    expect(sim.status).toBe('won');
    expect(sim.wave).toBe(2);
    const h = sim.hashState();
    sim.tick();
    expect(sim.hashState()).toBe(h); // frozen in victory
  });

  it('every 5th wave carries an elite surge of the heaviest available enemy', () => {
    const heavy: EnemyDef = { id: 'tank', hp: 500, speed: 0.03, damage: 9, minWave: 1 };
    const { simOpts } = makeWorld(61, { mode: 'waves', coreHp: 100000, enemyDefs: [WALKER, heavy] });
    const sim = new Sim(61, simOpts);
    let guard = 0;
    let wave5Spawned = 0;
    let sawTankInWave5 = false;
    while (sim.wave <= 5 && guard++ < 200000) {
      sim.tick();
      if (sim.offer) sim.pickRelic(0);
      if (sim.wave === 5) {
        for (let i = 0; i < 128; i++) {
          if (sim.alive[i] && sim.enemyDefOf(i).id === 'tank') sawTankInWave5 = true;
        }
        wave5Spawned = sim.spawned;
      }
    }
    expect(wave5Spawned).toBeGreaterThan(0);
    expect(sawTankInWave5).toBe(true);
  });
});

describe('the route is a graph - touching is not connecting (session 14)', () => {
  it('border roads of adjacent tiles touch without joining; enemies cannot lane-hop', () => {
    // Tile A: road hugs its EAST border, exits NORTH. Tile B (to its right):
    // road hugs its WEST border, exits north too, ending at a Core cell.
    // Their road columns are physically adjacent across the tile boundary.
    const W = 10, H = 5;
    const cells: (import('../grid/cells').CellType | null)[] = [];
    const A = ['GGXXX', 'GGXGX', 'GGGGX', 'GGGGX', 'GGGGX'];
    const B = ['XXXGG', 'XGXGG', 'XGGGG', 'XGGGG', 'XGGGG'];
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < 5; x++) cells.push(A[y][x] as import('../grid/cells').CellType);
      for (let x = 0; x < 5; x++) cells.push(B[y][x] as import('../grid/cells').CellType);
    }
    // Plant the Core inside B's lane so ITS road resolves.
    cells[1 * W + 7] = 'C'; // B local (2,1)
    const flow = computeFlowField(cells, W, H, []);
    // The two road columns touch at x=4|x=5 for every row - and not one
    // step between them is allowed (E=2 from x=4, W=8 from x=5).
    for (let y = 0; y < H; y++) {
      expect(flow.allowed[y * W + 4] & 2).toBe(0);
      expect(flow.allowed[y * W + 5] & 8).toBe(0);
    }
    // B's lane reaches the Core; A's lane - touching it the whole way - never does.
    expect(flow.dist[4 * W + 5]).toBeGreaterThan(0); // B's border road: on the route
    expect(flow.dist[4 * W + 4]).toBe(-1); // A's border road: a different road entirely
  });
});

describe('a fired shot always resolves (WBS 2.19, playtest 8)', () => {
  const kill = (sim: Sim, slot: number): void => {
    // Reach in the way applyDamage does - tests may execute an enemy.
    sim.hp[slot] = 0;
    sim.alive[slot] = 0;
  };

  it('ballistic: the shell detonates at its committed aim point even if the target died', () => {
    const SHELL: TowerDef = {
      id: 'shell',
      cost: 20,
      range: 8,
      fireEveryTicks: 1000,
      projectile: { damage: 6, speed: 0.5, homing: false, explosive: true, explodeRadius: 1.5 },
    };
    const { cells, cellsW, cellsH, simOpts } = makeWorld(23, { towerDefs: [SHELL], maxSpawns: 4, spawnEveryTicks: 2 });
    const sim = new Sim(23, simOpts);
    const spot = buildSpotNear(cells, cellsW, cellsH);
    sim.buildTower(spot.x, spot.y, 'shell');
    // March until the tower fires, then kill its target mid-flight.
    let fired = -1;
    for (let t = 0; t < 400 && fired === -1; t++) {
      sim.tick();
      for (let p = 0; p < sim.projAlive.length; p++) if (sim.projAlive[p]) fired = p;
    }
    expect(fired).not.toBe(-1);
    const events0 = sim.events.filter((e) => e.kind === 'impact').length;
    for (let i = 0; i < 8; i++) if (sim.alive[i]) kill(sim, i);
    // With every enemy dead the shell must STILL land and detonate.
    for (let t = 0; t < 100 && sim.projAlive[fired]; t++) sim.tick();
    expect(sim.projAlive[fired]).toBe(0);
    expect(sim.events.filter((e) => e.kind === 'impact').length).toBe(events0 + 1);
  });

  it('homing: a shot whose target dies re-acquires; with nobody left it falls ballistic - never evaporates', () => {
    const SNIPER: TowerDef = {
      id: 'sniper',
      cost: 20,
      range: 10,
      fireEveryTicks: 1000, // one shot in flight, so every impact is ITS impact
      projectile: { damage: 6, speed: 0.4, homing: true },
    };
    const { cells, cellsW, cellsH, simOpts } = makeWorld(23, { towerDefs: [SNIPER], maxSpawns: 5, spawnEveryTicks: 2 });
    const sim = new Sim(23, simOpts);
    const spot = buildSpotNear(cells, cellsW, cellsH);
    sim.buildTower(spot.x, spot.y, 'sniper');
    let fired = -1;
    for (let t = 0; t < 400 && fired === -1; t++) {
      sim.tick();
      for (let p = 0; p < sim.projAlive.length; p++) if (sim.projAlive[p]) fired = p;
    }
    expect(fired).not.toBe(-1);
    // Kill only the tracked target; others live. Under the old rule the shot
    // evaporated here; now it must retarget and land exactly one impact.
    const target0 = (() => { for (let i = 0; i < 8; i++) if (sim.alive[i]) return i; return -1; })();
    expect(target0).not.toBe(-1);
    kill(sim, target0);
    const impacts0 = sim.events.filter((e) => e.kind === 'impact').length;
    for (let t = 0; t < 300 && sim.projAlive[fired]; t++) sim.tick();
    expect(sim.projAlive[fired]).toBe(0);
    expect(sim.events.filter((e) => e.kind === 'impact').length).toBe(impacts0 + 1);
  });
});

describe('the event feed (WBS 4.1) - the sim narrates, the view decides', () => {
  it('combat and construction emit typed events with monotonic seq', () => {
    const { cells, cellsW, cellsH, simOpts } = makeWorld(23);
    const sim = new Sim(23, simOpts);
    for (let n = 0; n < 4; n++) {
      const spot = buildSpotNear(cells, cellsW, cellsH, n);
      sim.buildTower(spot.x, spot.y, 'bolt');
    }
    expect(sim.events.filter((e) => e.kind === 'build').length).toBe(4);
    const budget = (sim.flow.L / WALKER.speed + 10 * 5 + 200) | 0;
    for (let t = 0; t < budget; t++) sim.tick();
    // The defended-road test proves kills happen on this seed; every kill
    // and every hit must have narrated itself.
    expect(sim.events.some((e) => e.kind === 'impact')).toBe(true);
    expect(sim.events.filter((e) => e.kind === 'death').length).toBe(sim.kills);
    for (let i = 1; i < sim.events.length; i++) {
      expect(sim.events[i].seq).toBe(sim.events[i - 1].seq + 1);
    }
  });

  it('the feed is capped and events never enter the state hash', () => {
    const { cells, cellsW, cellsH, simOpts } = makeWorld(23, { maxSpawns: 0, spawnEveryTicks: 2 });
    const sim = new Sim(23, simOpts);
    for (let n = 0; n < 4; n++) {
      const spot = buildSpotNear(cells, cellsW, cellsH, n);
      sim.buildTower(spot.x, spot.y, 'bolt');
    }
    for (let t = 0; t < 4000; t++) sim.tick();
    expect(sim.events.length).toBeLessThanOrEqual(EVENT_CAP);
    // Draining the feed (what a view effectively does) must not move the
    // hash: two sims that evolved identically hash identically no matter
    // what happened to their event lists.
    const before = sim.hashState();
    sim.events.length = 0;
    expect(sim.hashState()).toBe(before);
  });
});

describe('boon ground (session 15, PRD sec 4.7)', () => {
  it('the cell buffs whoever stands on it, through the full stat fold', () => {
    const { map, cells, cellsW, cellsH, simOpts } = makeWorld(11);
    // Plant a damage boon under a known ground cell (overlay: map data).
    const spot = buildSpotNear(cells, cellsW, cellsH);
    map.boons = [{ x: spot.x, y: spot.y, boon: 'damage', tier: 2 }];
    const sim = new Sim(11, simOpts);
    sim.buildTower(spot.x, spot.y, 'bolt');
    const t = sim.towerAt(spot.x, spot.y)!;
    expect(sim.stats(t).damage).toBeCloseTo(6 * 1.2); // tier 2 = +20%
    expect(sim.boonAt(spot.x, spot.y)).toEqual({ boon: 'damage', tier: 2 });
  });
});
