/**
 * The meta tree (PRD sec 11; session 29, PR 1): what banked Ore buys
 * between runs, resolved into ONE object the shell, the worker and the lab
 * all read - which towers may be built, which relics may be offered, how
 * many slots the Core holds, which Threats the setup page offers, and so
 * on. The tree owns the POOL and the CAPACITY, never the power (sec 7.5):
 * nothing here multiplies a stat.
 *
 * Content: packages/content/assets/tree/nodes.json (tree.schema.json). The
 * engine keeps the types beside the resolver so a test can build a tree by
 * hand; the content package validates the shipped file.
 */
import type { RelicDef } from '../sim/defs';

export interface TreeGrant {
  towers?: readonly string[];
  relics?: readonly string[];
  /** A branch: every COMMON relic of the tag joins the pool; rarer ones are earned by wins (sec 19 item 3). */
  relicTags?: readonly string[];
  relicSlots?: number;
  threat?: number;
  tileSlots?: number;
  oreTier?: number;
  endless?: boolean;
  tileSmith?: boolean;
  tiles?: readonly string[];
}

export interface TreeNode {
  id: string;
  name: string;
  branch: 'arsenal' | 'reliquary' | 'capacity' | 'threat' | 'ore';
  desc: string;
  cost: { tier: number; ore: number };
  requires?: readonly string[];
  grants: TreeGrant;
}

export interface TreeDef {
  base: TreeGrant;
  nodes: readonly TreeNode[];
}

/** What a player has: the nodes bought and the relics won (the meta save's half the run needs). */
export interface MetaState {
  /** Node ids bought, in any order. The sentinel [ALL_UNLOCKS] means everything (a save from before the tree). */
  unlocks: readonly string[];
  /** Relic ids earned by wins (rare and epic ones of unlocked branches). */
  earned: readonly string[];
  /** Relic id -> the highest rarity index it was ever forged to; the pool deals a tier only once forged (item 2). */
  forged: Readonly<Record<string, number>>;
}

/** A save from before the tree had everything; it keeps everything. */
export const ALL_UNLOCKS = '*';

export const EMPTY_META: MetaState = { unlocks: [], earned: [], forged: {} };

/** Everything the tree has granted, resolved. */
export interface Unlocked {
  towers: ReadonlySet<string>;
  relicTags: ReadonlySet<string>;
  /** Relic ids the pool may offer: the base list, every common of an unlocked tag, the earned ones. Fusion-only relics never need unlocking. */
  relics: ReadonlySet<string>;
  relicSlots: number;
  /** The highest Threat index the setup page offers. */
  threatMax: number;
  tileSlots: number;
  oreTierMax: number;
  endless: boolean;
  /** Special tile ids the workshop may sell. */
  tiles: ReadonlySet<string>;
  /** Every node is bought - the tree is complete. */
  everything: boolean;
}

function grantInto(g: TreeGrant, out: { towers: Set<string>; tags: Set<string>; relics: Set<string>; tiles: Set<string>; slots: number; threat: number; tileSlots: number; oreTier: number; endless: boolean }): void {
  for (const t of g.towers ?? []) out.towers.add(t);
  for (const t of g.relicTags ?? []) out.tags.add(t);
  for (const r of g.relics ?? []) out.relics.add(r);
  for (const t of g.tiles ?? []) out.tiles.add(t);
  out.slots += g.relicSlots ?? 0;
  out.threat = Math.max(out.threat, g.threat ?? 0);
  out.tileSlots += g.tileSlots ?? 0;
  out.oreTier = Math.max(out.oreTier, g.oreTier ?? 1);
  out.endless = out.endless || g.endless === true;
}

/**
 * Resolve the tree against what was bought and won. Unknown node ids are
 * ignored (a node retired from content must not brick a save); a node
 * whose requirements are not met still counts if it was bought (the
 * requirement is a purchase rule, not a resolution rule).
 */
export function resolveUnlocks(tree: TreeDef, meta: MetaState, relicDefs: readonly Pick<RelicDef, 'id' | 'rarity' | 'tags' | 'fusionOnly'>[]): Unlocked {
  const all = meta.unlocks.includes(ALL_UNLOCKS);
  const acc = { towers: new Set<string>(), tags: new Set<string>(), relics: new Set<string>(), tiles: new Set<string>(), slots: 0, threat: 0, tileSlots: 0, oreTier: 1, endless: false };
  grantInto(tree.base, acc);
  const bought = new Set(meta.unlocks);
  let count = 0;
  for (const n of tree.nodes) {
    if (!all && !bought.has(n.id)) continue;
    grantInto(n.grants, acc);
    count++;
  }
  for (const r of relicDefs) {
    if (all) { acc.relics.add(r.id); continue; }
    if (r.fusionOnly) { acc.relics.add(r.id); continue; }
    if (r.rarity === 'common' && (r.tags ?? []).some((t) => acc.tags.has(t))) acc.relics.add(r.id);
  }
  for (const id of meta.earned) acc.relics.add(id);
  if (all) for (const n of tree.nodes) for (const t of n.grants.towers ?? []) acc.towers.add(t);
  return {
    towers: acc.towers,
    relicTags: acc.tags,
    relics: acc.relics,
    relicSlots: acc.slots,
    threatMax: acc.threat,
    tileSlots: acc.tileSlots,
    oreTierMax: acc.oreTier,
    endless: acc.endless,
    tiles: acc.tiles,
    everything: all || count === tree.nodes.length,
  };
}

