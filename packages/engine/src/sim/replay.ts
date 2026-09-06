/**
 * Replays (PRD sec 12): a run is a seed plus an input log - kilobytes that
 * buy shareable runs, bug reports as files, and the regression corpus M3's
 * calibration feeds on. The Sim records its own inputs (its four mutation
 * methods are the only mutation surface), so recording cannot drift from
 * reality; this module owns the envelope, the content hash and playback.
 *
 * The action union already carries the Phase 6 shapes (claimCache, prospect,
 * pickRelic, buyRelic, rerollOffer, fireActive, useConsumable) - reserved
 * NOW so the relic layer is an implementation, not a replay migration. The
 * Sim rejects them until they exist; a replay containing them is from a
 * newer version and version-gates away.
 */
import type { Priority } from './targeting';
import type { EnemyDef, TowerDef } from './defs';

/** Bump on any change that invalidates recorded inputs. */
export const REPLAY_VERSION = 1;

export type ReplayAction =
  | { t: 'build'; x: number; y: number; defId: string }
  | { t: 'choose'; x: number; y: number; tier: number; option: number }
  | { t: 'priority'; x: number; y: number; priority: Priority }
  | { t: 'facing'; x: number; y: number; facing: number } // 0 n, 1 e, 2 s, 3 w (session 26, WBS 2.34)
  | { t: 'sell'; x: number; y: number }
  // ---- reserved for Phase 6 (WBS 1.6) - see module doc ----
  // Design round 1: caches are OPENED (free), never claimed for Scrap.
  | { t: 'openCache'; x: number; y: number }
  | { t: 'prospect'; x: number; y: number }
  | { t: 'pickRelic'; option: number }
  | { t: 'pickPassive'; option: number } // the passive layer (session 28, PR 1)
  | { t: 'buyRelic' }
  | { t: 'rerollOffer' }
  // relicId added 2026-08-16 while still reserved (multiple held actives need
  // disambiguation); no recorded replay ever carried the old shape.
  | { t: 'fireActive'; relicId: string; x?: number; y?: number }
  | { t: 'useConsumable'; relicId: string }
  // Design round 1 (2026-09-03): the player CALLS the next wave early.
  | { t: 'callWave' };

/** One recorded input: applied after `tick` ticks have completed. */
export interface ReplayInput {
  tick: number;
  a: ReplayAction;
}

export interface Replay {
  version: number;
  seed: number;
  /** FNV-1a over the def rosters - a replay only replays against the content it saw. */
  contentHash: number;
  inputs: ReplayInput[];
}

/** FNV-1a 32-bit over a string. Stable across engines; no crypto needed. */
export function fnv1a(text: string, h = 0x811c9dc5): number {
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Hash the combat content a run was played against. JSON.stringify key order
 * follows parse/insertion order, so identical roster files hash identically
 * on every machine.
 */
export function contentHashOf(enemyDefs: readonly EnemyDef[], towerDefs: readonly TowerDef[]): number {
  return fnv1a(JSON.stringify({ e: enemyDefs, t: towerDefs }));
}

/** The slice of Sim playback needs - structural, so this module never imports the class. */
interface Replayable {
  readonly tickCount: number;
  applyAction(a: ReplayAction): boolean;
  tick(): void;
}

/**
 * Drive a FRESH sim through a recorded run for `untilTick` ticks. The sim
 * must have been constructed with the replay's seed and content (the caller
 * owns construction; contentHash is its receipt). Inputs are applied at the
 * exact tickCount they were recorded at - between ticks, exactly as the
 * player's clicks were.
 */
export function playReplay(sim: Replayable, replay: Replay, untilTick: number): void {
  let i = 0;
  for (;;) {
    while (i < replay.inputs.length && replay.inputs[i].tick === sim.tickCount) {
      sim.applyAction(replay.inputs[i].a);
      i++;
    }
    if (sim.tickCount >= untilTick) break;
    const before = sim.tickCount;
    sim.tick();
    if (sim.tickCount === before) break; // a fallen Core stays fallen
  }
}
