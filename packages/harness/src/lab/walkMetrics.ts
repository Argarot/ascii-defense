/**
 * What a map's road LOOKS like, as numbers (session 36, the carve's variety).
 * M5's gate is "two runs do not resemble each other", and since the road's
 * shapes are a closed set of nine (PRD sec 23) the resemblance lives in the
 * WALK - where the road runs, how it turns, what stands beside it. Until
 * now nothing measured any of that, so nothing could be said to have
 * changed it.
 *
 *  - a map's CHARACTER: how often the road turns, how long it runs straight,
 *    how much of it is junction, how long its lanes are, what its land is;
 *  - two maps' RESEMBLANCE: the share of slots whose road is the same shape
 *    in the same place. Random fillings of a board agree on some slots by
 *    chance; the figure is only meaningful against another figure.
 */
import { EDGES, TILE_SIZE, computeFlowField, landFamilyOf, mapCells, type Edge, type GeneratedMap, type LandFamily, type TileLibrary } from '@ascii-defense/engine';

export { landFamilyOf, type LandFamily };

export interface WalkCharacter {
  /** Road slots over all slots. */
  coverage: number;
  /** Entries the carve actually made (the Threat's roll is only the minimum). */
  entries: number;
  /** Of the two-port road slots, the share that BEND. 0 = all avenues, 1 = all corners. */
  turnRatio: number;
  /** Of the road slots, the share with three or four ports. */
  junctionShare: number;
  /** The longest run of straight slots in one line, in slots. */
  longestStraight: number;
  /** Mean route length from an entry to the Core, in cells. */
  laneCells: number;
  /** Of the road slots' ports, the share running north-south (the rest run east-west). */
  verticalShare: number;
  /** Of all placed tiles, the share of each land family. */
  land: Record<LandFamily, number>;
  /**
   * How clumped the land is: of the pairs of adjacent placed tiles, the
   * share whose families match. Salt-and-pepper land sits near the chance
   * figure (the sum of the squared shares); regions sit well above it.
   */
  landClumping: number;
  /** One string per slot: the road's ports there ('ns', 'esw', ...) or '.' - what resemblance compares. */
  signature: string[];
}

export function walkCharacter(map: GeneratedMap, lib: TileLibrary): WalkCharacter {
  const { width, height } = map.board;
  const ports: (Edge[] | null)[] = [];
  const family: (LandFamily | null)[] = [];
  for (let k = 0; k < width * height; k++) {
    const p = map.board.slots[k];
    if (!p) { ports.push(null); family.push(null); continue; }
    const { cells, connectors } = lib.resolved(p.tileId, p.rotation);
    const e = EDGES.filter((x) => connectors[x]);
    ports.push(e.length ? e : null);
    family.push(landFamilyOf(cells));
  }
  const road = ports.filter((p): p is Edge[] => p !== null);
  const two = road.filter((p) => p.length === 2);
  const isStraight = (p: Edge[]): boolean => (p.includes('n') && p.includes('s')) || (p.includes('e') && p.includes('w'));
  const bends = two.filter((p) => !isStraight(p)).length;

  let longestStraight = 0;
  const run = (k: number, axis: 'ns' | 'ew'): boolean => { const p = ports[k]; return !!p && p.length === 2 && (axis === 'ns' ? p.includes('n') && p.includes('s') : p.includes('e') && p.includes('w')); };
  for (let y = 0; y < height; y++) { let r = 0; for (let x = 0; x < width; x++) { r = run(y * width + x, 'ew') ? r + 1 : 0; longestStraight = Math.max(longestStraight, r); } }
  for (let x = 0; x < width; x++) { let r = 0; for (let y = 0; y < height; y++) { r = run(y * width + x, 'ns') ? r + 1 : 0; longestStraight = Math.max(longestStraight, r); } }

  let vertical = 0; let allPorts = 0;
  for (const p of road) for (const e of p) { allPorts++; if (e === 'n' || e === 's') vertical++; }

  const cells = mapCells(map, lib);
  const flow = computeFlowField(cells, map.cellsW, map.cellsH, []);
  const lanes = map.entries.map((en) => flow.dist[en.y * map.cellsW + en.x]).filter((d) => d >= 0);

  const placed = family.filter((f): f is LandFamily => f !== null);
  const land = { plain: 0, rock: 0, ore: 0 } as Record<LandFamily, number>;
  for (const f of placed) land[f] += 1 / placed.length;
  let pairs = 0; let same = 0;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const a = family[y * width + x];
      if (!a) continue;
      for (const [dx, dy] of [[1, 0], [0, 1]] as const) {
        if (x + dx >= width || y + dy >= height) continue;
        const b = family[(y + dy) * width + x + dx];
        if (!b) continue;
        pairs++;
        if (a === b) same++;
      }
    }

  return {
    coverage: road.length / (width * height),
    entries: map.entries.length,
    turnRatio: two.length ? bends / two.length : 0,
    junctionShare: road.length ? road.filter((p) => p.length >= 3).length / road.length : 0,
    longestStraight,
    laneCells: lanes.length ? lanes.reduce((a, c) => a + c, 0) / lanes.length : 0,
    verticalShare: allPorts ? vertical / allPorts : 0,
    land,
    landClumping: pairs ? same / pairs : 0,
    signature: ports.map((p) => (p ? [...p].sort().join('') : '.')),
  };
}

/** The share of slots on which two maps of one board carry the same road shape in the same place. */
export function resemblance(a: WalkCharacter, b: WalkCharacter): number {
  const n = Math.min(a.signature.length, b.signature.length);
  let same = 0;
  for (let i = 0; i < n; i++) if (a.signature[i] === b.signature[i]) same++;
  return n ? same / n : 0;
}

/** Mean pairwise resemblance over a set of maps. */
export function meanResemblance(maps: readonly WalkCharacter[]): number {
  let sum = 0; let pairs = 0;
  for (let i = 0; i < maps.length; i++) for (let j = i + 1; j < maps.length; j++) { sum += resemblance(maps[i], maps[j]); pairs++; }
  return pairs ? sum / pairs : 0;
}

export const mean = (a: readonly number[]): number => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
export const sd = (a: readonly number[]): number => { const m = mean(a); return a.length ? Math.sqrt(mean(a.map((x) => (x - m) * (x - m)))) : 0; };

/** Cells a lane crosses per slot it spans, at least - for reading a lane in slots. */
export const CELLS_PER_SLOT = TILE_SIZE;
