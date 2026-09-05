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
      startTileId: 'straight',
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
      if (!t.projectile) continue; // producers (attack none) fire nothing
      expect(t.projectile.speed, t.id).toBeGreaterThan(maxEnemySpeed * 2);
    }
  });

  it('every tower either attacks or produces - a tower that does neither is a scam', () => {
    for (const t of towers.towers) {
      const attacks = t.attack !== 'none' && t.projectile !== undefined;
      // roster.json is imported as a literal type here; widen to the schema shape.
      const prod = t.production as { ore?: number; scrap?: number } | undefined;
      const produces = prod !== undefined && ((prod.ore ?? 0) + (prod.scrap ?? 0)) > 0;
      expect(attacks || produces, t.id).toBe(true);
      // And an attacker without a projectile spec would crash the tower phase.
      if (t.attack !== 'none') expect(t.projectile, t.id).toBeDefined();
    }
  });

  it('ids are unique across each roster', () => {
    const eIds = enemies.enemies.map((e) => e.id);
    const tIds = towers.towers.map((t) => t.id);
    expect(new Set(eIds).size).toBe(eIds.length);
    expect(new Set(tIds).size).toBe(tIds.length);
  });
});

// ---- sprites v2 (session 22): every tower state the sim can reach has art ----
import boltSprite from '@ascii-defense/content/assets/sprites/bolt.json';
import mortarSprite from '@ascii-defense/content/assets/sprites/mortar.json';
import frostSprite from '@ascii-defense/content/assets/sprites/frost.json';
import refinerySprite from '@ascii-defense/content/assets/sprites/refinery.json';
import teslaSprite from '@ascii-defense/content/assets/sprites/tesla.json';
import missileSprite from '@ascii-defense/content/assets/sprites/missile.json';
import laserSprite from '@ascii-defense/content/assets/sprites/laser.json';
import roadSprite from '@ascii-defense/content/assets/sprites/road_muted_cobble.json';
import grid from '@ascii-defense/content/assets/grid.json';

describe('imported sprites cover what the game can show', () => {
  // The four studies and the two session-25 placeholders (tools/placeholder-sprites.mjs).
  const towerSprites = [boltSprite, mortarSprite, frostSprite, refinerySprite, teslaSprite, missileSprite, laserSprite];
  // The 15 choice paths a three-tier either/or tree can reach.
  const PATHS = [''];
  for (const a of ['0', '1']) { PATHS.push(a); for (const b of ['0', '1']) { PATHS.push(a + b); for (const c of ['0', '1']) PATHS.push(a + b + c); } }

  it('every tower in the roster has a sprite with all 15 states, two idle frames each, at the grid cell', () => {
    for (const t of towers.towers) {
      const sp = towerSprites.find((s) => s.id === t.id);
      expect(sp, `sprite for ${t.id}`).toBeDefined();
      expect(sp!.cell).toEqual(grid.cell);
      for (const p of PATHS) {
        const st = (sp!.states as Record<string, { art: string[]; frames?: unknown[] }>)[p];
        expect(st, `${t.id} state '${p}'`).toBeDefined();
        expect(st.frames?.length, `${t.id} state '${p}' frames`).toBe(1);
      }
    }
  });

  it('the road sprite has every road letter with four variations', () => {
    const letters = ['|', '-', 'L', 'J', 'F', '7', 'T', 'U', 'E', '3', 'X', 'B'];
    for (const l of letters) {
      const st = (roadSprite.states as Record<string, { variations?: unknown[] }>)[l];
      expect(st, `road '${l}'`).toBeDefined();
      expect(st.variations?.length).toBe(3);
    }
    expect(Object.keys(roadSprite.states).sort()).toEqual([...letters].sort());
  });
});
