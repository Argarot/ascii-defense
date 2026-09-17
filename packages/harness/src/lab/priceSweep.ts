/**
 * The price sweep (2026-09-17; PRD sec 27, D31): the pricing function read
 * against its targets. Not a simulation - a table of what priceTile() says
 * for the tiles that anchor it, for the dial a player turns in the Smith,
 * and for the ceiling that is meant to be out of reach.
 *
 *   node tools/price-sweep.mjs
 */
import { TILE_PRICE, costText, priceTile, type PricedTile } from '@ascii-defense/engine';
import libraryJson from '@ascii-defense/content/assets/tiles/library.json';

declare const console: { log: (...args: unknown[]) => void };

/** What the shop charged before D31, hand-authored in the content file (tier, ore). */
const WAS: Record<string, [number, number]> = {
  twin_bend: [1, 25], gen_ns_2: [1, 30], gen_ns_3: [1, 25], gen_ne_1: [1, 30], gen_ne_4: [1, 35], rich_vein: [1, 60], mother_lode: [2, 50],
};
/** Income a run banks, by purse (docs/lab/ore-sweep-2026-09-17.md): ~50 tier-1 on the reference build; ~27 tier-2 on a map that has the vein (one in three); tier 3 ~20 on one map in nine. */
const RUN = [50, 27, 20];
const LUCK = [1, 1 / 3, 1 / 9];
const runs = (cost: readonly number[]): string => {
  const each = cost.map((c, i) => (c > 0 ? c / (RUN[i] * LUCK[i]) : 0));
  const worst = Math.max(...each);
  return worst < 0.05 ? '-' : worst.toFixed(1);
};
const g = (...rows: string[]): string[] => rows;
const MEADOW = g('GGGGG', 'GGGGG', 'GGGGG', 'GGGGG', 'GGGGG');
const STRAIGHT = g('GGGGG', 'GGGGG', '-----', 'GGGGG', 'GGGGG');
const boons = (n: number, tier: number): { tier: number }[] => Array.from({ length: n }, () => ({ tier }));

console.log(`## 1. the anchors - the seven tiles the shop sold, was and is\n`);
console.log(`coefficients: base ${TILE_PRICE.base}, road ${TILE_PRICE.road}/cell, rock ${TILE_PRICE.rock}, vein ${TILE_PRICE.veinPerOre.toFixed(3)}/Ore, own-tier ${TILE_PRICE.veinTierPerOre.toFixed(3)}/Ore, boon power^${TILE_PRICE.boonExponent}/${TILE_PRICE.boonDivisor}, crowding +${TILE_PRICE.crowd * 100}% a feature\n`);
console.log('| tile | road cells | was | is | moved |');
console.log('|---|---|---|---|---|');
for (const t of libraryJson.tiles.filter((x) => (x as { special?: boolean }).special)) {
  const was = WAS[t.id];
  const is = priceTile(t as PricedTile);
  const road = [...t.cells.join('')].filter((c) => !'GROC'.includes(c)).length;
  const wasCost = [0, 0, 0]; if (was) wasCost[was[0] - 1] = was[1];
  const moved = was ? is.map((c, i) => c - wasCost[i]).map((d, i) => (d === 0 ? '' : `${d > 0 ? '+' : ''}${d}${i ? ` t${i + 1}` : ''}`)).filter(Boolean).join(', ') : 'new';
  console.log(`| ${t.id} | ${road} | ${was ? costText(wasCost) : '-'} | ${costText(is)} | ${moved || 'same'} |`);
}

console.log(`\n## 2. the dial - what a player pays for what, in the Smith\n`);
console.log('| the tile | price | runs of income it costs (the slowest purse) |');
console.log('|---|---|---|');
const DIAL: [string, PricedTile][] = [
  ['a plain straight road', { cells: STRAIGHT }],
  ['the twin bend (10 road cells)', { cells: g('GG|GG', 'GGL7G', '-7GL-', 'GL7GG', 'GG|GG') }],
  ['a straight + one ordinary vein (dealt by the dice)', { cells: g('GGGGG', 'GGOGG', '-----', 'GGGGG', 'GGGGG') }],
  ['a straight + one rich tier-1 vein (90)', { cells: g('GGGGG', 'GGOGG', '-----', 'GGGGG', 'GGGGG'), deposits: [{ amount: 90, tier: 1 }] }],
  ['a straight + one small tier-2 vein (30)', { cells: g('GGGGG', 'GGOGG', '-----', 'GGGGG', 'GGGGG'), deposits: [{ amount: 30, tier: 2 }] }],
  ['a straight + one tier-1 boon (+10%)', { cells: STRAIGHT, boons: boons(1, 1) }],
  ['a straight + one tier-2 boon (+20%)', { cells: STRAIGHT, boons: boons(1, 2) }],
  ['a straight + one tier-3 boon (+35%)', { cells: STRAIGHT, boons: boons(1, 3) }],
  ['a straight + one tier-4 boon (+50%)', { cells: STRAIGHT, boons: boons(1, 4) }],
  ['a straight + three tier-4 boons', { cells: STRAIGHT, boons: boons(3, 4) }],
  ['a straight + six tier-4 boons (a kill-zone)', { cells: STRAIGHT, boons: boons(6, 4) }],
  ['a straight + ten tier-4 boons', { cells: STRAIGHT, boons: boons(10, 4) }],
  ['four tier-3 veins (90) and nothing else', { cells: g('GGGGG', 'GOOGG', 'GOOGG', 'GGGGG', 'GGGGG'), deposits: Array.from({ length: 4 }, () => ({ amount: 90, tier: 3 })) }],
  ['THE CEILING: nine tier-3 veins (90) ringed by sixteen tier-4 boons', { cells: g('GGGGG', 'GOOOG', 'GOOOG', 'GOOOG', 'GGGGG'), deposits: Array.from({ length: 9 }, () => ({ amount: 90, tier: 3 })), boons: boons(16, 4) }],
];
for (const [name, tile] of DIAL) { const c = priceTile(tile); console.log(`| ${name} | ${costText(c)} | ${runs(c)} |`); }

console.log(`\n## 3. the shape - what the k-th tier-4 boon adds to a meadow\n`);
console.log('| k | price with k | the k-th adds |');
console.log('|---|---|---|');
let prev = priceTile({ cells: MEADOW })[0];
for (let k = 1; k <= 8; k++) { const p = priceTile({ cells: MEADOW, boons: boons(k, 4) })[0]; console.log(`| ${k} | ${p} | +${p - prev} |`); prev = p; }
