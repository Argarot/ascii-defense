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

/** The nodes of one branch, in content order. */
export function branchNodes(tree: TreeDef, branch: TreeNode['branch']): TreeNode[] {
  return tree.nodes.filter((n) => n.branch === branch);
}

/** A tile the workshop may sell: its id and its price. */
export interface ShopTile {
  id: string;
  price?: { tier: number; ore: number };
}

/**
 * Why a tile cannot be bought now, or null (PRD sec 11.1; session 29, PR 5).
 * One copy each: the generator guarantees a chosen id once, so a second
 * copy would buy nothing (the multiset of sec 11.1 waits for a generator
 * that places copies).
 */
export function whyNotTile(unlocked: Unlocked, owned: Readonly<Record<string, number>>, ore: readonly number[], tile: ShopTile): string | null {
  if (!tile.price) return 'not for sale';
  if ((owned[tile.id] ?? 0) > 0) return 'owned';
  if (!unlocked.tiles.has(tile.id)) return 'the tree has not opened it';
  const have = ore[tile.price.tier - 1] ?? 0;
  if (have < tile.price.ore) return `needs ${tile.price.ore} tier-${tile.price.tier} ore (have ${have})`;
  return null;
}

/** Buy one copy: the new owned record and the Ore left, or null when whyNotTile says no. Pure - the caller saves. */
export function buyTile(unlocked: Unlocked, owned: Readonly<Record<string, number>>, ore: readonly number[], tile: ShopTile): { owned: Record<string, number>; ore: number[] } | null {
  if (whyNotTile(unlocked, owned, ore, tile) !== null) return null;
  const next = [...ore];
  next[tile.price!.tier - 1] -= tile.price!.ore;
  return { owned: { ...owned, [tile.id]: (owned[tile.id] ?? 0) + 1 }, ore: next };
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
