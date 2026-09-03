/**
 * The lab CLI: sweep difficulty candidates against reference builds and
 * print the table the curve gets CHOSEN from. Run via `node tools/lab.mjs`
 * (esbuild bundles this file on the fly - no build step to remember).
 *
 * Reference builds bracket the space:
 *  - naked:  4 bolts, no upgrades, no relics - the floor
 *  - mid:    5 upgraded bolts, no relics - a competent run
 *  - wave48: 5 maxed bolts + damage/range/economy relics - Daniil's
 *            screenshot build, the one that coasted past wave 100
 */
// Runs under node via tools/lab.mjs; the harness tsconfig is DOM-free, so
// declare the one global the CLI needs rather than dragging in @types/node.
declare const console: { log: (...args: unknown[]) => void };

import { TileLibrary, effectiveStats, foldRelics, type DifficultySpec } from '@ascii-defense/engine';
import { validateEnemies, validateRelics, validateTowers } from '@ascii-defense/content';
import libraryJson from '@ascii-defense/content/assets/tiles/library.json';
import enemiesJson from '@ascii-defense/content/assets/enemies/roster.json';
import towersJson from '@ascii-defense/content/assets/towers/roster.json';
import relicsJson from '@ascii-defense/content/assets/relics/pool.json';
import { predict, runLab, type LabContent, type LabSpec } from './lab';

const must = <T,>(r: { ok: true; value: T } | { ok: false; errors: unknown[] }): T => {
  if (!r.ok) throw new Error(JSON.stringify(r.errors));
  return r.value;
};

const content: LabContent = {
  lib: new TileLibrary(libraryJson.tiles), // tile semantics are engine-validated in CI
  towerDefs: must(validateTowers.check(towersJson)).towers,
  enemyDefs: must(validateEnemies.check(enemiesJson)).enemies,
  relicDefs: must(validateRelics.check(relicsJson)).relics,
};

const SEED = 945046; // Daniil's map, both screenshots

const maxedBolt = { towerId: 'bolt', choices: [0, 0, 0] as [number, number, number], at: 'auto' as const };
const BUILDS: Record<string, Pick<LabSpec, 'towers' | 'relicIds'>> = {
  naked: { towers: Array.from({ length: 4 }, () => ({ towerId: 'bolt', choices: [-1, -1, -1] as [number, number, number], at: 'auto' as const })), relicIds: [] },
  mid: { towers: Array.from({ length: 5 }, () => ({ ...maxedBolt })), relicIds: [] },
  wave48: { towers: Array.from({ length: 5 }, () => ({ ...maxedBolt, at: 'core' as const })), relicIds: ['loadbearing', 'overflow', 'frostbite'] },
};

const CANDIDATES: { name: string; d: DifficultySpec }[] = [
  { name: 'current(linear)', d: { hpLinear: 0.18, hpGeometric: 1, countBase: 6, countLinear: 4, countGeometric: 1 } },
  ...[1.04, 1.06, 1.08, 1.1, 1.12].map((g) => ({
    name: `geo ${g}`,
    d: { hpLinear: 0.18, hpGeometric: g, countBase: 6, countLinear: 4, countGeometric: 1 },
  })),
];

const MAX_WAVES = 60;

console.log(`seed ${SEED} · demo map · horizon ${MAX_WAVES} waves\n`);
console.log('| curve | build | analytic death | actual death | first leak (analytic) |');
console.log('|---|---|---|---|---|');

for (const cand of CANDIDATES) {
  for (const [name, build] of Object.entries(BUILDS)) {
    const spec: LabSpec = { seed: SEED, map: 'demo', ...build, difficulty: cand.d, maxWaves: MAX_WAVES };
    const report = runLab(spec, content);
    // Analytic needs the placed towers' folded stats.
    const fold = foldRelics(build.relicIds.map((id) => content.relicDefs.find((r) => r.id === id)!).filter((r) => r.kind === 'passive'));
    const placedStats = report.towersPlaced.map((p) => {
      const def = content.towerDefs.find((d) => d.id === p.towerId)!;
      const eff = effectiveStats(def, build.towers[0].choices);
      const dmg = eff.damage * fold.damageMul;
      const fireEvery = Math.max(2, Math.round(eff.fireEveryTicks / fold.fireRateMul));
      let range = eff.range + fold.rangeAdd;
      // Loadbearing applies only near the Core; approximate: assume it applies
      // (auto-placement hugs the densest road, usually near the Core ring).
      range *= fold.coreAdjacentRangeMul;
      return { x: p.x, y: p.y, dps: (dmg / fireEvery) * 20, range };
    });
    const pred = predict(spec, content, placedStats, MAX_WAVES);
    console.log(
      `| ${cand.name} | ${name} | ${pred.deathWave ?? '>' + MAX_WAVES} | ${report.deathWave ?? '>' + MAX_WAVES} | ${pred.firstLeakWave ?? '-'} |`,
    );
  }
}
