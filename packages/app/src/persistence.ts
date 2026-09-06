/**
 * Persistence (PRD sec 15.2): the meta save and the run save, as pure
 * functions over a key store so they run under Node tests. Load-or-explain
 * throughout - a corrupt or foreign blob is REPORTED and left in place,
 * never wiped, so it can still be exported.
 *
 * Two formats, two versions. The meta save was once stamped with the RUN
 * save's SAVE_VERSION, so bumping that for the map-in-save change (v2->v3)
 * silently reset every player's banked ore and history to defaults although
 * the meta shape had not changed at all. META_VERSION moves only when the
 * META shape moves.
 */
import { SAVE_VERSION, type RunSave } from './protocol';

export const META_KEY = 'ascii-defense.meta.v1';
export const RUN_KEY = 'ascii-defense.run.v1';

/**
 * Meta format version. 1, 2 and 3 all carry the same shape (2 and 3 were
 * SAVE_VERSION stamps leaking in); every one of them loads as-is.
 */
export const META_VERSION = 3;
const META_COMPATIBLE = new Set([1, 2, 3]);

/** The minimal store surface: localStorage, or a Map-backed fake in tests. */
export interface KeyStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface MetaSave {
  version: number;
  bankedOre: number;
  settings: {
    reducedMotion: boolean | null; // null = follow the OS
    /** The HUD's and menus' font multiple; 1 or 2 (session 27). Applied at boot. */
    hudScale: 1 | 2;
    /** 'default' or 'colourblind' - a role override set in the view (session 27, WBS 4.24). */
    palette: 'default' | 'colourblind';
    /** Which sprite pack the game draws with (2026-09-06 evening): the current assets, or the previous pack kept beside them for comparison. Read at boot. */
    spriteSet: 'current' | 'previous';
    /** The first-run prompts have been seen (session 27, WBS 4.23). */
    onboarded: boolean;
  };
  history: { seed: number; threat: string; wave: number; status: string; kills: number }[];
}

export const defaultMeta = (): MetaSave => ({ version: META_VERSION, bankedOre: 0, settings: { reducedMotion: null, hudScale: 2, palette: 'default', spriteSet: 'current', onboarded: false }, history: [] });

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * A versioned blob is not yet a valid save: `{"version":3}` used to reach
 * `meta.history.push` and kill the frame loop. Fields are checked one by
 * one; a field of the wrong shape makes the whole blob a reported problem.
 */
function shapeMeta(m: Record<string, unknown>): MetaSave | null {
  const bankedOre = m.bankedOre ?? 0;
  const history = m.history ?? [];
  const settings = isRecord(m.settings) ? m.settings : { reducedMotion: null };
  if (typeof bankedOre !== 'number' || !Number.isFinite(bankedOre)) return null;
  if (!Array.isArray(history) || !history.every(isRecord)) return null;
  const rm = settings.reducedMotion ?? null;
  if (rm !== null && typeof rm !== 'boolean') return null;
  // Newer settings default when absent (a save from before session 27).
  const hudScale = settings.hudScale === 1 ? 1 : 2;
  const palette = settings.palette === 'colourblind' ? 'colourblind' : 'default';
  const onboarded = settings.onboarded === true;
  const spriteSet = settings.spriteSet === 'previous' ? 'previous' : 'current'; // 'shipped'/'reworked' of one evening both mean the current pack now
  return {
    version: META_VERSION,
    bankedOre,
    settings: { reducedMotion: rm, hudScale, palette, spriteSet, onboarded },
    history: history as MetaSave['history'],
  };
}

export function loadMetaFrom(store: KeyStore): { meta: MetaSave; problem: string | null } {
  const corrupt = { meta: defaultMeta(), problem: 'meta save is corrupt - using defaults, the broken data is kept for export' };
  try {
    const raw = store.getItem(META_KEY);
    if (!raw) return { meta: defaultMeta(), problem: null };
    const m: unknown = JSON.parse(raw);
    if (!isRecord(m) || typeof m.version !== 'number') return corrupt;
    if (!META_COMPATIBLE.has(m.version)) {
      return { meta: defaultMeta(), problem: `meta save is version ${m.version}, this build reads ${META_VERSION} - using defaults, old data kept` };
    }
    const shaped = shapeMeta(m);
    return shaped ? { meta: shaped, problem: null } : corrupt;
  } catch {
    return corrupt;
  }
}

export function saveMetaTo(store: KeyStore, m: MetaSave): void {
  try { store.setItem(META_KEY, JSON.stringify({ ...m, version: META_VERSION })); } catch { /* storage full: the run continues */ }
}

/** The fields a resume actually dereferences before the worker validates. */
function looksLikeRun(r: Record<string, unknown>): boolean {
  return typeof r.seed === 'number' && typeof r.threatIdx === 'number' && typeof r.tick === 'number'
    && Array.isArray(r.inputs) && Array.isArray(r.loadout) && isRecord(r.map);
}

export function loadRunFrom(store: KeyStore): { run: RunSave | null; problem: string | null } {
  const corrupt = { run: null, problem: 'run save is corrupt and cannot continue - kept for export' };
  try {
    const raw = store.getItem(RUN_KEY);
    if (!raw) return { run: null, problem: null };
    const r: unknown = JSON.parse(raw);
    if (!isRecord(r) || typeof r.version !== 'number') return corrupt;
    // v1/v2 saves carry no map; across the generator rebuild their seed
    // would regenerate a DIFFERENT map and the input log would replay onto
    // the wrong cells - refused with a sentence, never silently corrupted.
    if (r.version < SAVE_VERSION) return { run: null, problem: 'run save predates the generator rebuild - it cannot continue' };
    if (r.version !== SAVE_VERSION) return { run: null, problem: `run save is version ${r.version}, this build reads ${SAVE_VERSION} - it cannot continue` };
    if (!looksLikeRun(r)) return corrupt;
    return { run: r as unknown as RunSave, problem: null };
  } catch {
    return corrupt;
  }
}
