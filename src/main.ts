/**
 * Terrain tiles at the agreed nomenclature.
 *
 *   GLYPH  one character, 8x8 px (unscii-8)
 *   CELL   5x5 glyphs, 40x40 px — the placement unit a tower occupies
 *   TILE   7x7 cells, 280x280 px — the Carcassonne piece the player lays
 *
 * Tiles come from public/assets/tiledefs.json: a 7x7 grid of cell types plus
 * edge connectors. Placement is legal only where connectors match, so road
 * connectivity holds by construction. Adding tiles needs no engine change.
 *
 * Void is black; every placed cell paints a background, so the boundary
 * between built terrain and void is unmistakable.
 */
import { GLTerm } from './term/GLTerm';
import type { GlyphSet } from './term/GLTerm';

const BASE = import.meta.env.BASE_URL;
const load = <T>(p: string): Promise<T> => fetch(`${BASE}assets/${p}`).then((r) => r.json() as Promise<T>);

interface TileDef { id: string; name: string; conn: string[]; cells: string[] }
interface TileDefs { cellsPerTile: number; glyphsPerCell: number; tiles: TileDef[] }
interface Piece { art: string[]; ink: string[] }
interface Mini { towers: Record<string, Piece>; enemy: Piece; inkMap: Record<string, string | null> }

const PAL: Record<string, string> = {
  'tower.shadow': '#0c1017', 'tower.frame': '#7286a0', 'tower.body': '#98adc4',
  'tower.edge': '#c3d5e8', 'tower.core': '#ffffff',
  'enemy.body': '#a04545', 'enemy.edge': '#f07070', 'enemy.eye': '#ffd166',
  text: '#d3dae7', dim: '#65758a', accent: '#2ee6a0', bg: '#000000',
};
const PATHS = ['#4cc9f0', '#ffb703', '#c08cff', '#5ce68c'];

// Terrain: foreground ramp + a background so placed ground never reads as void.
const TERRAIN: Record<string, { ramp: string[]; fg: string; fgLit: string; bg: string }> = {
  G: { ramp: [' ', ' ', ' ', '·', "'", '`', ','], fg: '#3d4f61', fgLit: '#54687d', bg: '#141c25' },
  R: { ramp: [':', ';', ':', '·', '='], fg: '#93abc4', fgLit: '#c2d6ea', bg: '#333f4d' },
  K: { ramp: ['#', '%', '@', '&'], fg: '#5a6a7c', fgLit: '#8698ab', bg: '#1b232c' },
  O: { ramp: ['¤', '*', '·', '¤'], fg: '#ffd15c', fgLit: '#fff0b0', bg: '#2a2415' },
  S: { ramp: ['»', '»', ':', '·'], fg: '#ff9090', fgLit: '#ffd0d0', bg: '#331a1a' },
};

const BX = 6, BY = 4;                      // board, in tiles
const DIRS = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] } as const;
const OPP: Record<string, string> = { n: 's', s: 'n', e: 'w', w: 'e' };

