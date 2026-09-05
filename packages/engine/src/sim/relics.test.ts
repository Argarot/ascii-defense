/**
 * The relic layer (WBS 1.6.1-1.6.3, PRD sec 7): hooks, offers, and every
 * shipped effect knob. Each test builds the smallest world that can prove
 * one rule is actually broken by its relic - the point of the layer.
 */
import { describe, expect, it } from 'vitest';
import { createRng } from '../rng/rng';

import { TileLibrary } from '../tiles/board';
import { mapCells, generateMap } from '../mapgen/mapgen';
import { OFFER_EVERY_WAVES, Sim, type SimOptions } from './sim';
import type { LootTable } from './defs';
import type { EnemyDef, RelicDef, TowerDef } from './defs';

const g = (...rows: string[]): string[] => rows;
const LIB = new TileLibrary([
  { id: 'straight', cells: g('GGGGG', 'GGGGG', 'XXXXX', 'GGGGG', 'GGGGG') },
  { id: 'corner', cells: g('GGGGG', 'GGGGG', 'XXXGG', 'GGXGG', 'GGXGG') },
  { id: 'tee', cells: g('GGGGG', 'GGGGG', 'XXXXX', 'GGXGG', 'GGXGG') },
  { id: 'cross', cells: g('GGXGG', 'GGXGG', 'XXXXX', 'GGXGG', 'GGXGG') },
  { id: 'meadow', cells: g('GGGGG', 'GGGGG', 'GGGGG', 'GGGGG', 'GGGGG') },
  { id: 'ore_patch', cells: g('GGGGG', 'GOOGG', 'GOOGG', 'GGGGG', 'GGGGG') },
  { id: 'rocky', cells: g('GGGGG', 'GRRGG', 'GRRGG', 'GGGGG', 'GGGGG') },
]);

const WALKER: EnemyDef = { id: 'walker', hp: 10, speed: 0.2, damage: 2, bounty: 3 };
const BOLT: TowerDef = { id: 'bolt', cost: 20, range: 6, fireEveryTicks: 10, projectile: { damage: 6, speed: 0.7, homing: true } };
const REFINERY: TowerDef = {
  id: 'refinery',
  cost: 30,
  range: 0.5,
  fireEveryTicks: 1,
  attack: 'none',
  production: { ore: 1, everyTicks: 40 },
  tiers: [
    { choices: [{ name: 'Wide Bore', cost: 10, mods: { production: 1 } }, { name: 'Fast Cycle', cost: 10, mods: { productionEveryTicks: -15 } }] },
    { choices: [{ name: 'Deep Drill', cost: 10, mods: { production: 1 } }, { name: 'Survey', cost: 10, unlocks: 'surveyAuto' }] },
    { choices: [{ name: 'Mother Lode', cost: 10, mods: { production: 2 } }, { name: 'Perpetual', cost: 10, mods: { productionEveryTicks: -10 } }] },
  ],
};

const POOL: RelicDef[] = [
  { id: 'overflow', name: 'Overflow', kind: 'passive', desc: '', effects: { overkillCarry: true } },
  { id: 'frostbite', name: 'Frostbite', kind: 'passive', desc: '', effects: { slowedDamageMul: 1.5 } },
  { id: 'tithe', name: 'Tithe', kind: 'passive', desc: '', effects: { killRefundScrap: 2 } },
  { id: 'vein_tap', name: 'Vein Tap', kind: 'passive', desc: '', effects: { buildOnRock: true } },
  { id: 'ballistics', name: 'Ballistics', kind: 'passive', desc: '', effects: { damageMul: 1.2 } },
  { id: 'flashfreeze', name: 'Flash Freeze', kind: 'consumable', desc: '', effects: { freezeTicks: 30 } },
  { id: 'orbital', name: 'Orbital', kind: 'active', desc: '', cooldownTicks: 100, effects: { orbitalDamage: 400, orbitalRadius: 3 } },
  { id: 'stasis', name: 'Stasis', kind: 'active', desc: '', cooldownTicks: 100, effects: { freezeTicks: 50 } },
  { id: 'deep_vein', name: 'Deep Vein', kind: 'active', desc: '', cooldownTicks: 100, effects: { productionMul: 5, boostTicks: 200 } },
];

/** Both shipped table ids, with tiny deterministic payouts for tests. */
const TABLES: LootTable[] = [
  { id: 'rock_cache', outcomes: [{ kind: 'scrap', weight: 1, min: 10, max: 10 }] },
  { id: 'boss_drop', outcomes: [{ kind: 'ore', weight: 1, min: 5, max: 5 }] },
];

