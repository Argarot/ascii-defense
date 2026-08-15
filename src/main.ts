/**
 * Cell-size comparison at 5x5-cell terrain tiles.
 *
 * One shared tile map, rendered three times into panels of identical physical
 * size, differing only in how many glyphs make up a cell:
 *
 *   A  cell = 5x5 glyphs  -> tile 25 glyphs = 200 px  ->  9x6 = 54 tiles on 1920x1200
 *   B  cell = 4x4 glyphs  -> tile 20 glyphs = 160 px  -> 12x7 = 84 tiles
 *   C  cell = 3x3 glyphs  -> tile 15 glyphs = 120 px  -> 16x10 = 160 tiles
 *
 * Panels are the same glyph dimensions, so the difference you see is real
 * relative density, not a zoom.
 */
import { GLTerm } from './term/GLTerm';
import type { GlyphSet } from './term/GLTerm';

const BASE = import.meta.env.BASE_URL;
const load = <T>(p: string): Promise<T> => fetch(`${BASE}assets/${p}`).then((r) => r.json() as Promise<T>);

interface TileDef { id: string; name: string; conn: string[]; cells: string[] }
interface TileDefs { tiles: TileDef[] }
interface Piece { art: string[]; ink: string[] }
interface Art {
  inkMap: Record<string, string | null>;
  towers: Record<string, Record<string, Piece>>;
  enemies: Record<string, Piece>;
}

const PAL: Record<string, string> = {
  'tower.frame': '#7286a0', 'tower.body': '#98adc4', 'tower.core': '#ffffff',
  'enemy.body': '#a04545', 'enemy.edge': '#f07070', 'enemy.eye': '#ffd166',
  text: '#d3dae7', dim: '#65758a', accent: '#2ee6a0', bg: '#000000',
};
const PATHS = ['#4cc9f0', '#ffb703', '#c08cff', '#5ce68c'];

const TERRAIN: Record<string, { ramp: string[]; fg: string; fgLit: string; bg: string }> = {
  G: { ramp: [' ', ' ', ' ', '·', "'", '`', ','], fg: '#3d4f61', fgLit: '#54687d', bg: '#141c25' },
  R: { ramp: [':', ';', ':', '·', '='], fg: '#93abc4', fgLit: '#c2d6ea', bg: '#333f4d' },
  K: { ramp: ['#', '%', '@', '&'], fg: '#5a6a7c', fgLit: '#8698ab', bg: '#1b232c' },
  O: { ramp: ['¤', '*', '·', '¤'], fg: '#ffd15c', fgLit: '#fff0b0', bg: '#2a2415' },
  S: { ramp: ['»', '»', ':', '·'], fg: '#ff9090', fgLit: '#ffd0d0', bg: '#331a1a' },
};

const TC = 5;              // cells per tile edge — agreed
const MAPX = 10, MAPY = 8; // logical map, in tiles
const PANEL = 75;          // panel size in glyphs, identical for all three
const DIRS = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] } as const;
const OPP: Record<string, string> = { n: 's', s: 'n', e: 'w', w: 'e' };

