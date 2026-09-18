/**
 * The balance gate's player (session 38; WBS 1.5.2 and 3.2): one shard of a
 * small corpus, every plan the committed bands name, one JSON line per run.
 * tools/balance-check.mjs runs the shards, reads the bands in
 * packages/harness/balance/targets.json and fails outside them.
 *
 * The bands record what the game IS on the day they were set, target met or
 * not - a gate that only knew the wished-for numbers would be red from its
 * first day and teach everyone to ignore it. What it catches is a CHANGE:
 * a curve nudged, a tower re-priced, a generator rule that shortens roads.
 *
 *   node tools/balance-check.mjs [--seeds=N] [--jobs=N]
 */
import { STARTING_SCRAP, THREAT_LEVELS, TileLibrary } from '@ascii-defense/engine';
import { validateEnemies, validateRelics, validateTowers, validateTree } from '@ascii-defense/content';
import treeJson from '@ascii-defense/content/assets/tree/nodes.json';
import libraryJson from '@ascii-defense/content/assets/tiles/library.json';
import enemiesJson from '@ascii-defense/content/assets/enemies/roster.json';
import towersJson from '@ascii-defense/content/assets/towers/roster.json';
import relicsJson from '@ascii-defense/content/assets/relics/pool.json';
import { runLab, type LabContent, type TowerPlacement } from './lab';

declare const console: { log: (...args: unknown[]) => void };
declare const process: { argv: string[] };

function must<T>(r: { ok: true; value: T } | { ok: false; errors: unknown[] }): T {
  if (!r.ok) throw new Error('content invalid: ' + JSON.stringify(r.errors).slice(0, 200));
  return r.value;
}
const content: LabContent = {
  lib: new TileLibrary(libraryJson.tiles),
  enemyDefs: must(validateEnemies.check(enemiesJson)).enemies,
  towerDefs: must(validateTowers.check(towersJson)).towers,
  relicDefs: must(validateRelics.check(relicsJson)).relics,
  tree: must(validateTree.check(treeJson)),
};

const arg = (name: string): string | undefined => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
const N = Number(arg('seeds') ?? 40);
const [SHARD, SHARDS] = (arg('shard') ?? '0/1').split('/').map(Number);
/** `--plans=calm:naive1,grim:reference`: the (threat, plan) pairs the bands name - nothing else is played. */
const WANTED = (arg('plans') ?? '').split(',').filter(Boolean);

