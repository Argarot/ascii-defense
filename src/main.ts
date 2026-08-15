/**
 * Font / palette comparison at the chosen geometry (option C).
 *
 *   A  unscii-8, full ~1010-glyph palette, cell 3x3 glyphs, tile 5x5 cells
 *   B  unscii-8 restricted to the CP437-class repertoire (221 glyphs) and
 *      rendered in the Dwarf Fortress idiom: block shades for terrain,
 *      box-drawing for structures
 *   C  spleen 5x8 (BSD-2-Clause), a real non-square bitmap font. Only 210 of
 *      our palette codepoints exist in it — no Latin-1 at all — so terrain and
 *      towers are redrawn from ASCII and light box drawing only.
 *
 * Cells are square in A and B. In C the glyph is 5x8, so a square-ish cell is
 * 3 wide x 2 tall (15x16 px), which makes tiles smaller and denser still.
 */
import { GLTerm } from './term/GLTerm';
import type { GlyphSet } from './term/GLTerm';

const BASE = import.meta.env.BASE_URL;
const load = <T>(p: string): Promise<T> => fetch(`${BASE}assets/${p}`).then((r) => r.json() as Promise<T>);

interface TileDef { id: string; name: string; conn: string[]; cells: string[] }
interface TileDefs { tiles: TileDef[] }

const PAL: Record<string, string> = {
  frame: '#7286a0', body: '#98adc4', core: '#ffffff',
  eBody: '#a04545', eEye: '#ffd166',
  text: '#d3dae7', dim: '#65758a', accent: '#2ee6a0', bg: '#000000',
};
const PATHS = ['#4cc9f0', '#ffb703', '#c08cff', '#5ce68c'];

type Style = {
  terrain: Record<string, { ramp: string[]; fg: string; fgLit: string; bg: string }>;
  towers: string[][];   // 3x3 art, one per family
  enemy: string;
};

const S_FULL: Style = {
  terrain: {
    G: { ramp: [' ', ' ', ' ', '·', "'", '`', ','], fg: '#3d4f61', fgLit: '#54687d', bg: '#141c25' },
    R: { ramp: [':', ';', ':', '·', '='], fg: '#93abc4', fgLit: '#c2d6ea', bg: '#333f4d' },
    K: { ramp: ['#', '%', '@', '&'], fg: '#5a6a7c', fgLit: '#8698ab', bg: '#1b232c' },
    O: { ramp: ['¤', '*', '·', '¤'], fg: '#ffd15c', fgLit: '#fff0b0', bg: '#2a2415' },
    S: { ramp: ['»', '»', ':', '·'], fg: '#ff9090', fgLit: '#ffd0d0', bg: '#331a1a' },
  },
  towers: [[',-,', '|O|', '`-´'], ['\\|/', '|@|', '`-´'], ['\\*/', '¤O¤', '/*\\'], ['-¤-', '|$|', '`-´']],
  enemy: '(o)',
};

const S_DF: Style = {
  terrain: {
    G: { ramp: ['░', ' ', ' ', '░', '·'], fg: '#39485a', fgLit: '#4d5f74', bg: '#10161d' },
    R: { ramp: ['▒', '░', '▒', '▓'], fg: '#8fa6bd', fgLit: '#c0d4e8', bg: '#2e3945' },
    K: { ramp: ['█', '▓', '█', '▒'], fg: '#5f7085', fgLit: '#8ea0b4', bg: '#191f27' },
    O: { ramp: ['◘', '░', '▒', '¤'], fg: '#ffd15c', fgLit: '#fff0b0', bg: '#2a2415' },
    S: { ramp: ['▓', '▒', '»', '░'], fg: '#ff9090', fgLit: '#ffd0d0', bg: '#331a1a' },
  },
  towers: [['┌─┐', '│Ω│', '└─┘'], ['╔═╗', '║Θ║', '╚═╝'], ['┌─┐', '│§│', '└─┘'], ['╒═╕', '│Φ│', '╘═╛']],
  enemy: '☼',
};

const S_SPLEEN: Style = {
  terrain: {
    G: { ramp: [' ', ' ', ' ', '.', "'", '`', ','], fg: '#3d4f61', fgLit: '#54687d', bg: '#141c25' },
    R: { ramp: [':', ';', ':', '.', '='], fg: '#93abc4', fgLit: '#c2d6ea', bg: '#333f4d' },
    K: { ramp: ['#', '%', '@', '&'], fg: '#5a6a7c', fgLit: '#8698ab', bg: '#1b232c' },
    O: { ramp: ['*', '+', '.', '*'], fg: '#ffd15c', fgLit: '#fff0b0', bg: '#2a2415' },
    S: { ramp: ['>', '>', ':', '.'], fg: '#ff9090', fgLit: '#ffd0d0', bg: '#331a1a' },
  },
  towers: [[',-,', '|O|', "'-'"], ['\\|/', '|@|', "'-'"], ['\\*/', '*O*', '/*\\'], ['-+-', '|$|', "'-'"]],
  enemy: '(o)',
};

const TC = 5, MAPX = 14, MAPY = 12;
const DIRS = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] } as const;
const OPP: Record<string, string> = { n: 's', s: 'n', e: 'w', w: 'e' };