function makeWorld(seed: number, extra: Partial<SimOptions> = {}) {
  const opts = { width: 10, height: 6, entries: 3, targetPathCells: 40 };
  const map = generateMap(createRng(seed).stream('map'), LIB, { ...opts, relicPoolSize: POOL.length });
  const cellsW = map.cellsW;
  const cellsH = map.cellsH;
  const cells = mapCells(map, LIB);
  const simOpts: SimOptions = {
    cells,
    cellsW,
    cellsH,
    map,
    enemyDefs: [WALKER],
    towerDefs: [BOLT, REFINERY],
    relicDefs: POOL,
    spawnEveryTicks: 5,
    maxSpawns: 10,
    ...extra,
  };
  return { map, cells, cellsW, cellsH, simOpts };
}

/** Ore is a bias, not a guarantee (D12): scan forward to a seed with a vein. */
function makeOreWorld(start: number, extra: Partial<SimOptions> = {}) {
  for (let s = start; ; s++) {
    const w = makeWorld(s, extra);
    if (w.cells.some((c) => c === 'O')) return { ...w, seed: s };
  }
}

function cellOfType(cells: readonly (string | null)[], W: number, H: number, type: string): { x: number; y: number } {
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) if (cells[y * W + x] === type) return { x, y };
  throw new Error(`no ${type} cell`);
}

/** Grant a relic directly (test shortcut past the offer flow). */
function grant(sim: Sim, id: string): void {
  const idx = POOL.findIndex((r) => r.id === id);
  sim.offer = [idx];
  expect(sim.pickRelic(0)).toBe(true);
}

describe('offers (1.6.2 engine half)', () => {
  it(`every ${OFFER_EVERY_WAVES} completed waves: pick 1 of 3, no duplicates, on the relics stream`, () => {
    const { simOpts } = makeWorld(61, { mode: 'waves', firstWaveWaits: false, coreHp: 10000, startingScrap: 0 });
    const sim = new Sim(61, simOpts);
    // Run until the offer for wave 3 appears; undefended waves just breach.
    let guard = 0;
    while (sim.offer === null && guard++ < 60000) sim.tick();
    expect(sim.offer).not.toBeNull();
    // The offer is owed by wave 3 and dealt when the board goes quiet or, at
    // the latest, when wave 4 launches (the clock no longer waits for the
    // last enemy - design round 1, item 10); undefended, it is the latter.
    expect([OFFER_EVERY_WAVES, OFFER_EVERY_WAVES + 1]).toContain(sim.wave);
    expect(sim.offer!.length).toBe(3);
    expect(new Set(sim.offer!).size).toBe(3);
    const offered = sim.offerDefs()!.map((d) => d.id);

    // Same seed, same offer - the draw is deterministic.
    const sim2 = new Sim(61, simOpts);
    let g2 = 0;
    while (sim2.offer === null && g2++ < 60000) sim2.tick();
    expect(sim2.offerDefs()!.map((d) => d.id)).toEqual(offered);

    // Picking holds the relic, clears the offer, records the input.
    const before = sim.inputs.length;
    expect(sim.pickRelic(1)).toBe(true);
    expect(sim.offer).toBeNull();
    expect(sim.heldRelicInfo().map((h) => h.def.id)).toEqual([offered[1]]);
    expect(sim.inputs.length).toBe(before + 1);
  });

  it('held relics never reappear in later offers', () => {
    const { simOpts } = makeWorld(67, { mode: 'waves', firstWaveWaits: false, coreHp: 100000 });
    const sim = new Sim(67, simOpts);
    const seen: string[] = [];
    let guard = 0;
    while (seen.length < 3 && guard++ < 200000) {
      sim.tick();
      if (sim.offer !== null) {
        const ids = sim.offerDefs()!.map((d) => d.id);
        for (const s of seen) expect(ids).not.toContain(s);
        seen.push(ids[0]);
        sim.pickRelic(0);
      }
    }
    expect(seen.length).toBe(3);
  });
});

describe('the Ore sinks - draw and reroll (1.6.5)', () => {
  it('buyRelic: pays Ore, draws from the unheld pool, records', () => {
    const { simOpts } = makeWorld(71, { startingOre: 60 });
    const sim = new Sim(71, simOpts);
    expect(sim.drawCost()).toBe(50);
    expect(sim.buyRelic()).toBe(true);
    expect(sim.ore[0]).toBe(10);
    expect(sim.heldRelics.length).toBe(1);
    expect(sim.drawCost()).toBe(75); // escalates x1.5 per purchase (Daniil)
    expect(sim.buyRelic()).toBe(false); // 10 < 75: broke
    expect(sim.inputs.filter((i) => i.a.t === 'buyRelic').length).toBe(1);
    // Determinism: same seed, same ore, same draw.
    const sim2 = new Sim(71, simOpts);
    sim2.buyRelic();
    expect(sim2.heldRelics).toEqual(sim.heldRelics);
  });

  it('rerollOffer: needs a standing offer and Ore, deals a fresh three', () => {
    const { simOpts } = makeWorld(61, { mode: 'waves', firstWaveWaits: false, coreHp: 10000, startingOre: 20 });
    const sim = new Sim(61, simOpts);
    expect(sim.rerollOffer()).toBe(false); // no offer up
    let guard = 0;
    while (sim.offer === null && guard++ < 60000) sim.tick();
    const before = [...sim.offer!];
    expect(sim.rerollCost()).toBe(15);
    expect(sim.rerollOffer()).toBe(true);
    expect(sim.ore[0]).toBe(5);
    expect(sim.offer!.length).toBe(3);
    expect(sim.rerollCost()).toBe(23); // escalates x1.5 per reroll
    expect(sim.rerollOffer()).toBe(false); // 5 < 23: broke
    // A reroll is a fresh deal, not a shuffle of the same three.
    expect(sim.offer).not.toEqual(before);
  });
});