/** Why a node cannot be bought right now, or null when it can. */
export function whyNot(tree: TreeDef, meta: MetaState, ore: readonly number[], id: string): string | null {
  const n = tree.nodes.find((x) => x.id === id);
  if (!n) return 'no such node';
  if (meta.unlocks.includes(id) || meta.unlocks.includes(ALL_UNLOCKS)) return 'already bought';
  const missing = (n.requires ?? []).filter((r) => !meta.unlocks.includes(r));
  if (missing.length > 0) {
    const names = missing.map((m) => tree.nodes.find((x) => x.id === m)?.name ?? m);
    return `needs ${names.join(' and ')}`;
  }
  const have = ore[n.cost.tier - 1] ?? 0;
  if (have < n.cost.ore) return `needs ${n.cost.ore} tier-${n.cost.tier} ore (have ${have})`;
  return null;
}

/**
 * Buy a node: the new unlock list and the Ore left, or null when whyNot
 * says no. Pure - the caller saves.
 */
export function buyNode(tree: TreeDef, meta: MetaState, ore: readonly number[], id: string): { meta: MetaState; ore: number[] } | null {
  if (whyNot(tree, meta, ore, id) !== null) return null;
  const n = tree.nodes.find((x) => x.id === id)!;
  const next = [...ore];
  next[n.cost.tier - 1] -= n.cost.ore;
  return { meta: { ...meta, unlocks: [...meta.unlocks, id] }, ore: next };
}

/**
 * What a WIN earns (PRD sec 19 item 3): one relic of the rarity the Threat
 * sets - Standard a rare, Grim an epic (a rare when no epic is left) - from
 * the unlocked branches, not yet earned and not in the base list. Calm
 * earns Ore only. Deterministic per seed, so a replayed run earns the same
 * relic. Null when nothing is left to earn.
 */
export function relicForWin(tree: TreeDef, meta: MetaState, relicDefs: readonly Pick<RelicDef, 'id' | 'rarity' | 'tags' | 'fusionOnly'>[], threatIdx: number, seed: number): string | null {
  if (threatIdx < 1) return null;
  const u = resolveUnlocks(tree, meta, relicDefs);
  const candidates = (rarity: string): string[] =>
    relicDefs.filter((r) => r.rarity === rarity && !r.fusionOnly && !u.relics.has(r.id) && (r.tags ?? []).some((t) => u.relicTags.has(t))).map((r) => r.id).sort();
  const pool = threatIdx >= 2 ? (candidates('epic').length ? candidates('epic') : candidates('rare')) : candidates('rare');
  if (pool.length === 0) return null;
  // A small hash of the seed picks; no RNG stream is spent (the run is over).
  let h = seed >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  return pool[h % pool.length];
}

/**
 * Does this relic do anything in a run with these towers? A relic whose
 * only effect touches a tower kind (Grounding Rod's arcs, Overclock's beam,
 * Wide Aura's aura, Kindling's burn) is a dead pick in a run without that
 * tower; the worker and the lab leave it out of the run's pool (session
 * 31, PR 7; the register's "relic offers weighted by applicability").
 */
export function relicApplies(def: { needsTower?: readonly string[] }, towerIds: Iterable<string>): boolean {
  if (!def.needsTower || def.needsTower.length === 0) return true;
  const have = new Set(towerIds);
  return def.needsTower.some((t) => have.has(t));
}

/** The nodes of one branch, in content order. */
export function branchNodes(tree: TreeDef, branch: TreeNode['branch']): TreeNode[] {
  return tree.nodes.filter((n) => n.branch === branch);
}

/** An Ore cost BY TIER, index tier - 1 (invariant 9: Ore is stored per tier, and so is what it buys). */
export type OreCost = readonly number[];

/** Can this purse pay this cost - every tier of it? */
export function canPay(ore: readonly number[], cost: OreCost): boolean {
  return cost.every((c, i) => c <= 0 || (ore[i] ?? 0) >= c);
}

