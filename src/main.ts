/**
 * Character-set comparison.
 *
 * NOT the game. Renders the same tower, enemy and terrain under three glyph
 * vocabularies at the real target scale (unscii-8, 8x8 square cells, WebGL2,
 * 24-bit colour per cell) so the charset decision can be made by looking.
 *
 * Top row is 1:1 — exactly the size it will be in play.
 * Bottom row is the same towers at 3x, for judging detail.
 */
import { GLTerm } from './term/GLTerm';
import type { GlyphSet } from './term/GLTerm';

const BASE = import.meta.env.BASE_URL;
const load = <T>(p: string): Promise<T> => fetch(`${BASE}assets/${p}`).then((r) => r.json() as Promise<T>);

interface Piece { size: [number, number]; art: string[]; ink: string[] }
interface Style {
  label: string; blurb: string;
  terrain: Record<string, string[]>;
  tower: Piece; enemy: Piece;
}
interface Styles { inkMap: Record<string, string | null>; styles: Record<string, Style> }

const PAL: Record<string, string> = {
  'tower.shadow': '#11161d', 'tower.frame': '#5b6f86', 'tower.body': '#8298b0',
  'tower.edge': '#aec2d8', 'tower.core': '#f2f7ff',
  'enemy.body': '#8c3a3a', 'enemy.edge': '#e26060', 'enemy.eye': '#ffd166',
  'ground': '#27333f', 'groundDim': '#18202a', 'road': '#4a5b70', 'roadLit': '#71879f',
  'roadEdge': '#8299b3', 'rock': '#3b4653', 'rockCap': '#5d6e83', 'ore': '#e8b52a',
  'text': '#d3dae7', 'dim': '#65758a', 'accent': '#2ee6a0', 'bg': '#07090c',
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
    const art = p.art[r];
    const ink = p.ink[r] ?? '';
    for (let c = 0; c < art.length; c++) {
      const key = ink[c] ?? '.';
      const role = inkMap[key];
      if (!role) continue;
      const fg = role === 'PATH' ? PATH : (PAL[role] ?? '#ff00ff');
      t.put(x + c, y + r, art[c], fg, bg);
    }
  }
}

async function main(): Promise<void> {
  const [glyphs, data] = await Promise.all([load<GlyphSet>('glyphset.json'), load<Styles>('styles.json')]);
  const app = document.getElementById('app')!;

  const keys = Object.keys(data.styles);
  // Sized to fit a 1920-wide display without CSS scaling: scaling a bitmap
  // font defeats the entire point of using one.
  const PANEL_W = 74, PANEL_H = 46;
  const main1 = new GLTerm(glyphs, { cols: PANEL_W * 3 + 4, rows: PANEL_H, cellPx: 8, background: PAL.bg });
  const zoom = new GLTerm(glyphs, { cols: 70, rows: 13, cellPx: 24, background: PAL.bg });
  app.appendChild(main1.canvas);
  const gap = document.createElement('div'); gap.style.height = '10px'; app.appendChild(gap);
  app.appendChild(zoom.canvas);
  const note = document.createElement('div'); note.className = 'hud'; app.appendChild(note);

  // Report any glyph the font does not actually carry, rather than silently
  // dropping it — a missing block character would quietly flatter style A.
  const missing = new Set<string>();
  for (const k of keys) {
    const s = data.styles[k];
    for (const piece of [s.tower, s.enemy]) for (const row of piece.art) for (const ch of row) if (!main1.has(ch)) missing.add(ch);
    for (const set of Object.values(s.terrain)) for (const ch of set) if (!main1.has(ch)) missing.add(ch);
  }
  if (missing.size) console.warn('glyphs absent from unscii-8:', [...missing].join(' '));

  let tick = 0;
  function frame(): void {
    main1.clear(PAL.bg);
    zoom.clear(PAL.bg);

    keys.forEach((key, pi) => {
      const s = data.styles[key];
      const ox = pi * (PANEL_W + 2);

      main1.write(ox, 0, s.label, PAL.accent);
      main1.write(ox, 1, s.blurb.slice(0, PANEL_W), PAL.dim);

      // --- terrain: a road band across sparse ground, with rock and ore
      const top = 3, h = PANEL_H - 4;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < PANEL_W; x++) {
          const roadY = 20 + Math.round(Math.sin((x + pi * 3) * 0.09) * 5);
          const onRoad = y >= roadY && y < roadY + 6;
          const edge = onRoad && (y === roadY || y === roadY + 5);
          const rock = !onRoad && hash2((x / 6) | 0, (y / 4) | 0, 21) > 0.86;
          const sy = top + y;
          if (edge) {
            main1.put(ox + x, sy, pickG(s.terrain.roadEdge, x, y, 4), PAL.roadEdge);
          } else if (onRoad) {
            if (hash2(x, y, 5) < 0.9) {
              main1.put(ox + x, sy, pickG(s.terrain.road, x, y, 6), hash2(x, y, 7) < 0.15 ? PAL.roadLit : PAL.road);
            }
          } else if (rock) {
            const cap = hash2((x / 6) | 0, ((y - 1) / 4) | 0, 21) <= 0.86;
            main1.put(ox + x, sy, cap ? pickG(s.terrain.rockCap, x, y, 8) : pickG(s.terrain.rock, x, y, 9),
              cap ? PAL.rockCap : PAL.rock);
          } else if (hash2(x, y, 10) < 0.09) {
            main1.put(ox + x, sy, pickG(s.terrain.ground, x, y, 11),
              hash2(x, y, 12) < 0.5 ? PAL.groundDim : PAL.ground);
          }
          if (!onRoad && !rock && hash2(x, y, 13) > 0.995) {
            main1.put(ox + x, sy, s.terrain.ore[0], PAL.ore);
          }
        }
      }

      // --- towers flanking the road, and enemies walking it
      drawPiece(main1, s.tower, data.inkMap, ox + 8, top + 6, PAL['tower.shadow']);
      drawPiece(main1, s.tower, data.inkMap, ox + 44, top + 30, PAL['tower.shadow']);
      for (let e = 0; e < 4; e++) {
        const ex = ((tick * 0.4 + e * 19) % (PANEL_W + 8)) - 8;
        const roadY = 20 + Math.round(Math.sin((ex + pi * 3) * 0.09) * 5);
        drawPiece(main1, s.enemy, data.inkMap, ox + Math.round(ex), top + roadY, undefined);
      }

      // --- zoom strip
      const zx = pi * 26 + 2;
      drawPiece(zoom, s.tower, data.inkMap, zx, 1, PAL['tower.shadow']);
      zoom.write(zx, 12, key, PAL.dim);
    });

    main1.flush();
    zoom.flush();
    tick++;
    requestAnimationFrame(frame);
  }
  note.textContent = 'top: 1:1 at 8px cells (real in-game size) · bottom: same towers at 3x for detail';
  frame();
}

main().catch((e) => {
  document.getElementById('app')!.textContent = `failed: ${String(e)}`;
  console.error(e);
});
