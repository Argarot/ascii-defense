/**
 * Compact tile board — the scale a real level actually runs at.
 *
 * NOT the game. Implements three pieces of feedback:
 *   1. Pseudo-3D dropped. Depth comes from shading only: a lit top row, a dark
 *      bottom row, and a drop shadow under towers. No occlusion, no projection
 *      layer, no doubled art.
 *   2. Much larger map. 7x7-cell tiles on a 30x16 board = 480 tile slots,
 *      against 45 in the previous mock.
 *   3. Terrain fill uses the block ramp. Measured: cells are geometrically
 *      square (canvas scale 1.001 x 1.002), but unscii letterform ink is about
 *      5x7 inside an 8x8 box, so punctuation-only terrain reads taller than it
 *      is. Block glyphs fill the cell edge to edge and fix the proportion.
 */
import { GLTerm } from './term/GLTerm';
import type { GlyphSet } from './term/GLTerm';

const BASE = import.meta.env.BASE_URL;
const load = <T>(p: string): Promise<T> => fetch(`${BASE}assets/${p}`).then((r) => r.json() as Promise<T>);

interface Piece { size: [number, number]; art: string[]; ink: string[] }
interface Shade { fill: string[]; top: string; mid: string; bot: string }
interface Tiles {
  tile: number;
  inkMap: Record<string, string | null>;
  tower: Piece; enemy: Piece;
  terrain: Record<string, Shade>;
}

const PAL: Record<string, string> = {
  'tower.shadow': '#0d1219', 'tower.frame': '#66798f', 'tower.body': '#8ea3ba',
  'tower.edge': '#b8cade', 'tower.core': '#f2f7ff',
  'enemy.body': '#8c3a3a', 'enemy.edge': '#e26060', 'enemy.eye': '#ffd166',
  frontier: '#1f3a2c', frontierLit: '#3c6b51', ghost: '#2ee6a0',
  card: '#33475e', cardLit: '#8aa0b8', shadow: '#080b0f',
  text: '#d3dae7', dim: '#65758a', accent: '#2ee6a0', bg: '#05070a',
};
const PATH = '#4cc9f0';

const TX = 30, TY = 16;
type Kind = 'void' | 'ground' | 'road' | 'rock' | 'ore' | 'spawn';