const RAIL: [number, number, number] = [0, 0, 0];
const PLAIN: [number, number, number] = [-1, -1, -1];
const P = (towerId: string, choices: [number, number, number], at: TowerPlacement['at'] = 'choke'): TowerPlacement => ({ towerId, choices, at });
const LINE: TowerPlacement[] = [P('bolt', RAIL), P('frost', [1, 0, 1]), P('bolt', RAIL), P('mortar', [1, 1, 0]), P('bolt', RAIL)];
/** The plans a band may name. A plan with no tail is a player who stops on purpose. */
/** The mixed line bought DEPTH FIRST: one gun through its choices, the Refinery, then each tower of the line finished before the next (D37: an upgrade is the better buy, and a plan that lays six chassis first is playing badly on purpose). */
const DEEP = { towers: [P('bolt', RAIL), P('refinery', [0, 0, 0], 'vein')], tail: [P('frost', [1, 0, 1]), P('bolt', RAIL), P('mortar', [1, 1, 0]), P('bolt', RAIL)] };
/** Six relics a build is glad of; held at rarity 2 they stand for the tree's epic band (the base world's pool holds commons alone). */
const SIX = ['hot_loads', 'quick_hands', 'iron_sights', 'deep_cold', 'thick_walls', 'second_wind'];
/** What carries a Bolt-only build (#365): a bigger small hit, plate ignored, more per hit, more hits, more bodies per hit, more Scrap for the next Bolt. */
const BOLT_SET = ['payload', 'penetrators', 'hot_loads', 'quick_hands', 'wide_net', 'bounty_hunter'];
const PLANS: Record<string, { towers: TowerPlacement[]; tail?: TowerPlacement[]; unlocks: string[]; horizon?: number; relics?: { id: string; rarity: number }[] }> = {
  mixed: { ...DEEP, unlocks: [] },
  tree: { ...DEEP, unlocks: ['*'], relics: SIX.map((id) => ({ id, rarity: 2 })) },
  // The THERMOMETER (not a player): the six-tower reference that stops buying, played to wave 40. It dies in the
  // middle of the run on Standard and Grim, so its mean death wave moves with the smallest change to a curve, a
  // price or a road - where a win rate near 100% does not move at all. This is what "the reference dies at 22-24"
  // was always good for, and the only thing.
  probe6: { towers: [P('refinery', [0, 0, 0], 'vein'), ...LINE], unlocks: [], horizon: 40 },
  naive1: { towers: [P('bolt', PLAIN, 'entry')], unlocks: [] },
  naive3: { towers: [P('bolt', PLAIN, 'entry'), P('bolt', PLAIN, 'entry'), P('bolt', PLAIN, 'entry')], unlocks: [] },
  spam: { towers: [P('bolt', PLAIN)], tail: [P('bolt', PLAIN)], unlocks: [] },
  reference: { towers: [P('refinery', [0, 0, 0], 'vein'), ...LINE], tail: LINE, unlocks: [] },
  // THE SYNERGY (#365; the same plans as fit.ts): plain-Bolt width holding the six commons that carry it, and the
  // door that set could open - the base world's mixed line holding the same six on Grim, which it must still lose.
  spamRelics: { towers: [P('bolt', PLAIN)], tail: [P('bolt', PLAIN)], unlocks: [], relics: BOLT_SET.map((id) => ({ id, rarity: 0 })) },
  mixedBolt: { ...DEEP, unlocks: [], relics: BOLT_SET.map((id) => ({ id, rarity: 0 })) },
  // THE ENERGY DOOR (D38; the same plans as fit.ts, where their story is): width in the cheapest energy hit in the
  // game - Ice Shards and no further - alone and holding the tree's relics, and the tree's mono-energy line played
  // depth first, which has to lose to `tree` above.
  frostSpam: { towers: [P('frost', [1, -1, -1])], tail: [P('frost', [1, -1, -1])], unlocks: [] },
  treeFrostSpam: { towers: [P('frost', [1, -1, -1])], tail: [P('frost', [1, -1, -1])], unlocks: ['*'], relics: SIX.map((id) => ({ id, rarity: 2 })) },
  treeEnergy: { towers: [P('frost', [1, 1, 1]), P('refinery', [0, 0, 0], 'vein')], tail: [P('tesla', [0, 0, 0]), P('laser', [0, 0, 0], 'inline'), P('frost', [1, 1, 1])], unlocks: ['*'], relics: SIX.map((id) => ({ id, rarity: 2 })) },
};
const THREAT_KEYS = ['calm', 'standard', 'grim'];

for (const want of WANTED) {
  const [threatKey, planKey] = want.split(':');
  const threat = THREAT_LEVELS[THREAT_KEYS.indexOf(threatKey)];
  const plan = PLANS[planKey];
  if (!threat || !plan) throw new Error(`unknown threat or plan in '${want}'`);
  for (let i = SHARD; i < N; i += SHARDS) {
    const seed = (i + 1) * 7919 + 13;
    let death: number | null | 'refused';
    try {
      death = runLab({ seed, map: { width: 7, height: 5, threat }, towers: plan.towers, tail: plan.tail, relicIds: [], relics: plan.relics, unlocks: plan.unlocks, interWaveTicks: threat.waveSeconds * 20, difficulty: threat.difficulty, maxWaves: plan.horizon ?? threat.finalWave, economy: { startingScrap: STARTING_SCRAP } }, content).deathWave;
    } catch { death = 'refused'; }
    console.log(JSON.stringify({ run: want, seed, death, horizon: plan.horizon ?? threat.finalWave }));
  }
}
