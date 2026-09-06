/**
 * The seam between the sim worker and the UI thread (D7, session 18).
 *
 * The worker owns the Sim and everything derived from it; the main thread
 * owns terminals, input and ambient time. Per frame the main thread sends
 * the UI state (hover, selection) and receives a FrameSnapshot - plain data,
 * no live objects - so the view can never reach into sim memory again. The
 * failure mode this shape prevents: a screen caching sim state (PRD sec 15.1).
 */
import type { CellRef, GeneratedMap, ReplayInput, StampedSimEvent, TileDef , MetaState } from '@ascii-defense/engine';
import type { HudState, RenderState } from '@ascii-defense/view';

/**
 * The DEFAULT board in tile slots: what the worker uses when init names no
 * board (tests, the lab). The app derives the real size from the viewport
 * (boardSize.ts, D24) and sends it with init; a resumed save brings its own
 * map and therefore its own size.
 */
export const BOARD_SLOTS = { w: 12, h: 7 } as const;

/** Threat levels as data (session 15); shared so both threads agree. */
/** `waveSeconds`: the wave clock, launch to launch (design round 1, item 10). */
export const THREAT_LEVELS = [
  { name: 'Calm', entries: [2, 3] as const, pathBias: 12, finalWave: 15, hpGeometric: 1.05, waveSeconds: 55 },
  { name: 'Standard', entries: [2, 5] as const, pathBias: 8, finalWave: 20, hpGeometric: 1.05, waveSeconds: 40 },
  { name: 'Grim', entries: [3, 6] as const, pathBias: 5, finalWave: 25, hpGeometric: 1.07, waveSeconds: 30 },
] as const;

/** What the run IS, for saving: determinism makes this the whole state.
 *  The loadout is generation input (2.21), so it must ride the save - a
 *  resume without it would replay onto a different map. The tile DEFS ride
 *  too, not just ids: the minted pool can change between save and resume. */
export interface RunSave {
  version: number;
  seed: number;
  threatIdx: number;
  /**
   * The run's meta identity (v5, session 29, PR 1): the tree state the
   * run was started under - it filters the towers and the relic pool, sets
   * the slots and caps the rarities dealt, so a resume and a replay see
   * the same world. A v4 save migrates with the everything sentinel.
   */
  meta: MetaState;
  /** Endless mode (session 29, PR 2; PRD sec 19 item 22): no final wave, the ramp runs until the Core falls. Absent = false. */
  endless?: boolean;
  tick: number;
  inputs: ReplayInput[];
  contentHash: number;
  /** Special tiles loaded for this run (v2+); [] on migrated v1 saves. */
  loadout: TileDef[];
  /**
   * The generated map itself (v3, D15): resume LOADS it and never
   * re-generates, so a saved run survives generator changes. The map is
   * plain data - it already crosses postMessage every init.
   */
  map: GeneratedMap;
}

export interface UiState {
  hover: CellRef | null;
  selected: CellRef | null;
  hudHover: import('@ascii-defense/view').HudAction | null;
  targeting: string | null;
  showGrid: boolean;
  /** A held relic the player opened in the column (session 28, PR 3); the worker builds its card. */
  selectedRelic?: number | null;
}

/** Everything a frame needs, assembled where the sim lives. */
export interface FrameSnapshot {
  /** RenderState minus the ambient fields (phase/animMs/drift) - those are
   *  presentation time and belong to the main thread's clocks. */
  board: Omit<RenderState, 'phase' | 'animMs' | 'drift'>;
  /** HudState minus phase, same reason. */
  hud: Omit<HudState, 'phase'>;
  /** A pick-1-of-3 standing over the board: the relic offer, with reroll (the passive layer folded into it 2026-09-06 evening). */
  offer: { kind: 'relic'; title: string; cards: { name: string; kind: string; desc: string; rarity?: string }[]; wave: number; reroll?: { cost: number; can: boolean; ore: number }; /** Slots full: a pick must name the held one it replaces (session 28, PR 3). */ full: boolean } | null;
  events: StampedSimEvent[];
  /** The sim's terrain mutations, cumulative - the view applies incrementally. */
  cellChanges: { x: number; y: number; t: string }[];
  tick: number;
  status: 'running' | 'lost' | 'won';
  seed: number;
  paused: boolean;
  /** Current speed multiplier, for the main thread's world-ambient clock (4.25). */
  speed: number;
  /** The run's story, once it has ended (session 27): kills by tower, bodies met, relics held. */
  story?: { killsByTower: { name: string; kills: number }[]; met: { name: string; count: number }[]; relics: string[]; relicUses: { name: string; uses: number }[]; /** Forged-to rarities and fusions reached, for the meta save (session 29, PR 1). */ forged: { id: string; rarity: number }[]; fused: string[] };
}

export type ToWorker =
  | { t: 'init'; seed: number; threatIdx: number; loadout?: TileDef[]; resume?: RunSave; board?: { w: number; h: number }; /** The tree state for a NEW run (session 29, PR 1); absent = everything (tests). A resume carries its own. */ meta?: MetaState; /** Endless mode for a NEW run (session 29, PR 2); a resume carries its own. */ endless?: boolean }
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
  | { k: 'facing'; x: number; y: number; value: number }
  | { k: 'pickRelic'; option: number; replace?: number }
  | { k: 'skipOffer' }
  | { k: 'salvage'; index: number }
  | { k: 'combine'; a: number; b: number }
  | { k: 'rerollOffer' }
  | { k: 'buyRelic' }
  | { k: 'slot'; index: number }
  | { k: 'fireActive'; relicId: string; x: number; y: number }
  | { k: 'openCache'; x: number; y: number }
  | { k: 'claimChest'; x: number; y: number }
  | { k: 'prospect'; x: number; y: number }
  | { k: 'callWave' };

export type FromWorker =
  | { t: 'ready'; seed: number; map: GeneratedMap; finalWave: number }
  | { t: 'snapshot'; s: FrameSnapshot }
  | { t: 'saved'; id: number; save: RunSave }
  | { t: 'genError'; message: string }
  | { t: 'debugResult'; id: number; result: unknown };

/**
 * v2 (session 19): RunSave gains the loadout; v1 migrated with [].
 * v3 (2.27 PR 4, D15): RunSave carries the generated map. v1/v2 saves
 * cannot honestly resume across the generator rebuild (their seed would
 * regenerate a DIFFERENT map and the input log would replay onto wrong
 * cells) - they are refused with a sentence, never silently corrupted.
 * v4 (design round 1, 2026-09-03): the map's rock contents lost their pool
 * index, caches moved into the sim (openCache replaced claimCache in the
 * input log). A v3 save would replay a claim the sim no longer knows.
 * v5 (session 29, PR 1): RunSave carries the run's meta identity (the tree
 * state); a v4 save migrates with the everything sentinel, since the world
 * before the tree had everything.
 */
export const SAVE_VERSION = 5;
