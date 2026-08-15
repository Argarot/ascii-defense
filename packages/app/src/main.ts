/**
 * Bootstrap and input wiring - nothing else. What the board looks like lives
 * in view (BoardView); what the board IS lives in engine. This file connects
 * the mouse and keyboard to both.
 */
import { GLTerm } from '@ascii-defense/render';
import type { GlyphSet } from '@ascii-defense/render';
import { TILE_SIZE, TileLibrary } from '@ascii-defense/engine';
import { BoardView, CELL_W, CELL_H, role } from '@ascii-defense/view';
import type { CellRef } from '@ascii-defense/view';
import tileLibraryJson from '@ascii-defense/content/assets/tiles/library.json';

const BASE = import.meta.env.BASE_URL;
const ASSET_V = '5';
const load = <T>(p: string): Promise<T> =>
  fetch(`${BASE}assets/${p}?v=${ASSET_V}`).then((r) => r.json() as Promise<T>);

const GLYPH_PX_W = 5;
const GLYPH_PX_H = 8;

async function main(): Promise<void> {
  const glyphs = await load<GlyphSet>('glyphset-spleen.json');
  const lib = new TileLibrary(tileLibraryJson.tiles);

  const mapX = 14, mapY = 7;
  const OY = 4; // HUD rows above the board (title, help, inspector, gap)
  const term = new GLTerm(glyphs, {
    cols: mapX * TILE_SIZE * CELL_W,
    rows: mapY * TILE_SIZE * CELL_H + OY,
    cellPx: GLYPH_PX_W,
    cellPxH: GLYPH_PX_H,
    background: role('ui.bg'),
  });

  const view = new BoardView(term, lib, {
    mapX,
    mapY,
    offsetY: OY,
    glyphPxW: GLYPH_PX_W,
    glyphPxH: GLYPH_PX_H,
  });

  // Seed from the URL if pinned, else from the clock (Math.random is banned
  // everywhere, and the whole point is that the seed is the only entropy).
  const fromUrl = Number(new URLSearchParams(location.search).get('seed'));
  let seed = Number.isInteger(fromUrl) && fromUrl > 0 ? fromUrl : Date.now() % 1_000_000;

  let hover: CellRef | null = null;
  let selected: CellRef | null = null;

  const draw = (): void => view.render({ hover, selected });

  const setSeed = (s: number): void => {
    seed = s;
    view.setSeed(seed);
    selected = null;
    history.replaceState(null, '', `?seed=${seed}`);
    draw();
  };

  const app = document.getElementById('app')!;
  app.appendChild(term.canvas);
  const cap = document.createElement('div');
  cap.className = 'hud';
  cap.textContent =
    `spleen 5x8 \u00b7 board by engine growBoard (derived connectors, road-join rule) \u00b7 ` +
    `hover + selection are view-layer; the engine never knows a mouse exists`;
  app.appendChild(cap);

  const same = (a: CellRef | null, b: CellRef | null): boolean =>
    a === b || (a !== null && b !== null && a.x === b.x && a.y === b.y);

  term.canvas.addEventListener('mousemove', (e) => {
    const next = view.cellFromPixel(e.offsetX, e.offsetY);
    if (!same(next, hover)) {
      hover = next;
      draw();
    }
  });
  term.canvas.addEventListener('mouseleave', () => {
    hover = null;
    draw();
  });
  term.canvas.addEventListener('click', (e) => {
    const cell = view.cellFromPixel(e.offsetX, e.offsetY);
    selected = same(cell, selected) ? null : cell; // click again to deselect
    draw();
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'r' || e.key === 'R') setSeed((seed + 1 + (Date.now() % 997)) % 1_000_000);
    if (e.key === 'Escape') {
      selected = null;
      draw();
    }
  });

  setSeed(seed);
}

main().catch((e) => {
  document.getElementById('app')!.textContent = `failed: ${String(e)}`;
  console.error(e);
});
