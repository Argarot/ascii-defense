/**
 * ONE way to turn (threat, plan, seed) into a run (2026-09-18, issue #394).
 *
 * Three times in three sessions a lab tool that spelled its own LabSpec
 * drifted from the app, and each was found by reading, never by a number:
 * the seed's map (session 38), the tree's rarity cap (session 40, inside
 * runLab), the ladder's maps (session 41 - explicit knobs carve from a
 * fresh stream: right for a statistic, wrong beside tools that list seeds).
 * The plans became one table (plans.ts); this is the same move for the spec.
 * The fit harness, the balance gate, the ladder and the seed corpus call it,
 * and spec.test.ts fails one of them that builds a LabSpec by hand.
 *
 * What a tool may still vary is named here and nowhere else: the rules of
 * combat and the purse (the fit harness's patch), the horizon (an
 * instrument plays past the win), and the relics held (the ladder deals
 * sets; a bare row holds nothing). A patched CURVE is a patched threat -
 * pass the threat you mean.
 */
import { STARTING_SCRAP, type CombatRules, type ThreatLevel } from '@ascii-defense/engine';
import type { LabSpec } from './lab';
import type { Plan } from './plans';

/** The app's board at 1920x1080 (D24), which every corpus is read on. */
export const LAB_BOARD = { width: 7, height: 5 } as const;

/** The corpus: seed i of every tool is the same seed, so a row of one table can be set beside a row of another. */
export const corpusSeed = (i: number): number => (i + 1) * 7919 + 13;

export interface SpecOverrides {
  /** Overrides of the engine's COMBAT_RULES (the fit harness's patch). */
  rules?: Partial<CombatRules>;
  /** The purse a run starts with; the engine's when absent. */
  startingScrap?: number;
  /** Play to this wave. Absent: the plan's own horizon (an instrument), else the Threat's final wave. */
  horizon?: number;
  /** Relics held from wave 1 INSTEAD of the plan's: a dealt set, or `null` for a row that holds nothing. */
  relics?: Plan['relics'] | null;
}

export function specFor(threat: ThreatLevel, plan: Plan, seed: number, o: SpecOverrides = {}): LabSpec {
  return {
    seed,
    // THE APP'S OWN MAP for this seed: the Threat's knobs drawn off the front of the map stream, the same stream carving on.
    map: { ...LAB_BOARD, threat },
    towers: plan.towers,
    tail: plan.tail,
    relicIds: [],
    relics: o.relics === null ? undefined : o.relics ?? plan.relics,
    unlocks: plan.unlocks,
    interWaveTicks: threat.waveSeconds * 20,
    difficulty: threat.difficulty,
    rules: o.rules,
    maxWaves: o.horizon ?? plan.horizon ?? threat.finalWave,
    economy: { startingScrap: o.startingScrap ?? STARTING_SCRAP },
  };
}
