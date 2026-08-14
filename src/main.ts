/**
 * Mock: tile-laying UI, and a tilted (2.5D) rendering of the same board.
 *
 * NOT the game. Answers two questions visually before they go into the PRD:
 *   1. What does a mostly-void board, a hand of terrain tiles, and a legal
 *      placement look like in ASCII?
 *   2. Does a tilted perspective work in a character grid, and what does it
 *      cost?
 *
 * The tilt is a foreshortened ground plane: a tile's top face is 12x8 cells
 * while the tile advances only 8 rows per grid step, so the 4 remaining rows
 * become a front wall. Elevation raises the top face and lengthens the wall.
 * That is a real 2.5D height map, drawn back-to-front, with no change to the
 * underlying square grid.
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
  ground: '#27333f', groundDim: '#18202a', road: '#4a5b70', roadLit: '#71879f',
  roadEdge: '#8299b3', rock: '#3b4653', ore: '#e8b52a',
  wall: '#1b2531', wallLit: '#2b3a4b',
  frontier: '#2a4436', frontierLit: '#47795c',
  ghost: '#2ee6a0', card: '#33475e', cardLit: '#7d93ab',
  spawn: '#e05a5a', text: '#d3dae7', dim: '#65758a', accent: '#2ee6a0', bg: '#07090c',
};
const PATH = '#4cc9f0';

const T = 12;            // tile edge in cells (flat)
const TOPH = 8;          // tilted: rows of top face visible per grid step
const TX = 9, TY = 5;    // board in tiles

type Kind = 'void' | 'ground' | 'road' | 'rock' | 'ore' | 'spawn';
const ELEV: Record<Kind, number> = { void: 0, road: 0, ground: 1, ore: 1, rock: 3, spawn: 1 };

function hash2(x: number, y: number, s: number): number {
  let h = (x | 0) * 374761393 + (y | 0) * 668265263 + s * 2246822519;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const pick = (a: string[], x: number, y: number, s: number): string =>
  a[Math.floor(hash2(x, y, s) * a.length) % a.length];

async function main(): Promise<void> {
  const [glyphs, data] = await Promise.all([load<GlyphSet>('glyphset.json'), load<Styles>('styles.json')]);
  const st = data.styles.extended;
  const app = document.getElementById('app')!;
  const COLS = 178, ROWS = 122;
  const term = new GLTerm(glyphs, { cols: COLS, rows: ROWS, cellPx: 8, background: PAL.bg });
  app.appendChild(term.canvas);
  const note = document.createElement('div');
  note.className = 'hud';
  app.appendChild(note);

  const G = (a: string[]) => a;
  const drawPiece = (p: Piece, x: number, y: number, bg?: string, tint?: string): void => {
    for (let r = 0; r < p.art.length; r++)
      for (let c = 0; c < p.art[r].length; c++) {
        const role = data.inkMap[(p.ink[r] ?? '')[c] ?? '.'];
        if (!role) continue;
        term.put(x + c, y + r, p.art[r][c], tint ?? (role === 'PATH' ? PATH : (PAL[role] ?? '#f0f')), bg);
      }
  };

  // ------------------------------------------------------- the placed board
  const tiles: Kind[] = new Array(TX * TY).fill('void');
  const put = (tx: number, ty: number, k: Kind): void => { if (tx >= 0 && ty >= 0 && tx < TX && ty < TY) tiles[ty * TX + tx] = k; };
  const at = (tx: number, ty: number): Kind => (tx < 0 || ty < 0 || tx >= TX || ty >= TY ? 'void' : tiles[ty * TX + tx]);
  // A short built region: spawn on the left, road snaking right, ground either side.
  put(0, 2, 'spawn'); put(1, 2, 'road'); put(2, 2, 'road'); put(2, 1, 'road'); put(3, 1, 'road');
  put(1, 1, 'ground'); put(1, 3, 'ground'); put(2, 3, 'rock'); put(3, 2, 'ground');
  put(2, 0, 'ground'); put(3, 0, 'ore'); put(0, 1, 'rock'); put(0, 3, 'ground');
  const towers = [1 * TX + 1, 3 * TX + 0];

  const frontier = new Set<number>();
  for (let ty = 0; ty < TY; ty++)
    for (let tx = 0; tx < TX; tx++)
      if (at(tx, ty) === 'void' && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => at(tx + dx, ty + dy) !== 'void'))
        frontier.add(ty * TX + tx);
  const GHOST_TX = 4, GHOST_TY = 1;

  /** Terrain fill for one tile, into an arbitrary rectangle. */
  function fillTile(k: Kind, ox: number, oy: number, w: number, h: number, seed: number, dim: number): void {
    const dens = 0.05 + hash2(seed, 0, 41) * 0.08;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const gx = ox + x, gy = oy + y;
        const shade = (c: string): string => c;
        if (k === 'road') {
          if (hash2(gx, gy, 5) < 0.85) term.put(gx, gy, pick(G(st.terrain.road), gx, gy, 6), shade(hash2(gx, gy, 7) < 0.15 ? PAL.roadLit : PAL.road));
        } else if (k === 'rock') {
          if (hash2(gx, gy, 8) < 0.8) term.put(gx, gy, pick(G(st.terrain.rock), gx, gy, 9), PAL.rock);
        } else if (k === 'ore') {
          if (hash2(gx, gy, 13) < 0.13) term.put(gx, gy, st.terrain.ore[0], PAL.ore);
          else if (hash2(gx, gy, 10) < dens) term.put(gx, gy, pick(G(st.terrain.ground), gx, gy, 11), PAL.groundDim);
        } else if (k === 'spawn') {
          if (hash2(gx, gy, 5) < 0.85) term.put(gx, gy, pick(G(st.terrain.road), gx, gy, 6), PAL.road);
          if (y === (h >> 1) && x > 1 && x < w - 2) term.put(gx, gy, '»', PAL.spawn);
        } else if (hash2(gx, gy, 10) < dens) {
          term.put(gx, gy, pick(G(st.terrain.ground), gx, gy, 11), hash2(gx, gy, 12) < 0.5 ? PAL.groundDim : PAL.ground);
        }
        void dim;
      }
    }
  }

  // ------------------------------------------------------------- flat board
  function drawFlat(ox: number, oy: number): void {
    for (let ty = 0; ty < TY; ty++) {
      for (let tx = 0; tx < TX; tx++) {
        const k = at(tx, ty);
        const bx = ox + tx * T, by = oy + ty * T;
        if (k === 'void') {
          if (frontier.has(ty * TX + tx))
            for (let y = 0; y < T; y++) for (let x = 0; x < T; x++)
              if (hash2(bx + x, by + y, 33) < 0.09) term.put(bx + x, by + y, '·', PAL.frontier);
          continue;
        }
        fillTile(k, bx, by, T, T, ty * TX + tx, 0);
      }
    }
    for (const id of towers) drawPiece(st.tower, ox + (id % TX) * T, oy + Math.floor(id / TX) * T + 1, PAL['tower.shadow']);

    // Ghost: the selected hand tile previewed on a legal position.
    const gx = ox + GHOST_TX * T, gy = oy + GHOST_TY * T;
    for (let y = 0; y < T; y++)
      for (let x = 0; x < T; x++) {
        const onRoad = y >= 4 && y < 8;
        if (onRoad) { if (hash2(x, y, 61) < 0.7) term.put(gx + x, gy + y, pick(G(st.terrain.road), x, y, 6), PAL.ghost); }
        else if (x === 0 || x === T - 1 || y === 0 || y === T - 1) {
          if ((x + y) % 2 === 0) term.put(gx + x, gy + y, '·', PAL.ghost);
        }
      }
  }

  // ---------------------------------------------------------- tilted board
  // Back to front. Top face is TOPH rows; the rest of the 12-row step becomes
  // a front wall, made taller by elevation.
  function drawTilted(ox: number, oy: number): void {
    for (let ty = 0; ty < TY; ty++) {
      for (let tx = 0; tx < TX; tx++) {
        const k = at(tx, ty);
        if (k === 'void') continue;
        const e = ELEV[k];
        const bx = ox + tx * T;
        const topY = oy + ty * TOPH - e * 2;
        const wallH = TOPH - (ELEV[at(tx, ty + 1)] - e) * 2;
        fillTile(k, bx, topY, T, TOPH, ty * TX + tx, 0);
        for (let y = 0; y < Math.max(0, wallH - TOPH + 4 + e * 2); y++) {
          for (let x = 0; x < T; x++) {
            const wy = topY + TOPH + y;
            if (wy >= oy + TY * TOPH + 14) continue;
            term.put(bx + x, wy, y === 0 ? '▔' : (hash2(bx + x, wy, 71) < 0.4 ? '▒' : '░'), y === 0 ? PAL.wallLit : PAL.wall);
          }
        }
      }
      for (const id of towers) if (Math.floor(id / TX) === ty)
        drawPiece(st.tower, ox + (id % TX) * T, oy + ty * TOPH - ELEV[at(id % TX, ty)] * 2 - 4, PAL['tower.shadow']);
    }
  }

  // ------------------------------------------------------------- tile hand
  const HAND: { name: string; conn: string; rows: (x: number, y: number) => Kind }[] = [
    { name: 'straight', conn: 'W-E', rows: (_x, y) => (y >= 4 && y < 8 ? 'road' : 'ground') },
    { name: 'corner', conn: 'W-S', rows: (x, y) => ((y >= 4 && y < 8 && x < 8) || (x >= 4 && x < 8 && y >= 4) ? 'road' : 'ground') },
    { name: 'spur + spawn', conn: 'W-E-N', rows: (x, y) => ((y >= 4 && y < 8) || (x >= 4 && x < 8 && y < 8) ? 'road' : 'rock') },
  ];

  function drawHand(ox: number, oy: number): void {
    term.write(ox, oy - 2, 'place a tile  (every 2 waves)', PAL.accent);
    HAND.forEach((h, i) => {
      const cy = oy + i * 17;
      const w = T + 4;
      for (let x = 0; x < w; x++) { term.put(ox + x, cy, '─', i === 0 ? PAL.cardLit : PAL.card); term.put(ox + x, cy + 15, '─', i === 0 ? PAL.cardLit : PAL.card); }
      for (let y = 1; y < 15; y++) { term.put(ox, cy + y, '│', i === 0 ? PAL.cardLit : PAL.card); term.put(ox + w - 1, cy + y, '│', i === 0 ? PAL.cardLit : PAL.card); }
      term.put(ox, cy, '┌', PAL.card); term.put(ox + w - 1, cy, '┐', PAL.card);
      term.put(ox, cy + 15, '└', PAL.card); term.put(ox + w - 1, cy + 15, '┘', PAL.card);
      for (let y = 0; y < T; y++)
        for (let x = 0; x < T; x++) {
          const k = h.rows(x, y);
          const gx = ox + 2 + x, gy = cy + 2 + y;
          if (k === 'road') { if (hash2(gx, gy, 5) < 0.85) term.put(gx, gy, pick(G(st.terrain.road), gx, gy, 6), PAL.road); }
          else if (k === 'rock') { if (hash2(gx, gy, 8) < 0.75) term.put(gx, gy, pick(G(st.terrain.rock), gx, gy, 9), PAL.rock); }
          else if (hash2(gx, gy, 10) < 0.09) term.put(gx, gy, pick(G(st.terrain.ground), gx, gy, 11), PAL.groundDim);
        }
      // connector marks on the card edge — this is the legality rule, visible
      if (h.conn.includes('W')) term.write(ox, cy + 8, '╞', PAL.roadEdge);
      if (h.conn.includes('E')) term.write(ox + w - 1, cy + 8, '╡', PAL.roadEdge);
      if (h.conn.includes('N')) term.write(ox + 8, cy, '╨', PAL.roadEdge);
      if (h.conn.includes('S')) term.write(ox + 8, cy + 15, '╥', PAL.roadEdge);
      term.write(ox + 1, cy + 16, `${i + 1}. ${h.name}`, i === 0 ? PAL.text : PAL.dim);
      term.write(ox + w - 6, cy + 16, h.conn, PAL.dim);
    });
    term.write(ox, oy + 3 * 17 + 2, 'reroll  ·  2 recon', PAL.dim);
  }

  function frame(): void {
    term.clear(PAL.bg);
    term.write(0, 0, 'A · flat — mostly-void board, tile hand, legal placement ghosted', PAL.accent);
    term.write(0, 1, 'green stipple = legal positions · green outline = selected tile previewed · » = enemy entry', PAL.dim);
    drawFlat(0, 3);
    drawHand(114, 5);

    term.write(0, 68, 'B · tilted — same board, foreshortened ground plane + front walls', PAL.accent);
    term.write(0, 69, 'top face 12x8 per 12-cell tile · elevation raises the face and lengthens the wall', PAL.dim);
    drawTilted(0, 72);

    term.flush();
    (window as unknown as Record<string, unknown>).__screen = () => term.toText();
    requestAnimationFrame(frame);
  }
  note.textContent = 'tile-laying UI and tilted rendering — 1:1 at 8px cells';
  frame();
}

main().catch((e) => {
  document.getElementById('app')!.textContent = `failed: ${String(e)}`;
  console.error(e);
});