function hash2(x: number, y: number, s: number): number {
  let h = (x | 0) * 374761393 + (y | 0) * 668265263 + s * 2246822519;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const pick = (a: string[], x: number, y: number, s: number): string =>
  a[Math.floor(hash2(x, y, s) * a.length) % a.length];

async function main(): Promise<void> {
  const [glyphs, T] = await Promise.all([load<GlyphSet>('glyphset.json'), load<Tiles>('tiles.json')]);
  const S = T.tile;
  const app = document.getElementById('app')!;
  const HAND_W = 13;
  const COLS = TX * S + HAND_W + 3, ROWS = TY * S + 5;
  const term = new GLTerm(glyphs, { cols: COLS, rows: ROWS, cellPx: 8, background: PAL.bg });
  app.appendChild(term.canvas);
  const note = document.createElement('div');
  note.className = 'hud';
  app.appendChild(note);

  // ------------------------------------------------------------- build a map
  const tiles: Kind[] = new Array(TX * TY).fill('void');
  const at = (x: number, y: number): Kind => (x < 0 || y < 0 || x >= TX || y >= TY ? 'void' : tiles[y * TX + x]);
  const set = (x: number, y: number, k: Kind): void => { if (x >= 0 && y >= 0 && x < TX && y < TY) tiles[y * TX + x] = k; };
  {
    // A road that wanders right, then doubles back — the kind of shape a player
    // builds when lengthening the path deliberately.
    let cx = 1, cy = 8;
    set(0, 8, 'spawn');
    const steps: [number, number][] = [];
    for (let i = 0; i < 46; i++) {
      steps.push([cx, cy]);
      set(cx, cy, 'road');
      const r = hash2(i, 7, 3);
      if (i < 14) { cx++; if (r < 0.3 && cy > 2) cy--; else if (r > 0.75 && cy < TY - 3) cy++; }
      else if (i < 24) { cy--; if (r > 0.6) cx++; }
      else if (i < 34) { cx++; if (r < 0.35 && cy < TY - 3) cy++; }
      else { cy++; if (r > 0.65) cx++; }
      cx = Math.min(TX - 2, cx); cy = Math.max(1, Math.min(TY - 2, cy));
    }
    for (const [rx, ry] of steps) {
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]] as const) {
        if (at(rx + dx, ry + dy) !== 'void') continue;
        const h = hash2(rx + dx, ry + dy, 11);
        if (h > 0.90) set(rx + dx, ry + dy, 'rock');
        else if (h < 0.07) set(rx + dx, ry + dy, 'ore');
        else if (h < 0.62) set(rx + dx, ry + dy, 'ground');
      }
    }
  }
  const towers: number[] = [];
  for (let i = 0; i < tiles.length && towers.length < 14; i++)
    if (tiles[i] === 'ground' && hash2(i, 5, 23) > 0.62) towers.push(i);
  const placed = tiles.filter((k) => k !== 'void').length;

  const frontier = new Set<number>();
  for (let y = 0; y < TY; y++)
    for (let x = 0; x < TX; x++)
      if (at(x, y) === 'void' && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => at(x + dx, y + dy) !== 'void'))
        frontier.add(y * TX + x);

  function drawPiece(p: Piece, x: number, y: number, bg?: string): void {
    for (let r = 0; r < p.art.length; r++)
      for (let c = 0; c < p.art[r].length; c++) {
        const role = T.inkMap[(p.ink[r] ?? '')[c] ?? '.'];
        if (!role) continue;
        term.put(x + c, y + r, p.art[r][c], role === 'PATH' ? PATH : (PAL[role] ?? '#f0f'), bg);
      }
  }

  const OX = 0, OY = 3;
  function frame(): void {
    term.clear(PAL.bg);
    term.write(0, 0, `compact tiles — ${S}x${S} cells (${S * 8}x${S * 8} px) · board ${TX}x${TY} = ${TX * TY} slots · ${placed} placed`, PAL.accent);
    term.write(0, 1, 'depth is shading only: lit top row, dark bottom row, drop shadow under towers. no walls, no occlusion.', PAL.dim);

    for (let ty = 0; ty < TY; ty++) {
      for (let tx = 0; tx < TX; tx++) {
        const k = at(tx, ty);
        const bx = OX + tx * S, by = OY + ty * S;
        if (k === 'void') {
          if (frontier.has(ty * TX + tx))
            for (let y = 0; y < S; y++) for (let x = 0; x < S; x++)
              if (hash2(bx + x, by + y, 33) < 0.07)
                term.put(bx + x, by + y, '·', hash2(bx + x, by + y, 34) < 0.25 ? PAL.frontierLit : PAL.frontier);
          continue;
        }
        const sh = T.terrain[k];
        // Same-kind neighbours suppress the lit/dark banding, so shading marks
        // the boundary of a terrain mass rather than every tile edge.
        const openTop = at(tx, ty - 1) !== k;
        const openBot = at(tx, ty + 1) !== k;
        for (let y = 0; y < S; y++) {
          for (let x = 0; x < S; x++) {
            const g = pick(sh.fill, bx + x, by + y, 6);
            if (g === ' ') continue;
            const col = (y === 0 && openTop) ? sh.top : (y >= S - 1 && openBot) ? sh.bot : sh.mid;
            term.put(bx + x, by + y, g, col);
          }
        }
      }
    }

    for (const id of towers) {
      const tx = id % TX, ty = (id / TX) | 0;
      const bx = OX + tx * S, by = OY + ty * S;
      for (let x = 0; x < S; x++) term.put(bx + x, by + S, '▁', PAL.shadow); // drop shadow
      drawPiece(T.tower, bx, by, PAL['tower.shadow']);
    }

    // Enemies on the road, sized to the new scale.
    let n = 0;
    for (let y = 0; y < TY && n < 40; y++)
      for (let x = 0; x < TX && n < 40; x++)
        if (at(x, y) === 'road' && hash2(x, y, 51) > 0.72) {
          drawPiece(T.enemy, OX + x * S + 2, OY + y * S + 2);
          n++;
        }

    // Hand
    const hx = TX * S + 3;
    term.write(hx, OY - 1, 'place', PAL.accent);
    for (let i = 0; i < 3; i++) {
      const cy = OY + 1 + i * (S + 4);
      for (let x = 0; x < S + 2; x++) { term.put(hx + x, cy, '─', i === 0 ? PAL.cardLit : PAL.card); term.put(hx + x, cy + S + 1, '─', i === 0 ? PAL.cardLit : PAL.card); }
      for (let y = 1; y <= S; y++) { term.put(hx, cy + y, '│', i === 0 ? PAL.cardLit : PAL.card); term.put(hx + S + 1, cy + y, '│', i === 0 ? PAL.cardLit : PAL.card); }
      const kinds: Kind[] = ['road', 'ground', 'rock'];
      const sh = T.terrain[kinds[i]];
      for (let y = 0; y < S; y++)
        for (let x = 0; x < S; x++) {
          const g = pick(sh.fill, x + i * 9, y, 6);
          if (g !== ' ') term.put(hx + 1 + x, cy + 1 + y, g, y === 0 ? sh.top : y === S - 1 ? sh.bot : sh.mid);
        }
      term.put(hx, cy + 4, '╞', PAL['tower.edge']);
      if (i !== 2) term.put(hx + S + 1, cy + 4, '╡', PAL['tower.edge']);
      term.write(hx, cy + S + 2, `${i + 1}.${kinds[i].slice(0, 5)}`, i === 0 ? PAL.text : PAL.dim);
    }

    term.write(0, ROWS - 1, 'towers are 7x7 · enemies 3x3 · a full run would fill several boards this size', PAL.dim);
    term.flush();
    (window as unknown as Record<string, unknown>).__screen = () => term.toText();
    requestAnimationFrame(frame);
  }
  note.textContent = `compact tile board — ${TX}x${TY} tiles at ${S}x${S} cells, 1:1 at 8px`;
  frame();
}

main().catch((e) => {
  document.getElementById('app')!.textContent = `failed: ${String(e)}`;
  console.error(e);
});
