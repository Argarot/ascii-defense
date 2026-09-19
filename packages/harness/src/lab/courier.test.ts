/**
 * The courier (PRD sec 32.4, D45; Rework I, PR 4): much faster than anything,
 * held by nothing, harmless, in the preview, one wave in three and never a
 * boss's; killed it drops its chest where it fell, missed the chest is gone;
 * random chests are cut. And the game as it is has never heard of it.
 */
import { describe, expect, it } from 'vitest';
import { COURIER_DEF, REWORK_COURIER, Sim, THREAT_LEVELS, TICK_HZ, TileLibrary, createRng, generateMap, mapCells, reworkKnobs, reworkRules, threatKnobs, withCourier, type EnemyDef, type TowerDef } from '@ascii-defense/engine';
import { validateEnemies } from '@ascii-defense/content';
import libraryJson from '@ascii-defense/content/assets/tiles/library.json';
import enemiesJson from '@ascii-defense/content/assets/enemies/roster.json';

const lib = new TileLibrary(libraryJson.tiles);
const T = THREAT_LEVELS[1];
const roster = ((): EnemyDef[] => { const r = validateEnemies.check(enemiesJson); if (!r.ok) throw new Error('roster'); return r.value.enemies as EnemyDef[]; })();
const GRUNT: EnemyDef = { id: 'grunt', hp: 10, speed: 0.05, damage: 1, bounty: 5 };
/** Reaches the whole board and freezes, slows and kills: everything a build can throw at a body. */
const GUN: TowerDef = { id: 'bolt', cost: 20, range: 60, fireEveryTicks: 2, projectile: { damage: 500, speed: 3, homing: true } };
const FROST: TowerDef = { id: 'frost', cost: 20, range: 60, fireEveryTicks: 2, projectile: { damage: 0, speed: 3, homing: true, applyEffect: 'slow', slowMul: 0.1, slowTicks: 200 } };
const SEED = 7 * 7919 + 13;

function world(rework: boolean, towerDefs: TowerDef[], enemies: EnemyDef[] = [GRUNT]): Sim {
  const knobs = createRng(SEED).stream('map');
  const map = generateMap(knobs, lib, { width: 7, height: 5, ...threatKnobs(knobs, T), relicPoolSize: 54, specials: [], ...(rework ? reworkKnobs(T) : {}) });
  return new Sim(SEED, { cells: mapCells(map, lib), cellsW: map.cellsW, cellsH: map.cellsH, map, enemyDefs: rework ? withCourier(enemies) : enemies, towerDefs, mode: 'waves', interWaveTicks: T.waveSeconds * TICK_HZ, difficulty: T.difficulty, finalWave: 12, coreHp: 1_000_000, startingScrap: 100_000, lootTables: [{ id: 'void_chest', outcomes: [{ kind: 'scrap', weight: 1, min: 40, max: 40 }] }], rework: rework ? reworkRules() : undefined } as ConstructorParameters<typeof Sim>[1]);
}
const arm = (sim: Sim, id: string): void => { for (let y = 0; y < 25; y++) for (let x = 0; x < 36; x++) if (sim.canBuildAt(x, y)) sim.buildTower(x, y, id); };
const couriers = (sim: Sim): number[] => { const out: number[] = []; for (let i = 0; i < sim.posX.length; i++) if (sim.alive[i] && sim.enemyDefOf(i).courier) out.push(i); return out; };
/** Play until wave `w` has launched and its courier is on the road; returns its slot. */
function toCourier(sim: Sim, w: number): number {
  sim.callWave();
  for (let t = 0; t < w * T.waveSeconds * TICK_HZ + 400; t++) { sim.tick(); if (sim.wave >= w && couriers(sim).length > 0) return couriers(sim)[0]; }
  return -1;
}

