/**
 * The seam between the sim worker and the UI thread (D7, session 18).
 *
 * The worker owns the Sim and everything derived from it; the main thread
 * owns terminals, input and ambient time. Per frame the main thread sends
 * the UI state (hover, selection) and receives a FrameSnapshot - plain data,
 * no live objects - so the view can never reach into sim memory again. The
 * failure mode this shape prevents: a screen caching sim state (PRD sec 15.1).
 */
import type { CellRef, GeneratedMap, ReplayInput, StampedSimEvent, TileDef } from '@ascii-defense/engine';
import type { HudState, RenderState } from '@ascii-defense/view';

/** Threat levels as data (session 15); shared so both threads agree. */
export const THREAT_LEVELS = [
  { name: 'Calm', entries: [2, 3] as const, pathBias: 12, finalWave: 15, hpGeometric: 1.05 },
  { name: 'Standard', entries: [2, 5] as const, pathBias: 8, finalWave: 20, hpGeometric: 1.06 },
  { name: 'Grim', entries: [3, 6] as const, pathBias: 5, finalWave: 25, hpGeometric: 1.08 },
] as const;

/** What the run IS, for saving: determinism makes this the whole state.
 *  The loadout is generation input (2.21), so it must ride the save - a
 *  resume without it would replay onto a different map. The tile DEFS ride
 *  too, not just ids: the minted pool can change between save and resume. */
export interface RunSave {
  version: number;
  seed: number;
  threatIdx: number;
  tick: number;
  inputs: ReplayInput[];
  contentHash: number;
  /** Special tiles loaded for this run (v2+); [] on migrated v1 saves. */
  loadout: TileDef[];
}

export interface UiState {
  hover: CellRef | null;
  selected: CellRef | null;
  hudHover: import('@ascii-defense/view').HudAction | null;
  targeting: string | null;
  showGrid: boolean;
}

/** Everything a frame needs, assembled where the sim lives. */
export interface FrameSnapshot {
  /** RenderState minus the ambient fields (phase/animMs/drift) - those are
   *  presentation time and belong to the main thread's clocks. */
  board: Omit<RenderState, 'phase' | 'animMs' | 'drift'>;
  /** HudState minus phase, same reason. */
  hud: Omit<HudState, 'phase'>;
  offer: { cards: { name: string; kind: string; desc: string }[]; wave: number; reroll: { cost: number; can: boolean; ore: number } } | null;
  events: StampedSimEvent[];
  /** The sim's terrain mutations, cumulative - the view applies incrementally. */
  cellChanges: { x: number; y: number; t: string }[];
  tick: number;
  status: 'running' | 'lost' | 'won';
  seed: number;
  paused: boolean;
  /** Current speed multiplier, for the main thread's world-ambient clock (4.25). */
  speed: number;
}

export type ToWorker =
  | { t: 'init'; seed: number; threatIdx: number; loadout?: TileDef[]; resume?: RunSave }
  | { t: 'frame'; ui: UiState }
  | { t: 'speed'; idx: number }
  | { t: 'action'; a: WorkerAction }
  | { t: 'save'; id: number }
  | { t: 'debug'; id: number; op: string; args: unknown[] };

export type WorkerAction =
  | { k: 'build'; x: number; y: number; defId: string }
  | { k: 'sell'; x: number; y: number }
  | { k: 'choose'; x: number; y: number; tier: number; option: number }
  | { k: 'priority'; x: number; y: number; value: string }
  | { k: 'pickRelic'; option: number }
  | { k: 'rerollOffer' }
  | { k: 'buyRelic' }
  | { k: 'slot'; index: number }
  | { k: 'fireActive'; relicId: string; x: number; y: number }
  | { k: 'claimCache'; x: number; y: number }
  | { k: 'prospect'; x: number; y: number };

export type FromWorker =
  | { t: 'ready'; seed: number; map: GeneratedMap; finalWave: number }
  | { t: 'snapshot'; s: FrameSnapshot }
  | { t: 'saved'; id: number; save: RunSave }
  | { t: 'genError'; message: string }
  | { t: 'debugResult'; id: number; result: unknown };

/** v2 (session 19): RunSave gains the loadout. v1 saves migrate with []. */
export const SAVE_VERSION = 2;
