/**
 * The worker lifecycle state machine (2.27 PR 4) - and the reserved
 * playtest-16 regression fixtures, finally written as tests:
 *
 *  - PHANTOM RESUME: a failed init used to escape uncaught, leaving the
 *    main thread 'playing' the previous run with no error. The contract:
 *    init yields exactly one of ready | genError, and a failed init leaves
 *    the previous run fully intact.
 *  - DROPPED BRIDGE SPECIALS, no error surfaced: an impossible loadout
 *    must produce a genError naming the problem, never silence.
 *  - BOON-ON-VOID, the lifecycle half: newRun used to assign the new map
 *    before constructing the Sim, so a Sim-constructor throw left frames
 *    compositing the NEW map's boons over the OLD sim's board. Init is
 *    transactional now; the mixed state is unrepresentable, and the test
 *    pins that a failed init serves the old run's boons with the old
 *    run's map.
 */
import { describe, expect, it } from 'vitest';
import type { EnemyDef, RelicDef, TileDef, TowerDef } from '@ascii-defense/engine';
import type { FromWorker, RunSave, UiState } from './protocol';
import { createWorkerRuntime } from './workerRuntime';

const g = (...rows: string[]): string[] => rows;
const BASICS: TileDef[] = [
  { id: 'straight', cells: g('GGGGG', 'GGGGG', 'XXXXX', 'GGGGG', 'GGGGG') },
  { id: 'corner', cells: g('GGGGG', 'GGGGG', 'XXXGG', 'GGXGG', 'GGXGG') },
  { id: 'tee', cells: g('GGGGG', 'GGGGG', 'XXXXX', 'GGXGG', 'GGXGG') },
  { id: 'cross', cells: g('GGXGG', 'GGXGG', 'XXXXX', 'GGXGG', 'GGXGG') },
  { id: 'meadow', cells: g('GGGGG', 'GGGGG', 'GGGGG', 'GGGGG', 'GGGGG') },
  { id: 'ore_patch', cells: g('GGGGG', 'GOOGG', 'GOOGG', 'GGGGG', 'GGGGG') },
  // A shipped SPECIAL (playtest 2026-08-19): lives in the basics file,
  // flagged so it is chosen, never rolled.
  { id: 'ship_twin', cells: g('GG|GG', 'GGL7G', '-7GL-', 'GL7GG', 'GG|GG'), special: true },
];
const WALKER: EnemyDef = { id: 'walker', hp: 10, speed: 0.2, damage: 2 };
const BOLT: TowerDef = { id: 'bolt', cost: 20, range: 6, fireEveryTicks: 10, projectile: { damage: 6, speed: 0.6, homing: true } };
const POOL: RelicDef[] = [
  { id: 'r1', name: 'One', kind: 'passive', desc: '', effects: { damageMul: 1.1 } },
  { id: 'r2', name: 'Two', kind: 'passive', desc: '', effects: { damageMul: 1.2 } },
];

const UI: UiState = { hover: null, selected: null, hudHover: null, targeting: null, showGrid: false };

function makeRt() {
  const posts: FromWorker[] = [];
  const rt = createWorkerRuntime({
    post: (m) => posts.push(m),
    basics: BASICS,
    enemyDefs: [WALKER],
    towerDefs: [BOLT],
    relicDefs: POOL,
    lootTables: [
      { id: 'rock_cache', outcomes: [{ kind: 'scrap', weight: 1, min: 10, max: 10 }] },
      { id: 'boss_drop', outcomes: [{ kind: 'scrap', weight: 1, min: 10, max: 10 }] },
    ],
  });
  const last = <T extends FromWorker['t']>(t: T) =>
    [...posts].reverse().find((p): p is Extract<FromWorker, { t: T }> => p.t === t);
  let debugSeq = 0;
  const debug = (op: string, ...args: unknown[]): unknown => {
    rt.handle({ t: 'debug', id: ++debugSeq, op, args });
    return last('debugResult')!.result;
  };
  return { rt, posts, last, debug };
}

