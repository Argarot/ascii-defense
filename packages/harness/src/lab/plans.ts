/**
 * ONE table of plans (2026-09-18, the last quarter of "What bounds a build").
 *
 * Every lab tool that plays a named player takes it from here: the fit
 * harness (fit.ts), the balance gate (balanceCheck.ts), the ladder
 * (buildSweep.ts --debt, tools/ladder.mjs) and the seed corpus
 * (seedCorpus.ts). Until this file, fit.ts and balanceCheck.ts held hand
 * copies of the same plans under different names (`mixed` was `mixedDeep`,
 * `tree` was `treeBaseDeep`), and the ladder and the corpus still laid six
 * chassis before the first upgrade - a player D37's prices punish: the
 * chassis-first reference wins Standard 46% where the depth-first line wins
 * 93%, so the corpus's "unwinnable" and the ladder's rungs were being read
 * off a player nobody should be.
 *
 * A plan is WHO PLAYS, never what the game is: towers bought in order, what
 * the player goes on buying (`tail`; a plan without one is a player who
 * stops on purpose - say so in its story), the tree state it plays under
 * (`unlocks`; [] is the base world), and relics held from wave 1. Pure data:
 * nothing here reads content or runs a seed.
 *
 * Before adding a plan, read CONTRIBUTING sec 5: a rule that closes one door
 * gets a rung for the door it opens; check two plans are played the same WAY
 * before believing one beats the other; no row "holds nothing" (the lab
 * takes option 0 of every offer).
 */
import type { TowerPlacement } from './lab';

export interface Plan {
  towers: TowerPlacement[];
  /** What the player goes on buying once `towers` is bought out (issue #348). Absent: a player who stops on purpose. */
  tail?: TowerPlacement[];
  /** The tree state: [] is the base world, ['*'] the whole workshop. */
  unlocks: string[];
  /** Relics held from wave 1, by id and rarity band (0 common, 1 rare, 2 epic). */
  relics?: { id: string; rarity: number }[];
  /** Play to this wave instead of the Threat's final one - an INSTRUMENT, not a player (the thermometer). */
  horizon?: number;
}

export const RAIL: [number, number, number] = [0, 0, 0];
export const PLAIN: [number, number, number] = [-1, -1, -1];
/** Frost's damage fork: Ice Shards and no further (the cheapest energy hit in the game), and the fork finished (Ice Shards, Brittle, Shatterfield). */
export const ICE_SHARDS: [number, number, number] = [1, -1, -1];
export const SHATTER: [number, number, number] = [1, 1, 1];

export const P = (towerId: string, choices: [number, number, number], at: TowerPlacement['at'] = 'choke'): TowerPlacement => ({ towerId, choices, at });
export const VEIN = P('refinery', [0, 0, 0], 'vein');
/** The base world's mixed line: Railbores, a Frost, a Mortar. */
export const LINE: TowerPlacement[] = [P('bolt', RAIL), P('frost', [1, 0, 1]), P('bolt', RAIL), P('mortar', [1, 1, 0]), P('bolt', RAIL)];
/** What 200 Scrap buys a player who means to go wide on a tower the purse cannot reach: three plain Bolts. */
const OPENING: TowerPlacement[] = [P('bolt', PLAIN), P('bolt', PLAIN), P('bolt', PLAIN)];

/** Six relics a build would be glad of, held from wave 1 - common for the base world, epic for the tree: the rarity band is what differs. */
/** COMMONS only: the base world's pool holds nothing rarer (D29), and a set that names a rare is refused on every seed. */
export const SIX = ['hot_loads', 'quick_hands', 'iron_sights', 'deep_cold', 'thick_walls', 'second_wind'];
/** What carries a Bolt-only build (target S5): more per hit, more hits, more bodies per hit, more reach, more Scrap for the next Bolt. */
export const BOLT_SET = ['payload', 'penetrators', 'hot_loads', 'quick_hands', 'wide_net', 'bounty_hunter'];
/** The six commons that suited a Bolt before #365 - a multiplier on 8 damage is still a small hit, and they read 1%. Kept as the row that shows WHAT carries the build. */
const OLD_BOLT_SET = ['hot_loads', 'quick_hands', 'wide_net', 'ricochet', 'iron_sights', 'bounty_hunter'];
export const held = (ids: string[], rarity: number): { id: string; rarity: number }[] => ids.map((id) => ({ id, rarity }));

