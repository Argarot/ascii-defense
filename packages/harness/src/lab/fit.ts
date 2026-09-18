/**
 * The fit harness (session 39, D37): named plans played against a PATCH of
 * the game - a rule of combat, an enemy's armour, a resistance, a tier's
 * numbers, a Threat's curve - without touching a shipped file. One shard of a
 * corpus per process; tools/fit.mjs runs the shards and prints the table.
 *
 * D37 made the damage model the thing that bounds a build, which means
 * moving many numbers against six targets at once. Doing that by editing
 * content and re-running the ladder is forty minutes a guess; this is under
 * one.
 *
 *   node tools/fit.mjs [--patch=file.json] [--seeds=80] [--plans=standard:spam,grim:reference]
 *
 * A patch (every key optional):
 *   { "rules":   { "armorFloor": 0.1, "armorBlunts": "kinetic", "plating": { "from": 6, "every": 3, "add": 1 } },
 *     "enemies": { "husk": { "armor": 4, "resist": { "kinetic": 1, "energy": 0.4 } } },
 *     "towers":  { "bolt": { "cost": 20, "projectile": { "damage": 8 }, "tiers": [[{ "cost": 25 }, null], null, [{ "mods": { "damage": 40 } }, null]] } },
 *     "threats": { "grim": { "hpGeometric": 1.12 } } }
 */
import { STARTING_SCRAP, THREAT_LEVELS, TileLibrary, type CombatRules, type DifficultySpec, type EnemyDef, type TowerDef } from '@ascii-defense/engine';
import { validateEnemies, validateRelics, validateTowers, validateTree } from '@ascii-defense/content';
import treeJson from '@ascii-defense/content/assets/tree/nodes.json';
import libraryJson from '@ascii-defense/content/assets/tiles/library.json';
import enemiesJson from '@ascii-defense/content/assets/enemies/roster.json';
import towersJson from '@ascii-defense/content/assets/towers/roster.json';
import relicsJson from '@ascii-defense/content/assets/relics/pool.json';
import { runLab, type LabContent, type TowerPlacement } from './lab';

declare const console: { log: (...args: unknown[]) => void };
declare const process: { argv: string[]; env: Record<string, string | undefined> };

function must<T>(r: { ok: true; value: T } | { ok: false; errors: unknown[] }): T {
  if (!r.ok) throw new Error('content invalid: ' + JSON.stringify(r.errors).slice(0, 200));
  return r.value;
}

interface TierPatch { cost?: number; mods?: Record<string, number>; /** null takes a capability away (a Railbore that no longer ignores armour). */ unlocks?: string | null }
interface Patch {
  rules?: Partial<CombatRules>;
  /** The purse a run starts with (100 as shipped). */
  startingScrap?: number;
  /** Every tower's price by one rule: the chassis times `base`, each tier choice times `tiers` - the split between a tower and its upgrades, which is what makes width or depth the better buy. `except` keeps its prices. */
  scale?: { base: number; tiers: number; except?: string[] };
  enemies?: Record<string, Partial<EnemyDef>>;
  towers?: Record<string, { cost?: number; range?: number; fireEveryTicks?: number; projectile?: Record<string, number>; tiers?: ((TierPatch | null)[] | null)[] }>;
  threats?: Record<string, Partial<DifficultySpec> & { finalWave?: number }>;
}
/** The patch arrives in the environment (FIT_PATCH, JSON): a shard is spawned by the runner, and a command line is no place for braces. */
const patch: Patch = JSON.parse(process.env.FIT_PATCH ?? '{}') as Patch;

const enemyDefs = must(validateEnemies.check(enemiesJson)).enemies.map((d) => ({ ...d, ...(patch.enemies?.[d.id] ?? {}) }));
const scaled = (d: TowerDef): TowerDef => {
  const s = patch.scale;
  if (!s || s.except?.includes(d.id)) return d;
  return { ...d, cost: Math.round(d.cost * s.base), tiers: d.tiers?.map((tier) => ({ ...tier, choices: tier.choices.map((c) => ({ ...c, cost: Math.max(1, Math.round((c.cost * s.tiers) / 5) * 5) })) })) } as TowerDef;
};
const towerDefs = must(validateTowers.check(towersJson)).towers.map(scaled).map((d): TowerDef => {
  const p = patch.towers?.[d.id];
  if (!p) return d;
  const tiers = d.tiers?.map((tier, ti) => ({ ...tier, choices: tier.choices.map((c, ci) => {
    const tp = p.tiers?.[ti]?.[ci];
    if (!tp) return c;
    const next = { ...c, cost: tp.cost ?? c.cost, mods: tp.mods ? { ...tp.mods } : c.mods };
    if (tp.unlocks === null) delete (next as { unlocks?: string }).unlocks;
    return next;
  }) }));
  return { ...d, cost: p.cost ?? d.cost, range: p.range ?? d.range, fireEveryTicks: p.fireEveryTicks ?? d.fireEveryTicks, projectile: d.projectile && p.projectile ? { ...d.projectile, ...p.projectile } : d.projectile, tiers } as TowerDef;
});
const content: LabContent = {
  lib: new TileLibrary(libraryJson.tiles),
  enemyDefs,
  towerDefs,
  relicDefs: must(validateRelics.check(relicsJson)).relics,
  tree: must(validateTree.check(treeJson)),
};

