/**
 * Head to head at effectively identical tile size.
 *
 *   A  unscii-8, 3159 glyphs, glyph 8x8, cell 3x3 glyphs (24x24 px)
 *      tile 120x120 px   ->   9 glyphs of drawing room per cell
 *
 *   B  spleen 5x8, 472 glyphs, cell 5x3 glyphs (25x24 px)
 *      tile 125x120 px   ->  15 glyphs of drawing room per cell
 *
 * Same tile footprint, so the same number of tiles fit on screen. The trade is
 * palette breadth (unscii, 6.7x more glyphs) against per-cell drawing room
 * (spleen, 1.7x more glyphs inside each cell).
 */
import { GLTerm } from './term/GLTerm';
import type { GlyphSet } from './term/GLTerm';

const BASE = import.meta.env.BASE_URL;
const ASSET_V = '5';
const load = <T>(p: string): Promise<T> =>
  fetch(`${BASE}assets/${p}?v=${ASSET_V}`).then((r) => r.json() as Promise<T>);

interface TileDef { id: string; name: string; conn: string[]; cells: string[] }
interface TileDefs { tiles: TileDef[] }

const PAL: Record<string, string> = {
  frame: '#7286a0', core: '#ffffff', eEye: '#ffd166',
  text: '#d3dae7', dim: '#65758a', accent: '#2ee6a0', bg: '#000000',
};
const PATHS = ['#4cc9f0', '#ffb703', '#c08cff', '#5ce68c'];

const COLS: Record<string, [string, string, string]> = {
  G: ['#3d4f61', '#54687d', '#141c25'],
  R: ['#93abc4', '#c2d6ea', '#333f4d'],
  K: ['#5a6a7c', '#8698ab', '#1b232c'],
  O: ['#ffd15c', '#fff0b0', '#2a2415'],
  S: ['#ff9090', '#ffd0d0', '#331a1a'],
};

interface Style {
  pools: Record<string, string>;
  towers: string[][];
  enemy: string;
}

const RICH: Style = {
  pools: {
    G: "          \u00b7`',.\u00b8\u02da\u00b0\u16eb\u2219\u22c5\u02d1\u02b7\u02bb\u02bc\u201a\u00b4\u00af\u02d8\u02d9\u02db\u02dd\u16a0\u16b9",
    R: ':;\u00b7,=\u2248\u00f7\u2234\u2235\u2026\u2025\u205a\u02d0\u02c8\u00a6\u00ac\u00b1\u2213\u2310\u2261\u2260\u223c\u223d',
    K: '#%@&\u00a7\u00a4\u00d8\u03a6\u03a8\u0416\u0428\u0429\u00de\u00d0\u00c6\u014a\u0166\u0126\u039e\u03a0\u03a3\u03a9\u00b6\u0496',
    O: '\u00a4*\u25ca\u25cb\u25cf\u25d8\u2022\u2219\u25e6\u2218\u2299\u229a\u229b\u2733\u2734\u203b\u263c',
    S: '\u00bb\u203a\u263c\u25c4\u25ba\u25b8\u25b9\u226b\u22d9',
  },
  towers: [
    [',-,', '|\u03a9|', '`-\u00b4'],
    ['\\|/', '|\u03a6|', '`-\u00b4'],
    ['\\*/', '\u00a4\u0398\u00a4', '/*\\'],
    ['-\u00a4-', '|\u03a8|', '`-\u00b4'],
  ],
  enemy: '(o)',
};

// spleen: ASCII, braille and light box drawing only. Braille supplies the
// density ramp; the 5-wide cell gives the towers room ASCII alone can use.
const SPL: Style = {
  pools: {
    G: "          .'`,\u2800\u2801\u2802\u2804\u2808\u2810\u2820\u2840\u2880\u2803\u2809",
    R: ':;.,=\u2809\u2812\u2824\u2836\u281b\u283f-_~\u2810\u2820',
    K: '#%@&\u28ff\u287f\u28bf\u28fb\u28fd\u28fe\u28f7$WMB\u28f6\u28ef',
    O: '*+.o\u283f\u283e\u283d\u283bO0\u2837',
    S: '>>:.\u2808\u2818\u2838',
  },
  towers: [
    ['.-^-.', '|[O]|', "'---'"],
    ['\\ | /', '|(@)|', "'---'"],
    ['* . *', '|<8>|', "* ' *"],
    ['=====', '|{$}|', "'---'"],
  ],
  enemy: '<(o)>',
};