describe('the lifecycle contract: init yields ready or genError, never silence', () => {
  it('a good init posts ready; frames serve the run', () => {
    const { rt, last } = makeRt();
    rt.handle({ t: 'init', seed: 7, threatIdx: 1, loadout: [] });
    const ready = last('ready');
    expect(ready).toBeDefined();
    rt.handle({ t: 'frame', ui: UI });
    expect(last('snapshot')!.s.seed).toBe(ready!.seed);
  });

  it('before any successful init, frames serve NOTHING - never a stale lie', () => {
    const { rt, posts } = makeRt();
    rt.handle({ t: 'frame', ui: UI });
    expect(posts.filter((p) => p.t === 'snapshot')).toEqual([]);
  });

  it('PHANTOM RESUME: an init that throws in construction posts genError and leaves the old run intact', () => {
    const { rt, last, posts } = makeRt();
    rt.handle({ t: 'init', seed: 7, threatIdx: 1, loadout: [] });
    const firstSeed = last('ready')!.seed;
    const firstBoons = structuredClone(last('ready')!.map.boons);

    // Two same-id specials: TileLibrary's constructor throws - the exact
    // class of escape that used to strand the worker half-switched.
    const dup: TileDef = { id: 'sp_dup', cells: g('GG|GG', 'GG|GG', 'GG|GG', 'GG|GG', 'GG|GG') };
    const before = posts.length;
    rt.handle({ t: 'init', seed: 8, threatIdx: 1, loadout: [dup, { ...dup }] });

    // Exactly one message, and it is genError - not silence, not ready.
    expect(posts.length).toBe(before + 1);
    expect(posts[before].t).toBe('genError');

    // The previous run is fully intact: same seed, and - the boon-on-void
    // composite, pinned - the boons a frame serves are the OLD map's.
    rt.handle({ t: 'frame', ui: UI });
    const snap = last('snapshot')!.s;
    expect(snap.seed).toBe(firstSeed);
    expect(snap.board.boons).toEqual(firstBoons.map((b) => ({ x: b.x, y: b.y, tier: b.tier })));
  });

  it('DROPPED SPECIALS: an impossible loadout is refused with a sentence, never silently', () => {
    const { rt, last } = makeRt();
    const spCore: TileDef = { id: 'sp_core', cells: g('GGGGG', 'GCCCG', 'GCCCX', 'GCCCG', 'GGGGG') };
    rt.handle({ t: 'init', seed: 7, threatIdx: 1, loadout: [spCore] });
    const err = last('genError');
    expect(err).toBeDefined();
    expect(err!.message).toMatch(/carries the Core/);
    expect(last('ready')).toBeUndefined();
  });
});

describe('shipped specials (playtest 2026-08-19): chosen, never rolled', () => {
  it('unchosen, the flagged tile never appears', () => {
    const { rt, last } = makeRt();
    for (const seed of [3, 14, 26, 47, 88]) {
      rt.handle({ t: 'init', seed, threatIdx: 1, loadout: [] });
      const placed = last('ready')!.map.board.slots.filter(Boolean).map((p) => p!.tileId);
      expect(placed.includes('ship_twin'), `seed ${seed}`).toBe(false);
    }
  });

  it('chosen by its shipped def, it is guaranteed exactly once', () => {
    const { rt, last } = makeRt();
    const def = BASICS.find((t) => t.id === 'ship_twin')!;
    rt.handle({ t: 'init', seed: 21, threatIdx: 1, loadout: [def] });
    const ready = last('ready');
    expect(ready).toBeDefined();
    const placed = ready!.map.board.slots.filter(Boolean).map((p) => p!.tileId);
    expect(placed.filter((id) => id === 'ship_twin').length).toBe(1);
  });
});

describe('map-in-save (D15): resume loads the map, never regenerates', () => {
  function playAndSave() {
    const world = makeRt();
    const { rt, last, debug } = world;
    rt.handle({ t: 'init', seed: 4242, threatIdx: 1, loadout: [] });
    const map = last('ready')!.map;
    // Build a tower on the first buildable cell so the input log is real.
    outer: for (let y = 0; y < 35; y++)
      for (let x = 0; x < 60; x++)
        if (debug('canBuild', x, y) === true) { debug('build', x, y, 'bolt'); break outer; }
    debug('step', 150);
    rt.handle({ t: 'save', id: 1 });
    const save = last('saved')!.save;
    const hashAtSave = debug('hash');
    return { save, hashAtSave, map };
  }

  it('round trip: a resumed run is bit-identical to the original at the saved tick', () => {
    const { save, hashAtSave, map } = playAndSave();
    expect(save.map).toEqual(map); // the save carries the map itself

    const second = makeRt();
    second.rt.handle({ t: 'init', seed: save.seed, threatIdx: save.threatIdx, resume: save });
    const ready = second.last('ready');
    expect(ready).toBeDefined();
    expect(ready!.map).toEqual(map); // loaded, not regenerated
    expect(second.debug('hash')).toBe(hashAtSave);
  });

  it('content drift is refused loudly', () => {
    const { save } = playAndSave();
    const second = makeRt();
    second.rt.handle({ t: 'init', seed: save.seed, threatIdx: save.threatIdx, resume: { ...save, contentHash: save.contentHash + 1 } });
    expect(second.last('genError')!.message).toMatch(/different content/);
    expect(second.last('ready')).toBeUndefined();
  });

  it('a save without a map (pre-rebuild) is refused loudly', () => {
    const { save } = playAndSave();
    const second = makeRt();
    const { map: _dropped, ...stale } = save;
    void _dropped;
    second.rt.handle({ t: 'init', seed: save.seed, threatIdx: save.threatIdx, resume: stale as RunSave });
    expect(second.last('genError')!.message).toMatch(/predates the generator rebuild/);
    expect(second.last('ready')).toBeUndefined();
  });
});