const arg = (name: string): string | undefined => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
const N = Number(arg('seeds') ?? 80);
const [SHARD, SHARDS] = (arg('shard') ?? '0/1').split('/').map(Number);
const WANTED = (arg('plans') ?? '').split(',').filter(Boolean);

const RAIL: [number, number, number] = [0, 0, 0];
const PLAIN: [number, number, number] = [-1, -1, -1];
const P = (towerId: string, choices: [number, number, number], at: TowerPlacement['at'] = 'choke'): TowerPlacement => ({ towerId, choices, at });
const LINE: TowerPlacement[] = [P('bolt', RAIL), P('frost', [1, 0, 1]), P('bolt', RAIL), P('mortar', [1, 1, 0]), P('bolt', RAIL)];
const VEIN = P('refinery', [0, 0, 0], 'vein');
/** Six relics a build would be glad of, held from wave 1 - common for the base world, epic for the tree: the rarity band is what differs. */
/** COMMONS only: the base world's pool holds nothing rarer (D29), and a set that names a rare is refused on every seed. */
const SIX = ['hot_loads', 'quick_hands', 'iron_sights', 'deep_cold', 'thick_walls', 'second_wind'];
/** What carries a Bolt-only build (target S5): more per hit, more hits, more bodies per hit, more reach, more Scrap for the next Bolt. */
const BOLT_SET = ['hot_loads', 'quick_hands', 'wide_net', 'ricochet', 'iron_sights', 'bounty_hunter'];
interface Plan { towers: TowerPlacement[]; tail?: TowerPlacement[]; unlocks: string[]; relics?: { id: string; rarity: number }[] }
const held = (ids: string[], rarity: number): { id: string; rarity: number }[] => ids.map((id) => ({ id, rarity }));
const PLANS: Record<string, Plan> = {
  naive1: { towers: [P('bolt', PLAIN, 'entry')], unlocks: [] },
  naive3: { towers: [P('bolt', PLAIN, 'entry'), P('bolt', PLAIN, 'entry'), P('bolt', PLAIN, 'entry')], unlocks: [] },
  spam: { towers: [P('bolt', PLAIN)], tail: [P('bolt', PLAIN)], unlocks: [] },
  spamRelics: { towers: [P('bolt', PLAIN)], tail: [P('bolt', PLAIN)], unlocks: [], relics: held(BOLT_SET, 0) },
  forks: { towers: [P('bolt', [0, 0, -1])], tail: [P('bolt', [0, 0, -1])], unlocks: [] },
  rails: { towers: [P('bolt', RAIL)], tail: [P('bolt', RAIL)], unlocks: [] },
  railsRelics: { towers: [P('bolt', RAIL)], tail: [P('bolt', RAIL)], unlocks: [], relics: held(BOLT_SET, 0) },
  gatlings: { towers: [P('bolt', [1, 1, 1])], tail: [P('bolt', [1, 1, 1])], unlocks: [] },
  mortars: { towers: [P('bolt', PLAIN), P('mortar', [0, 0, 0])], tail: [P('mortar', [0, 0, 0])], unlocks: [] },
  reference: { towers: [VEIN, ...LINE], tail: LINE, unlocks: [] },
  /** The reference for a player who looks at the map: a gun before the Refinery (the tail probe of 2026-09-17 - the Refinery first is the lab's commonest mistake, not the map's). */
  gunFirst: { towers: [P('bolt', RAIL), VEIN, P('frost', [1, 0, 1]), P('bolt', RAIL), P('mortar', [1, 1, 0]), P('bolt', RAIL)], tail: LINE, unlocks: [] },
  gunFirstRelics: { towers: [P('bolt', RAIL), VEIN, P('frost', [1, 0, 1]), P('bolt', RAIL), P('mortar', [1, 1, 0]), P('bolt', RAIL)], tail: LINE, unlocks: [], relics: held(SIX, 0) },
  referenceRelics: { towers: [VEIN, ...LINE], tail: LINE, unlocks: [], relics: held(SIX, 0) },
  // DEPTH FIRST (session 39): one gun taken through its choices, the Refinery, then each tower of the line in turn,
  // each finished before the next. The plans above place all six chassis before the first upgrade - which is how the
  // lab has always played them, and is the mistake an expensive chassis punishes: it made the mixed line look weaker
  // than mono-Railbore when what differed was the ORDER, not the towers.
  mixedDeep: { towers: [P('bolt', RAIL), VEIN], tail: [P('frost', [1, 0, 1]), P('bolt', RAIL), P('mortar', [1, 1, 0]), P('bolt', RAIL)], unlocks: [] },
  mixedDeepRelics: { towers: [P('bolt', RAIL), VEIN], tail: [P('frost', [1, 0, 1]), P('bolt', RAIL), P('mortar', [1, 1, 0]), P('bolt', RAIL)], unlocks: [], relics: held(SIX, 0) },
  treeBaseDeep: { towers: [P('bolt', RAIL), VEIN], tail: [P('frost', [1, 0, 1]), P('bolt', RAIL), P('mortar', [1, 1, 0]), P('bolt', RAIL)], unlocks: ['*'], relics: held(SIX, 2) },
  treeMixedDeep: { towers: [P('bolt', RAIL), VEIN], tail: [P('tesla', [0, 0, 0]), P('frost', [1, 0, 1]), P('bolt', RAIL), P('laser', [0, 0, 0], 'inline'), P('mortar', [1, 1, 0])], unlocks: ['*'], relics: held(SIX, 2) },
  treeLaserDeep: { towers: [P('bolt', RAIL), VEIN], tail: [P('laser', [0, 0, 0], 'inline'), P('bolt', RAIL)], unlocks: ['*'], relics: held(SIX, 2) },
  treeTeslaDeep: { towers: [P('bolt', RAIL), VEIN], tail: [P('tesla', [0, 0, 0]), P('bolt', RAIL)], unlocks: ['*'], relics: held(SIX, 2) },
  treeMissileDeep: { towers: [P('bolt', RAIL), VEIN], tail: [P('missile', [0, 1, 0]), P('bolt', RAIL)], unlocks: ['*'], relics: held(SIX, 2) },
  treeRails: { towers: [P('bolt', RAIL)], tail: [P('bolt', RAIL)], unlocks: ['*'], relics: held(SIX, 2) },
  treeBase: { towers: [VEIN, ...LINE], tail: LINE, unlocks: ['*'], relics: held(SIX, 2) },
  treeLaser: { towers: [VEIN, P('bolt', RAIL), P('laser', [0, 0, 0], 'inline'), P('frost', [1, 0, 1]), P('laser', [0, 0, 0], 'inline'), P('laser', [1, 1, 1], 'inline')], tail: [P('laser', [0, 0, 0], 'inline'), P('bolt', RAIL)], unlocks: ['*'], relics: held(SIX, 2) },
  treeTesla: { towers: [VEIN, P('bolt', RAIL), P('tesla', [0, 0, 0]), P('bastion', [0, 1, 0], 'adjacent'), P('frost', [1, 0, 1]), P('tesla', [1, 1, 0])], tail: [P('tesla', [0, 0, 0]), P('bolt', RAIL)], unlocks: ['*'], relics: held(SIX, 2) },
  treeMissile: { towers: [VEIN, P('bolt', RAIL), P('missile', [0, 1, 0]), P('bastion', [0, 0, 0], 'adjacent'), P('missile', [1, 0, 1]), P('bolt', RAIL)], tail: [P('missile', [0, 1, 0]), P('bolt', RAIL)], unlocks: ['*'], relics: held(SIX, 2) },
  treeMixed: { towers: [VEIN, P('bolt', RAIL), P('tesla', [0, 0, 0]), P('frost', [1, 0, 1]), P('mortar', [1, 1, 0]), P('laser', [0, 0, 0], 'inline')], tail: [P('bolt', RAIL), P('tesla', [0, 0, 0]), P('laser', [0, 0, 0], 'inline')], unlocks: ['*'], relics: held(SIX, 2) },
};
const THREAT_KEYS = ['calm', 'standard', 'grim'];