const TC = 5, MAPX = 16, MAPY = 14;
const DIRS = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] } as const;
const OPP: Record<string, string> = { n: 's', s: 'n', e: 'w', w: 'e' };
const CORE = /[\u03a9\u03a6\u0398\u03a8O@$8]/;

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
  const [gFull, gSp, defs] = await Promise.all([
    load<GlyphSet>('glyphset.json'),
    load<GlyphSet>('glyphset-spleen.json'),
    load<TileDefs>('tiledefs.json'),
  ]);
  const lib = defs.tiles.map((t) => ({ ...t, cells: to5(t.cells) }));
  const byId = new Map(lib.map((t) => [t.id, t]));

  const board: (typeof lib[0] | null)[] = new Array(MAPX * MAPY).fill(null);
  const get = (x: number, y: number) => (x < 0 || y < 0 || x >= MAPX || y >= MAPY ? null : board[y * MAPX + x]);
  board[1 * MAPX] = byId.get('spawn_e')!;
  for (let y = 0; y < MAPY; y++)
    for (let x = 0; x < MAPX; x++) {
      if (get(x, y)) continue;
      const cands = lib.filter((t) => {
        if (t.id === 'spawn_e') return false;
        for (const [dir, d] of Object.entries(DIRS)) {
          const nb = get(x + d[0], y + d[1]);
          if (!nb) continue;
          if (nb.conn.includes(OPP[dir]) !== t.conn.includes(dir)) return false;
        }
        return true;
      });
      if (!cands.length) continue;
      board[y * MAPX + x] = cands[Math.floor(hash2(x, y, 17) * cands.length) % cands.length];
    }

  const app = document.getElementById('app')!;
  app.style.display = 'flex';
  app.style.gap = '12px';
  app.style.alignItems = 'flex-start';

  function panel(glyphs: GlyphSet, st: Style, cw: number, ch: number, px: number, pxh: number, label: string): void {
    const cols = Math.floor(890 / (cw * px)) * cw;
    const rows = Math.floor(900 / (ch * pxh)) * ch;
    const term = new GLTerm(glyphs, { cols, rows: rows + 4, cellPx: px, cellPxH: pxh, background: PAL.bg });

    const pool: Record<string, string[]> = {};
    let usable = 0;
    for (const [k, s] of Object.entries(st.pools)) {
      pool[k] = [...s].filter((c) => c === ' ' || term.has(c));
      usable += new Set(pool[k].filter((c) => c !== ' ')).size;
    }

    const wrap = document.createElement('div');
    wrap.appendChild(term.canvas);
    const cap = document.createElement('div');
    cap.className = 'hud';
    cap.textContent = `${glyphs.codepoints.length} glyphs in font \u00b7 ${usable} distinct in terrain \u00b7 ${cw * ch} glyphs per cell`;
    wrap.appendChild(cap);
    app.appendChild(wrap);

    const TGx = TC * cw, TGy = TC * ch;
    const across = Math.floor(cols / TGx), down = Math.floor(rows / TGy);
    const scrX = Math.floor(1920 / (TGx * px)), scrY = Math.floor(1150 / (TGy * pxh));
    term.clear(PAL.bg);
    term.write(0, 0, label, PAL.accent);
    term.write(0, 1, `tile ${TGx * px}x${TGy * pxh}px \u00b7 ${scrX}x${scrY} = ${scrX * scrY} tiles on a 1920x1200 screen`, PAL.dim);

    const OY = 3;
    let tn = 0;
    for (let ty = 0; ty < down; ty++)
      for (let tx = 0; tx < across; tx++) {
        const d = get(tx, ty);
        if (!d) continue;
        for (let cy = 0; cy < TC; cy++)
          for (let cx = 0; cx < TC; cx++) {
            const kind = d.cells[cy][cx];
            const p = pool[kind] ?? pool.G;
            const c3 = COLS[kind] ?? COLS.G;
            const gx0 = tx * TGx + cx * cw, gy0 = OY + ty * TGy + cy * ch;
            for (let y = 0; y < ch; y++)
              for (let x = 0; x < cw; x++) {
                const g = p[Math.floor(hash2(gx0 + x, gy0 + y, 6) * p.length) % p.length];
                term.put(gx0 + x, gy0 + y, g, hash2(gx0 + x, gy0 + y, 9) < 0.2 ? c3[1] : c3[0], c3[2]);
              }
            if (kind === 'G' && hash2(tx * 100 + cx, ty * 100 + cy, 41) > 0.74) {
              const art = st.towers[tn % 4], col = PATHS[tn % 4];
              tn++;
              for (let r = 0; r < Math.min(ch, art.length); r++)
                for (let c = 0; c < Math.min(cw, art[r].length); c++) {
                  const chr = art[r][c];
                  if (chr === ' ' || !term.has(chr)) continue;
                  term.put(gx0 + c, gy0 + r, chr, CORE.test(chr) ? col : PAL.frame, '#0c1017');
                }
            }
            if (kind === 'R' && hash2(tx * 77 + cx, ty * 77 + cy, 61) > 0.82)
              for (let i = 0; i < Math.min(cw, st.enemy.length); i++)
                if (term.has(st.enemy[i])) term.put(gx0 + i, gy0, st.enemy[i], PAL.eEye, COLS.R[2]);
          }
      }
    term.flush();
  }

  panel(gFull, RICH, 3, 3, 8, 8, 'A \u00b7 unscii-8 \u00b7 cell 3x3 glyphs (24x24px)');
  panel(gSp, SPL, 5, 3, 5, 8, 'B \u00b7 spleen 5x8 \u00b7 cell 5x3 glyphs (25x24px)');
}

main().catch((e) => {
  document.getElementById('app')!.textContent = `failed: ${String(e)}`;
  console.error(e);
});