describe('relic effects - each breaks its rule (1.6.1/1.6.3)', () => {
  it('ballistics: global damage multiplier folds into stats', () => {
    const { cells, cellsW, cellsH, simOpts } = makeWorld(11);
    const sim = new Sim(11, simOpts);
    const spot = cellOfType(cells, cellsW, cellsH, 'G');
    sim.buildTower(spot.x, spot.y, 'bolt');
    const t = sim.towerAt(spot.x, spot.y)!;
    expect(sim.stats(t).damage).toBe(6);
    grant(sim, 'ballistics');
    expect(sim.stats(t).damage).toBeCloseTo(7.2);
  });

  it('tithe: kills refund extra scrap', () => {
    const { cells, cellsW, cellsH, simOpts } = makeWorld(23);
    const a = new Sim(23, simOpts);
    const b = new Sim(23, simOpts);
    grant(b, 'tithe');
    // Anchor towers to the world: same spots both sims.
    for (let n = 0; n < 3; n++) {
      const spot = nthGround(cells, cellsW, cellsH, n);
      a.buildTower(spot.x, spot.y, 'bolt');
      b.buildTower(spot.x, spot.y, 'bolt');
    }
    for (let t = 0; t < 1500; t++) {
      a.tick();
      b.tick();
    }
    expect(a.kills).toBeGreaterThan(0);
    expect(b.kills).toBe(a.kills); // same fight
    expect(b.scrap).toBe(a.scrap + 2 * b.kills); // plus the tithe
  });

  it('vein tap: rock becomes buildable for fighters, never for refineries without foundry', () => {
    const { cells, cellsW, cellsH, simOpts } = makeWorld(31);
    const sim = new Sim(31, simOpts);
    const rock = cellOfType(cells, cellsW, cellsH, 'R');
    expect(sim.canBuildDefAt(rock.x, rock.y, 'bolt')).toBe(false);
    grant(sim, 'vein_tap');
    expect(sim.canBuildDefAt(rock.x, rock.y, 'bolt')).toBe(true);
    expect(sim.canBuildDefAt(rock.x, rock.y, 'refinery')).toBe(false);
    expect(sim.buildTower(rock.x, rock.y, 'bolt')).toBe(true);
  });

  it('a consumable acts once and FREES its slot (1.7.6)', () => {
    const { simOpts } = makeWorld(41, { spawnEveryTicks: 2, maxSpawns: 8 });
    const sim = new Sim(41, simOpts);
    grant(sim, 'flashfreeze');
    grant(sim, 'tithe');
    for (let t = 0; t < 200; t++) sim.tick();
    const posBefore = [sim.posX[0], sim.posY[0]];
    expect(sim.useConsumable('flashfreeze')).toBe(true);
    // The slot is VACATED, not tombstoned - only tithe remains.
    expect(sim.heldRelicInfo().map((h) => h.def.id)).toEqual(['tithe']);
    expect(sim.useConsumable('flashfreeze')).toBe(false); // gone
    // And its effect landed: the board is frozen for the window.
    for (let t = 0; t < 29; t++) sim.tick();
    if (sim.alive[0]) {
      expect(sim.posX[0]).toBe(posBefore[0]);
      expect(sim.posY[0]).toBe(posBefore[1]);
    }
  });

  it('orbital: targeted blast kills what it covers, then cools down', () => {
    const { simOpts } = makeWorld(41, { spawnEveryTicks: 2, maxSpawns: 8 });
    const sim = new Sim(41, simOpts);
    grant(sim, 'orbital');
    for (let t = 0; t < 300; t++) sim.tick();
    const alive = sim.aliveCount();
    expect(alive).toBeGreaterThan(0);
    // Aim at the first living walker.
    let ex = 0, ey = 0;
    for (let i = 0; i < 64; i++) if (sim.alive[i]) { ex = Math.floor(sim.posX[i]); ey = Math.floor(sim.posY[i]); break; }
    expect(sim.fireActive('orbital', ex, ey)).toBe(true);
    expect(sim.aliveCount()).toBeLessThan(alive);
    // The view draws the strike from its own event (session 25), not a pulse.
    expect(sim.events.some((e) => e.kind === 'strike' && e.r === 3)).toBe(true);
    expect(sim.fireActive('orbital', ex, ey)).toBe(false); // cooling down
    for (let t = 0; t < 101; t++) sim.tick();
    expect(sim.fireActive('orbital', ex, ey)).toBe(true); // recharged
  });

  it('duplicate actives cool down independently (playtest 12)', () => {
    const { simOpts } = makeWorld(43);
    const sim = new Sim(43, simOpts);
    grant(sim, 'stasis');
    grant(sim, 'stasis');
    expect(sim.fireActive('stasis')).toBe(true); // first copy fires
    expect(sim.relicCooldowns[0]).toBeGreaterThan(0);
    // The bug: the lookup always found the FIRST copy, so its cooldown
    // blocked the ready second copy. The first READY copy must fire.
    expect(sim.fireActive('stasis')).toBe(true);
    expect(sim.relicCooldowns[1]).toBeGreaterThan(0);
    // Both cooling: now it genuinely refuses.
    expect(sim.fireActive('stasis')).toBe(false);
  });

  it('stasis: enemies freeze, towers keep firing', () => {
    const { simOpts } = makeWorld(41, { spawnEveryTicks: 2, maxSpawns: 8 });
    const sim = new Sim(41, simOpts);
    grant(sim, 'stasis');
    for (let t = 0; t < 200; t++) sim.tick();
    expect(sim.aliveCount()).toBeGreaterThan(0);
    const posBefore: number[] = [];
    for (let i = 0; i < 64; i++) if (sim.alive[i]) posBefore.push(sim.posX[i], sim.posY[i]);
    expect(sim.fireActive('stasis')).toBe(true);
    expect(sim.events.some((e) => e.kind === 'freeze' && e.ticks === 50)).toBe(true);
    for (let t = 0; t < 49; t++) sim.tick();
    const posAfter: number[] = [];
    for (let i = 0; i < 64; i++) if (sim.alive[i]) posAfter.push(sim.posX[i], sim.posY[i]);
    // Frozen: any enemy alive through the window has not moved. (Set sizes
    // may differ if towers killed some - compare the shared prefix.)
    expect(posAfter.length).toBeLessThanOrEqual(posBefore.length);
    for (let i = 0; i < posAfter.length; i++) expect(posAfter[i]).toBe(posBefore[i]);
  });

  it('deep vein: production quintuples for the boost window', () => {
    const { cells, cellsW, cellsH, simOpts, seed } = makeOreWorld(11, { maxSpawns: 0, spawnEveryTicks: 100000 });
    const sim = new Sim(seed, simOpts);
    const vein = cellOfType(cells, cellsW, cellsH, 'O');
    sim.buildTower(vein.x, vein.y, 'refinery');
    grant(sim, 'deep_vein');
    expect(sim.fireActive('deep_vein')).toBe(true);
    // Window is [fire, fire+200): cycles at ticks 40/80/120/160 are boosted,
    // the cycle landing exactly AT the boundary (tick 200) is not.
    for (let t = 0; t < 200; t++) sim.tick();
    expect(sim.ore[0]).toBe(4 * 5 + 1);
    for (let t = 0; t < 40; t++) sim.tick(); // window over
    expect(sim.ore[0]).toBe(4 * 5 + 2); // back to 1 per cycle
  });

  it('frostbite + overflow together: the combo layer exists', () => {
    // Not a balance test - a wiring test: two relics' effects both apply in
    // one damage resolution. Slow an enemy, overkill it, watch the chain.
    const { cells, cellsW, cellsH, simOpts } = makeWorld(53, {
      towerDefs: [
        { id: 'bolt', cost: 0, range: 12, fireEveryTicks: 6, projectile: { damage: 30, speed: 1.5, homing: true } },
        { id: 'frost', cost: 0, range: 12, fireEveryTicks: 8, attack: 'pulse', projectile: { damage: 0, speed: 1, applyEffect: 'slow', slowMul: 0.5, slowTicks: 40 } },
      ],
      enemyDefs: [{ ...WALKER, hp: 35 }],
      spawnEveryTicks: 3,
      maxSpawns: 12,
    });
    const with_ = new Sim(53, simOpts);
    const without = new Sim(53, simOpts);
    grant(with_, 'frostbite');
    grant(with_, 'overflow');
    const spot = nthGround(cells, cellsW, cellsH, 0);
    const spot2 = nthGround(cells, cellsW, cellsH, 1);
    for (const s of [with_, without]) {
      s.buildTower(spot.x, spot.y, 'bolt');
      s.buildTower(spot2.x, spot2.y, 'frost');
    }
    let firstKillWith = -1;
    let firstKillWithout = -1;
    for (let t = 0; t < 1200; t++) {
      with_.tick();
      without.tick();
      if (firstKillWith === -1 && with_.kills > 0) firstKillWith = t;
      if (firstKillWithout === -1 && without.kills > 0) firstKillWithout = t;
    }
    // The relic'd sim kills strictly faster (frostbite) and at least as many
    // (overflow chains); identical seeds make this a fair race.
    expect(firstKillWith).toBeGreaterThanOrEqual(0);
    expect(firstKillWith).toBeLessThanOrEqual(firstKillWithout === -1 ? 1200 : firstKillWithout);
    expect(with_.kills).toBeGreaterThanOrEqual(without.kills);
  });

  it('a relic run replays bit-identically, relic actions included', () => {
    const { simOpts } = makeWorld(61, { mode: 'waves', firstWaveWaits: false, coreHp: 10000 });
    const sim = new Sim(61, simOpts);
    let guard = 0;
    while (sim.offer === null && guard++ < 60000) sim.tick();
    sim.pickRelic(0);
    for (let t = 0; t < 500; t++) sim.tick();

    const fresh = new Sim(61, simOpts);
    let i = 0;
    while (fresh.tickCount < sim.tickCount) {
      while (i < sim.inputs.length && sim.inputs[i].tick === fresh.tickCount) fresh.applyAction(sim.inputs[i++].a);
      fresh.tick();
    }
    while (i < sim.inputs.length && sim.inputs[i].tick === fresh.tickCount) fresh.applyAction(sim.inputs[i++].a);
    expect(fresh.hashState()).toBe(sim.hashState());
  });
});

