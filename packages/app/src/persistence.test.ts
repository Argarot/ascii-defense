/**
 * Load-or-explain for both saves (PRD sec 15.2), under Node with a Map as
 * the store. The regression that motivated the module: meta saves were
 * stamped with the RUN save's version, so the map-in-save bump (v2->v3)
 * silently zeroed every player's banked ore and history.
 */
import { describe, expect, it } from 'vitest';
import { META_KEY, META_VERSION, RUN_KEY, defaultMeta, loadMetaFrom, loadRunFrom, saveMetaTo, type KeyStore } from './persistence';
import { SAVE_VERSION } from './protocol';

function store(init: Record<string, string> = {}): KeyStore & { map: Map<string, string> } {
  const map = new Map(Object.entries(init));
  return { map, getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v) };
}

describe('meta save', () => {
  it('loads a version-2 meta (the SAVE_VERSION stamp that used to reset it) with its data intact', () => {
    const s = store({ [META_KEY]: JSON.stringify({ version: 2, bankedOre: 2896, settings: { reducedMotion: true }, history: [{ seed: 1, threat: 'Calm', wave: 14, status: 'lost', kills: 300 }] }) });
    const { meta, problem } = loadMetaFrom(s);
    expect(problem).toBeNull();
    expect(meta.ore).toEqual([2896, 0, 0]);
    expect(meta.history).toHaveLength(1);
    expect(meta.settings.reducedMotion).toBe(true);
    expect(meta.version).toBe(META_VERSION);
  });

  it('loads v1 and v3 the same way', () => {
    for (const v of [1, 3]) {
      const s = store({ [META_KEY]: JSON.stringify({ version: v, bankedOre: 7, settings: { reducedMotion: null }, history: [] }) });
      expect(loadMetaFrom(s)).toEqual({ meta: { ...defaultMeta(), ore: [7, 0, 0] }, problem: null });
    }
  });

  it('a versioned blob with the wrong shape is a reported problem, not a crash later', () => {
    const cases = ['{"version":3}', '{"version":3,"history":"nope"}', '{"version":3,"bankedOre":"lots"}', '"just a string"', '{"version":"3"}'];
    for (const raw of cases) {
      const { meta, problem } = loadMetaFrom(store({ [META_KEY]: raw }));
      // Whatever the problem, the caller can always push to history.
      expect(Array.isArray(meta.history), raw).toBe(true);
      expect(Array.isArray(meta.ore), raw).toBe(true);
      if (raw !== '{"version":3}') expect(problem, raw).not.toBeNull();
    }
  });

  it('a future meta version is refused with a sentence and the blob left alone', () => {
    const s = store({ [META_KEY]: JSON.stringify({ version: 99, bankedOre: 1 }) });
    const { meta, problem } = loadMetaFrom(s);
    expect(meta).toEqual(defaultMeta());
    expect(problem).toMatch(/version 99/);
    expect(s.map.get(META_KEY)).toContain('99');
  });

  it('corrupt JSON and an empty store both yield usable defaults', () => {
    expect(loadMetaFrom(store({ [META_KEY]: '{not json' })).problem).toMatch(/corrupt/);
    expect(loadMetaFrom(store())).toEqual({ meta: defaultMeta(), problem: null });
  });

  it('saveMeta stamps META_VERSION, independent of SAVE_VERSION', () => {
    const s = store();
    saveMetaTo(s, { ...defaultMeta(), version: 1, ore: [3, 0, 0] });
    const written = JSON.parse(s.map.get(META_KEY)!) as { version: number; ore: number[] };
    expect(written.version).toBe(META_VERSION);
    expect(written.ore).toEqual([3, 0, 0]);
  });

  it('v4 (session 29, PR 1): Ore by tier and the tree state load; a short ore array pads; wrong shapes are problems', () => {
    const s = store({ [META_KEY]: JSON.stringify({ version: 4, ore: [5, 2], unlocks: ['tesla'], earned: ['kindling'], forged: { tithe: 1 }, owned: { twin_bend: 2 }, discovered: ['bunker'], settings: { reducedMotion: null }, history: [] }) });
    const { meta, problem } = loadMetaFrom(s);
    expect(problem).toBeNull();
    expect(meta.ore).toEqual([5, 2, 0]);
    expect(meta.unlocks).toEqual(['tesla']);
    expect(meta.earned).toEqual(['kindling']);
    expect(meta.forged).toEqual({ tithe: 1 });
    expect(meta.owned).toEqual({ twin_bend: 2 });
    expect(meta.discovered).toEqual(['bunker']);
    for (const bad of ['{"version":4,"ore":"x"}', '{"version":4,"unlocks":[1]}', '{"version":4,"forged":{"a":"b"}}']) {
      expect(loadMetaFrom(store({ [META_KEY]: bad })).problem, bad).not.toBeNull();
    }
  });
});

describe('run save', () => {
  const run = { version: SAVE_VERSION, seed: 5, threatIdx: 1, tick: 10, inputs: [], contentHash: 1, loadout: [], map: { board: {} }, meta: { unlocks: [], earned: [], forged: {} } };

  it('loads a current-version run', () => {
    expect(loadRunFrom(store({ [RUN_KEY]: JSON.stringify(run) })).run?.seed).toBe(5);
  });

  it('a v4 save (before the tree) resumes with everything unlocked (session 29, PR 1)', () => {
    const v4: Record<string, unknown> = { ...run };
    delete v4.meta;
    const r = loadRunFrom(store({ [RUN_KEY]: JSON.stringify({ ...v4, version: 4 }) }));
    expect(r.problem).toBeNull();
    expect(r.run?.meta.unlocks).toEqual(['*']);
    expect(r.run?.version).toBe(SAVE_VERSION);
    // A v5 save without its meta is corrupt, not a resume.
    expect(loadRunFrom(store({ [RUN_KEY]: JSON.stringify(v4) })).problem).toMatch(/corrupt/);
  });

  it('refuses pre-rebuild saves and future versions with a sentence', () => {
    expect(loadRunFrom(store({ [RUN_KEY]: JSON.stringify({ ...run, version: 2 }) })).problem).toMatch(/predates/);
    expect(loadRunFrom(store({ [RUN_KEY]: JSON.stringify({ ...run, version: SAVE_VERSION + 1 }) })).problem).toMatch(/cannot continue/);
  });

  it('a current-version blob missing its map or inputs is corrupt, not a resume', () => {
    for (const bad of [{ ...run, map: undefined }, { ...run, inputs: 'x' }, { ...run, loadout: undefined }]) {
      const r = loadRunFrom(store({ [RUN_KEY]: JSON.stringify(bad) }));
      expect(r.run).toBeNull();
      expect(r.problem).toMatch(/corrupt/);
    }
  });
});
