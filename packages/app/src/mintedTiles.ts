/**
 * The minted-tile pool (session 14, Daniil's "add" button): tiles authored
 * in Tile Smith live in localStorage and join the generator's library at
 * load. Per-browser by design - a minted pool makes a seed non-shareable
 * across browsers, which the demo accepts (real persistence is M4; the
 * tile SHOP that prices these is M7).
 *
 * Every read re-validates through the same engine function that gated the
 * export - a corrupted or stale entry is dropped, never half-loaded.
 */
import { validateTile, type TileDef } from '@ascii-defense/engine';

const KEY = 'ascii-defense.mintedTiles.v1';

export function loadMintedTiles(): TileDef[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return (parsed as TileDef[]).filter((t) => validateTile(t).length === 0);
  } catch {
    return [];
  }
}

export function addMintedTile(tile: TileDef): void {
  const pool = loadMintedTiles().filter((t) => t.id !== tile.id);
  pool.push(tile);
  localStorage.setItem(KEY, JSON.stringify(pool));
}

export function clearMintedTiles(): void {
  localStorage.removeItem(KEY);
}
