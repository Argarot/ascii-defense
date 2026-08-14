/**
 * Square vs hex tiles, under a LOGICAL tile grid (no borders drawn), with the
 * tile-placement expansion mechanic illustrated.
 *
 * Most of the map is void. Placed tiles form a connected region with a road
 * running through it. Void tiles adjacent to the region are legal placements
 * and are marked faintly — that is the "which tile can I add" checker made
 * visible.
 *
 * Both panels share one tile map and one renderer; only the tile shape
 * function differs. Square tiles are 12x12 cells. Hex tiles are flat-top,
 * centres on a 12 x 14 lattice with odd columns offset by 7 — a ratio of
 * 1.167 against the ideal 1.155, so they are near-regular hexagons.
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
  roadEdge: '#8299b3', rock: '#3b4653', ore: '#e8b52a',
  frontier: '#2a4436', frontierLit: '#3f6b52',
  text: '#d3dae7', dim: '#65758a', accent: '#2ee6a0', bg: '#07090c',
};
const PATH = '#4cc9f0';

type Tile = 'void' | 'ground' | 'road' | 'rock' | 'ore';
const PW = 110, PMH = 58, TOP = 3;

function hash2(x: number, y: number, s: number): number {
  let h = (x | 0) * 374761393 + (y | 0) * 668265263 + s * 2246822519;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const pickG = (a: string[], x: number, y: number, s: number): string =>
  a[Math.floor(hash2(x, y, s) * a.length) % a.length];

function drawPiece(t: GLTerm, p: Piece, m: Record<string, string | null>, x: number, y: number, bg?: string): void {
  for (let r = 0; r < p.art.length; r++)
    for (let c = 0; c < (p.art[r] ?? '').length; c++) {
      const role = m[(p.ink[r] ?? '')[c] ?? '.'];
      if (!role) continue;
      t.put(x + c, y + r, p.art[r][c], role === 'PATH' ? PATH : (PAL[role] ?? '#f0f'), bg);
    }
}

/** A tiling: maps a cell to a tile id, and a tile id to its centre cell. */
interface Tiling {
  cols: number; rows: number;
  idAt(x: number, y: number): number;
  centre(id: number): [number, number];
  neighbours(id: number): number[];
}

function squareTiling(size: number): Tiling {
  const cols = Math.floor(PW / size), rows = Math.floor(PMH / size);
  return {
    cols, rows,
    idAt: (x, y) => {
      const c = Math.floor(x / size), r = Math.floor(y / size);
      return c < 0 || r < 0 || c >= cols || r >= rows ? -1 : r * cols + c;
    },
    centre: (id) => [(id % cols) * size + size / 2, Math.floor(id / cols) * size + size / 2],
    neighbours: (id) => {
      const c = id % cols, r = Math.floor(id / cols), out: number[] = [];
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nc = c + dc, nr = r + dr;
        if (nc >= 0 && nr >= 0 && nc < cols && nr < rows) out.push(nr * cols + nc);
      }
      return out;
    },
  };
}

function hexTiling(dx: number, dy: number): Tiling {
  const cols = Math.floor(PW / dx), rows = Math.floor(PMH / dy);
  const centre = (id: number): [number, number] => {
    const c = id % cols, r = Math.floor(id / cols);
    return [c * dx + dx / 2, r * dy + dy / 2 + (c % 2) * (dy / 2)];
  };
  return {
    cols, rows, centre,
    // Nearest-centre lookup over a hex lattice is exactly the hex Voronoi cell,
    // so tile shape falls out of the lattice rather than being drawn.
    idAt: (x, y) => {
      let best = -1, bestD = Infinity;
      const c0 = Math.floor(x / dx), r0 = Math.floor(y / dy);
      for (let c = c0 - 1; c <= c0 + 1; c++) {
        for (let r = r0 - 1; r <= r0 + 1; r++) {
          if (c < 0 || r < 0 || c >= cols || r >= rows) continue;
          const id = r * cols + c, [ux, uy] = centre(id);
          const d = (ux - x) ** 2 + (uy - y) ** 2;
          if (d < bestD) { bestD = d; best = id; }
        }
      }
      return best;
    },
    neighbours: (id) => {
      const c = id % cols, r = Math.floor(id / cols), odd = c % 2;
      const deltas = odd
        ? [[0, -1], [0, 1], [-1, 0], [-1, 1], [1, 0], [1, 1]]
        : [[0, -1], [0, 1], [-1, -1], [-1, 0], [1, -1], [1, 0]];
      const out: number[] = [];
      for (const [dc, dr] of deltas) {
        const nc = c + dc, nr = r + dr;
        if (nc >= 0 && nr >= 0 && nc < cols && nr < rows) out.push(nr * cols + nc);
      }
      return out;
    },
  };
}

