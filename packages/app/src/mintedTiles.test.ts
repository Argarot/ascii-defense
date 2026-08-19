/**
 * The minted pool heals on every read (playtest 18, his item 2): a borked
 * tile - his hand-minted loop - is dropped from the pool the moment the
 * validity rules learn to refuse it, with no migration step needed.
 */
import { describe, expect, it } from 'vitest';
import type { TileDef } from '@ascii-defense/engine';

const store = new Map<string, string>();
(globalThis as unknown as { localStorage: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};

const g = (...rows: string[]): string[] => rows;
// Distinct from every shipped shape (the pool drops library twins): a
// straight with a rock outcrop.
const GOOD: TileDef = { id: 'mint_road', cells: g('GGGGG', 'GRGGG', '-----', 'GGGGG', 'GGGGG') };
// The borked class: an omni blob that closes a road cycle.
const LOOPED: TileDef = { id: 'mint_loop', cells: g('GG|GG', 'GXXGG', 'GXXGG', 'GG|GG', 'GG|GG') };

describe('minted pool hygiene', () => {
  it('a loop tile in the stored pool is dropped on load; valid tiles survive', async () => {
    store.set('ascii-defense.mintedTiles.v2', JSON.stringify([GOOD, LOOPED]));
    const { loadMintedTiles } = await import('./mintedTiles');
    const pool = loadMintedTiles();
    expect(pool.map((t) => t.id)).toEqual(['mint_road']);
  });
});
