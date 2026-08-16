/**
 * The balance lab's own tests (WBS 1.5.3/1.5.4) - and the session-12 gate:
 * the analytic model's prediction and the real headless run must agree.
 *
 * Small maps and short horizons on purpose: the full sweep runs via
 * `node tools/lab.mjs`, not in CI.
 */
import { describe, expect, it } from 'vitest';
import { TileLibrary, DEFAULT_DIFFICULTY, effectiveStats } from '@ascii-defense/engine';
import { validateEnemies, validateRelics, validateTowers } from '@ascii-defense/content';
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
  lib: new TileLibrary(libraryJson.tiles),
  towerDefs: must(validateTowers.check(towersJson)).towers,
  enemyDefs: must(validateEnemies.check(enemiesJson)).enemies,
  relicDefs: must(validateRelics.check(relicsJson)).relics,
};

const SMALL = { width: 8, height: 5, entries: 2, targetPathLength: 8 };

describe('the balance lab (session 12 gate)', () => {
  it('under the geometric default, even a competent build DIES', () => {
    // The un-fixable flaw of the old linear curve was a stable state; the
    // geometric term guarantees there is none (PRD sec 9.1).
    expect(DEFAULT_DIFFICULTY.hpGeometric).toBeGreaterThan(1);
    const report = runLab(
      {
        seed: 4242,
        map: SMALL,
        towers: Array.from({ length: 4 }, () => ({ towerId: 'bolt', choices: [0, 1, 1] as [number, number, number], at: 'auto' as const })),
        relicIds: ['ballistics'],
        maxWaves: 40,
      },
      content,
    );
    expect(report.result).toBe('died');
    expect(report.deathWave).toBeLessThanOrEqual(40);
    // ...but not instantly: the build holds the early game.
    expect(report.deathWave).toBeGreaterThan(6);
  });

  it('gate: the analytic prediction matches the real run within tolerance', () => {
    const spec: LabSpec = {
      seed: 4242,
      map: SMALL,
      towers: Array.from({ length: 4 }, () => ({ towerId: 'bolt', choices: [0, 1, 1] as [number, number, number], at: 'auto' as const })),
      relicIds: [],
      maxWaves: 40,
    };
    const report = runLab(spec, content);
    const bolt = content.towerDefs.find((d) => d.id === 'bolt')!;
    const eff = effectiveStats(bolt, [0, 1, 1]);
    const placedStats = report.towersPlaced.map((p) => ({ x: p.x, y: p.y, dps: (eff.damage / eff.fireEveryTicks) * 20, range: eff.range }));
    const pred = predict(spec, content, placedStats, 40);
    expect(report.result).toBe('died');
    expect(pred.deathWave).not.toBeNull();
    // The model ignores overkill and contention (optimistic) and slow
    // (pessimistic); +-5 waves is the documented tolerance at this scale.
    expect(Math.abs(pred.deathWave! - report.deathWave!)).toBeLessThanOrEqual(5);
  });

  it('a stronger build strictly outlives a weaker one under the same curve', () => {
    const naked = runLab(
      { seed: 4242, map: SMALL, towers: Array.from({ length: 4 }, () => ({ towerId: 'bolt', choices: [-1, -1, -1] as [number, number, number], at: 'auto' as const })), relicIds: [], maxWaves: 40 },
      content,
    );
    const upgraded = runLab(
      { seed: 4242, map: SMALL, towers: Array.from({ length: 4 }, () => ({ towerId: 'bolt', choices: [0, 1, 1] as [number, number, number], at: 'auto' as const })), relicIds: ['ballistics'], maxWaves: 40 },
      content,
    );
    expect(naked.result).toBe('died');
    expect(upgraded.deathWave ?? 41).toBeGreaterThan(naked.deathWave!);
  });

  it('demoMap reproduces the live app map derivation deterministically', () => {
    const a = demoMap(945046, content.lib, content.relicDefs.length);
    const b = demoMap(945046, content.lib, content.relicDefs.length);
    expect(a.map.entries).toEqual(b.map.entries);
    expect(a.cells).toEqual(b.cells);
    expect(a.map.entries.length).toBeGreaterThanOrEqual(2);
  });
});