/** The purse after paying; the caller checked canPay. Pure. */
export function payCost(ore: readonly number[], cost: OreCost): number[] {
  const next = [...ore];
  cost.forEach((c, i) => { if (c > 0) next[i] = (next[i] ?? 0) - c; });
  return next;
}

/** A cost in words: "34 ore", "34 ore + 15 tier-2 ore". */
export function costText(cost: OreCost): string {
  const parts = cost.map((c, i) => (c > 0 ? `${c} ${i === 0 ? '' : `tier-${i + 1} `}ore` : '')).filter((s) => s !== '');
  return parts.length ? parts.join(' + ') : 'free';
}

/** The first tier this purse falls short in, in words, or null when it can pay. */
export function shortfall(ore: readonly number[], cost: OreCost): string | null {
  for (let i = 0; i < cost.length; i++) if (cost[i] > 0 && (ore[i] ?? 0) < cost[i]) return `needs ${cost[i]} tier-${i + 1} ore (have ${ore[i] ?? 0})`;
  return null;
}

/** What the pricing function reads: a tile's cells and its authored overlays. Nothing else prices a tile (PRD sec 27). */
export interface PricedTile {
  cells: readonly string[];
  deposits?: readonly { amount: number; tier?: number }[];
  boons?: readonly { tier: number }[];
}

/** A tile the workshop may sell: its id and its CONTENTS - the price is a function of them (PRD sec 27, D31), never a number in the content file. */
export interface ShopTile extends PricedTile {
  id: string;
}

/**
 * The pricing function's coefficients (PRD sec 27, D31). The lab's, not
 * Daniil's: docs/lab/price-sweep-2026-09-17.md states the targets and shows
 * each number meeting them. The shape is the requirement - FLAT for plain
 * authoring, STEEP to prohibitive for a loaded tile.
 */
export const TILE_PRICE = {
  /** Any tile at all: the slot it takes in a loadout, the guarantee that it lands. */
  base: 20,
  /** Per road cell: path length is what a road tile is FOR (longer under fire is easier). Base + road is the least-squares line through the five road specials' shipped prices. */
  road: 0.9,
  /** Per rock cell: a prospecting roll (ore 30%, a cache 6%). */
  rock: 1,
  /** A vein, per Ore it holds, in the tile's lower purse (a 60-Ore vein: 10). An ore cell with no authored vein is dealt 30-90 by the dice and is priced as the mean, 60 - it used to be free. */
  veinPerOre: 1 / 6,
  dealtVeinOre: 60,
  /** A vein above tier 1, per Ore it holds, in ITS OWN tier's Ore, on top (PRD sec 26). A 30-Ore tier-2 vein: 10 - less than half of one lucky run. */
  veinTierPerOre: 1 / 3,
  /** Boon ground by POWER, not by tier: power^1.5 / 3, power being the percent it adds (10/20/35/50 - Sim.boonEffect). 11 / 30 / 69 / 118: the strongest costs eleven of the weakest for five times the effect. */
  boonExponent: 1.5,
  boonDivisor: 3,
  /** Crowding: every feature after the first raises the price of ALL of them by this share. One boon is a purchase; a kill-zone of them is worth far more than its sum, and is priced so. */
  crowd: 0.15,
} as const;

/** The percent a boon of a tier adds (Sim.boonEffect's damage and rate ladder; a range boon's +tier cells is priced on the same rung). */
export const BOON_POWER_PCT: readonly number[] = [10, 20, 35, 50];

/** One line of a price: what is being paid for, and what it adds to which purse. */
export interface PriceLine {
  label: string;
  /** Purse index (tier - 1). */
  purse: number;
  ore: number;
}

/**
 * What a tile is worth, itemised (PRD sec 27, D31): the ONE pricing
 * function - the Smith's MINT and the workshop's shop both charge its sum,
 * so a minted tile and a bought tile of the same contents cost the same.
 * The Smith shows the lines, which is what makes the price a dial rather
 * than a verdict: the player sees what each feature costs before paying.
 *
 * Everything but a rare vein's own-tier Ore is charged in the purse one
 * below the richest vein (a tier-N vein is bought with tier-(N-1) Ore);
 * a vein above tier 1 also costs its own tier's Ore on top (sec 26).
 */
