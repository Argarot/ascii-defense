/**
 * The Threat levels (PRD sec 4.4): the map's difficulty dial and each
 * level's whole curve - ONE source, read by the app's worker, the setup
 * page and every sweep in the lab.
 *
 * They lived in the app's protocol.ts until session 36, where the lab could
 * not import them (harness never imports app), so every sweep carried a
 * hand copy "as protocol.ts ships it". Seven copies in six files, and they
 * drifted: the variant sweep was still measuring Standard at x1.05 and four
 * a wave two sessions after the game moved to x1.07 and five. A number
 * measured on a world the game does not ship is not a measurement of the
 * game.
 */
import { TILE_SIZE } from '../tiles/tile';
import type { RngStream } from '../rng/rng';
import type { DifficultySpec } from './sim';

export interface ThreatLevel {
  name: string;
  /** Spawn points, drawn uniformly in [min, max] on the map stream. More is harder. */
  entries: readonly [number, number];
  /** The floor of the per-entry path target, in tile slots; the draw adds the larger of two 0-18 rolls. Longer is easier. */
  pathBias: number;
  /** Hold this wave and the run is won. */
  finalWave: number;
  /** The wave clock, launch to launch (D17). */
  waveSeconds: number;
  difficulty: DifficultySpec;
}

export const THREAT_LEVELS: readonly ThreatLevel[] = [
  // Each level carries its whole curve (session 31): Calm was the Standard curve with a slower clock, and a
  // base-world build died at wave 10 on it (docs/lab/base-sweep-2026-09-07.md); now it grows slower and meets
  // the heavier kinds three waves later - the reference line holds its fifteen on every seed, a plain Bolt
  // builder on half of them, and relics come on top of that.
  { name: 'Calm', entries: [2, 3], pathBias: 12, finalWave: 15, waveSeconds: 55, difficulty: { hpLinear: 0.08, hpGeometric: 1.03, countBase: 6, countLinear: 3, countGeometric: 1, unlockDelay: 3, countMax: 60 } },
  // Session 32 (Enemies II; docs/lab/enemy-sweep-2026-09-08.md): the count is BODIES since packs (a swarm entry counts its three), and bodies are Scrap - fewer of them starved the reference build on half the seeds - so Standard and Grim grow five a wave and the reference dies at 22-24 on every seed.
  { name: 'Standard', entries: [2, 5], pathBias: 8, finalWave: 20, waveSeconds: 40, difficulty: { hpLinear: 0.15, hpGeometric: 1.07, countBase: 6, countLinear: 5, countGeometric: 1, unlockDelay: 0, countMax: 60 } },
  { name: 'Grim', entries: [3, 6], pathBias: 5, finalWave: 25, waveSeconds: 30, difficulty: { hpLinear: 0.15, hpGeometric: 1.09, countBase: 6, countLinear: 5, countGeometric: 1, unlockDelay: 0, countMax: 60 } },
];

/**
 * A map's two knobs for a Threat, drawn the way the worker draws them: two
 * values off the front of the map stream, which then goes on to carve the
 * map. Pass the SAME stream to generateMap to get the app's own map for the
 * seed; a sweep that only wants the knobs may draw from a fresh one.
 */
export function threatKnobs(knobs: RngStream, threat: ThreatLevel): { entries: number; targetPathCells: number } {
  const entries = knobs.int(threat.entries[0], threat.entries[1]);
  const targetPathCells = (threat.pathBias + Math.max(knobs.int(0, 18), knobs.int(0, 18))) * TILE_SIZE;
  return { entries, targetPathCells };
}