function hash2(x: number, y: number, s: number): number {
  let h = (x | 0) * 374761393 + (y | 0) * 668265263 + s * 2246822519;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function to5(cells: string[]): string[] {
  const out: string[] = [];
  for (let y = 0; y < TC; y++) {
    let row = '';
    for (let x = 0; x < TC; x++) row += cells[Math.round((y * 6) / 4)][Math.round((x * 6) / 4)];
    out.push(row);
  }
  return out;
}

async function main(): Promise<void> {
  const [gFull, gCp, gSp, defs] = await Promise.all([
    load<GlyphSet>('glyphset.json'),
    load<GlyphSet>('glyphset-cp437.json'),
    load<GlyphSet>('glyphset-spleen.json'),
    load<TileDefs>('tiledefs.json'),
  ]);
  const lib = defs.tiles.map((t) => ({ ...t, cells: to5(t.cells) }));
  const byId = new Map(lib.map((t) => [t.id, t]));

  const board: (typeof lib[0] | null)[] = new Array(MAPX * MAPY).fill(null);
  const get = (x: number, y: number) => (x < 0 || y < 0 || x >= MAPX || y >= MAPY ? null : board[y * MAPX + x]);
  board[5 * MAPX] = byId.get('spawn_e')!;
  {
    const open = [{ x: 1, y: 5, entry: 'w' }];
    let guard = 0;
    while (open.length && guard++ < 600) {
      const { x, y, entry } = open.shift()!;
      if (x < 0 || y < 0 || x >= MAPX || y >= MAPY || get(x, y)) continue;
      const cands = lib.filter((t) => t.id !== 'spawn_e' && t.conn.includes(entry));
      const d = cands[Math.floor(hash2(x, y, guard + 5) * cands.length) % cands.length];
      board[y * MAPX + x] = d;
      for (const c of d.conn) {
        if (c === entry) continue;
        const [dx, dy] = DIRS[c as keyof typeof DIRS];
        open.push({ x: x + dx, y: y + dy, entry: OPP[c] });
      }
    }
  }
  const laid = board.filter(Boolean).length;

  const app = document.getElementById('app')!;
  app.style.display = 'flex';
  app.style.gap = '10px';
  app.style.alignItems = 'flex-start';

  function panel(glyphs: GlyphSet, style: Style, cw: number, ch: number, px: number, pxh: number, label: string, sub: string): void {
    const cols = Math.floor(1180 / (cw * px)) * cw;   // whole cells
    const rows = Math.floor(1000 / (ch * pxh)) * ch;
    const term = new GLTerm(glyphs, { cols, rows: rows + 4, cellPx: px, cellPxH: pxh, background: PAL.bg });
    const wrap = document.createElement('div');
    wrap.appendChild(term.canvas);
    const cap = document.createElement('div');
    cap.className = 'hud';
    cap.textContent = sub;
    wrap.appendChild(cap);
    app.appendChild(wrap);

    const TGx = TC * cw, TGy = TC * ch;
    const across = Math.floor(cols / TGx), down = Math.floor(rows / TGy);
    term.clear(PAL.bg);
    term.write(0, 0, label, PAL.accent);
    term.write(0, 1, `${across}x${down} = ${across * down} tiles visible`, PAL.dim);

    const OY = 3;
    let towerN = 0;
    for (let ty = 0; ty < down; ty++)
      for (let tx = 0; tx < across; tx++) {
        const d = get(tx, ty);
        if (!d) continue;
        for (let cy = 0; cy < TC; cy++)
          for (let cx = 0; cx < TC; cx++) {
            const t = style.terrain[d.cells[cy][cx]] ?? style.terrain.G;
            const gx0 = tx * TGx + cx * cw, gy0 = OY + ty * TGy + cy * ch;
            for (let y = 0; y < ch; y++)
              for (let x = 0; x < cw; x++) {
                const g = t.ramp[Math.floor(hash2(gx0 + x, gy0 + y, 6) * t.ramp.length) % t.ramp.length];
                term.put(gx0 + x, gy0 + y, g, hash2(gx0 + x, gy0 + y, 9) < 0.18 ? t.fgLit : t.fg, t.bg);
              }
            // tower
            if (d.cells[cy][cx] === 'G' && hash2(tx * 100 + cx, ty * 100 + cy, 41) > 0.72) {
              const art = style.towers[towerN % 4];
              const col = PATHS[towerN % 4];
              towerN++;
              for (let r = 0; r < Math.min(ch, art.length); r++)
                for (let c = 0; c < Math.min(cw, art[r].length); c++) {
                  const chr = art[r][c];
                  if (chr === ' ') continue;
                  term.put(gx0 + c, gy0 + r, chr, chr === 'O' || chr === 'Ω' || chr === 'Θ' || chr === '§' || chr === 'Φ' || chr === '@' || chr === '$' ? col : PAL.frame, '#0c1017');
                }
            }
            if (d.cells[cy][cx] === 'R' && hash2(tx * 77 + cx, ty * 77 + cy, 61) > 0.80) {
              for (let i = 0; i < Math.min(cw, style.enemy.length); i++)
                term.put(gx0 + i, gy0, style.enemy[i], PAL.eEye, style.terrain.R.bg);
            }
          }
      }
    term.flush();
  }

  panel(gFull, S_FULL, 3, 3, 8, 8, 'A · unscii-8, full palette', `${gFull.codepoints.length} glyphs · cell 3x3 · tile 120px`);
  panel(gCp, S_DF, 3, 3, 8, 8, 'B · CP437-class, DF idiom', `${gCp.codepoints.length} glyphs · cell 3x3 · tile 120px`);
  panel(gSp, S_SPLEEN, 3, 2, 5, 8, 'C · spleen 5x8, no Latin-1', `${gSp.codepoints.length} glyphs · cell 3x2 (15x16px) · tile 75x80px`);

  const n = document.createElement('div');
  n.className = 'hud';
  n.textContent = `same map, ${laid} tiles laid`;
  app.appendChild(n);
}

main().catch((e) => {
  document.getElementById('app')!.textContent = `failed: ${String(e)}`;
  console.error(e);
});