function nthGround(cells: readonly (string | null)[], W: number, H: number, nth: number): { x: number; y: number } {
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
  throw new Error('no ground spot');
}

describe('caches and prospecting - the map as a source of power (1.6.5 A, 1.6.6)', () => {
  it('caches: opened for free, block building while sealed, roll their table on the loot stream', () => {
    const { cells, cellsW, cellsH, simOpts } = makeWorld(83, { startingScrap: 100, lootTables: [{ id: 'rock_cache', outcomes: [{ kind: 'scrap', weight: 1, min: 25, max: 25 }] }] });
    const sim = new Sim(83, simOpts);
    const g = nthGround(cells, cellsW, cellsH, 0);
    sim.caches.push({ x: g.x, y: g.y, table: 'rock_cache', opened: false });
    expect(sim.cacheAt(g.x, g.y)).not.toBeNull();
    expect(sim.canBuildDefAt(g.x, g.y, 'bolt')).toBe(false); // open it, never build on it
    expect(sim.openCache(g.x, g.y)).toBe(true);
    expect(sim.scrap).toBe(125); // free to open; the table paid 25
    expect(sim.lootLog.at(-1)?.text).toBe('+25 scrap');
    expect(sim.inputs.at(-1)?.a.t).toBe('openCache');
    expect(sim.cacheAt(g.x, g.y)).toBeNull(); // opened: gone
    expect(sim.openCache(g.x, g.y)).toBe(false);
    expect(sim.canBuildDefAt(g.x, g.y, 'bolt')).toBe(true); // ground again
  });

  it('prospecting is a JOB: costs scrap AND time, reveals what generation dealt', () => {
    const { map, simOpts } = makeWorld(83, { startingScrap: 5000, maxSpawns: 1 });
    const sim = new Sim(83, simOpts);
    const rc = map.rockContents[0];
    // No unlock needed (playtest 3): anyone may start a job.
    expect(sim.prospect(rc.x, rc.y)).toBe(true);
    expect(sim.prospect(rc.x, rc.y)).toBe(false); // already running
    expect(sim.cellAt(rc.x, rc.y)).toBe('R'); // NOT instant
    for (let t = 0; t < 599; t++) sim.tick();
    expect(sim.cellAt(rc.x, rc.y)).toBe('R'); // still digging at base speed
    sim.tick();
    // Revealed: exactly what was dealt.
    if (rc.yields === 'ore') {
      expect(sim.cellAt(rc.x, rc.y)).toBe('O');
      expect(sim.depositAt(rc.x, rc.y)!.left).toBe(rc.depositAmount);
      expect(sim.canBuildDefAt(rc.x, rc.y, 'refinery')).toBe(true);
    } else {
      expect(sim.cellAt(rc.x, rc.y)).toBe('G');
    }
  });

  it('Automation refineries prospect on their own (parallel to Survey speed)', () => {
    const { cells, cellsW, cellsH, simOpts, seed } = makeOreWorld(83, { startingScrap: 5000, maxSpawns: 1 });
    const sim = new Sim(seed, simOpts);
    // A Survey refinery on a vein; find a rock within its chebyshev-2 reach.
    const vein = cellOfType(cells, cellsW, cellsH, 'O');
    sim.buildTower(vein.x, vein.y, 'refinery');
    sim.chooseTier(vein.x, vein.y, 0, 0);
    sim.chooseTier(vein.x, vein.y, 1, 1); // Survey
    let nearRock: { x: number; y: number } | null = null;
    for (let dy = -2; dy <= 2 && !nearRock; dy++)
      for (let dx = -2; dx <= 2; dx++)
        if (sim.cellAt(vein.x + dx, vein.y + dy) === 'R') { nearRock = { x: vein.x + dx, y: vein.y + dy }; break; }
    if (nearRock) {
      // AUTONOMOUS: within a tick the refinery starts a free job nearby.
      const scrap0 = sim.scrap;
      sim.tick();
      expect(sim.prospectJobAt(nearRock.x, nearRock.y)).not.toBeNull();
      expect(sim.scrap).toBe(scrap0); // free - Survey pays with the slot it occupies
      // Automation is not speed: the free job runs at base pace.
      for (let t = 0; t < 601; t++) sim.tick();
      expect(sim.cellAt(nearRock.x, nearRock.y)).not.toBe('R');
    }
  });

  it('a run with claims and prospects replays bit-identically', () => {
    const { map, cells, cellsW, cellsH, simOpts, seed } = makeOreWorld(83, { startingScrap: 5000, lootTables: TABLES });
    const sim = new Sim(seed, simOpts);
    const vein = cellOfType(cells, cellsW, cellsH, 'O');
    sim.buildTower(vein.x, vein.y, 'refinery');
    sim.chooseTier(vein.x, vein.y, 0, 0);
    sim.chooseTier(vein.x, vein.y, 1, 1);
    for (let t = 0; t < 100; t++) sim.tick();
    const g0 = nthGround(cells, cellsW, cellsH, 0);
    sim.caches.push({ x: g0.x, y: g0.y, table: 'rock_cache', opened: false });
    sim.openCache(g0.x, g0.y);
    sim.prospect(map.rockContents[0].x, map.rockContents[0].y);
    for (let t = 0; t < 700; t++) sim.tick(); // the job completes mid-run

    const fresh = new Sim(seed, simOpts);
    fresh.caches.push({ x: g0.x, y: g0.y, table: 'rock_cache', opened: false });
    let i = 0;
    while (fresh.tickCount < sim.tickCount) {
      while (i < sim.inputs.length && sim.inputs[i].tick === fresh.tickCount) fresh.applyAction(sim.inputs[i++].a);
      fresh.tick();
    }
    while (i < sim.inputs.length && sim.inputs[i].tick === fresh.tickCount) fresh.applyAction(sim.inputs[i++].a);
    expect(fresh.hashState()).toBe(sim.hashState());
  });
});

