/**
 * The balance lab's own tests (WBS 1.5.3/1.5.4) - and the session-12 gate:
 * the analytic model's prediction and the real headless run must agree.
 *
 * Small maps and short horizons on purpose: the full sweep runs via
 * `node tools/lab.mjs`, not in CI.
 */
import { describe, expect, it } from 'vitest';
import { STARTING_SCRAP, THREAT_LEVELS, TileLibrary, DEFAULT_DIFFICULTY, computeFlowField, createRng, effectiveStats, generateMap, mapCells, threatKnobs, tilePartition } from '@ascii-defense/engine';
import { validateEnemies, validateRelics, validateTowers, validateTree } from '@ascii-defense/content';
import treeJson from '@ascii-defense/content/assets/tree/nodes.json';
import libraryJson from '@ascii-defense/content/assets/tiles/library.json';
import enemiesJson from '@ascii-defense/content/assets/enemies/roster.json';
import towersJson from '@ascii-defense/content/assets/towers/roster.json';
import relicsJson from '@ascii-defense/content/assets/relics/pool.json';
import { demoMap, predict, runLab, type LabContent, type LabSpec } from './lab';

const must = <T,>(r: { ok: true; value: T } | { ok: false; errors: unknown[] }): T => {
  if (!r.ok) throw new Error(JSON.stringify(r.errors));
  return r.value;
};

const content: LabContent = {
  // The hand-authored tiles only (session 33, PR 6): the analytic gate
  // measures the model against a FIXED world; the enumerated fillers and
  // decorated roads (t_, f_, <base>r<k>) grew the library and moved the
  // seed-4242 map under it, which is not what this gate reads.
  lib: new TileLibrary(libraryJson.tiles.filter((t) => !/^(t_|f_)/.test(t.id) && !/r\d+$/.test(t.id))),
  towerDefs: must(validateTowers.check(towersJson)).towers,
  enemyDefs: must(validateEnemies.check(enemiesJson)).enemies,
  relicDefs: must(validateRelics.check(relicsJson)).relics,
};

const SMALL = { width: 8, height: 5, entries: 2, targetPathCells: 40 };

