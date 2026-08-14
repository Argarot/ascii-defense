/**
 * Tile-grid vs continuous comparison.
 *
 * NOT the game. Same map, same art, two backends:
 *
 *   left  — continuous: terrain is per-cell noise, towers sit at arbitrary
 *           cell offsets. No tile concept anywhere.
 *   right — tile grid: the map IS a grid of square tiles (Heroes of Might and
 *           Magic style). Terrain is authored per tile, placement snaps to
 *           tiles. No drawn borders; the structure is legible from the terrain.
 *
 * Cells are square (unscii-8 is 8x8), so a 12x12-cell tile is a genuinely
 * square 96x96 px tile. No aspect correction needed anywhere.
 */
import { GLTerm } from './term/GLTerm';
import type { GlyphSet } from './term/GLTerm';

const BASE = import.meta.env.BASE_URL;
const load = <T>(p: string): Promise<T> => fetch(`${BASE}assets/${p}`).then((r) => r.json() as Promise<T>);

interface Piece { size: [number, number]; art: string[]; ink: string[] }
interface Style { terrain: Record<string, string[]>; tower: Piece; enemy: Piece }
interface Styles { inkMap: Record<string, string | null>; styles: Record<string, Style> }

const PAL: Record<string, string> = {
  'tower.shadow': '#11161d', 'tower.frame': '#5b6f86', 'tower.body': '#8298b0',
  'tower.edge': '#aec2d8', 'tower.core': '#f2f7ff',
  'enemy.body': '#8c3a3a', 'enemy.edge': '#e26060', 'enemy.eye': '#ffd166',
  ground: '#27333f', groundDim: '#18202a', road: '#4a5b70', roadLit: '#71879f',
  roadEdge: '#8299b3', rock: '#3b4653', rockCap: '#5d6e83', ore: '#e8b52a',
  hint: '#1d2836', text: '#d3dae7', dim: '#65758a', accent: '#2ee6a0', bg: '#07090c',
};
const PATH = '#4cc9f0';

const TILE = 12;          // cells per tile edge — square, because cells are square
const TILES_X = 9;
const TILES_Y = 5;
const PW = TILE * TILES_X;
const PH_MAP = TILE * TILES_Y;

type Tile = 'ground' | 'road' | 'rock' | 'ore';