async function main(): Promise<void> {
  const [glyphs, data] = await Promise.all([load<GlyphSet>('glyphset.json'), load<Styles>('styles.json')]);
  const style = data.styles.extended;
  const app = document.getElementById('app')!;
  const term = new GLTerm(glyphs, { cols: PW * 2 + 4, rows: PMH + 6, cellPx: 8, background: PAL.bg });
  app.appendChild(term.canvas);
  const note = document.createElement('div');
  note.className = 'hud';
  app.appendChild(note);

  /** Grow a connected region with a road spine, leaving the rest void. */
  function buildMap(t: Tiling, seed: number): { tiles: Tile[]; towers: number[]; frontier: Set<number> } {
    const n = t.cols * t.rows;
    const tiles: Tile[] = new Array(n).fill('void');
    let cur = Math.floor(t.rows / 2) * t.cols;
    const road: number[] = [];
    for (let i = 0; i < t.cols + 2 && cur >= 0; i++) {
      tiles[cur] = 'road';
      road.push(cur);
      const nb = t.neighbours(cur).filter((x) => t.centre(x)[0] > t.centre(cur)[0] && tiles[x] === 'void');
      if (!nb.length) break;
      cur = nb[Math.floor(hash2(i, seed, 5) * nb.length) % nb.length];
    }
    for (const r of road) {
      for (const nb of t.neighbours(r)) {
        if (tiles[nb] !== 'void') continue;
        const h = hash2(nb, seed, 7);
        tiles[nb] = h > 0.82 ? 'rock' : h < 0.12 ? 'ore' : 'ground';
      }
    }
    const towers: number[] = [];
    for (let i = 0; i < n && towers.length < 6; i++)
      if (tiles[i] === 'ground' && hash2(i, seed, 11) > 0.55) towers.push(i);
    const frontier = new Set<number>();
    for (let i = 0; i < n; i++)
      if (tiles[i] === 'void') for (const nb of t.neighbours(i)) if (tiles[nb] !== 'void') { frontier.add(i); break; }
    return { tiles, towers, frontier };
  }

  function drawPanel(ox: number, t: Tiling, map: ReturnType<typeof buildMap>, towerSize: number): void {
    for (let y = 0; y < PMH; y++) {
      for (let x = 0; x < PW; x++) {
        const id = t.idAt(x, y);
        if (id < 0) continue;
        const kind = map.tiles[id];
        const sy = TOP + y;
        if (kind === 'void') {
          // Legal next placements get a faint stipple; unreachable void stays black.
          if (map.frontier.has(id) && hash2(x, y, 33) < 0.10)
            term.put(ox + x, sy, '·', hash2(x, y, 34) < 0.3 ? PAL.frontierLit : PAL.frontier);
          continue;
        }
        const dens = 0.05 + hash2(id, 0, 41) * 0.08;
        if (kind === 'road') {
          const nbrRoad = t.neighbours(t.idAt(x, y)).some((nb) => map.tiles[nb] === 'road');
          const edge = t.idAt(x, y) !== t.idAt(x + 1, y) || t.idAt(x, y) !== t.idAt(x, y + 1);
          if (edge && !nbrRoad) term.put(ox + x, sy, pickG(style.terrain.roadEdge, x, y, 4), PAL.roadEdge);
          else if (hash2(x, y, 5) < 0.85) term.put(ox + x, sy, pickG(style.terrain.road, x, y, 6), hash2(x, y, 7) < 0.15 ? PAL.roadLit : PAL.road);
        } else if (kind === 'rock') {
          if (hash2(x, y, 8) < 0.75) term.put(ox + x, sy, pickG(style.terrain.rock, x, y, 9), PAL.rock);
        } else if (kind === 'ore') {
          if (hash2(x, y, 13) < 0.12) term.put(ox + x, sy, style.terrain.ore[0], PAL.ore);
          else if (hash2(x, y, 10) < dens) term.put(ox + x, sy, pickG(style.terrain.ground, x, y, 11), PAL.groundDim);
        } else if (hash2(x, y, 10) < dens) {
          term.put(ox + x, sy, pickG(style.terrain.ground, x, y, 11), hash2(x, y, 12) < 0.5 ? PAL.groundDim : PAL.ground);
        }
      }
    }
    for (const id of map.towers) {
      const [cx, cy] = t.centre(id);
      drawPiece(term, style.tower, data.inkMap, ox + Math.round(cx) - 6, TOP + Math.round(cy) - towerSize, PAL['tower.shadow']);
    }
  }

  const sq = squareTiling(12);
  const hx = hexTiling(12, 14);
  const sqMap = buildMap(sq, 3), hxMap = buildMap(hx, 3);

  function frame(): void {
    term.clear(PAL.bg);
    term.write(0, 0, 'A · square tiles  (12x12 cells)', PAL.accent);
    term.write(0, 1, '4 neighbours · axis-aligned edges · one REXPaint canvas size', PAL.dim);
    term.write(PW + 4, 0, 'B · hex tiles  (12x14 lattice, flat-top)', PAL.accent);
    term.write(PW + 4, 1, '6 neighbours · stepped diagonal edges · rect canvas with wasted corners', PAL.dim);
    drawPanel(0, sq, sqMap, 5);
    drawPanel(PW + 4, hx, hxMap, 5);
    term.write(0, TOP + PMH + 1, 'faint green stipple = void tiles legal to place next. black = unreachable void. most of the map is unbuilt.', PAL.dim);
    term.flush();
    (window as unknown as Record<string, unknown>).__screen = () => term.toText();
    requestAnimationFrame(frame);
  }
  note.textContent = 'square vs hex tiles, with tile-placement expansion — 1:1 at 8px cells';
  frame();
}

main().catch((e) => {
  document.getElementById('app')!.textContent = `failed: ${String(e)}`;
  console.error(e);
});