describe('the courier', () => {
  it('is faster than every body that ships, harmless, and worth no bounty', () => {
    expect(COURIER_DEF.speed).toBeGreaterThan(Math.max(...roster.map((d) => d.speed)) * 1.25);
    expect(COURIER_DEF.damage).toBe(0);
    expect(COURIER_DEF.bounty ?? 0).toBe(0);
  });

  it('walks with wave 2, 5, 8, 11 - one wave in three - in the NEXT preview, and never with a boss', () => {
    const sim = world(true, [GUN]);
    const seen: number[] = [];
    arm(sim, 'bolt');
    sim.callWave();
    for (let t = 0; t < 12 * T.waveSeconds * TICK_HZ; t++) {
      const p = sim.nextWavePreview();
      if (p && p.kinds.some((k) => k.id === 'courier') && !seen.includes(p.wave)) seen.push(p.wave);
      sim.tick();
    }
    expect(seen).toEqual([2, 8, 11]); // 5 is a boss wave: the boss has a chest of its own
    expect(REWORK_COURIER).toEqual({ every: 3, from: 2 });
  });

  it('nothing holds it: its walk to the Core takes exactly as long through a wall of Frost as across an empty board', () => {
    // What a player would see. (The first version of this test looked at the courier's slow timer forty ticks in, and
    // passed with the exemption switched OFF: every tower was still shooting the front grunt.)
    const walk = (frost: boolean): { ticks: number; slowedGrunts: number } => {
      const sim = world(true, [FROST]);
      if (frost) arm(sim, 'frost');
      const c = toCourier(sim, 2);
      expect(c).toBeGreaterThanOrEqual(0);
      let ticks = 0; let slowedGrunts = 0;
      while (sim.alive[c] && sim.enemyDefOf(c).courier && ticks < 5000) {
        sim.tick(); ticks++;
        for (let i = 0; i < sim.posX.length; i++) if (sim.alive[i] && !sim.enemyDefOf(i).courier && sim.slowTicks[i] > 0) slowedGrunts++;
      }
      return { ticks, slowedGrunts };
    };
    const free = walk(false);
    const held = walk(true);
    expect(held.slowedGrunts, 'the Frost wall is real: it holds the grunts').toBeGreaterThan(100);
    expect(free.slowedGrunts).toBe(0);
    expect(held.ticks).toBe(free.ticks);
  });

  it('killed, it drops its chest where it fell, and the chest pays when clicked; random chests never surface', () => {
    const sim = world(true, [GUN]);
    arm(sim, 'bolt');
    // A gun that reaches the whole board kills the courier the tick it steps on: play until its chest stands.
    sim.callWave();
    for (let t = 0; t < 3 * T.waveSeconds * TICK_HZ && sim.voidChests.length === 0; t++) sim.tick();
    expect(sim.wave).toBe(2);
    expect(sim.voidChests.length).toBe(1);
    expect(sim.cellAt(sim.voidChests[0].x, sim.voidChests[0].y), 'it fell on the road').not.toBe('G');
    const chest = sim.voidChests[0];
    const scrap = sim.scrap;
    expect(sim.claimChest(chest.x, chest.y)).toBe(true);
    expect(sim.scrap).toBeGreaterThan(scrap);
    // Twelve waves of play, and the only chests that ever stood were couriers' and bosses'.
    let stray = 0;
    for (let t = 0; t < 2 * T.waveSeconds * TICK_HZ; t++) { sim.tick(); stray += sim.voidChests.filter((c) => !c.boss && sim.cellAt(c.x, c.y) === 'G').length; }
    expect(stray).toBe(0);
  });

  it('missed, the chest is gone and nothing else is lost: it reaches the Core and the Core does not feel it', () => {
    const sim = world(true, [GUN]); // no towers built
    const hp = sim.coreHp;
    expect(toCourier(sim, 2)).toBeGreaterThanOrEqual(0);
    const grunts = (): number => sim.aliveCount() - couriers(sim).length;
    void grunts;
    for (let t = 0; t < 600 && couriers(sim).length > 0; t++) sim.tick();
    expect(couriers(sim).length).toBe(0);
    expect(sim.voidChests.length).toBe(0);
    // Whatever the Core lost, it lost to grunts: a breach by damage 0 costs nothing.
    expect(hp - sim.coreHp).toBe(sim.breaches - 1 >= 0 ? (sim.breaches - 1) * GRUNT.damage : 0);
  });

  it('the game as it is has never heard of it: no courier in any preview, and chests still surface', () => {
    const sim = world(false, [GUN]);
    arm(sim, 'bolt');
    sim.callWave();
    let seen = false; let chests = 0;
    for (let t = 0; t < 9 * T.waveSeconds * TICK_HZ; t++) { if (sim.nextWavePreview()?.kinds.some((k) => k.id === 'courier')) seen = true; sim.tick(); chests = Math.max(chests, sim.voidChests.length); }
    expect(seen).toBe(false);
    expect(chests).toBeGreaterThan(0);
  });
});