function hash2(x: number, y: number, salt: number): number {
  let h = (x | 0) * 374761393 + (y | 0) * 668265263 + salt * 2246822519;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const pickG = (a: string[], x: number, y: number, s: number): string =>
  a[Math.floor(hash2(x, y, s) * a.length) % a.length];

function drawPiece(t: GLTerm, p: Piece, inkMap: Record<string, string | null>, x: number, y: number, bg?: string): void {
  for (let r = 0; r < p.art.length; r++) {
    const art = p.art[r], ink = p.ink[r] ?? '';
    for (let c = 0; c < art.length; c++) {
      const role = inkMap[ink[c] ?? '.'];
      if (!role) continue;
      t.put(x + c, y + r, art[c], role === 'PATH' ? PATH : (PAL[role] ?? '#ff00ff'), bg);
    }
  }
}

async function main(): Promise<void> {
  const [glyphs, data] = await Promise.all([load<GlyphSet>('glyphset.json'), load<Styles>('styles.json')]);
  const style = data.styles.extended;
  const app = document.getElementById('app')!;

  const term = new GLTerm(glyphs, { cols: PW * 2 + 4, rows: PH_MAP + 6, cellPx: 8, background: PAL.bg });
  app.appendChild(term.canvas);
  const note = document.createElement('div');
  note.className = 'hud';
  app.appendChild(note);

  // ------------------------------------------------------------- the tile map
  // One authored map, shared by both panels. This is the whole point: the same
  // level data can be rendered either way.
  const tiles: Tile[] = new Array(TILES_X * TILES_Y).fill('ground');
  const tileAt = (tx: number, ty: number): Tile => tiles[ty * TILES_X + tx];
  {
    let ty = 2;
    for (let tx = 0; tx < TILES_X; tx++) {
      tiles[ty * TILES_X + tx] = 'road';
      const roll = hash2(tx, 0, 3);
      if (roll < 0.3 && ty > 0) { ty--; tiles[ty * TILES_X + tx] = 'road'; }
      else if (roll > 0.7 && ty < TILES_Y - 1) { ty++; tiles[ty * TILES_X + tx] = 'road'; }
    }
    for (let i = 0; i < tiles.length; i++) {
      if (tiles[i] !== 'ground') continue;
      const r = hash2(i % TILES_X, (i / TILES_X) | 0, 9);
      if (r > 0.86) tiles[i] = 'rock';
      else if (r < 0.09) tiles[i] = 'ore';
    }
  }
  const towerTiles: number[] = [];
  for (let i = 0; i < tiles.length && towerTiles.length < 5; i++) {
    if (tiles[i] === 'ground' && hash2(i, 1, 17) > 0.55) towerTiles.push(i);
  }

  const top = 3;

  /** Continuous: per-cell noise, no tile awareness at all. */
  function drawContinuous(ox: number): void {
    for (let y = 0; y < PH_MAP; y++) {
      for (let x = 0; x < PW; x++) {
        const t = tileAt(Math.min(TILES_X - 1, (x / TILE) | 0), Math.min(TILES_Y - 1, (y / TILE) | 0));
        const sy = top + y;
        // Noise ignores tile edges entirely, so boundaries dissolve.
        if (t === 'road') {
          if (hash2(x, y, 5) < 0.85) term.put(ox + x, sy, pickG(style.terrain.road, x, y, 6), hash2(x, y, 7) < 0.15 ? PAL.roadLit : PAL.road);
        } else if (t === 'rock' && hash2(x, y, 8) < 0.8) {
          term.put(ox + x, sy, pickG(style.terrain.rock, x, y, 9), PAL.rock);
        } else if (t === 'ore' && hash2(x, y, 13) < 0.10) {
          term.put(ox + x, sy, style.terrain.ore[0], PAL.ore);
        } else if (hash2(x, y, 10) < 0.08) {
          term.put(ox + x, sy, pickG(style.terrain.ground, x, y, 11), hash2(x, y, 12) < 0.5 ? PAL.groundDim : PAL.ground);
        }
      }
    }
    // Towers at arbitrary offsets — nothing lines up with anything.
    towerTiles.forEach((i, n) => {
      const tx = i % TILES_X, ty = (i / TILES_X) | 0;
      const jx = Math.round(hash2(n, 2, 31) * 6) - 3;
      const jy = Math.round(hash2(n, 3, 37) * 6) - 3;
      drawPiece(term, style.tower, data.inkMap, ox + tx * TILE + jx, top + ty * TILE + 1 + jy, PAL['tower.shadow']);
    });
  }

  /** Tile grid: terrain authored per tile, placement snapped. No borders. */
  function drawTiled(ox: number, hints: boolean): void {
    for (let ty = 0; ty < TILES_Y; ty++) {
      for (let tx = 0; tx < TILES_X; tx++) {
        const t = tileAt(tx, ty);
        // One roll per tile gives the whole tile a shared character — this is
        // what makes the grid legible without drawing a single border.
        const density = 0.05 + hash2(tx, ty, 41) * 0.09;
        for (let y = 0; y < TILE; y++) {
          for (let x = 0; x < TILE; x++) {
            const gx = tx * TILE + x, gy = ty * TILE + y, sy = top + gy;
            if (t === 'road') {
              // Edge cells of a road tile get the lighter treatment, so the
              // road reads as a laid surface with kerbs.
              const edge = (x === 0 || x === TILE - 1 || y === 0 || y === TILE - 1);
              const nbr = edge && (
                (y === 0 && ty > 0 && tileAt(tx, ty - 1) === 'road') ||
                (y === TILE - 1 && ty < TILES_Y - 1 && tileAt(tx, ty + 1) === 'road') ||
                (x === 0 && tx > 0 && tileAt(tx - 1, ty) === 'road') ||
                (x === TILE - 1 && tx < TILES_X - 1 && tileAt(tx + 1, ty) === 'road'));
              if (edge && !nbr) term.put(ox + gx, sy, pickG(style.terrain.roadEdge, gx, gy, 4), PAL.roadEdge);
              else if (hash2(gx, gy, 5) < 0.85) term.put(ox + gx, sy, pickG(style.terrain.road, gx, gy, 6), hash2(gx, gy, 7) < 0.15 ? PAL.roadLit : PAL.road);
            } else if (t === 'rock') {
              const inset = x > 0 && x < TILE - 1 && y > 0 && y < TILE - 1;
              if (inset || hash2(gx, gy, 8) < 0.5) term.put(ox + gx, sy, pickG(style.terrain.rock, gx, gy, 9), inset ? PAL.rock : PAL.rockCap);
            } else if (t === 'ore') {
              if (hash2(gx, gy, 13) < 0.13) term.put(ox + gx, sy, style.terrain.ore[0], PAL.ore);
              else if (hash2(gx, gy, 10) < density) term.put(ox + gx, sy, pickG(style.terrain.ground, gx, gy, 11), PAL.groundDim);
            } else if (hash2(gx, gy, 10) < density) {
              term.put(ox + gx, sy, pickG(style.terrain.ground, gx, gy, 11), hash2(gx, gy, 12) < 0.5 ? PAL.groundDim : PAL.ground);
            }
          }
        }
        if (hints && t === 'ground') term.put(ox + tx * TILE, top + ty * TILE, '·', PAL.hint);
      }
    }
    towerTiles.forEach((i) => {
      const tx = i % TILES_X, ty = (i / TILES_X) | 0;
      drawPiece(term, style.tower, data.inkMap, ox + tx * TILE, top + ty * TILE + 1, PAL['tower.shadow']);
    });
  }

  let tick = 0;
  function frame(): void {
    term.clear(PAL.bg);

    term.write(0, 0, 'A · continuous backend', PAL.accent);
    term.write(0, 1, 'per-cell terrain, free placement — nothing aligns, footprints are guesswork', PAL.dim);
    term.write(PW + 4, 0, 'B · tile grid backend  (12x12 cells = 96x96 px, square)', PAL.accent);
    term.write(PW + 4, 1, 'per-tile terrain, snapped placement — structure is visible without any borders', PAL.dim);

    drawContinuous(0);
    drawTiled(PW + 4, true);

    // Same enemies on both, walking the road tiles.
    for (let e = 0; e < 4; e++) {
      const p = ((tick * 0.3 + e * 22) % (PW + 10)) - 8;
      const tx = Math.max(0, Math.min(TILES_X - 1, (p / TILE) | 0));
      let ty = 2;
      for (let y = 0; y < TILES_Y; y++) if (tileAt(tx, y) === 'road') { ty = y; break; }
      const ey = top + ty * TILE + 4;
      drawPiece(term, style.enemy, data.inkMap, Math.round(p), ey, undefined);
      drawPiece(term, style.enemy, data.inkMap, PW + 4 + Math.round(p), ey, undefined);
    }

    term.write(0, top + PH_MAP + 1, 'same level data, two renderings. tiles are square because cells are square (unscii-8 is 8x8).', PAL.dim);
    term.flush();
    (window as unknown as Record<string, unknown>).__screen = () => term.toText();
    tick++;
    requestAnimationFrame(frame);
  }
  note.textContent = 'tile grid vs continuous — 1:1 at 8px cells';
  frame();
}

main().catch((e) => {
  document.getElementById('app')!.textContent = `failed: ${String(e)}`;
  console.error(e);
});
