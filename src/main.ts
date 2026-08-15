/**
 * Font comparison with COMPLETE glyph sets.
 *
 *   A  unscii-8, all 3159 glyphs, cell 3x3           tile 120x120 px
 *   B  unscii-8 CP437 repertoire, 221 glyphs,        tile 120x120 px
 *      drawn in the Dwarf Fortress idiom
 *   C  spleen 5x8, all 472 glyphs, cell 3x2          tile  75x80  px
 *   D  spleen 5x8, all 472 glyphs, cell 5x5          tile 125x200 px
 *
 * Terrain ramps are large pools drawn from across each font's range rather
 * than a handful of hand-picked marks. Every pool is filtered through
 * term.has() at load, and the resolved count is reported per panel, so the
 * palette claim is measured rather than asserted.
 */
import { GLTerm } from './term/GLTerm';
import type { GlyphSet } from './term/GLTerm';

const BASE = import.meta.env.BASE_URL;
// Files under public/ keep a stable URL, so the Pages CDN happily serves a
// stale copy after a deploy. Bump this whenever an asset changes.
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

interface Style {
  pools: Record<string, string>;
  cols: Record<string, [string, string, string]>; // fg, fgLit, bg
  towers: string[][];
  enemy: string;
}

// Wide pools. No blocks or box drawing in terrain вЂ” those stay UI-only вЂ”
// except in the DF idiom, where they are the idiom.
const RICH: Style = {
  pools: {
    G: '          В·`\',.ВёЛљВ°б›«в€™в‹…Л‘Л·К»КјвЂљВ·ВґВЇЛЛ™ЛљЛ›ЛќНєО„бѕїбїЂб› бљ№',
    R: ':;В·,=в‰€Г·в€ґв€µвЂ¦вЂҐВ·вЃљвЃќЛђЛ€В¦В¬В±в€“вЊђв‰Ўв‰ в€јв€Ѕ',
    K: '#%@&В§В¤ГО¦ОЁР–РЁР©ГћГђГ†ЕЉЕ¦Д¦Д±ОћО ОЈО©В¶Т–',
    O: 'В¤*в—Љв—‹в—Џв—вЂўв€™в—¦в€вЉ™вЉљвЉ›вњівњґвЂ»вј',
    S: 'В»вЂєвјв—„в–єв–ёв–№в‰«в‹™',
  },
  cols: {
    G: ['#3d4f61', '#54687d', '#141c25'],
    R: ['#93abc4', '#c2d6ea', '#333f4d'],
    K: ['#5a6a7c', '#8698ab', '#1b232c'],
    O: ['#ffd15c', '#fff0b0', '#2a2415'],
    S: ['#ff9090', '#ffd0d0', '#331a1a'],
  },
  towers: [[',-,', '|О©|', '`-Вґ'], ['\\|/', '|О¦|', '`-Вґ'], ['\\*/', 'В¤ОВ¤', '/*\\'], ['-В¤-', '|ОЁ|', '`-Вґ']],
  enemy: '(o)',
};

const DF: Style = {
  pools: {
    G: '     в–‘в–‘В·.,в–‘в–’',
    R: 'в–’в–‘в–’в–“в–’в–‘в–“в–’',
    K: 'в–€в–“в–€в–’в–€в–“',
    O: 'в—В¤в–’в–‘в—™',
    S: 'в–“в–’В»в–‘в–є',
  },
  cols: RICH.cols,
  towers: [['в”Њв”Ђв”ђ', 'в”‚О©в”‚', 'в””в”Ђв”'], ['в•”в•ђв•—', 'в•‘Ов•‘', 'в•љв•ђв•ќ'], ['в•“в”Ђв•–', 'в•‘В§в•‘', 'в•™в”Ђв•њ'], ['в•’в•ђв••', 'в”‚О¦в”‚', 'в•в•ђв•›']],
  enemy: 'вј',
};

// spleen: ASCII + braille + light box drawing. Braille gives a genuine
// density ramp, which is the most useful thing this font has.
const SPL: Style = {
  pools: {
    G: '          .\'`,в Ђв Ѓв ‚в „в €в ђв  вЎЂвўЂ',
    R: ':;.,=в ‰в ’в ¤в ¶в ›в ї-_~',
    K: '#%@&вЈївЎївўївЈ»вЈЅвЈѕвЈ·$WMB',
    O: '*+.oв їв ѕв Ѕв »O0',
    S: '>>:.в €в в ё',
  },
  cols: RICH.cols,
  towers: [[',-,', '|O|', "'-'"], ['\\|/', '|@|', "'-'"], ['\\*/', '*8*', '/*\\'], ['-+-', '|$|', "'-'"]],
  enemy: '(o)',
};

