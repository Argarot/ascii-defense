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
import type { WalkCharacterSpec } from '../mapgen/carve';
import type { LandSpec } from '../mapgen/mapgen';

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
  /** How this Threat's roads walk (session 36): Calm long and gentle, Grim short and knotted; every map strays from it by its own roll. */
  walk: WalkCharacterSpec;
}

/**
 * The walk by Threat (session 36; the numbers are the map sweep's - docs/lab/map-sweep-2026-09-17.md). `straight` is the
 * Threat's taste, `spread` how far one map may stray from it, `fresh` the pull toward headings the map has not used.
 */
const WALK = {
  // Calm: avenues. A map's taste runs 3 to 12 - always gentle, never a knot.
  calm: { straight: 6, spread: 2, fresh: 1 },
  // Standard: no taste of its own, and the widest roll - 0.08 to 12. One map is avenues, the next is switchbacks: this is
  // the row that makes two Standard runs differ by the road's walk. At 5 the sweep could not tell it from no roll at
  // all; at 12 about one map in five runs in avenues (8% before); at 30 nothing more happens - the board is the limit.
  standard: { straight: 1, spread: 12, fresh: 1 },
  // Grim: knots. 0.08 to 0.5 - always turning.
  grim: { straight: 0.2, spread: 2.5, fresh: 1 },
} as const;

export const THREAT_LEVELS: readonly ThreatLevel[] = [
  // Each level carries its whole curve (session 31): Calm was the Standard curve with a slower clock, and a
  // base-world build died at wave 10 on it (docs/lab/base-sweep-2026-09-07.md); now it grows slower and meets
  // the heavier kinds three waves later - the reference line holds its fifteen on every seed, a plain Bolt
  // builder on half of them, and relics come on top of that.
  { name: 'Calm', entries: [2, 3], pathBias: 12, finalWave: 15, waveSeconds: 55, difficulty: { hpLinear: 0.08, hpGeometric: 1.03, countBase: 6, countLinear: 3, countGeometric: 1, unlockDelay: 3, countMax: 60 }, walk: WALK.calm },
  // Session 32 (Enemies II; docs/lab/enemy-sweep-2026-09-08.md): the count is BODIES since packs (a swarm entry counts its three), and bodies are Scrap - fewer of them starved the reference build on half the seeds - so Standard and Grim grow five a wave and the reference dies at 22-24 on every seed.
  { name: 'Standard', entries: [2, 5], pathBias: 8, finalWave: 20, waveSeconds: 40, difficulty: { hpLinear: 0.15, hpGeometric: 1.07, countBase: 6, countLinear: 5, countGeometric: 1, unlockDelay: 0, countMax: 60 }, walk: WALK.standard },
  { name: 'Grim', entries: [3, 6], pathBias: 5, finalWave: 25, waveSeconds: 30, difficulty: { hpLinear: 0.15, hpGeometric: 1.09, countBase: 6, countLinear: 5, countGeometric: 1, unlockDelay: 0, countMax: 60 }, walk: WALK.grim },
];

/**
 * The land's regions (session 36; docs/lab/map-sweep-2026-09-17.md): three centres, so every family has one; a tile of its
 * region's family six times likelier. Six is where adjacent tiles match half the time (chance is a third) while a map still
 * carries the ore it always did (9.9 ore tiles against 9.5) - at eight the ore creeps up, and the ladder's numbers with it.
 * The same on every Threat: land is the map's, not the difficulty's.
 */
export const MAP_LAND: LandSpec = { regions: 3, bias: 6 };

/**
 * Everything a Threat says about a map, drawn the way the worker draws it:
 * the two knobs off the front of the map stream - which then goes on to
 * carve the map - plus how its roads walk and how its land groups. Spread
 * it into generateMap's options and pass the SAME stream to get the app's
 * own map for the seed; a sweep that only wants the knobs may draw from a
 * fresh one.
 */
export function threatKnobs(knobs: RngStream, threat: ThreatLevel): { entries: number; targetPathCells: number; walk: WalkCharacterSpec; land: LandSpec } {
  const entries = knobs.int(threat.entries[0], threat.entries[1]);
  const targetPathCells = (threat.pathBias + Math.max(knobs.int(0, 18), knobs.int(0, 18))) * TILE_SIZE;
  return { entries, targetPathCells, walk: threat.walk, land: MAP_LAND };
}