for (const want of WANTED) {
  const [threatKey, planKey] = want.split(':');
  const shipped = THREAT_LEVELS[THREAT_KEYS.indexOf(threatKey)];
  const plan = PLANS[planKey];
  if (!shipped || !plan) throw new Error(`unknown threat or plan in '${want}' - plans: ${Object.keys(PLANS).join(', ')}`);
  const { finalWave: patchedFinal, ...curve } = patch.threats?.[threatKey] ?? {};
  const threat = { ...shipped, finalWave: patchedFinal ?? shipped.finalWave, difficulty: { ...shipped.difficulty, ...curve } };
  for (let i = SHARD; i < N; i += SHARDS) {
    const seed = (i + 1) * 7919 + 13;
    let death: number | null | 'refused';
    let towers = 0;
    let why: string | undefined;
    try {
      const r = runLab({ seed, map: { width: 7, height: 5, threat }, towers: plan.towers, tail: plan.tail, relicIds: [], relics: plan.relics, unlocks: plan.unlocks, interWaveTicks: threat.waveSeconds * 20, difficulty: threat.difficulty, rules: patch.rules, maxWaves: threat.finalWave, economy: { startingScrap: patch.startingScrap ?? STARTING_SCRAP } }, content);
      death = r.deathWave;
      towers = r.waves[r.waves.length - 1]?.towersEnd ?? 0;
    } catch (e) { death = 'refused'; why = e instanceof Error ? e.message : String(e); }
    console.log(JSON.stringify({ run: want, seed, death, towers, final: threat.finalWave, why }));
  }
}