describe('design round 1 (2026-09-03): stackability, escalating costs, the new knobs', () => {
  const NEW: RelicDef[] = [
    { id: 'frost2', name: 'Frostbite', kind: 'passive', desc: '', stackable: true, effects: { slowedDamageMul: 1.5 } },
    { id: 'second_wind', name: 'Second Wind', kind: 'passive', desc: '', effects: { coreHealPerWave: 2 } },
    { id: 'quarry', name: 'Quarry', kind: 'passive', desc: '', effects: { prospectSpeedMul: 3 } },
    { id: 'toll', name: 'Toll', kind: 'passive', desc: '', stackable: true, effects: { tollScrap: 1 } },
    { id: 'bounty_board', name: 'Bounty Board', kind: 'passive', desc: '', effects: { bossBountyMul: 1.5 } },
    { id: 'sandbags', name: 'Sandbags', kind: 'consumable', desc: '', stackable: true, effects: { coreHpAdd: 15 } },
    { id: 'ore_pocket', name: 'Ore Pocket', kind: 'consumable', desc: '', stackable: true, effects: { oreAdd: 20 } },
  ];
  const POOL2 = [...POOL, ...NEW];
  const pool = (sim: Sim): string[] => (sim as unknown as { unheldPool(): number[] }).unheldPool().map((i) => POOL2[i].id);
  const grant2 = (sim: Sim, id: string): void => {
    sim.offer = [POOL2.findIndex((r) => r.id === id)];
    if (!sim.pickRelic(0)) throw new Error('grant failed');
  };

  it('a held unstackable relic leaves the pool; a stackable one stays', () => {
    const { simOpts } = makeWorld(61, { relicDefs: POOL2 });
    const sim = new Sim(61, simOpts);
    expect(pool(sim)).toContain('overflow');
    expect(pool(sim)).toContain('frost2');
    grant2(sim, 'overflow');
    grant2(sim, 'frost2');
    expect(pool(sim)).not.toContain('overflow'); // a second Overflow is a dead card
    expect(pool(sim)).toContain('frost2'); // a second Frostbite is a bigger one
    expect(pool(sim)).toContain('sandbags'); // consumables are always dealable
  });

  it('Second Wind mends the Core when a wave launches', () => {
    const { simOpts } = makeWorld(61, { mode: 'waves', coreHp: 50, relicDefs: POOL2 });
    const sim = new Sim(61, simOpts);
    grant2(sim, 'second_wind');
    sim.coreHp = 10;
    sim.callWave();
    expect(sim.coreHp).toBe(12);
    sim.coreHp = 49;
    let guard = 0;
    while (sim.spawnRemaining() > 0 && guard++ < 1000) sim.tick();
    sim.callWave();
    expect(sim.coreHp).toBe(50); // never above the maximum
  });

  it('Quarry multiplies prospect speed past the Survey cap', () => {
    const { simOpts } = makeWorld(61, { relicDefs: POOL2 });
    const sim = new Sim(61, simOpts);
    expect(sim.prospectSpeed()).toBe(1);
    grant2(sim, 'quarry');
    expect(sim.prospectSpeed()).toBe(3);
  });

  it('Toll: enemies walking beside a tower pay Scrap', () => {
    const { cells, cellsW, cellsH, simOpts } = makeWorld(61, { relicDefs: POOL2, startingScrap: 100 });
    const HARMLESS: TowerDef = { id: 'bolt', cost: 20, range: 6, fireEveryTicks: 10, projectile: { damage: 0, speed: 0.7, homing: true } };
    const run = (toll: boolean): number => {
      const sim = new Sim(61, { ...simOpts, towerDefs: [HARMLESS] });
      if (toll) grant2(sim, 'toll');
      // A spot touching the road NEAREST THE CORE (session 24: one entrance,
      // so every enemy walks past it and pays the toll).
      let core = { x: cellsW - 1, y: Math.floor(cellsH / 2) };
      for (let y = 0; y < cellsH; y++) for (let x = 0; x < cellsW; x++) if (cells[y * cellsW + x] === 'C') core = { x, y };
      let pick: { x: number; y: number } | null = null;
      let bestD = Infinity;
      for (let y = 0; y < cellsH; y++)
        for (let x = 0; x < cellsW; x++) {
          if (cells[y * cellsW + x] !== 'G') continue;
          const touches = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => cells[(y + dy) * cellsW + (x + dx)] === 'X');
          const d = Math.abs(x - core.x) + Math.abs(y - core.y);
          if (touches && d < bestD) { bestD = d; pick = { x, y }; }
        }
      expect(pick).not.toBeNull();
      expect(sim.buildTower(pick!.x, pick!.y, 'bolt')).toBe(true);
      for (let t = 0; t < 1500; t++) sim.tick();
      return sim.scrap;
    };
    expect(run(false)).toBe(80); // 100 - the tower, nobody dies (damage 0)
    expect(run(true)).toBeGreaterThan(80);
  });

  it('consumables: Sandbags raise the Core and its maximum, Ore Pocket pays Ore, both free their slot', () => {
    const { simOpts } = makeWorld(61, { relicDefs: POOL2, coreHp: 50 });
    const sim = new Sim(61, simOpts);
    grant2(sim, 'sandbags');
    grant2(sim, 'ore_pocket');
    sim.coreHp = 40;
    expect(sim.useConsumable('sandbags')).toBe(true);
    expect(sim.coreHpMax).toBe(65);
    expect(sim.coreHp).toBe(55);
    expect(sim.useConsumable('ore_pocket')).toBe(true);
    expect(sim.ore[0]).toBe(20);
    expect(sim.heldRelics.length).toBe(0);
  });

  it('Bounty Board folds as a boss-only multiplier', () => {
    const { simOpts } = makeWorld(61, { relicDefs: POOL2 });
    const sim = new Sim(61, simOpts);
    grant2(sim, 'bounty_board');
    expect((sim as unknown as { fold: { bossBountyMul: number } }).fold.bossBountyMul).toBe(1.5);
  });
});

