/**
 * The minted-tile pool (session 14, Daniil's "add" button): tiles authored
 * in Tile Smith live in localStorage and are the run's SPECIAL pool (2.21).
 * Per-browser by design - a minted pool makes a seed non-shareable across
 * browsers, which the demo accepts (real persistence is M4; the tile SHOP
 * that prices these is M7).
 *
 * Every read re-validates through the same engine function that gated the
 * export - a corrupted or stale entry is dropped, never half-loaded - and
 * the pool is kept CANONICAL (playtest 12): each def canonicalised, rotation
 * twins collapsed, and shapes that already exist in the basic library
 * dropped, because a "special" identical to a basic both appears unchosen
 * (as the basic, rolled normally) and clutters the picker with lookalikes.
 */
import { canonicalCells, migrateLegacyCells, validateTile, type TileDef } from '@ascii-defense/engine';
import tileLibraryJson from '@ascii-defense/content/assets/tiles/library.json';

const KEY = 'ascii-defense.mintedTiles.v2';
const LEGACY_KEY = 'ascii-defense.mintedTiles.v1';

// Canonical form is IDENTITY, never display (playtest 14): tiles are stored
// and shown exactly as their author drew them - a preview that silently
// rotates someone's tile reads as the wrong sprite. The canonical KEY is
// only ever compared.
const canonKey = (cells: readonly string[]): string => canonicalCells(cells).join('/');
const LIBRARY_FORMS = new Map<string, string>(tileLibraryJson.tiles.map((t) => [canonKey(t.cells), t.id]));

/** The basic-library tile this shape duplicates, if any (playtest 12, item 5). */
export function libraryTwinOf(cells: readonly string[]): string | null {
  return LIBRARY_FORMS.get(canonKey(cells)) ?? null;
}

/**
 * v1 pools predate the 2026-08-18 nomenclature migration (R->X, K->R, r->B).
 * They MUST be letter-mapped, not just revalidated: under the new alphabet an
 * old road 'R' still parses - as rock - so an unmigrated tile would load as a
 * silently different shape rather than fail.
 */
function migrateLegacyPool(): void {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (raw === null) return;
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const pool = (parsed as TileDef[])
        .map((t) => ({ ...t, cells: migrateLegacyCells(t.cells) }))
        .filter((t) => validateTile(t).length === 0);
      const current = loadMintedTiles();
      const merged = [...current, ...pool.filter((t) => !current.some((c) => c.id === t.id))];
      localStorage.setItem(KEY, JSON.stringify(merged));
    }
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    /* a corrupt legacy pool is dropped, never half-loaded */
  }
}

export function loadMintedTiles(): TileDef[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const valid = (parsed as TileDef[]).filter((t) => validateTile(t).length === 0);
    // Canonical hygiene on every read, so pre-2.24 pools heal themselves:
    // one entry per shape, and no shape the basic library already has. The
    // surviving def keeps its AUTHORED orientation - only the key is
    // canonical.
    const seen = new Set<string>();
    const out: TileDef[] = [];
    for (const t of valid) {
      const key = canonKey(t.cells);
      if (seen.has(key) || LIBRARY_FORMS.has(key)) continue;
      seen.add(key);
      out.push(t);
    }
    return out;
  } catch {
    return [];
  }
}

export function addMintedTile(tile: TileDef): void {
  // Canonical IDENTITY (2.24): the same shape drawn sideways is the same
  // tile, so it replaces its rotation-twin instead of joining it as a
  // second asset - but it is STORED as authored (playtest 14): the pool
  // shows what the author drew, never a silently rotated version.
  const key = canonKey(tile.cells);
  const pool = loadMintedTiles().filter((t) => t.id !== tile.id && canonKey(t.cells) !== key);
  pool.push(tile);
  localStorage.setItem(KEY, JSON.stringify(pool));
}

export function clearMintedTiles(): void {
  localStorage.removeItem(KEY);
  localStorage.removeItem(LEGACY_KEY);
}

migrateLegacyPool();
