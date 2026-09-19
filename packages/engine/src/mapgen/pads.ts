/**
 * Build pads (PRD sec 32.1, D42 - the rework's first piece, a PROTOTYPE
 * behind a switch): every cell that is not road is a pad, rock over a pad, or
 * bedrock, and pads are VERY scarce. "Scarcity is the share of bedrock."
 *
 * The first build is a generator RULE with a knob, not a re-authored tile
 * library: the tiles are dealt exactly as they always were, and this pass -
 * the LAST dice of a map, like the ore ladder before it - says which of the
 * board's ground cells survive as pads. Everything else that was ground
 * becomes bedrock ('D'). So a seed's roads, rock, veins and boons are the
 * same board with the switch on and off; only the ground moves.
 *
 * Absent `MapGenOptions.pads`, nothing here runs and no dice are spent: the
 * engine's default generator, the lab, the balance bands and the golden hash
 * stand still until Daniil has played the prototype (D55).
 *
 * The rule, in the order it spends its dice:
 *
 *   1. A boon cell is always a pad (sec 32.1: "boon ground is a pad with a
 *      modifier"), and counts toward the board's total.
 *   2. THE LAST SHARED STRETCH by the Core keeps `coreStretch` pads (3-5):
 *      sec 4.5's "cells next to the Core are meant to be precious", finally
 *      true of the map. The stretch is the road from the Core's face back to
 *      the first junction; its candidates are the ground cells touching it,
 *      and the cells that touch the face (where a tower gets its gift) weigh
 *      three times.
 *   3. EVERY LANE gets one pad in reach of its own road - the part before it
 *      meets another lane - so no entry is a front nothing can answer.
 *   4. The rest, up to `perTile` x the board's tiles, by weighted draw without
 *      replacement: a cell weighs (1 + n) ^ touchBias, n = the road cells
 *      among its eight neighbours - the SAME n that will price a pad in the
 *      Tile Smith (sec 32.10: "the more roads it touches, the dearer"). A
 *      bend's inside corner and the cell between two lanes that touch are
 *      where pads gather; a cell with no road within two cells is never one.
 *      A chosen pad thins its neighbours' odds, so a junction is a position
 *      and not a parking lot.
 */
import { isRoad, roadsConnect, type CellType } from '../grid/cells';
import type { RngStream } from '../rng/rng';

export interface PadOptions {
  /** Pads the board opens with, per TILE of board. Sec 32.1's 25-35 on a 7x5 board is about 0.7-1.0. */
  perTile: number;
  /** How strongly a pad prefers cells that touch more road: weight = (1 + n) ^ touchBias. 0 = anywhere in reach. */
  touchBias: number;
  /** Pads kept on the last shared stretch by the Core, [min, max]. Default [3, 5]. */
  coreStretch?: readonly [number, number];
}

export interface PadDeal {
  /** Cell indices (y * cellsW + x) of the ground that became bedrock. */
  bedrock: number[];
  /** Cell indices of the pads that survived, boon cells among them. */
  pads: number[];
  /** Of those, the pads on the last shared stretch. */
  stretchPads: number[];
  /** Per entry, in `entries` order: the pads within reach of that lane's own road. */
  lanePads: number[][];
}

/** A pad farther than this (Chebyshev) from every road cell answers nothing, so it is never kept. */
export const PAD_REACH = 2;
/** The shared stretch is walked at most this far from the face: past it a "stretch" is simply a long first lane. */
const STRETCH_CAP = 14;
const NEIGHBOUR_THINNING = 0.25;
const GIFT_WEIGHT = 3;
/** A cell in reach of the road but touching none of it: a set-back pad - a Mortar's, whose dead zone wants the distance. */
const SETBACK_WEIGHT = 0.35;

const STEPS: readonly (readonly [number, number])[] = [[0, -1], [1, 0], [0, 1], [-1, 0]];

/**
 * Walk the road from `start` away from `from`, while it does not branch.
 * Returns the cells walked, the junction (if one ended the walk) included. A
 * bridge is crossed straight: its two strands never join.
 */
function walkUnbranched(cells: readonly (CellType | null)[], W: number, H: number, start: number, from: number, cap: number): number[] {
  const out: number[] = [];
  let prev = from;
  let at = start;
  while (out.length < cap) {
    out.push(at);
    const c = cells[at];
    if (c === null || c === 'C') break;
    const ax = at % W;
    const ay = Math.floor(at / W);
    const onward: number[] = [];
    for (const [dx, dy] of STEPS) {
      const nx = ax + dx;
      const ny = ay + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const k = ny * W + nx;
      if (k === prev) continue;
      const n = cells[k];
      if (n === null || (!isRoad(n) && n !== 'C')) continue;
      if (!roadsConnect(c, n, dx, dy)) continue;
      // Off a bridge a walker only ever goes straight on.
      if (c === 'B' && prev >= 0 && k - at !== at - prev) continue;
      onward.push(k);
    }
    if (onward.length !== 1) break; // a junction, or the road's end
    prev = at;
    at = onward[0];
  }
  return out;
}