describe('caches and loot tables (design round 1, 2026-09-03)', () => {
  const table = (kind: LootTable['outcomes'][number]['kind'], extra: Partial<LootTable['outcomes'][number]> = {}): LootTable[] =>
    [{ id: 'rock_cache', outcomes: [{ kind, weight: 1, ...extra }] }];
  const withCache = (seed: number, tables: LootTable[], where: 'G' | 'X' = 'G') => {
    const { cells, cellsW, cellsH, simOpts } = makeWorld(seed, { lootTables: tables, startingScrap: 0 });
    const sim = new Sim(seed, simOpts);
    const at = where === 'G' ? nthGround(cells, cellsW, cellsH, 0) : cellOfType(cells, cellsW, cellsH, 'X');
    sim.caches.push({ x: at.x, y: at.y, table: 'rock_cache', opened: false });
    return { sim, at };
  };

  it('every outcome kind applies: ore, boon, consumable, relic, nothing', () => {
    const ore = withCache(83, table('ore', { min: 7, max: 7 }));
    ore.sim.openCache(ore.at.x, ore.at.y);
    expect(ore.sim.ore[0]).toBe(7);

    const boon = withCache(83, table('boon', { tier: 2 }));
    expect(boon.sim.boonAt(boon.at.x, boon.at.y)).toBeNull();
    boon.sim.openCache(boon.at.x, boon.at.y);
    expect(boon.sim.boonAt(boon.at.x, boon.at.y)?.tier).toBe(2);
    expect(boon.sim.extraBoons).toHaveLength(1);
    expect(boon.sim.lootLog.at(-1)?.text).toMatch(/^boon ground/);

    const cons = withCache(83, table('consumable'));
    cons.sim.openCache(cons.at.x, cons.at.y);
    expect(cons.sim.heldRelicInfo().map((h) => h.def.kind)).toEqual(['consumable']);

    const relic = withCache(83, table('relic'));
    relic.sim.openCache(relic.at.x, relic.at.y);
    expect(relic.sim.heldRelicInfo()).toHaveLength(1);
    expect(relic.sim.heldRelicInfo()[0].def.kind).not.toBe('consumable');

    const nothing = withCache(83, table('nothing'));
    nothing.sim.openCache(nothing.at.x, nothing.at.y);
    expect(nothing.sim.lootLog.at(-1)?.text).toBe('empty');
  });

  it('a boon rolled on a road cell (a boss drop) falls back to Scrap', () => {
    const { sim, at } = withCache(83, table('boon', { tier: 2 }), 'X');
    sim.openCache(at.x, at.y);
    expect(sim.extraBoons).toHaveLength(0);
    expect(sim.scrap).toBe(60);
  });

  it('the roll is deterministic per seed and rides the input log', () => {
    const mixed: LootTable[] = [{ id: 'rock_cache', outcomes: [
      { kind: 'scrap', weight: 35, min: 60, max: 120 }, { kind: 'ore', weight: 25, min: 10, max: 30 },
      { kind: 'boon', weight: 20, tier: 2 }, { kind: 'consumable', weight: 12 }, { kind: 'relic', weight: 8 },
    ] }];
    const a = withCache(91, mixed);
    const b = withCache(91, mixed);
    a.sim.openCache(a.at.x, a.at.y);
    b.sim.openCache(b.at.x, b.at.y);
    expect(a.sim.lootLog.at(-1)?.text).toBe(b.sim.lootLog.at(-1)?.text);
    expect(a.sim.hashState()).toBe(b.sim.hashState());
  });

  it('a prospected rock that hides a cache REVEALS a sealed cache - nothing is granted', () => {
    // Rock caches are rare and capped; scan seeds until a map deals one.
    let found: { seed: number; x: number; y: number } | null = null;
    for (let seed = 83; seed < 400 && !found; seed++) {
      const { map } = makeWorld(seed);
      const rc = map.rockContents.find((r) => r.yields === 'cache');
      if (rc) found = { seed, x: rc.x, y: rc.y };
    }
    expect(found).not.toBeNull();
    const { simOpts } = makeWorld(found!.seed, { startingScrap: 5000, maxSpawns: 1, lootTables: TABLES });
    const sim = new Sim(found!.seed, simOpts);
    expect(sim.prospect(found!.x, found!.y)).toBe(true);
    for (let t = 0; t < 600; t++) sim.tick();
    expect(sim.cellAt(found!.x, found!.y)).toBe('G');
    expect(sim.heldRelics).toHaveLength(0);
    expect(sim.cacheAt(found!.x, found!.y)?.table).toBe('rock_cache');
  });

  it('a boss drops a cache where it dies, and the drop rolls the boss table', () => {
    const CANNON: TowerDef = { id: 'bolt', cost: 20, range: 60, fireEveryTicks: 1, projectile: { damage: 100000, speed: 5, homing: true } };
    const { cells, cellsW, cellsH, simOpts } = makeWorld(83, { mode: 'waves', coreHp: 100000, finalWave: 1, startingScrap: 100, towerDefs: [CANNON], lootTables: TABLES });
    const sim = new Sim(83, simOpts);
    const spot = nthGround(cells, cellsW, cellsH, 0);
    expect(sim.buildTower(spot.x, spot.y, 'bolt')).toBe(true);
    expect(sim.nextWavePreview()?.boss).toBe(true); // the final wave is a boss wave
    sim.callWave();
    let guard = 0;
    while (guard++ < 5000 && !sim.caches.some((c) => c.table === 'boss_drop')) sim.tick();
    const drop = sim.caches.find((c) => c.table === 'boss_drop');
    expect(drop).toBeDefined();
    expect(sim.openCache(drop!.x, drop!.y)).toBe(true);
    expect(sim.ore[0]).toBe(5);
  });
});