function hash2(x: number, y: number, s: number): number {
  let h = (x | 0) * 374761393 + (y | 0) * 668265263 + s * 2246822519;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Shrink a 7x7 authored tile to 5x5 by sampling — keeps the library usable. */
function to5(cells: string[]): string[] {
  const out: string[] = [];
  for (let y = 0; y < TC; y++) {
    let row = '';
    for (let x = 0; x < TC; x++) {
      const sy = Math.min(6, Math.round((y * 6) / (TC - 1)));
      const sx = Math.min(6, Math.round((x * 6) / (TC - 1)));
      row += cells[sy][sx];
    }
    out.push(row);
  }
  return out;
}

async function main(): Promise<void> {
  const [glyphs, defs, art] = await Promise.all([
    load<GlyphSet>('glyphset.json'),
    load<TileDefs>('tiledefs.json'),
    load<Art>('tiles.json'),
  ]);
  const lib = defs.tiles.map((t) => ({ ...t, cells: to5(t.cells) }));
  const byId = new Map(lib.map((t) => [t.id, t]));

  const app = document.getElementById('app')!;
  const term = new GLTerm(glyphs, { cols: PANEL * 3 + 8, rows: PANEL + 6, cellPx: 8, background: PAL.bg });
  app.appendChild(term.canvas);
  const note = document.createElement('div');
  note.className = 'hud';
  app.appendChild(note);

  // ---- one shared map, laid by connector matching
  const board: (typeof lib[0] | null)[] = new Array(MAPX * MAPY).fill(null);
  const get = (x: number, y: number) => (x < 0 || y < 0 || x >= MAPX || y >= MAPY ? null : board[y * MAPX + x]);
  {
    let x = 0, y = 3;
    board[y * MAPX + x] = byId.get('spawn_e')!;
    let exit = 'e';
    for (let step = 0; step < 40; step++) {
      const [dx, dy] = DIRS[exit as keyof typeof DIRS];
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= MAPX || ny >= MAPY || get(nx, ny)) break;
      const entry = OPP[exit];
      const cands = lib.filter((t) => t.id !== 'spawn_e' && t.conn.includes(entry));
      if (!cands.length) break;
      const d = cands[Math.floor(hash2(nx, ny, step + 5) * cands.length) % cands.length];
      board[ny * MAPX + nx] = d;
      const exits = d.conn.filter((c) => c !== entry);
      exit = exits[Math.floor(hash2(nx, ny, step + 90) * exits.length) % exits.length];
      x = nx; y = ny;
    }
  }
  const laid = board.filter(Boolean).length;

  const towerKeys = ['bolt', 'mortar', 'frost', 'refinery'];
  const towers: { tx: number; ty: number; cx: number; cy: number; k: string; p: number }[] = [];
  for (let ty = 0; ty < MAPY; ty++)
    for (let tx = 0; tx < MAPX; tx++) {
      const d = get(tx, ty);
      if (!d) continue;
      for (let cy = 0; cy < TC; cy++)
        for (let cx = 0; cx < TC; cx++)
          if (d.cells[cy][cx] === 'G' && hash2(tx * 100 + cx, ty * 100 + cy, 41) > 0.72)
            towers.push({ tx, ty, cx, cy, k: towerKeys[towers.length % 4], p: towers.length % 4 });
    }

  function drawPanel(ox: number, oy: number, Gp: number, label: string): void {
    const TG = TC * Gp;
    const tilesAcross = Math.ceil(PANEL / TG);
    term.write(ox, oy - 3, label, PAL.accent);
    term.write(ox, oy - 2, `tile ${TG}px · ${Math.floor(1920 / (TG * 8))}x${Math.floor(1150 / (TG * 8))} = ${Math.floor(1920 / (TG * 8)) * Math.floor(1150 / (TG * 8))} tiles on a 1920x1200 screen`, PAL.dim);

    for (let ty = 0; ty < tilesAcross; ty++) {
      for (let tx = 0; tx < tilesAcross; tx++) {
        const d = get(tx, ty);
        if (!d) continue;
        for (let cy = 0; cy < TC; cy++)
          for (let cx = 0; cx < TC; cx++) {
            const t = TERRAIN[d.cells[cy][cx]] ?? TERRAIN.G;
            for (let y = 0; y < Gp; y++)
              for (let x = 0; x < Gp; x++) {
                const gx = tx * TG + cx * Gp + x, gy = ty * TG + cy * Gp + y;
                if (gx >= PANEL || gy >= PANEL) continue;
                const g = t.ramp[Math.floor(hash2(gx + ox, gy, 6) * t.ramp.length) % t.ramp.length];
                term.put(ox + gx, oy + gy, g, hash2(gx + ox, gy, 9) < 0.18 ? t.fgLit : t.fg, t.bg);
              }
          }
      }
    }

    const tArt = art.towers[String(Gp)];
    for (const tw of towers) {
      const gx = tw.tx * TG + tw.cx * Gp, gy = tw.ty * TG + tw.cy * Gp;
      if (gx + Gp > PANEL || gy + Gp > PANEL) continue;
      const p = tArt[tw.k];
      for (let r = 0; r < p.art.length; r++)
        for (let c = 0; c < p.art[r].length; c++) {
          const role = art.inkMap[(p.ink[r] ?? '')[c] ?? '.'];
          if (!role) continue;
          term.put(ox + gx + c, oy + gy + r, p.art[r][c], role === 'PATH' ? PATHS[tw.p] : (PAL[role] ?? '#f0f'), '#0c1017');
        }
    }

    const eArt = art.enemies[String(Gp)];
    let n = 0;
    for (let ty = 0; ty < tilesAcross && n < 24; ty++)
      for (let tx = 0; tx < tilesAcross && n < 24; tx++) {
        const d = get(tx, ty);
        if (!d) continue;
        for (let cy = 0; cy < TC && n < 24; cy++)
          for (let cx = 0; cx < TC && n < 24; cx++)
            if (d.cells[cy][cx] === 'R' && hash2(tx * 77 + cx, ty * 77 + cy, 61) > 0.68) {
              const gx = tx * TG + cx * Gp, gy = ty * TG + cy * Gp;
              if (gx + 3 > PANEL || gy + eArt.art.length > PANEL) continue;
              for (let r = 0; r < eArt.art.length; r++)
                for (let c = 0; c < eArt.art[r].length; c++) {
                  const role = art.inkMap[(eArt.ink[r] ?? '')[c] ?? '.'];
                  if (role) term.put(ox + gx + c, oy + gy + r, eArt.art[r][c], PAL[role] ?? '#f0f', TERRAIN.R.bg);
                }
              n++;
            }
      }
  }

  function frame(): void {
    term.clear(PAL.bg);
    term.write(0, 0, `terrain tile = ${TC}x${TC} cells · same map, same panel size, three cell sizes · ${laid} tiles laid, ${towers.length} towers`, PAL.text);
    drawPanel(0, 4, 5, 'A · cell 5x5 glyphs');
    drawPanel(PANEL + 4, 4, 4, 'B · cell 4x4 glyphs');
    drawPanel(PANEL * 2 + 8, 4, 3, 'C · cell 3x3 glyphs');
    term.flush();
    (window as unknown as Record<string, unknown>).__screen = () => term.toText();
    requestAnimationFrame(frame);
  }
  note.textContent = 'cell-size comparison at 5x5-cell tiles';
  frame();
}

main().catch((e) => {
  document.getElementById('app')!.textContent = `failed: ${String(e)}`;
  console.error(e);
});
