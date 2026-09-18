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
 *   { "rules":   { "armorFloor": 0.1, "armorBlunts": "kinetic", "plating": { "from": 6, "every": 3, "add": 1 }, "insulating": null },
 *     "enemies": { "husk": { "armor": 4, "insulation": 4, "resist": { "kinetic": 1, "energy": 0.4 } } },
 *     "towers":  { "bolt": { "cost": 20, "projectile": { "damage": 8 }, "tiers": [[{ "cost": 25 }, null], null, [{ "mods": { "damage": 40 } }, null]] } },
 *     "threats": { "grim": { "hpGeometric": 1.12 } } }
 */
import { THREAT_LEVELS, TileLibrary, type CombatRules, type DifficultySpec, type EnemyDef, type TowerDef } from '@ascii-defense/engine';
import { validateEnemies, validateRelics, validateTowers, validateTree } from '@ascii-defense/content';
import treeJson from '@ascii-defense/content/assets/tree/nodes.json';
import libraryJson from '@ascii-defense/content/assets/tiles/library.json';
import enemiesJson from '@ascii-defense/content/assets/enemies/roster.json';
import towersJson from '@ascii-defense/content/assets/towers/roster.json';
import relicsJson from '@ascii-defense/content/assets/relics/pool.json';
import { runLab, type LabContent } from './lab';
import { THREAT_KEYS, planOf } from './plans';
import { corpusSeed, specFor } from './spec';

declare const console: { log: (...args: unknown[]) => void };
declare const process: { argv: string[]; env: Record<string, string | undefined> };

function must<T>(r: { ok: true; value: T } | { ok: false; errors: unknown[] }): T {
  if (!r.ok) throw new Error('content invalid: ' + JSON.stringify(r.errors).slice(0, 200));
  return r.value;
}

interface TierPatch { cost?: number; mods?: Record<string, number>; /** null takes a capability away (a Railbore that no longer ignores armour). */ unlocks?: string | null }
interface Patch {
  rules?: Partial<CombatRules>;
  /** The purse a run starts with (the engine's STARTING_SCRAP when absent - this comment typed "100" for a day after D37 made it 200). */
  startingScrap?: number;
  /** Every tower's price by one rule: the chassis times `base`, each tier choice times `tiers` - the split between a tower and its upgrades, which is what makes width or depth the better buy. `except` keeps its prices. */
  scale?: { base: number; tiers: number; except?: string[] };
  enemies?: Record<string, Partial<EnemyDef>>;
  towers?: Record<string, { cost?: number; range?: number; fireEveryTicks?: number; projectile?: Record<string, number>; tiers?: ((TierPatch | null)[] | null)[] }>;
  threats?: Record<string, Partial<DifficultySpec> & { finalWave?: number }>;
  /** A relic's numbers, by id: its common `effects` and any of its `tiers`, merged over what ships (#365). */
  relics?: Record<string, { effects?: Record<string, unknown>; tiers?: Record<string, { effects: Record<string, unknown> }> }>;
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
  relicDefs: must(validateRelics.check(relicsJson)).relics.map((r) => {
    const p = patch.relics?.[r.id];
    if (!p) return r;
    const tiers = { ...(r.tiers ?? {}) } as Record<string, { desc?: string; effects: Record<string, unknown> }>;
    for (const [band, t] of Object.entries(p.tiers ?? {})) tiers[band] = { ...tiers[band], effects: { ...tiers[band]?.effects, ...t.effects } };
    return { ...r, effects: { ...r.effects, ...p.effects }, tiers } as typeof r;
  }),
  tree: must(validateTree.check(treeJson)),
};

const arg = (name: string): string | undefined => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
const N = Number(arg('seeds') ?? 80);
const [SHARD, SHARDS] = (arg('shard') ?? '0/1').split('/').map(Number);
const WANTED = (arg('plans') ?? '').split(',').filter(Boolean);

for (const want of WANTED) {
  const [threatKey, planKey] = want.split(':');
  const shipped = THREAT_LEVELS[THREAT_KEYS.indexOf(threatKey as (typeof THREAT_KEYS)[number])];
  if (!shipped) throw new Error(`unknown threat in '${want}' - threats: ${THREAT_KEYS.join(', ')}`);
  const plan = planOf(planKey);
  const { finalWave: patchedFinal, ...curve } = patch.threats?.[threatKey] ?? {};
  const threat = { ...shipped, finalWave: patchedFinal ?? shipped.finalWave, difficulty: { ...shipped.difficulty, ...curve } };
  // An instrument plays past the win (the thermometer's horizon); a player plays to the Threat's final wave.
  const horizon = plan.horizon ?? threat.finalWave;
  for (let i = SHARD; i < N; i += SHARDS) {
    const seed = corpusSeed(i);
    let death: number | null | 'refused';
    let towers = 0;
    let why: string | undefined;
    try {
      const r = runLab(specFor(threat, plan, seed, { rules: patch.rules, startingScrap: patch.startingScrap, horizon }), content);
      death = r.deathWave;
      towers = r.waves[r.waves.length - 1]?.towersEnd ?? 0;
    } catch (e) { death = 'refused'; why = e instanceof Error ? e.message : String(e); }
    console.log(JSON.stringify({ run: want, seed, death, towers, final: horizon, why }));
  }
}
