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
import enemies from '@ascii-defense/content/assets/enemies/roster.json';
import towers from '@ascii-defense/content/assets/towers/roster.json';

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
      startTileId: 'core_l',
      maxTiles: 98,
    });
    const laid = board.slots.filter(Boolean).length;
    // A library where tiles validate but can barely combine would pass every
    // per-tile check and still make a dead game. Threshold is deliberately
    // loose; the point is "grows freely", not a magic number.
    expect(laid).toBeGreaterThan(20);
  });
});

describe('shipped combat rosters - cross-content sanity', () => {
  it('every projectile comfortably outruns every enemy', () => {
    // A homing shot slower than its target never lands and never expires -
    // a livelock the schema cannot see because it spans two files.
    const maxEnemySpeed = Math.max(...enemies.enemies.map((e) => e.speed));
    for (const t of towers.towers) {
      expect(t.projectile.speed, t.id).toBeGreaterThan(maxEnemySpeed * 2);
    }
  });

  it('ids are unique across each roster', () => {
    const eIds = enemies.enemies.map((e) => e.id);
    const tIds = towers.towers.map((t) => t.id);
    expect(new Set(eIds).size).toBe(eIds.length);
    expect(new Set(tIds).size).toBe(tIds.length);
  });
});
