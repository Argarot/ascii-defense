/**
 * Shipped content passes engine validation. Lives in harness because it needs
 * both sides: engine rules, content data (harness may import both; neither may
 * import the other).
 *
 * This is the semantic half of content checking - the schema half runs in
 * tools/validate-content.mjs. A tile that passes both is guaranteed placeable
 * by the same code that will judge it in-game, because it IS that code.
 */
import { describe, expect, it } from 'vitest';
import { TileLibrary, createRng, growBoard, validateTile } from '@ascii-defense/engine';
import library from '@ascii-defense/content/assets/tiles/library.json';

describe('shipped tile library', () => {
  it('every tile validates against engine rules', () => {
    for (const tile of library.tiles) {
      expect(validateTile(tile), `tile '${tile.id}'`).toEqual([]);
    }
  });

  it('ids are unique', () => {
    const ids = library.tiles.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('the library actually grows boards - not just individually-valid tiles', () => {
    const lib = new TileLibrary(library.tiles);
    const board = growBoard(createRng(4242).stream('map'), lib, {
      width: 14,
      height: 7,
      startTileId: 'spawn',
      maxTiles: 98,
    });
    const laid = board.slots.filter(Boolean).length;
    // A library where tiles validate but can barely combine would pass every
    // per-tile check and still make a dead game. Threshold is deliberately
    // loose; the point is "grows freely", not a magic number.
    expect(laid).toBeGreaterThan(20);
  });
});
