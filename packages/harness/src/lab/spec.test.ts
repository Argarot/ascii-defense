/**
 * One way to turn (threat, plan, seed) into a run (#394): what specFor()
 * builds, and that the tools which play named plans build nothing of their
 * own. Three drifts from the app in three sessions were each a tool spelling
 * its own LabSpec.
 */
import { describe, expect, it } from 'vitest';
import { STARTING_SCRAP, THREAT_LEVELS, TileLibrary } from '@ascii-defense/engine';
import { validateEnemies, validateRelics, validateTowers, validateTree } from '@ascii-defense/content';
import treeJson from '@ascii-defense/content/assets/tree/nodes.json';
import libraryJson from '@ascii-defense/content/assets/tiles/library.json';
import enemiesJson from '@ascii-defense/content/assets/enemies/roster.json';
import towersJson from '@ascii-defense/content/assets/towers/roster.json';
import relicsJson from '@ascii-defense/content/assets/relics/pool.json';
import { runLab, type LabContent } from './lab';
import { PLANS } from './plans';
import { LAB_BOARD, corpusSeed, specFor } from './spec';

const [CALM, STANDARD, GRIM] = THREAT_LEVELS;
const SOURCES = import.meta.glob(['./fit.ts', './balanceCheck.ts', './seedCorpus.ts', './buildSweep.ts'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

// #367, "the refused seeds": they were never refused maps. runLab let the plan buy on the tick the Core died; the sim
// refuses a purchase once the run is over, the lab threw, and a LOST run left its row's denominator. Both seeds below
// threw before the fix ("cannot choose t2 on bolt", "cannot place mortar"); both are plain losses.
describe('a run that ends on a plan tick is a finished run, not a refused one (#367)', () => {
  const must = <T,>(r: { ok: true; value: T } | { ok: false; errors: unknown[] }): T => { if (!r.ok) throw new Error('content invalid'); return r.value; };
  const content: LabContent = {
    lib: new TileLibrary(libraryJson.tiles),
    enemyDefs: must(validateEnemies.check(enemiesJson)).enemies,
    towerDefs: must(validateTowers.check(towersJson)).towers,
    relicDefs: must(validateRelics.check(relicsJson)).relics,
    tree: must(validateTree.check(treeJson)),
  };
  it.each([87122, 174231])('grim:bareBaseDeep on seed %i plays to its end and reports a death wave', (seed) => {
    const report = runLab(specFor(GRIM, PLANS.bareBaseDeep, seed), content);
    expect(typeof report.deathWave).toBe('number');
    expect(report.deathWave!).toBeGreaterThan(5);
    expect(report.deathWave!).toBeLessThanOrEqual(GRIM.finalWave);
  }, 60_000);
});

describe('specFor', () => {
  it('deals the APP\'S map for the seed: the threat form, on the app\'s board', () => {
    const spec = specFor(STANDARD, PLANS.mixedDeep, 7932);
    expect(spec.map).toEqual({ ...LAB_BOARD, threat: STANDARD });
    expect(spec.seed).toBe(7932);
  });

  it('takes the clock, the curve, the purse and the final wave from the Threat and the engine', () => {
    for (const threat of [CALM, STANDARD, GRIM]) {
      const spec = specFor(threat, PLANS.spam, 1);
      expect(spec.interWaveTicks).toBe(threat.waveSeconds * 20);
      expect(spec.difficulty).toBe(threat.difficulty);
      expect(spec.maxWaves).toBe(threat.finalWave);
      expect(spec.economy).toEqual({ startingScrap: STARTING_SCRAP });
    }
  });

  it('takes WHO PLAYS from the plan: towers, tail, tree state, relics held', () => {
    const spec = specFor(GRIM, PLANS.treeBaseDeep, 1);
    expect(spec.towers).toBe(PLANS.treeBaseDeep.towers);
    expect(spec.tail).toBe(PLANS.treeBaseDeep.tail);
    expect(spec.unlocks).toEqual(['*']);
    expect(spec.relics).toBe(PLANS.treeBaseDeep.relics);
    expect(spec.relicIds).toEqual([]);
  });

  it('an instrument plays to its own horizon, and a tool may play past the win', () => {
    expect(specFor(STANDARD, PLANS.probe6, 1).maxWaves).toBe(40);
    expect(specFor(STANDARD, PLANS.mixedDeep, 1, { horizon: 25 }).maxWaves).toBe(25);
  });

  it('relics: a dealt set replaces the plan\'s, and null holds nothing', () => {
    const dealt = [{ id: 'hot_loads', rarity: 0 }];
    expect(specFor(GRIM, PLANS.treeBaseDeep, 1, { relics: dealt }).relics).toBe(dealt);
    expect(specFor(GRIM, PLANS.treeBaseDeep, 1, { relics: null }).relics).toBeUndefined();
    expect(specFor(GRIM, PLANS.treeBaseDeep, 1, {}).relics).toBe(PLANS.treeBaseDeep.relics);
  });

  it('the fit harness\'s patch reaches the run: the rules of combat and the purse', () => {
    const spec = specFor(STANDARD, PLANS.spam, 1, { rules: { armorFloor: 0.5 }, startingScrap: 300 });
    expect(spec.rules).toEqual({ armorFloor: 0.5 });
    expect(spec.economy).toEqual({ startingScrap: 300 });
  });

  it('the corpus is one corpus: seed i is the same seed for every tool', () => {
    expect(corpusSeed(0)).toBe(7932);
    expect(corpusSeed(79)).toBe(80 * 7919 + 13);
  });

  it('the tools that play named plans spell no LabSpec and no corpus of their own', () => {
    expect(Object.keys(SOURCES).sort()).toEqual(['./balanceCheck.ts', './buildSweep.ts', './fit.ts', './seedCorpus.ts']);
    for (const [file, src] of Object.entries(SOURCES)) {
      expect(src, file).toContain('specFor(');
      expect(src, `${file} types the corpus's seed formula`).not.toMatch(/7919/);
      // buildSweep.ts still holds the older sweeps (the relic sets, the tree states), which spell their own specs on
      // the 'demo' and explicit-knob maps their baselines stand on; the three single-purpose tools must hold none.
      if (file !== './buildSweep.ts') expect(src, `${file} spells a LabSpec by hand`).not.toMatch(/interWaveTicks\s*:/);
    }
  });
});
