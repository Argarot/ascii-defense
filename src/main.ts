/**
 * Placement-grid comparison.
 *
 * NOT the game. Three panels, identical terrain and towers, differing only in
 * whether placement is freeform, snapped to a square grid, or snapped to hexes.
 * The question being tested: does an explicit grid make tower footprints and
 * buildable space self-evident, or does it just clutter the board?
 *
 * Grid chrome uses box-drawing glyphs. That is consistent with the charset
 * rule: blocks and box-drawing are UI, never entity art.
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
  grid: '#243447', gridLit: '#3d5570', text: '#d3dae7', dim: '#65758a',
  accent: '#2ee6a0', bg: '#07090c',
};
const PATH = '#4cc9f0';

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

/** Straight line between two cells, drawn with a fixed glyph. */
function line(t: GLTerm, x0: number, y0: number, x1: number, y1: number, ch: string, col: string): void {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let i = 0; i <= steps; i++) {
    const x = Math.round(x0 + ((x1 - x0) * i) / steps);
    const y = Math.round(y0 + ((y1 - y0) * i) / steps);
    t.put(x, y, ch, col);
  }
}

/** Flat-top hex outline: half-width 6, half-height 4. Tiles at dx=9, dy=8. */
function hex(t: GLTerm, cx: number, cy: number, col: string): void {
  line(t, cx - 3, cy - 4, cx + 3, cy - 4, '─', col);
  line(t, cx - 3, cy + 4, cx + 3, cy + 4, '─', col);
  line(t, cx - 6, cy, cx - 4, cy - 3, '/', col);
  line(t, cx - 6, cy, cx - 4, cy + 3, '\\', col);
  line(t, cx + 6, cy, cx + 4, cy - 3, '\\', col);
  line(t, cx + 6, cy, cx + 4, cy + 3, '/', col);
}

async function main(): Promise<void> {
  const [glyphs, data] = await Promise.all([load<GlyphSet>('glyphset.json'), load<Styles>('styles.json')]);
  const style = data.styles.extended; // the palette you picked
  const app = document.getElementById('app')!;

  const PW = 74, PH = 50;
  const term = new GLTerm(glyphs, { cols: PW * 3 + 4, rows: PH, cellPx: 8, background: PAL.bg });
  app.appendChild(term.canvas);
  const note = document.createElement('div');
  note.className = 'hud';
  app.appendChild(note);

  const MODES = [
    { key: 'none', label: 'A. no grid (freeform)', blurb: 'what we have now. placement rules are invisible' },
    { key: 'square', label: 'B. square placement grid', blurb: 'towers snap to 12x10 tiles. footprint is explicit' },
    { key: 'hex', label: 'C. hex placement grid', blurb: '6 neighbours. rectangular sprites do not fit hexes' },
  ] as const;

  const top = 3, mapH = PH - 5;
  const roadY = (x: number): number => 26 + Math.round(Math.sin(x * 0.07) * 6);

  let tick = 0;
  function frame(): void {
    term.clear(PAL.bg);

    MODES.forEach((mode, pi) => {
      const ox = pi * (PW + 2);
      term.write(ox, 0, mode.label, PAL.accent);
      term.write(ox, 1, mode.blurb, PAL.dim);

      // terrain
      for (let y = 0; y < mapH; y++) {
        for (let x = 0; x < PW; x++) {
          const ry = roadY(x), onRoad = y >= ry && y < ry + 6;
          const sy = top + y;
          if (onRoad) {
            if (y === ry || y === ry + 5) term.put(ox + x, sy, pickG(style.terrain.roadEdge, x, y, 4), PAL.roadEdge);
            else if (hash2(x, y, 5) < 0.9) term.put(ox + x, sy, pickG(style.terrain.road, x, y, 6), hash2(x, y, 7) < 0.15 ? PAL.roadLit : PAL.road);
          } else if (hash2((x / 6) | 0, (y / 4) | 0, 21) > 0.9) {
            term.put(ox + x, sy, pickG(style.terrain.rock, x, y, 9), PAL.rock);
          } else if (hash2(x, y, 10) < 0.08) {
            term.put(ox + x, sy, pickG(style.terrain.ground, x, y, 11), hash2(x, y, 12) < 0.5 ? PAL.groundDim : PAL.ground);
          }
        }
      }

      // grid chrome, drawn only where you could actually build
      if (mode.key === 'square') {
        for (let gy = 0; gy + 10 <= mapH; gy += 10) {
          for (let gx = 0; gx + 12 <= PW; gx += 12) {
            const ry = roadY(gx + 6);
            const blocked = gy + 10 > ry && gy < ry + 6;
            const col = blocked ? PAL.grid : PAL.gridLit;
            for (let i = 1; i < 12; i++) { term.put(ox + gx + i, top + gy, '─', col); term.put(ox + gx + i, top + gy + 9, '─', col); }
            for (let i = 1; i < 9; i++) { term.put(ox + gx, top + gy + i, '│', col); term.put(ox + gx + 11, top + gy + i, '│', col); }
            term.put(ox + gx, top + gy, '┌', col); term.put(ox + gx + 11, top + gy, '┐', col);
            term.put(ox + gx, top + gy + 9, '└', col); term.put(ox + gx + 11, top + gy + 9, '┘', col);
          }
        }
      } else if (mode.key === 'hex') {
        for (let c = 0; c * 9 + 12 < PW + 6; c++) {
          for (let r = 0; r * 8 + 8 < mapH; r++) {
            const cx = ox + 6 + c * 9, cy = top + 5 + r * 8 + (c % 2) * 4;
            const ry = roadY(6 + c * 9);
            const blocked = cy - top + 4 > ry && cy - top - 4 < ry + 6;
            hex(term, cx, cy, blocked ? PAL.grid : PAL.gridLit);
          }
        }
      }

      // towers, snapped per mode
      const spots: [number, number][] = mode.key === 'square'
        ? [[12, 0], [36, 10], [24, 30], [48, 30]]
        : mode.key === 'hex'
          ? [[9, 2], [33, 6], [24, 34], [51, 30]]
          : [[13, 3], [37, 12], [25, 32], [49, 31]];
      for (const [sx, sy] of spots) drawPiece(term, style.tower, data.inkMap, ox + sx, top + sy, PAL['tower.shadow']);

      // enemies on the road
      for (let e = 0; e < 3; e++) {
        const ex = Math.round(((tick * 0.35 + e * 24) % (PW + 8)) - 8);
        drawPiece(term, style.enemy, data.inkMap, ox + ex, top + roadY(ex), undefined);
      }
    });

    term.write(0, PH - 1, 'all three use the Stone Story palette. grid chrome is box-drawing = UI only, never entity art.', PAL.dim);
    term.flush();
    (window as unknown as Record<string, unknown>).__screen = () => term.toText();
    tick++;
    requestAnimationFrame(frame);
  }
  note.textContent = 'placement grid comparison — 1:1 at 8px cells';
  frame();
}

main().catch((e) => {
  document.getElementById('app')!.textContent = `failed: ${String(e)}`;
  console.error(e);
});