export function priceLines(tile: PricedTile): PriceLine[] {
  const P = TILE_PRICE;
  const cells = [...tile.cells.join('')];
  const road = cells.filter((c) => !'GROC'.includes(c)).length;
  const rock = cells.filter((c) => c === 'R').length;
  const authored = tile.deposits ?? [];
  const dealt = Math.max(0, cells.filter((c) => c === 'O').length - authored.length);
  const boons = tile.boons ?? [];
  const veinTier = Math.max(1, ...authored.map((d) => d.tier ?? 1));
  const lower = Math.max(1, Math.min(3, veinTier - 1)) - 1;
  const features = authored.length + dealt + boons.length;
  const crowd = 1 + P.crowd * Math.max(0, features - 1);

  const lines: PriceLine[] = [{ label: 'a tile', purse: lower, ore: P.base }];
  if (road > 0) lines.push({ label: `${road} road cell${road === 1 ? '' : 's'}`, purse: lower, ore: road * P.road });
  if (rock > 0) lines.push({ label: `${rock} rock`, purse: lower, ore: rock * P.rock });
  const veinOre = authored.reduce((a, d) => a + d.amount, 0) + dealt * P.dealtVeinOre;
  if (veinOre > 0) lines.push({ label: `${authored.length + dealt} vein${authored.length + dealt === 1 ? '' : 's'}, ${veinOre} Ore`, purse: lower, ore: veinOre * P.veinPerOre * crowd });
  for (let t = 1; t <= 4; t++) {
    const n = boons.filter((b) => b.tier === t).length;
    if (n === 0) continue;
    const each = Math.pow(BOON_POWER_PCT[t - 1] ?? BOON_POWER_PCT[0], P.boonExponent) / P.boonDivisor;
    lines.push({ label: `${n} tier-${t} boon${n === 1 ? '' : 's'}`, purse: lower, ore: n * each * crowd });
  }
  for (let t = 2; t <= 3; t++) {
    const ore = authored.filter((d) => Math.min(3, d.tier ?? 1) === t).reduce((a, d) => a + d.amount, 0);
    if (ore > 0) lines.push({ label: `tier-${t} veins, on top`, purse: t - 1, ore: ore * P.veinTierPerOre * crowd });
  }
  if (features > 1) lines.push({ label: `${features} features: x${crowd.toFixed(2)} on each`, purse: lower, ore: 0 });
  return lines;
}

/** The sum of priceLines, per purse, rounded once at the end - what is actually charged. */
export function priceTile(tile: PricedTile): OreCost {
  const cost = [0, 0, 0];
  for (const l of priceLines(tile)) cost[l.purse] += l.ore;
  return cost.map((c) => Math.round(c));
}

/** The most copies of one tile a player may hold (session 33, PR 7: the multiset): the carve places each loaded copy, and a loadout holds at most the tree's tile slots. */
export const MAX_TILE_COPIES = 3;

/** What the next copy of a tile costs (session 33, PR 7; D33): the tile's price, plus half of it per copy already owned - in every purse the price touches. */
export function copyPrice(tile: ShopTile, owned: Readonly<Record<string, number>>): OreCost {
  const copies = owned[tile.id] ?? 0;
  return priceTile(tile).map((c) => Math.round(c * (1 + 0.5 * copies)));
}

/** Why a tile cannot be bought now, or null (PRD sec 11.1; session 29, PR 5). */
export function whyNotTile(unlocked: Unlocked, owned: Readonly<Record<string, number>>, ore: readonly number[], tile: ShopTile): string | null {
  if ((owned[tile.id] ?? 0) >= MAX_TILE_COPIES) return `owned x${MAX_TILE_COPIES} - the most a tile may be held`;
  if (!unlocked.tiles.has(tile.id)) return 'the tree has not opened it';
  return shortfall(ore, copyPrice(tile, owned));
}

/** Buy one copy (a second and a third at a rising price - the multiset of PRD sec 11.1): the new owned record and the Ore left, or null when whyNotTile says no. Pure - the caller saves. */
export function buyTile(unlocked: Unlocked, owned: Readonly<Record<string, number>>, ore: readonly number[], tile: ShopTile): { owned: Record<string, number>; ore: number[] } | null {
  if (whyNotTile(unlocked, owned, ore, tile) !== null) return null;
  return { owned: { ...owned, [tile.id]: (owned[tile.id] ?? 0) + 1 }, ore: payCost(ore, copyPrice(tile, owned)) };
}

/** Every tile the tree can ever sell - the base's and every node's. */
export function everyShopTile(tree: TreeDef): string[] {
  const ids = new Set<string>(tree.base.tiles ?? []);
  for (const n of tree.nodes) for (const t of n.grants.tiles ?? []) ids.add(t);
  return [...ids];
}

/**
 * The Tile Smith opens only once every purchasable tile is owned (Daniil,
 * answer 6, 2026-09-06): the authorship endgame comes after the pool.
 */
export function smithOpen(tree: TreeDef, owned: Readonly<Record<string, number>>): { open: boolean; owned: number; total: number } {
  const all = everyShopTile(tree);
  const have = all.filter((id) => (owned[id] ?? 0) > 0).length;
  return { open: all.length > 0 && have === all.length, owned: have, total: all.length };
}