describe('the balance lab (session 12 gate)', () => {
  it('under the geometric default, even a competent build DIES', () => {
    // The un-fixable flaw of the old linear curve was a stable state; the
    // geometric term guarantees there is none (PRD sec 9.1).
    expect(DEFAULT_DIFFICULTY.hpGeometric).toBeGreaterThan(1);
    const report = runLab(
      {
        seed: 4242,
        map: SMALL,
        towers: Array.from({ length: 4 }, () => ({ towerId: 'bolt', choices: [0, 0, 0] as [number, number, number], at: 'auto' as const })),
        relicIds: ['overflow'],
        maxWaves: 40,
      },
      content,
    );
    expect(report.result).toBe('died');
    expect(report.deathWave).toBeLessThanOrEqual(40);
    // ...but not instantly: the build holds the early game.
    expect(report.deathWave).toBeGreaterThan(6);
  });

  it('the analytic prediction is a pessimistic floor under the real run (the tolerance gate, retired - issue #223)', () => {
    const spec: LabSpec = {
      seed: 4242,
      map: SMALL,
      towers: Array.from({ length: 4 }, () => ({ towerId: 'bolt', choices: [0, 0, 0] as [number, number, number], at: 'auto' as const })),
      relicIds: [],
      maxWaves: 40,
    };
    const report = runLab(spec, content);
    const bolt = content.towerDefs.find((d) => d.id === 'bolt')!;
    // The instruments (session 27): 'adjacent' touches the last tower; 'inline' aims a laser along road.
    const inst = runLab({ seed: 4242, map: SMALL, towers: [{ towerId: 'bolt', choices: [-1, -1, -1], at: 'choke' }, { towerId: 'bastion', choices: [-1, -1, -1], at: 'adjacent' }, { towerId: 'laser', choices: [-1, -1, -1], at: 'inline' }], relicIds: [], maxWaves: 2 }, content);
    const [first, bastion, laser] = inst.towersPlaced;
    expect(Math.max(Math.abs(bastion.x - first.x), Math.abs(bastion.y - first.y))).toBe(1);
    expect(laser).toBeDefined();
    expect(Object.values(inst.killsByDef).reduce((a, c) => a + c, 0)).toBeGreaterThanOrEqual(0);
    const eff = effectiveStats(bolt, [0, 1, 1]);
    const placedStats = report.towersPlaced.map((p) => ({ x: p.x, y: p.y, dps: (eff.damage / eff.fireEveryTicks) * 20, range: eff.range }));
    const pred = predict(spec, content, placedStats, 40);
    expect(report.result).toBe('died');
    expect(pred.deathWave).not.toBeNull();
    // This used to be a tolerance - |predicted - real| within 5, then 7, 8 and 10 waves, widened four times - and it
    // was read on ONE seed. Measured over sixty seeds on 2026-09-18 (issue #223), on the old deal and the new alike:
    // the model says wave 7-9 for every map while the real run dies anywhere from 5 to 27; the median error is eleven
    // waves and a third of seeds sat inside the tolerance. Seed 4242 passed at exactly ten. It was never a gate.
    // What IS true on every one of those seeds: the model is a pessimistic FLOOR - it never promised more than two
    // waves past what the real run held. That is the property kept; the headless runner is the instrument.
    expect(pred.deathWave!).toBeLessThanOrEqual(report.deathWave! + 3);
  });

  it('a stronger build strictly outlives a weaker one under the same curve', () => {
    const naked = runLab(
      { seed: 4242, map: SMALL, towers: Array.from({ length: 4 }, () => ({ towerId: 'bolt', choices: [-1, -1, -1] as [number, number, number], at: 'auto' as const })), relicIds: [], maxWaves: 40 },
      content,
    );
    const upgraded = runLab(
      { seed: 4242, map: SMALL, towers: Array.from({ length: 4 }, () => ({ towerId: 'bolt', choices: [0, 0, 0] as [number, number, number], at: 'auto' as const })), relicIds: ['overflow'], maxWaves: 40 },
      content,
    );
    expect(naked.result).toBe('died');
    expect(upgraded.deathWave ?? 41).toBeGreaterThan(naked.deathWave!);
  });

  it('a plan with a tail is a player who keeps buying: no pile of Scrap, more towers, a longer run (issue #348)', () => {
    // The six-tower reference was bought out by wave 12 and died holding 3,802 Scrap at wave 20 - and every ladder
    // table had been read off it. A plan that ENDS is not a player.
    const bolt = { towerId: 'bolt', choices: [0, 0, 0] as [number, number, number], at: 'auto' as const };
    const base: LabSpec = { seed: 4242, map: SMALL, towers: [bolt, bolt], relicIds: [], maxWaves: 40, economy: { startingScrap: STARTING_SCRAP } };
    const ends = runLab(base, content);
    const goesOn = runLab({ ...base, tail: [bolt] }, content);
    expect(ends.result).toBe('died');
    const last = (r: typeof ends) => r.waves[r.waves.length - 1];
    // The plan that ends dies rich; the one that goes on has spent what it earned - within a Bolt's whole price of it.
    const boltDef = content.towerDefs.find((d) => d.id === 'bolt')!;
    const boltPrice = boltDef.cost + boltDef.tiers!.reduce((sum, tier) => sum + tier.choices[0].cost, 0); // the chassis and the Railbore path, whatever they cost today
    expect(last(ends).scrapEnd).toBeGreaterThan(2 * boltPrice);
    expect(last(ends).towersEnd).toBe(2);
    expect(last(goesOn).scrapEnd).toBeLessThan(boltPrice);
    expect(last(goesOn).towersEnd).toBeGreaterThan(4);
    expect(goesOn.deathWave ?? 41).toBeGreaterThan(ends.deathWave!);
    // Depth before width: a tail tower is placed only when everything standing is fully bought, so at most the newest
    // tower is ever short of its listed choices.
    expect(goesOn.towersPlaced.length).toBe(last(goesOn).towersEnd);
    // Without an economy a tail means nothing, and changes nothing.
    const free = { ...base, economy: undefined };
    expect(runLab({ ...free, tail: [bolt] }, content).deathWave).toBe(runLab(free, content).deathWave);
  });

  it("`map: { threat }` is the APP'S map for the seed: the Threat's knobs off the front of the stream, the same stream carving on", () => {
    // A seed in a lab LIST (the seed corpus) must be a seed a player can type in. Explicit knobs carve from a fresh
    // stream - the same maps in distribution, a different map for the seed.
    const threat = THREAT_LEVELS[1];
    const full: LabContent = { ...content, lib: new TileLibrary(libraryJson.tiles) };
    for (const seed of [7932, 150474]) {
      const stream = createRng(seed).stream('map');
      const app = generateMap(stream, full.lib, { width: 7, height: 5, ...threatKnobs(stream, threat), relicPoolSize: full.relicDefs.length, specials: [], oreTierMax: 1 });
      const appL = computeFlowField(mapCells(app, full.lib), app.cellsW, app.cellsH, app.entries).L;
      const spec: LabSpec = { seed, map: { width: 7, height: 5, threat }, towers: [], relicIds: [], maxWaves: 1 };
      expect(runLab(spec, full).L).toBe(appL);
      const fresh = runLab({ ...spec, map: { width: 7, height: 5, ...threatKnobs(createRng(seed).stream('map'), threat) } }, full).L;
      expect([seed, fresh === appL]).toEqual([seed, false]);
    }
  });

  it("the lab's base world deals commons alone, as the app's does (D29): the band the tree bought caps what an offer may deal", () => {
    // Until 2026-09-18 runLab passed the tree's relicSlots to the Sim and not its rarityMax, so every base-world row
    // of every table rolled rares and epics from its offers - a richer world than a player without the workshop is
    // in. Found because a one-seed difference between two reads "could not happen": a base-world run had reached an
    // EPIC tier. The lab takes option 0 of every offer, so a run that lives a dozen waves holds several.
    const full: LabContent = { ...content, lib: new TileLibrary(libraryJson.tiles), tree: must(validateTree.check(treeJson)) };
    const threat = THREAT_LEVELS[0];
    const rail = { towerId: 'bolt', choices: [0, 0, 0] as [number, number, number], at: 'choke' as const };
    const spec: LabSpec = { seed: 7932, map: { width: 7, height: 5, threat }, towers: [rail], tail: [rail], relicIds: [], unlocks: [], interWaveTicks: threat.waveSeconds * 20, difficulty: threat.difficulty, maxWaves: threat.finalWave, economy: { startingScrap: STARTING_SCRAP } };
    const base = runLab(spec, full);
    expect(base.relicsHeld.length).toBeGreaterThan(3);
    expect(base.relicsHeld.filter((r) => r.rarity > 0)).toEqual([]);
    // ...and the whole workshop lifts the cap: the same seed, the same plan, holds something rarer.
    const tree = runLab({ ...spec, unlocks: ['*'] }, full);
    expect(tree.relicsHeld.some((r) => r.rarity > 0)).toBe(true);
  });

  it('demoMap reproduces the live app map derivation deterministically', () => {
    const a = demoMap(945046, content.lib, content.relicDefs.length);
    const b = demoMap(945046, content.lib, content.relicDefs.length);
    expect(a.map.entries).toEqual(b.map.entries);
    expect(a.cells).toEqual(b.cells);
    expect(a.map.entries.length).toBeGreaterThanOrEqual(2);
  });
});

describe('special shapes never appear unchosen (playtest 18 - inverts the old 2.17 sweep)', () => {
  it('plain maps contain NO special-flagged tiles and NO multi-segment slots', () => {
    // The 2.17 request ("two-turn tiles used") is served by the LOADOUT
    // now: twin_bend and every touching/twin-segment shape is chosen,
    // guaranteed, exactly-once - after playtest 17's map dealt unchosen
    // double bends on 45/60 plain maps. Tunnels self-limit to zero when no
    // two-group tile is in the rolled pool (the availability gate).
    const specialIds = new Set(content.lib.ids().filter((id) => content.lib.def(id).special === true));
    for (let seed = 1; seed <= 40; seed++) {
      const { map } = demoMap(seed * 101, content.lib, content.relicDefs.length);
      for (const p of map.board.slots) {
        if (!p) continue;
        expect(specialIds.has(p.tileId), `seed ${seed * 101}: '${p.tileId}' dealt unchosen`).toBe(false);
        expect(tilePartition(content.lib.resolved(p.tileId, p.rotation).cells).length, `seed ${seed * 101}: multi-segment '${p.tileId}' dealt`).toBeLessThanOrEqual(1);
      }
    }
  });
});