/** DEPTH FIRST: one gun taken through its choices, the Refinery, then each tower of the line in turn, each finished before the next. */
const DEEP = { towers: [P('bolt', RAIL), VEIN], tail: [P('frost', [1, 0, 1]), P('bolt', RAIL), P('mortar', [1, 1, 0]), P('bolt', RAIL)] };

export const PLANS = {
  // THE KNOW-NOTHING RUNGS (L1, L2, L4): plain Bolts where the enemies appear. No tail - a player who stops on purpose.
  naive1: { towers: [P('bolt', PLAIN, 'entry')], unlocks: [] },
  naive3: { towers: [P('bolt', PLAIN, 'entry'), P('bolt', PLAIN, 'entry'), P('bolt', PLAIN, 'entry')], unlocks: [] },
  /** The same player who never stops: plain Bolts by the entry for as long as Scrap comes (the ladder's rung between "knows nothing" and "placement learned"). */
  naiveWide: { towers: [P('bolt', PLAIN, 'entry')], tail: [P('bolt', PLAIN, 'entry')], unlocks: [] },
  spam: { towers: [P('bolt', PLAIN)], tail: [P('bolt', PLAIN)], unlocks: [] },
  spamRelics: { towers: [P('bolt', PLAIN)], tail: [P('bolt', PLAIN)], unlocks: [], relics: held(BOLT_SET, 0) },
  // THE SYNERGY (#365, D37: "to find 'broken' synergies"): what carries plain-Bolt width, taken apart - the old six
  // commons, each new relic alone, the pair, the set. And the doors the pair could open (CONTRIBUTING sec 5): Ice Shards
  // width holding the same set, and the base world's mixed line holding it on Grim, which S4 says the base world loses.
  spamCommons: { towers: [P('bolt', PLAIN)], tail: [P('bolt', PLAIN)], unlocks: [], relics: held(OLD_BOLT_SET, 0) },
  spamPayload: { towers: [P('bolt', PLAIN)], tail: [P('bolt', PLAIN)], unlocks: [], relics: held(['payload'], 0) },
  spamPenetrators: { towers: [P('bolt', PLAIN)], tail: [P('bolt', PLAIN)], unlocks: [], relics: held(['penetrators'], 0) },
  spamPair: { towers: [P('bolt', PLAIN)], tail: [P('bolt', PLAIN)], unlocks: [], relics: held(['payload', 'penetrators'], 0) },
  frostSpamRelics: { towers: [P('frost', ICE_SHARDS)], tail: [P('frost', ICE_SHARDS)], unlocks: [], relics: held(BOLT_SET, 0) },
  // One relic is not a synergy: what Payload ALONE does for the small hits that are not plain Bolts - the Gatling fork
  // finished (8 damage, fast, two more shots), and Mortars never upgraded (a 10-damage blast).
  gatlingsPayload: { towers: [P('bolt', [1, 1, 1])], tail: [P('bolt', [1, 1, 1])], unlocks: [], relics: held(['payload'], 0) },
  mortarSpamPayload: { towers: [P('bolt', PLAIN), P('mortar', PLAIN)], tail: [P('mortar', PLAIN)], unlocks: [], relics: held(['payload'], 0) },
  mortarSpam: { towers: [P('bolt', PLAIN), P('mortar', PLAIN)], tail: [P('mortar', PLAIN)], unlocks: [] },
  mixedDeepCommons: { ...DEEP, unlocks: [], relics: held(OLD_BOLT_SET, 0) },
  mixedDeepBolt: { ...DEEP, unlocks: [], relics: held(BOLT_SET, 0) },
  forks: { towers: [P('bolt', [0, 0, -1])], tail: [P('bolt', [0, 0, -1])], unlocks: [] },
  rails: { towers: [P('bolt', RAIL)], tail: [P('bolt', RAIL)], unlocks: [] },
  railsRelics: { towers: [P('bolt', RAIL)], tail: [P('bolt', RAIL)], unlocks: [], relics: held(BOLT_SET, 0) },
  gatlings: { towers: [P('bolt', [1, 1, 1])], tail: [P('bolt', [1, 1, 1])], unlocks: [] },
  mortars: { towers: [P('bolt', PLAIN), P('mortar', [0, 0, 0])], tail: [P('mortar', [0, 0, 0])], unlocks: [] },
  // CHASSIS FIRST - kept as the record of how the lab played until session 39, and as the row that shows what the
  // ORDER costs: all six chassis before the first upgrade. No tool's verdict is read off these any more.
  reference: { towers: [VEIN, ...LINE], tail: LINE, unlocks: [] },
  /** The reference for a player who looks at the map: a gun before the Refinery (the tail probe of 2026-09-17 - the Refinery first is the lab's commonest mistake, not the map's). */
  gunFirst: { towers: [P('bolt', RAIL), VEIN, P('frost', [1, 0, 1]), P('bolt', RAIL), P('mortar', [1, 1, 0]), P('bolt', RAIL)], tail: LINE, unlocks: [] },
  gunFirstRelics: { towers: [P('bolt', RAIL), VEIN, P('frost', [1, 0, 1]), P('bolt', RAIL), P('mortar', [1, 1, 0]), P('bolt', RAIL)], tail: LINE, unlocks: [], relics: held(SIX, 0) },
  referenceRelics: { towers: [VEIN, ...LINE], tail: LINE, unlocks: [], relics: held(SIX, 0) },
  // The THERMOMETER (not a player): the six-tower reference that stops buying, played to wave 40. It dies in the
  // middle of the run on Standard and Grim, so its mean death wave moves with the smallest change to a curve, a
  // price or a road - where a win rate near 100% does not move at all. This is what "the reference dies at 22-24"
  // was always good for, and the only thing.
  probe6: { towers: [VEIN, ...LINE], unlocks: [], horizon: 40 },
  // DEPTH FIRST (session 39): one gun taken through its choices, the Refinery, then each tower of the line in turn,
  // each finished before the next. The plans above place all six chassis before the first upgrade - which is how the
  // lab has always played them, and is the mistake an expensive chassis punishes: it made the mixed line look weaker
  // than mono-Railbore when what differed was the ORDER, not the towers.
  mixedDeep: { ...DEEP, unlocks: [] },
  /** The same line for a map with no vein worth a Refinery: guns only (the seed corpus's second try on a seed the line lost). */
  mixedDeepNoVein: { towers: [P('bolt', RAIL)], tail: DEEP.tail, unlocks: [] },
  mixedDeepRelics: { ...DEEP, unlocks: [], relics: held(SIX, 0) },
  treeBaseDeep: { ...DEEP, unlocks: ['*'], relics: held(SIX, 2) },
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
  // THE ENERGY DOOR (D38): D37 closed the kinetic door - a small kinetic hit is a bad answer to plate - and these are
  // the rungs for the door that opened: width in ENERGY, which plate does not touch. A Tesla (210) and a Laser (330)
  // cost more than the purse, so their spam opens the way a person would - three plain Bolts, which is all 200 Scrap
  // buys - and every Scrap after that goes wide on the one energy tower. Ice Shards is the base world's own rung.
  frostSpam: { towers: [P('frost', ICE_SHARDS)], tail: [P('frost', ICE_SHARDS)], unlocks: [] },
  teslaSpam: { towers: OPENING, tail: [P('tesla', PLAIN)], unlocks: ['*'] },
  laserSpam: { towers: OPENING, tail: [P('laser', PLAIN, 'inline')], unlocks: ['*'] },
  /** Payload's door (#366, A4): it lifts a hit under 10, and a plain Tesla hits for 9 - Tesla width holding it must not become a second synergy by accident. */
  teslaSpamPayload: { towers: OPENING, tail: [P('tesla', PLAIN)], unlocks: ['*'], relics: held(['payload'], 0) },
  // The same width holding the tree's relics, with its kinetic twin beside it: what the epic band does for spam of either kind.
  treeSpam: { towers: [P('bolt', PLAIN)], tail: [P('bolt', PLAIN)], unlocks: ['*'], relics: held(SIX, 2) },
  treeFrostSpam: { towers: [P('frost', ICE_SHARDS)], tail: [P('frost', ICE_SHARDS)], unlocks: ['*'], relics: held(SIX, 2) },
  treeTeslaSpam: { towers: OPENING, tail: [P('tesla', PLAIN)], unlocks: ['*'], relics: held(SIX, 2) },
  treeLaserSpam: { towers: OPENING, tail: [P('laser', PLAIN, 'inline')], unlocks: ['*'], relics: held(SIX, 2) },
  // MONO-ENERGY, played depth first like the *Deep plans above (so that only the towers differ, not the order): the
  // base world's is a finished Frost and nothing else; the tree's is Frost, Tesla and Laser - not one kinetic hit in it.
  frostDeep: { towers: [P('frost', SHATTER), VEIN], tail: [P('frost', SHATTER)], unlocks: [] },
  treeEnergyDeep: { towers: [P('frost', SHATTER), VEIN], tail: [P('tesla', [0, 0, 0]), P('laser', [0, 0, 0], 'inline'), P('frost', SHATTER)], unlocks: ['*'], relics: held(SIX, 2) },
  // The same two lines holding NOTHING: on Grim six epic relics win for whatever stands under them (99% for every
  // line that upgrades), so "mono-energy loses to mixed" can only be read where the towers are all there is.
  // THE ARSENAL (#366): each of the tree's lines and the base line under the same tree, holding nothing - the only
  // rung where "the tree's TOWERS earn their Ore" can be missed. Same shape every one: a Railbore, the Refinery, then
  // the line's tower and a Railbore in turn, each finished before the next - so only the tower differs.
  bareBaseDeep: { ...DEEP, unlocks: ['*'] },
  bareRails: { towers: [P('bolt', RAIL)], tail: [P('bolt', RAIL)], unlocks: ['*'] },
  bareTeslaDeep: { towers: [P('bolt', RAIL), VEIN], tail: [P('tesla', [0, 0, 0]), P('bolt', RAIL)], unlocks: ['*'] },
  bareMissileDeep: { towers: [P('bolt', RAIL), VEIN], tail: [P('missile', [0, 1, 0]), P('bolt', RAIL)], unlocks: ['*'] },
  bareLaserDeep: { towers: [P('bolt', RAIL), VEIN], tail: [P('laser', [0, 0, 0], 'inline'), P('bolt', RAIL)], unlocks: ['*'] },
  // ...and the SLOT plans, which are the fair reading: the *Deep lines above drop the Frost AND the Mortar for one
  // tower type, so they differ from the base line by a missing slow as much as by the tower (round 0 of the arsenal:
  // Tesla at three times its damage still won Grim 1%). These are the base line with the Mortar's slot - the line's
  // area damage - given to the tree's tower, and nothing else changed.
  bareTeslaSlot: { towers: [P('bolt', RAIL), VEIN], tail: [P('frost', [1, 0, 1]), P('bolt', RAIL), P('tesla', [0, 0, 0]), P('bolt', RAIL)], unlocks: ['*'] },
  bareMissileSlot: { towers: [P('bolt', RAIL), VEIN], tail: [P('frost', [1, 0, 1]), P('bolt', RAIL), P('missile', [0, 1, 0]), P('bolt', RAIL)], unlocks: ['*'] },
  /** The Missile Rack's other forks in the same slot: Seeker, Salvo, Barrage (many small blasts) and Warhead, Salvo, Bunker Buster (two big ones). */
  bareMissileSlotBarrage: { towers: [P('bolt', RAIL), VEIN], tail: [P('frost', [1, 0, 1]), P('bolt', RAIL), P('missile', [1, 0, 1]), P('bolt', RAIL)], unlocks: ['*'] },
  bareMissileSlotSalvo: { towers: [P('bolt', RAIL), VEIN], tail: [P('frost', [1, 0, 1]), P('bolt', RAIL), P('missile', [0, 0, 0]), P('bolt', RAIL)], unlocks: ['*'] },
  bareLaserSlot: { towers: [P('bolt', RAIL), VEIN], tail: [P('frost', [1, 0, 1]), P('bolt', RAIL), P('laser', [0, 0, 0], 'inline'), P('bolt', RAIL)], unlocks: ['*'] },
  bareEnergyDeep: { towers: [P('frost', SHATTER), VEIN], tail: [P('tesla', [0, 0, 0]), P('laser', [0, 0, 0], 'inline'), P('frost', SHATTER)], unlocks: ['*'] },
  bareMixedDeep: { towers: [P('bolt', RAIL), VEIN], tail: [P('tesla', [0, 0, 0]), P('frost', [1, 0, 1]), P('bolt', RAIL), P('laser', [0, 0, 0], 'inline'), P('mortar', [1, 1, 0])], unlocks: ['*'] },
} satisfies Record<string, Plan>;

export type PlanName = keyof typeof PLANS;
/** A plan by name, or a loud error that lists what exists - a typo in `--plans=` must never read as "no runs". */
export function planOf(name: string): Plan {
  const plan = (PLANS as Record<string, Plan>)[name];
  if (!plan) throw new Error(`unknown plan '${name}' - plans: ${Object.keys(PLANS).join(', ')}`);
  return plan;
}

export const THREAT_KEYS = ['calm', 'standard', 'grim'] as const;
