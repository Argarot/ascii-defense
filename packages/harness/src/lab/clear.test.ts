/**
 * The clear bonus (PRD sec 32.3, D44; Rework I, PR 3) on the app's own map
 * with the prototype's switch on: a body knows its wave, a wave arrives inside
 * its spawn window, a cleared wave pays its bounties x the share of par saved,
 * and the game as it is pays nothing of the kind.
 */
import { describe, expect, it } from 'vitest';
import { REWORK_CLEAR, Sim, THREAT_LEVELS, TICK_HZ, TileLibrary, createRng, generateMap, mapCells, reworkKnobs, reworkRules, threatKnobs, validateTileCells, type EnemyDef, type SimEvent, type TowerDef } from '@ascii-defense/engine';
import libraryJson from '@ascii-defense/content/assets/tiles/library.json';

void validateTileCells;
const lib = new TileLibrary(libraryJson.tiles);
const T = THREAT_LEVELS[1];
const GRUNT: EnemyDef = { id: 'grunt', hp: 10, speed: 0.05, damage: 1, bounty: 5 };
const BROOD: EnemyDef = { id: 'brood', hp: 10, speed: 0.05, damage: 1, bounty: 5, traits: ['split'], splitInto: 'grunt' } as EnemyDef;
const BOLT: TowerDef = { id: 'bolt', cost: 20, range: 60, fireEveryTicks: 2, projectile: { damage: 50, speed: 3, homing: true } };
const SEED = 5 * 7919 + 13;

function world(rework: boolean, enemyDefs: EnemyDef[] = [GRUNT]): { sim: Sim; events: SimEvent[] } {
  const knobs = createRng(SEED).stream('map');
  const map = generateMap(knobs, lib, { width: 7, height: 5, ...threatKnobs(knobs, T), relicPoolSize: 54, specials: [], ...(rework ? reworkKnobs(T) : {}) });
  const sim = new Sim(SEED, { cells: mapCells(map, lib), cellsW: map.cellsW, cellsH: map.cellsH, map, enemyDefs, towerDefs: [BOLT], mode: 'waves', interWaveTicks: T.waveSeconds * TICK_HZ, difficulty: T.difficulty, finalWave: 3, coreHp: 1_000_000, startingScrap: 100_000, rework: rework ? reworkRules() : undefined });
  const events: SimEvent[] = [];
  return { sim, events };
}
/** Every pad gets a gun that reaches the whole board: a build that kills at the entry. */
function armEverywhere(sim: Sim, W: number, H: number): number {
  let n = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (sim.canBuildAt(x, y) && sim.buildTower(x, y, 'bolt')) n++;
  return n;
}
/** Tick, gathering events by sequence number: `sim.events` is a capped ring, so it is read every tick. */
function play(sim: Sim, ticks: number): SimEvent[] {
  const out: SimEvent[] = [];
  let seen = sim.events.length > 0 ? sim.events[sim.events.length - 1].seq : -1;
  for (let i = 0; i < ticks; i++) {
    sim.tick();
    for (const e of sim.events) if (e.seq > seen) { out.push(e); seen = e.seq; }
  }
  return out;
}

describe('the clear bonus', () => {
  it('a wave killed at its entry pays nearly all of its bounties again; the line says how long, against what, for how much', () => {
    const { sim } = world(true);
    expect(armEverywhere(sim, 36, 25)).toBeGreaterThan(20);
    sim.callWave();
    const scrap0 = sim.scrap;
    const events = play(sim, 30 * TICK_HZ);
    const cleared = events.filter((e) => e.kind === 'waveCleared');
    expect(cleared.length).toBe(1);
    const c = cleared[0] as Extract<SimEvent, { kind: 'waveCleared' }>;
    expect(c.wave).toBe(1);
    expect(c.par).toBeGreaterThan(c.seconds); // killed forward: well under par
    const bounties = sim.kills * 5;
    expect(c.bonus).toBeGreaterThan(bounties * 0.6);
    expect(c.bonus).toBeLessThanOrEqual(bounties * REWORK_CLEAR.mul);
    expect(sim.scrap - scrap0).toBe(bounties + c.bonus);
    expect(sim.lastClear?.wave).toBe(1);
  });

  it('a wave nobody shoots is cleared through the Core, over par, and pays nothing', () => {
    const { sim } = world(true, [{ ...GRUNT, speed: 0.4 }]);
    sim.callWave();
    const events = play(sim, 39 * TICK_HZ);
    const c = events.find((e) => e.kind === 'waveCleared') as Extract<SimEvent, { kind: 'waveCleared' }> | undefined;
    expect(c, 'every body walked in: the wave is over').toBeTruthy();
    expect(c!.bonus).toBe(0);
    expect(sim.breaches).toBeGreaterThan(0);
  });

  it('a wave arrives inside a fifth of its clock (his condition: the build decides the payout, not the last body\'s entry time)', () => {
    // Wave 1 is six bodies and fits any window; the rule bites on a FAT wave. Wave 9 of Standard is about fifty bodies,
    // seventeen seconds of column at the shipped spacing - against a window of eight. (Seen red with the compression off.)
    const { sim } = world(true, [GRUNT]);
    const big = new Sim(SEED, { ...(sim as unknown as { opts: ConstructorParameters<typeof Sim>[1] }).opts, finalWave: 12 });
    armEverywhere(big, 36, 25);
    const window = T.waveSeconds * TICK_HZ * REWORK_CLEAR.windowShare;
    big.callWave();
    let launchedAt = 0; let lastSpawnAt = 0; let spawned = big.spawned; let bodies = 0;
    for (let i = 0; i < 9 * T.waveSeconds * TICK_HZ + window * 2; i++) {
      const wave = big.wave;
      big.tick();
      if (big.wave !== wave && big.wave === 9) { launchedAt = i; bodies = 0; }
      if (big.spawned > spawned) { if (big.wave === 9) { lastSpawnAt = i; bodies += big.spawned - spawned; } spawned = big.spawned; }
    }
    expect(bodies, 'wave 9 is a fat wave').toBeGreaterThan(40);
    expect(lastSpawnAt - launchedAt).toBeLessThanOrEqual(window + bodies); // a tick of rounding a body, at most
  });

  it('a body knows its wave: a split\'s halves hold their parent\'s wave open until they are gone too', () => {
    const { sim } = world(true, [BROOD, GRUNT]);
    armEverywhere(sim, 36, 25);
    sim.callWave();
    const events = play(sim, 30 * TICK_HZ);
    const c = events.find((e) => e.kind === 'waveCleared') as Extract<SimEvent, { kind: 'waveCleared' }>;
    expect(c).toBeTruthy();
    // Every kill of the wave - parents and halves - is in the bounties the bonus is a share of.
    expect(c.bonus).toBeLessThanOrEqual(sim.kills * 5);
    expect(sim.aliveCount()).toBe(0);
  });

  it('with the switch off a cleared wave pays nothing and says nothing', () => {
    const { sim } = world(false);
    armEverywhere(sim, 36, 25);
    sim.callWave();
    const scrap0 = sim.scrap;
    const events = play(sim, 30 * TICK_HZ);
    expect(events.some((e) => e.kind === 'waveCleared')).toBe(false);
    expect(sim.scrap - scrap0).toBe(sim.kills * 5);
    expect(sim.lastClear).toBeNull();
  });
});