const TC = 5, MAPX = 16, MAPY = 14;
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
  // Constraint fill rather than branch-and-drop: visit every cell in order and
  // pick any tile whose connectors agree with each already-placed neighbour on
  // their shared edge. A dying branch no longer strands the rest of the map.
  board[1 * MAPX] = byId.get('spawn_e')!;
  for (let y = 0; y < MAPY; y++)
    for (let x = 0; x < MAPX; x++) {
      if (get(x, y)) continue;
      const cands = lib.filter((t) => {
        if (t.id === 'spawn_e') return false;
        for (const [dir, [dx, dy]] of Object.entries(DIRS)) {
          const nb = get(x + dx, y + dy);
          if (!nb) continue;                       // unplaced: no constraint
          if (nb.conn.includes(OPP[dir]) !== t.conn.includes(dir)) return false;
        }
        return true;
      });
      if (!cands.length) continue;
      board[y * MAPX + x] = cands[Math.floor(hash2(x, y, 17) * cands.length) % cands.length];
    }
  const laid = board.filter(Boolean).length;

  const app = document.getElementById('app')!;
  app.style.display = 'flex';
  app.style.gap = '8px';
  app.style.alignItems = 'flex-start';

  function panel(glyphs: GlyphSet, st: Style, cw: number, ch: number, px: number, pxh: number, label: string): void {
    const cols = Math.max(cw, Math.floor(455 / (cw * px)) * cw);
    const rows = Math.max(ch, Math.floor(920 / (ch * pxh)) * ch);
    const term = new GLTerm(glyphs, { cols, rows: rows + 4, cellPx: px, cellPxH: pxh, background: PAL.bg });

    // Filter every pool through the font: claim only what actually resolves.
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
    cap.textContent = `${glyphs.codepoints.length} in font В· ${usable} distinct in terrain`;
    wrap.appendChild(cap);
    app.appendChild(wrap);

    const TGx = TC * cw, TGy = TC * ch;
    const across = Math.floor(cols / TGx), down = Math.floor(rows / TGy);
    term.clear(PAL.bg);
    term.write(0, 0, label, PAL.accent);
    term.write(0, 1, `${across}x${down} shown В· tile ${TGx * px}x${TGy * pxh}px`, PAL.dim);

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
            const [fg, fgLit, bg] = st.cols[kind] ?? st.cols.G;
            const gx0 = tx * TGx + cx * cw, gy0 = OY + ty * TGy + cy * ch;
            for (let y = 0; y < ch; y++)
              for (let x = 0; x < cw; x++) {
                const g = p[Math.floor(hash2(gx0 + x, gy0 + y, 6) * p.length) % p.length];
                term.put(gx0 + x, gy0 + y, g, hash2(gx0 + x, gy0 + y, 9) < 0.2 ? fgLit : fg, bg);
              }
            if (kind === 'G' && hash2(tx * 100 + cx, ty * 100 + cy, 41) > 0.74) {
              const art = st.towers[tn % 4], col = PATHS[tn % 4];
              tn++;
              for (let r = 0; r < Math.min(ch, art.length); r++)
                for (let c = 0; c < Math.min(cw, art[r].length); c++) {
                  const chr = art[r][c];
                  if (chr === ' ' || !term.has(chr)) continue;
                  term.put(gx0 + c, gy0 + r, chr, /[О©О¦ООЁO@$В§8]/.test(chr) ? col : PAL.frame, '#0c1017');
                }
            }
            if (kind === 'R' && hash2(tx * 77 + cx, ty * 77 + cy, 61) > 0.82)
              for (let i = 0; i < Math.min(cw, st.enemy.length); i++)
                if (term.has(st.enemy[i])) term.put(gx0 + i, gy0, st.enemy[i], PAL.eEye, st.cols.R[2]);
          }
      }
    term.flush();
  }

  panel(gFull, RICH, 3, 3, 8, 8, 'A В· unscii-8 full В· cell 3x3');
  panel(gCp, DF, 3, 3, 8, 8, 'B В· CP437 / DF idiom');
  panel(gSp, SPL, 3, 2, 5, 8, 'C В· spleen В· cell 3x2');
  panel(gSp, SPL, 5, 5, 5, 8, 'D В· spleen В· cell 5x5');

  const n = document.createElement('div');
  n.className = 'hud';
  n.textContent = `same map, ${laid} tiles laid`;
  app.appendChild(n);
}

main().catch((e) => {
  document.getElementById('app')!.textContent = `failed: ${String(e)}`;
  console.error(e);
});

