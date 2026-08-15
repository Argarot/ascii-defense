/**
 * Mini-tile board: 5x5-cell tiles, no block glyphs, colour-only shading.
 *
 * NOT the game. Feedback implemented:
 *   - Blocks removed from terrain entirely. Fill comes from the classic ASCII
 *     luminance ramp (glyph by density) and tone comes from colour.
 *   - Shading is per-row colour on the boundary of a terrain mass. No geometry,
 *     no walls, no occlusion.
 *   - Tiles down from 7x7 to 5x5, so the board holds ~4x more tiles at the same
 *     cell size. Towers are correspondingly simpler and lean on glyph shape and
 *     path colour for identity.
 *
 * Exposes window.__png() so the real rendered pixels can be captured, rather
 * than re-typeset into a different font elsewhere.
 */
import { GLTerm } from './term/GLTerm';
import type { GlyphSet } from './term/GLTerm';

const BASE = import.meta.env.BASE_URL;
const load = <T>(p: string): Promise<T> => fetch(`${BASE}assets/${p}`).then((r) => r.json() as Promise<T>);

interface Piece { art: string[]; ink: string[] }
interface Shade { ramp: string[]; top: string; mid: string; bot: string }
interface Tiles {
  tile: number;
  inkMap: Record<string, string | null>;
  towers: Record<string, Piece>;
  enemy: Piece;
  terrain: Record<string, Shade>;
}

const PAL: Record<string, string> = {
  'tower.shadow': '#0c1017', 'tower.frame': '#6f8299', 'tower.body': '#93a8bf',
  'tower.edge': '#bccfe2', 'tower.core': '#ffffff',
  'enemy.body': '#933d3d', 'enemy.edge': '#e86868', 'enemy.eye': '#ffd166',
  frontier: '#1c3529', frontierLit: '#3f7256',
  card: '#33475e', cardLit: '#8aa0b8', shadow: '#070a0e',
  text: '#d3dae7', dim: '#65758a', accent: '#2ee6a0', bg: '#04060a',
};
const PATHS = ['#4cc9f0', '#ffb703', '#c08cff', '#5ce68c'];

const TX = 42, TY = 21;
type Kind = 'void' | 'ground' | 'road' | 'rock' | 'ore' | 'spawn';

