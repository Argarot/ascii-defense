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
import { THREAT_LEVELS, TileLibrary, createRng, generateMap, threatKnobs, type EnemyDef, type RelicDef, type TileDef, type TowerDef } from '@ascii-defense/engine';
import { BOARD_SLOTS, SAVE_VERSION, type FromWorker, type RunSave, type UiState } from './protocol';
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
  { id: 'r1', name: 'One', kind: 'passive', rarity: 'common', desc: '', effects: { damageMul: 1.1 } },
  { id: 'r2', name: 'Two', kind: 'passive', rarity: 'rare', desc: '', effects: { damageMul: 1.2 } }, // exists only above common: WON, and dealt only inside the rare band (PRD sec 28.1)
];

const UI: UiState = { hover: null, selected: null, hudHover: null, targeting: null, showGrid: false };

function makeRt() {
  const posts: FromWorker[] = [];
  const rt = createWorkerRuntime({
    post: (m) => posts.push(m),
    basics: BASICS,
    enemyDefs: [WALKER],
    towerDefs: [BOLT],
    setDefs: [],
    recipeDefs: [],
    relicDefs: POOL,
    lootTables: [
      { id: 'rock_cache', outcomes: [{ kind: 'scrap', weight: 1, min: 10, max: 10 }] },
      { id: 'boss_drop', outcomes: [{ kind: 'scrap', weight: 1, min: 10, max: 10 }] },
    ],
    // A small tree (session 29, PR 1; the reliquary sells a BAND since D34): the base has the Bolt; a node grants the rare band and two slots.
    tree: { base: { towers: ['bolt'], relicSlots: 4, threat: 1, tileSlots: 1, oreTier: 1 }, nodes: [{ id: 'more', name: 'More', branch: 'capacity', desc: '', cost: { tier: 1, ore: 10 }, grants: { rarity: 1, relicSlots: 2 } }, { id: 'lodes', name: 'Lodes', branch: 'ore', desc: '', cost: { tier: 1, ore: 10 }, grants: { oreTier: 3 } }] },
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
    expect(snap.board.boons).toEqual(firstBoons.map((b) => ({ x: b.x, y: b.y, tier: b.tier, boon: b.boon })));
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

describe('the meta tree decides the world (session 29, PR 1)', () => {
  it('a run without meta has everything; a run under the base has the base; the save carries its meta; a resume keeps it', () => {
    const { rt, last, debug } = makeRt();
    rt.handle({ t: 'init', seed: 7, threatIdx: 1, loadout: [] });
    rt.handle({ t: 'frame', ui: UI });
    const everything = last('snapshot')!.s;
    expect(everything.hud.coreCard?.relicSlots).toBe(6); // base 4 + the node's 2: the sentinel counts every node
    expect((debug('pool') as unknown[]).length).toBe(2);
    rt.handle({ t: 'init', seed: 7, threatIdx: 1, loadout: [], meta: { unlocks: [], earned: [], forged: {} } });
    rt.handle({ t: 'frame', ui: UI });
    const base = last('snapshot')!.s;
    expect(base.hud.coreCard?.relicSlots).toBe(4);
    expect(base.hud.coreCard?.slots.filter((x) => x.state === 'locked').length).toBe(8); // twelve drawn, four granted
    expect((debug('pool') as unknown[]).length).toBe(1);
    rt.handle({ t: 'save', id: 1 });
    const save = last('saved')!.save;
    expect(save.meta.unlocks).toEqual([]);
    expect(save.version).toBe(SAVE_VERSION);
    // The band alone deals no rare relic - it has not been won; the win alone does not either - the band is not bought.
    for (const meta of [{ unlocks: ['more'], earned: [], forged: {} }, { unlocks: [], earned: ['r2'], forged: {} }]) {
      rt.handle({ t: 'init', seed: 7, threatIdx: 1, loadout: [], meta });
      expect((debug('pool') as unknown[]).length, JSON.stringify(meta)).toBe(1);
    }
    // A resume under a save carrying the node AND the win keeps that world, whatever the shell sends.
    rt.handle({ t: 'init', seed: 7, threatIdx: 1, loadout: [], resume: { ...save, meta: { unlocks: ['more'], earned: ['r2'], forged: {} } }, meta: { unlocks: [], earned: [], forged: {} } });
    rt.handle({ t: 'frame', ui: UI });
    expect(last('snapshot')!.s.hud.coreCard?.relicSlots).toBe(6);
    expect((debug('pool') as unknown[]).length).toBe(2);
  });
});

describe('the ore ladder reaches the run (PRD sec 26, D30)', () => {
  const tiersOver = (unlocks: string[]): Set<number> => {
    const { rt, last, debug } = makeRt();
    const seen = new Set<number>();
    for (let seed = 1; seed <= 60; seed++) {
      rt.handle({ t: 'init', seed, threatIdx: 1, loadout: [], meta: { unlocks, earned: [], forged: {} } });
      if (!last('ready')) continue;
      for (const d of debug('deposits') as { tier: number }[]) seen.add(d.tier);
    }
    return seen;
  };

  it('a tree with no ore node deals tier-1 veins only', () => {
    expect([...tiersOver([])]).toEqual([1]);
  });

  it('a tree that opened a tier deals it, rarely - and the snapshot carries the tier the board colours by', () => {
    const seen = tiersOver(['lodes']);
    expect(seen.has(1)).toBe(true);
    expect(seen.has(2) || seen.has(3)).toBe(true);
    const { rt, last } = makeRt();
    rt.handle({ t: 'init', seed: 3, threatIdx: 1, loadout: [], meta: { unlocks: ['lodes'], earned: [], forged: {} } });
    rt.handle({ t: 'frame', ui: UI });
    const rich = last('snapshot')!.s.board.oreRichness ?? [];
    expect(rich.length).toBeGreaterThan(0);
    for (const r of rich) { expect(r.tier).toBeGreaterThanOrEqual(1); expect(r.frac).toBeLessThanOrEqual(1); }
  });
});

describe('the worker deals the engine\'s map (session 36: one source for a Threat)', () => {
  it('a run\'s map is generateMap over threatKnobs - knobs, walk and land - so a sweep that spreads threatKnobs measures the app\'s own maps', () => {
    for (const threatIdx of [0, 1, 2]) {
      const { rt, last } = makeRt();
      rt.handle({ t: 'init', seed: 11, threatIdx, loadout: [], meta: { unlocks: [], earned: [], forged: {} } });
      rt.handle({ t: 'save', id: 1 });
      const dealt = last('saved')!.save.map;
      const knobs = createRng(11).stream('map');
      const expected = generateMap(knobs, new TileLibrary(BASICS), { width: BOARD_SLOTS.w, height: BOARD_SLOTS.h, ...threatKnobs(knobs, THREAT_LEVELS[threatIdx]), relicPoolSize: POOL.length, specials: [], oreTierMax: 1 });
      expect(dealt, THREAT_LEVELS[threatIdx].name).toEqual(expected);
      // The Threat's walk is in that spread: a worker that dropped it would deal the legacy map and fail here.
      expect(threatKnobs(createRng(11).stream('map'), THREAT_LEVELS[threatIdx]).walk).toBe(THREAT_LEVELS[threatIdx].walk);
    }
  });
});

describe('the hover tells the truth about building (issue #218)', () => {
  it('a vein is not "buildable" by the price of a tower that cannot stand on it', () => {
    // This run has the Bolt and no Refinery: nothing may stand on ore, so hovering a vein must not light up as a build
    // spot - it used to, because the verdict priced the first tower of the strip whatever the cell was.
    const { rt, last, debug } = makeRt();
    let ore: { x: number; y: number } | null = null;
    let ground: { x: number; y: number } | null = null;
    for (let seed = 1; seed <= 40 && !(ore && ground); seed++) {
      rt.handle({ t: 'init', seed, threatIdx: 1, loadout: [], meta: { unlocks: [], earned: [], forged: {} } });
      ore = null; ground = null;
      for (let y = 0; y < 35 && !(ore && ground); y++)
        for (let x = 0; x < 60 && !(ore && ground); x++) {
          const c = debug('cellAt', x, y);
          if (c === 'O' && !ore) ore = { x, y };
          if (c === 'G' && !ground && debug('canBuild', x, y) === true) ground = { x, y };
        }
    }
    expect(ore && ground).toBeTruthy();
    rt.handle({ t: 'frame', ui: { ...UI, hover: ore } });
    expect(last('snapshot')!.s.board.hoverBuildable).toBe(false);
    expect(debug('canBuild', ore!.x, ore!.y)).toBe(false);
    rt.handle({ t: 'frame', ui: { ...UI, hover: ground } });
    expect(last('snapshot')!.s.board.hoverBuildable).toBe(true);
  });
});