export function dealPads(
  rng: RngStream,
  cells: readonly (CellType | null)[],
  W: number,
  H: number,
  entries: readonly { x: number; y: number }[],
  coreFace: readonly { x: number; y: number }[],
  boons: readonly { x: number; y: number }[],
  tiles: number,
  opts: PadOptions,
): PadDeal {
  const at = (x: number, y: number): CellType | null => (x < 0 || y < 0 || x >= W || y >= H ? null : cells[y * W + x]);
  const roadAt = (x: number, y: number): boolean => { const c = at(x, y); return c !== null && isRoad(c); };

  // ---- every ground cell: how much road it touches, and whether any is in reach ----
  const ground: number[] = [];
  const touch = new Map<number, number>();
  const inReach = new Set<number>();
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (at(x, y) !== 'G') continue;
      const k = y * W + x;
      ground.push(k);
      let n = 0;
      let near = false;
      for (let dy = -PAD_REACH; dy <= PAD_REACH; dy++)
        for (let dx = -PAD_REACH; dx <= PAD_REACH; dx++) {
          if ((dx !== 0 || dy !== 0) && roadAt(x + dx, y + dy)) {
            near = true;
            if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) n++;
          }
        }
      touch.set(k, n);
      if (near) inReach.add(k);
    }

  const weight = new Map<number, number>();
  for (const k of inReach) {
    const n = touch.get(k) ?? 0;
    weight.set(k, n === 0 ? SETBACK_WEIGHT : Math.pow(1 + n, opts.touchBias));
  }

  const pads = new Set<number>();
  const keep = (k: number): void => {
    pads.add(k);
    const x = k % W;
    const y = Math.floor(k / W);
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const n = (y + dy) * W + (x + dx);
        if (n !== k && x + dx >= 0 && x + dx < W && weight.has(n)) weight.set(n, (weight.get(n) ?? 0) * NEIGHBOUR_THINNING);
      }
  };
  /** One weighted draw from `pool`, without replacement; -1 when nothing in it can be drawn. */
  const draw = (pool: readonly number[], w: (k: number) => number): number => {
    let total = 0;
    for (const k of pool) if (!pads.has(k)) total += w(k);
    if (total <= 0) return -1;
    let roll = rng.float() * total;
    for (const k of pool) {
      if (pads.has(k)) continue;
      roll -= w(k);
      if (roll < 0) return k;
    }
    for (let i = pool.length - 1; i >= 0; i--) if (!pads.has(pool[i]) && w(pool[i]) > 0) return pool[i]; // float dust
    return -1;
  };
  const near = (k: number, road: ReadonlySet<number>, r: number): boolean => {
    const x = k % W;
    const y = Math.floor(k / W);
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < W && ny < H && road.has(ny * W + nx)) return true;
      }
    return false;
  };

  // ---- 1. boon ground is a pad --------------------------------------------------
  for (const b of boons) if (at(b.x, b.y) === 'G') keep(b.y * W + b.x);

  // ---- 2. the last shared stretch by the Core -----------------------------------
  const mid = coreFace[Math.floor(coreFace.length / 2)];
  const faceSet = new Set(coreFace.map((c) => c.y * W + c.x));
  let stretch: number[] = [];
  for (const [dx, dy] of STEPS) {
    if (roadAt(mid.x + dx, mid.y + dy)) { stretch = walkUnbranched(cells, W, H, (mid.y + dy) * W + (mid.x + dx), mid.y * W + mid.x, STRETCH_CAP); break; }
  }
  const stretchSet = new Set(stretch);
  const gift = new Set(ground.filter((k) => near(k, faceSet, 1)));
  const stretchGround = ground.filter((k) => gift.has(k) || near(k, stretchSet, 1));
  const stretchGroundSet = new Set(stretchGround);
  const [sMin, sMax] = opts.coreStretch ?? [3, 5];
  const wantStretch = rng.int(sMin, sMax);
  const stretchWeight = (k: number): number => Math.max(weight.get(k) ?? SETBACK_WEIGHT, 0.01) * (gift.has(k) ? GIFT_WEIGHT : 1);
  const stretchPads = (): number[] => stretchGround.filter((k) => pads.has(k));
  while (stretchPads().length < wantStretch) {
    const k = draw(stretchGround, stretchWeight);
    if (k < 0) break;
    keep(k);
  }

  // ---- 3. one pad in reach of every lane's own road ------------------------------
  const lanes: Set<number>[] = entries.map((e) => new Set(walkUnbranched(cells, W, H, e.y * W + e.x, -1, W * H).filter((k) => !stretchSet.has(k))));
  const open = ground.filter((k) => inReach.has(k) && !stretchGroundSet.has(k));
  const laneGround = lanes.map((lane) => open.filter((k) => near(k, lane, PAD_REACH)));
  laneGround.forEach((pool) => {
    if (pool.some((k) => pads.has(k))) return;
    const k = draw(pool, (c) => weight.get(c) ?? 0);
    if (k >= 0) keep(k);
  });

  // ---- 4. the rest, by how much road a cell touches -------------------------------
  const target = Math.round(opts.perTile * tiles);
  while (pads.size < target) {
    const k = draw(open, (c) => weight.get(c) ?? 0);
    if (k < 0) break;
    keep(k);
  }

  const bedrock = ground.filter((k) => !pads.has(k));
  return {
    bedrock,
    pads: [...pads].sort((a, b) => a - b),
    stretchPads: stretchPads(),
    lanePads: laneGround.map((pool) => pool.filter((k) => pads.has(k))),
  };
}