function hash2(x: number, y: number, s: number): number {
  let h = (x | 0) * 374761393 + (y | 0) * 668265263 + s * 2246822519;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

async function main(): Promise<void> {
  const [glyphs, T] = await Promise.all([load<GlyphSet>('glyphset.json'), load<Tiles>('tiles.json')]);
  const S = T.tile;
  const app = document.getElementById('app')!;
  const COLS = TX * S + 16, ROWS = TY * S + 5;
  const term = new GLTerm(glyphs, { cols: COLS, rows: ROWS, cellPx: 8, background: PAL.bg });
  app.appendChild(term.canvas);
  const note = document.createElement('div');
  note.className = 'hud';
  app.appendChild(note);

  const tiles: Kind[] = new Array(TX * TY).fill('void');
  const at = (x: number, y: number): Kind => (x < 0 || y < 0 || x >= TX || y >= TY ? 'void' : tiles[y * TX + x]);
  const set = (x: number, y: number, k: Kind): void => { if (x >= 0 && y >= 0 && x < TX && y < TY) tiles[y * TX + x] = k; };
  {
    let cx = 1, cy = 11;
    set(0, 11, 'spawn');
    const spine: [number, number][] = [];
    for (let i = 0; i < 78; i++) {
      spine.push([cx, cy]);
      set(cx, cy, 'road');
      const r = hash2(i, 7, 3);
      if (i < 18) { cx++; if (r < 0.28 && cy > 3) cy--; else if (r > 0.76 && cy < TY - 4) cy++; }
      else if (i < 30) { cy--; if (r > 0.55) cx++; }
      else if (i < 46) { cx++; if (r < 0.3 && cy < TY - 4) cy++; }
      else if (i < 58) { cy++; if (r > 0.6) cx++; }
      else { cx++; if (r < 0.3 && cy > 3) cy--; }
      cx = Math.min(TX - 2, cx); cy = Math.max(1, Math.min(TY - 2, cy));
    }
    for (const [rx, ry] of spine)
      for (let dy = -2; dy <= 2; dy++)
        for (let dx = -2; dx <= 2; dx++) {
          if (at(rx + dx, ry + dy) !== 'void') continue;
          const h = hash2(rx + dx, ry + dy, 11);
          const near = Math.abs(dx) <= 1 && Math.abs(dy) <= 1;
          if (h > 0.91) set(rx + dx, ry + dy, 'rock');
          else if (h < 0.06) set(rx + dx, ry + dy, 'ore');
          else if (near || h < 0.45) set(rx + dx, ry + dy, 'ground');
        }
  }
  const towerKeys = Object.keys(T.towers);
  const towers: { id: number; kind: string; path: number }[] = [];
  for (let i = 0; i < tiles.length && towers.length < 34; i++)
    if (tiles[i] === 'ground' && hash2(i, 5, 23) > 0.70)
      towers.push({ id: i, kind: towerKeys[towers.length % towerKeys.length], path: towers.length % PATHS.length });
  const placed = tiles.filter((k) => k !== 'void').length;

  const frontier = new Set<number>();
  for (let y = 0; y < TY; y++)
    for (let x = 0; x < TX; x++)
      if (at(x, y) === 'void' && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => at(x + dx, y + dy) !== 'void'))
        frontier.add(y * TX + x);

  function drawPiece(p: Piece, x: number, y: number, path: string, bg?: string): void {
    for (let r = 0; r < p.art.length; r++)
      for (let c = 0; c < p.art[r].length; c++) {
        const role = T.inkMap[(p.ink[r] ?? '')[c] ?? '.'];
        if (!role) continue;
        term.put(x + c, y + r, p.art[r][c], role === 'PATH' ? path : (PAL[role] ?? '#f0f'), bg);
      }
  }

  const OY = 3;
  function frame(): void {
    term.clear(PAL.bg);
    term.write(0, 0, `mini tiles — ${S}x${S} cells (${S * 8}x${S * 8} px) · board ${TX}x${TY} = ${TX * TY} slots · ${placed} placed · ${towers.length} towers`, PAL.accent);
    term.write(0, 1, 'no block glyphs. terrain is the ASCII luminance ramp; shading is colour only, applied at the edge of a terrain mass.', PAL.dim);

    for (let ty = 0; ty < TY; ty++) {
      for (let tx = 0; tx < TX; tx++) {
        const k = at(tx, ty);
        const bx = tx * S, by = OY + ty * S;
        if (k === 'void') {
          if (frontier.has(ty * TX + tx))
            for (let y = 0; y < S; y++) for (let x = 0; x < S; x++)
              if (hash2(bx + x, by + y, 33) < 0.06)
                term.put(bx + x, by + y, '·', hash2(bx + x, by + y, 34) < 0.3 ? PAL.frontierLit : PAL.frontier);
          continue;
        }
        const sh = T.terrain[k];
        const openTop = at(tx, ty - 1) !== k;
        const openBot = at(tx, ty + 1) !== k;
        for (let y = 0; y < S; y++) {
          for (let x = 0; x < S; x++) {
            const g = sh.ramp[Math.floor(hash2(bx + x, by + y, 6) * sh.ramp.length) % sh.ramp.length];
            if (g === ' ') continue;
            const col = (y === 0 && openTop) ? sh.top : (y === S - 1 && openBot) ? sh.bot : sh.mid;
            term.put(bx + x, by + y, g, col);
          }
        }
      }
    }

    for (const t of towers) {
      const tx = t.id % TX, ty = (t.id / TX) | 0;
      const bx = tx * S, by = OY + ty * S;
      for (let x = 0; x < S; x++) term.put(bx + x, by + S, '_', PAL.shadow);
      drawPiece(T.towers[t.kind], bx, by, PATHS[t.path], PAL['tower.shadow']);
    }

    let n = 0;
    for (let y = 0; y < TY && n < 60; y++)
      for (let x = 0; x < TX && n < 60; x++)
        if (at(x, y) === 'road' && hash2(x, y, 51) > 0.70) { drawPiece(T.enemy, x * S + 1, OY + y * S + 1, '#fff'); n++; }

    // hand
    const hx = TX * S + 2;
    term.write(hx, OY - 1, 'place', PAL.accent);
    const kinds: Kind[] = ['road', 'ground', 'rock'];
    kinds.forEach((k, i) => {
      const cy = OY + 1 + i * (S + 4);
      const sh = T.terrain[k];
      for (let x = 0; x < S + 2; x++) { term.put(hx + x, cy, '-', i === 0 ? PAL.cardLit : PAL.card); term.put(hx + x, cy + S + 1, '-', i === 0 ? PAL.cardLit : PAL.card); }
      for (let y = 1; y <= S; y++) { term.put(hx, cy + y, '|', i === 0 ? PAL.cardLit : PAL.card); term.put(hx + S + 1, cy + y, '|', i === 0 ? PAL.cardLit : PAL.card); }
      for (let y = 0; y < S; y++)
        for (let x = 0; x < S; x++) {
          const g = sh.ramp[Math.floor(hash2(x + i * 9, y, 6) * sh.ramp.length) % sh.ramp.length];
          if (g !== ' ') term.put(hx + 1 + x, cy + 1 + y, g, y === 0 ? sh.top : y === S - 1 ? sh.bot : sh.mid);
        }
      term.write(hx, cy + S + 2, `${i + 1}.${k.slice(0, 4)}`, i === 0 ? PAL.text : PAL.dim);
    });

    term.write(0, ROWS - 1, 'towers 5x5, four families distinguished by shape and path colour · enemies 3x2', PAL.dim);
    term.flush();
    (window as unknown as Record<string, unknown>).__screen = () => term.toText();
    requestAnimationFrame(frame);
  }

  // Capture the real pixels, flipped (readPixels is bottom-up).
  (window as unknown as Record<string, unknown>).__png = (): string => {
    const gl = (term.canvas.getContext('webgl2') as WebGL2RenderingContext);
    const w = term.canvas.width, h = term.canvas.height;
    const px = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const out = document.createElement('canvas');
    out.width = w; out.height = h;
    const c2 = out.getContext('2d')!;
    const img = c2.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      const src = (h - 1 - y) * w * 4, dst = y * w * 4;
      img.data.set(px.subarray(src, src + w * 4), dst);
    }
    c2.putImageData(img, 0, 0);
    return out.toDataURL('image/png');
  };

  note.textContent = `mini tile board — ${TX}x${TY} tiles at ${S}x${S} cells, 1:1 at 8px`;
  frame();
}

main().catch((e) => {
  document.getElementById('app')!.textContent = `failed: ${String(e)}`;
  console.error(e);
});