function hash2(x: number, y: number, s: number): number {
  let h = (x | 0) * 374761393 + (y | 0) * 668265263 + s * 2246822519;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

async function main(): Promise<void> {
  const [glyphs, defs, mini] = await Promise.all([
    load<GlyphSet>('glyphset.json'),
    load<TileDefs>('tiledefs.json'),
    load<Mini>('tiles.json'),
  ]);
  const C = defs.cellsPerTile;    // 7
  const Gp = defs.glyphsPerCell;  // 5
  const TG = C * Gp;              // 35 glyphs per tile edge

  const app = document.getElementById('app')!;
  const HAND = 11;
  const term = new GLTerm(glyphs, { cols: BX * TG + HAND + 2, rows: BY * TG + 4, cellPx: 8, background: PAL.bg });
  app.appendChild(term.canvas);
  const note = document.createElement('div');
  note.className = 'hud';
  app.appendChild(note);

  const byId = new Map(defs.tiles.map((t) => [t.id, t]));
  const board: (TileDef | null)[] = new Array(BX * BY).fill(null);
  const put = (x: number, y: number, d: TileDef): void => { board[y * BX + x] = d; };
  const get = (x: number, y: number): TileDef | null => (x < 0 || y < 0 || x >= BX || y >= BY ? null : board[y * BX + x]);

  // Lay a connected chain, honouring connectors at every step.
  {
    let x = 0, y = 1, entry = '';
    put(0, 1, byId.get('spawn_e')!);
    let exit = 'e';
    for (let step = 0; step < 14; step++) {
      const [dx, dy] = DIRS[exit as keyof typeof DIRS];
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= BX || ny >= BY) break;
      entry = OPP[exit];
      const cands = defs.tiles.filter((t) => t.id !== 'spawn_e' && t.conn.includes(entry) && t.conn.length >= 2);
      if (!cands.length) break;
      const d = cands[Math.floor(hash2(nx, ny, step + 5) * cands.length) % cands.length];
      if (get(nx, ny)) break;
      put(nx, ny, d);
      const exits = d.conn.filter((c) => c !== entry);
      exit = exits[Math.floor(hash2(nx, ny, step + 90) * exits.length) % exits.length];
      x = nx; y = ny;
    }
  }
  const placedTiles = board.filter(Boolean).length;

  // Towers on ground cells, spread out.
  const towerKeys = Object.keys(mini.towers);
  const towers: { tx: number; ty: number; cx: number; cy: number; kind: string; path: number }[] = [];
  for (let ty = 0; ty < BY; ty++)
    for (let tx = 0; tx < BX; tx++) {
      const d = get(tx, ty);
      if (!d) continue;
      for (let cy = 0; cy < C; cy++)
        for (let cx = 0; cx < C; cx++)
          if (d.cells[cy][cx] === 'G' && hash2(tx * 100 + cx, ty * 100 + cy, 41) > 0.86)
            towers.push({ tx, ty, cx, cy, kind: towerKeys[towers.length % towerKeys.length], path: towers.length % PATHS.length });
    }

  function drawPiece(p: Piece, gx: number, gy: number, path: string, bg: string): void {
    for (let r = 0; r < p.art.length; r++)
      for (let c = 0; c < p.art[r].length; c++) {
        const role = mini.inkMap[(p.ink[r] ?? '')[c] ?? '.'];
        if (!role) continue;
        term.put(gx + c, gy + r, p.art[r][c], role === 'PATH' ? path : (PAL[role] ?? '#f0f'), bg);
      }
  }

  const OY = 3;
  function frame(): void {
    term.clear(PAL.bg);
    term.write(0, 0, `glyph 8px → cell ${Gp}x${Gp} glyphs (${Gp * 8}px) → tile ${C}x${C} cells (${TG * 8}px) · board ${BX}x${BY} = ${BX * BY} tile slots, ${placedTiles} laid`, PAL.accent);
    term.write(0, 1, 'void is black; every laid cell paints a background, so the terrain edge is unmistakable. tiles come from tiledefs.json.', PAL.dim);

    for (let ty = 0; ty < BY; ty++) {
      for (let tx = 0; tx < BX; tx++) {
        const d = get(tx, ty);
        if (!d) continue;
        for (let cy = 0; cy < C; cy++) {
          for (let cx = 0; cx < C; cx++) {
            const t = TERRAIN[d.cells[cy][cx]] ?? TERRAIN.G;
            const gx0 = tx * TG + cx * Gp, gy0 = OY + ty * TG + cy * Gp;
            for (let y = 0; y < Gp; y++)
              for (let x = 0; x < Gp; x++) {
                const gx = gx0 + x, gy = gy0 + y;
                const g = t.ramp[Math.floor(hash2(gx, gy, 6) * t.ramp.length) % t.ramp.length];
                term.put(gx, gy, g, hash2(gx, gy, 9) < 0.18 ? t.fgLit : t.fg, t.bg);
              }
          }
        }
      }
    }

    for (const tw of towers)
      drawPiece(mini.towers[tw.kind], tw.tx * TG + tw.cx * Gp, OY + tw.ty * TG + tw.cy * Gp, PATHS[tw.path], PAL['tower.shadow']);

    let n = 0;
    for (let ty = 0; ty < BY && n < 40; ty++)
      for (let tx = 0; tx < BX && n < 40; tx++) {
        const d = get(tx, ty);
        if (!d) continue;
        for (let cy = 0; cy < C && n < 40; cy++)
          for (let cx = 0; cx < C && n < 40; cx++)
            if (d.cells[cy][cx] === 'R' && hash2(tx * 77 + cx, ty * 77 + cy, 61) > 0.80) {
              drawPiece(mini.enemy, tx * TG + cx * Gp + 1, OY + ty * TG + cy * Gp + 1, '#fff', TERRAIN.R.bg);
              n++;
            }
      }

    // Hand: tiles shown schematically, one glyph per cell.
    const hx = BX * TG + 2;
    term.write(hx, OY - 1, 'hand', PAL.accent);
    ['corner_ws', 'straight_we_ore', 'tee_wns'].forEach((id, i) => {
      const d = byId.get(id)!;
      const cy = OY + 1 + i * (C + 4);
      for (let y = 0; y < C; y++)
        for (let x = 0; x < C; x++) {
          const t = TERRAIN[d.cells[y][x]] ?? TERRAIN.G;
          term.put(hx + x, cy + y, d.cells[y][x] === 'R' ? '=' : d.cells[y][x] === 'G' ? '·' : d.cells[y][x] === 'O' ? '¤' : '#', t.fgLit, t.bg);
        }
      for (const c of d.conn) {
        if (c === 'w') term.put(hx - 1, cy + 3, '╡', PAL['tower.edge']);
        if (c === 'e') term.put(hx + C, cy + 3, '╞', PAL['tower.edge']);
        if (c === 'n') term.put(hx + 3, cy - 1, '╨', PAL['tower.edge']);
        if (c === 's') term.put(hx + 3, cy + C, '╥', PAL['tower.edge']);
      }
      term.write(hx, cy + C + 2, d.name.slice(0, 9), i === 0 ? PAL.text : PAL.dim);
    });

    term.flush();
    (window as unknown as Record<string, unknown>).__screen = () => term.toText();
    requestAnimationFrame(frame);
  }
  note.textContent = `tile hierarchy — ${BX}x${BY} tiles, ${towers.length} towers`;
  frame();
}

main().catch((e) => {
  document.getElementById('app')!.textContent = `failed: ${String(e)}`;
  console.error(e);
});
