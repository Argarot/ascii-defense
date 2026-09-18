/**
 * The build sweep (session 24, PR 4): difficulty measured the way a player
 * meets it on the boards the game actually generates now - the Core at the
 * east edge, the board nine tenths road, 8-12 entries. Mixed builds with an
 * ECONOMY (100 scrap, towers and upgrades bought as kills pay), placed at
 * the CHOKE (the shared tail before the Core) or SPREAD across the board,
 * plus the two questions the variant sweep left open:
 *
 *  - choke vs spread: does one entrance make the last slots the whole game?
 *  - Hailstorm at 60% vs 75% per shot, in a mixed build behind a Frost.
 *
 * Usage: node tools/build-sweep.mjs [seed ...]
 */
import { THREAT_LEVELS, TileLibrary, createRng, resolveUnlocks, threatKnobs, type DifficultySpec, type TowerDef } from '@ascii-defense/engine';
import { validateEnemies, validateRelics, validateTowers, validateTree } from '@ascii-defense/content';
import treeJson from '@ascii-defense/content/assets/tree/nodes.json';
import libraryJson from '@ascii-defense/content/assets/tiles/library.json';
import enemiesJson from '@ascii-defense/content/assets/enemies/roster.json';
import towersJson from '@ascii-defense/content/assets/towers/roster.json';
import relicsJson from '@ascii-defense/content/assets/relics/pool.json';
import { runLab, type LabContent, type LabSpec, type TowerPlacement } from './lab';

declare const console: { log: (...args: unknown[]) => void };
declare const process: { argv: string[] };

function must<T>(r: { ok: true; value: T } | { ok: false; errors: unknown[] }): T {
  if (!r.ok) throw new Error('content invalid: ' + JSON.stringify(r.errors).slice(0, 200));
  return r.value;
}
const baseContent: LabContent = {
  lib: new TileLibrary(libraryJson.tiles),
  enemyDefs: must(validateEnemies.check(enemiesJson)).enemies,
  towerDefs: must(validateTowers.check(towersJson)).towers,
  relicDefs: must(validateRelics.check(relicsJson)).relics,
  tree: must(validateTree.check(treeJson)),
};

/** The curves the game ships (engine/sim/threat.ts) - never a copy of them: a sweep that measures a hand-copied world measures a world that drifts. */
const [CALM_T, STANDARD_T, GRIM_T] = THREAT_LEVELS;
const STANDARD: DifficultySpec = STANDARD_T.difficulty;
const MAX_WAVES = 40;
const BOARDS = [{ w: 7, h: 4 }, { w: 7, h: 5 }, { w: 12, h: 7 }];
const argSeeds = process.argv.slice(2).map(Number).filter((n) => Number.isInteger(n) && n > 0);
const SEEDS = argSeeds.length ? argSeeds : [945046, 12345, 777, 2024];

/** The app's knob derivation for a seed (protocol.ts Standard), minus the board - as sweep.ts does it. */
function demoKnobs(seed: number): { entries: number; targetPathCells: number } {
  return threatKnobs(createRng(seed).stream('map'), STANDARD_T);
}

/** Hailstorm at a different per-shot multiplier: the roster cloned with one number changed. */
function withHailstorm(mul: number): LabContent {
  const towerDefs = baseContent.towerDefs.map((d) => {
    if (d.id !== 'bolt' || !d.tiers) return d;
    const tiers = d.tiers.map((t) => ({ ...t, choices: t.choices.map((c) => (c.name === 'Hailstorm' ? { ...c, mods: { ...c.mods, damageMul: mul } } : c)) }));
    return { ...d, tiers } as TowerDef;
  });
  return { ...baseContent, towerDefs };
}

const mixed = (at: TowerPlacement['at'], boltPath: [number, number, number]): TowerPlacement[] => [
  { towerId: 'bolt', choices: boltPath, at },
  { towerId: 'frost', choices: [1, 0, 1], at },
  { towerId: 'bolt', choices: boltPath, at },
  { towerId: 'mortar', choices: [1, 1, 0], at },
  { towerId: 'bolt', choices: boltPath, at },
];
const RAILBORE: [number, number, number] = [0, 0, 0];
const HAILSTORM: [number, number, number] = [0, 0, 1];

interface Build { name: string; towers: TowerPlacement[]; content: LabContent; economy: LabSpec['economy'] }
// Session 26: one type alone against the mixed build - the proof that no
// single type clears the waves once resistances decide fights.
const soloKinetic = (at: TowerPlacement['at']): TowerPlacement[] => [
  { towerId: 'bolt', choices: RAILBORE, at }, { towerId: 'bolt', choices: RAILBORE, at }, { towerId: 'mortar', choices: [1, 1, 0], at },
  { towerId: 'bolt', choices: RAILBORE, at }, { towerId: 'missile', choices: [0, 1, 0], at },
];
const soloEnergy = (at: TowerPlacement['at']): TowerPlacement[] => [
  { towerId: 'tesla', choices: [0, 0, 0], at }, { towerId: 'frost', choices: [1, 0, 1], at }, { towerId: 'tesla', choices: [1, 0, 0], at },
  { towerId: 'frost', choices: [1, 0, 1], at }, { towerId: 'tesla', choices: [0, 1, 1], at },
];
const bothTypes = (at: TowerPlacement['at']): TowerPlacement[] => [
  { towerId: 'bolt', choices: RAILBORE, at }, { towerId: 'tesla', choices: [0, 0, 0], at }, { towerId: 'frost', choices: [1, 0, 1], at },
  { towerId: 'mortar', choices: [1, 1, 0], at }, { towerId: 'bolt', choices: RAILBORE, at },
];
// Session 26 PR 5: every tower in a pair with a partner it should want.
const P = (towerId: string, choices: [number, number, number]): TowerPlacement => ({ towerId, choices, at: 'choke' });
// Session 27 PR 6: the instruments - a Laser goes 'inline' (aimed along the
// most road), a Bastion 'adjacent' (touching the last tower placed).
const A = (towerId: string, choices: [number, number, number], at: TowerPlacement['at']): TowerPlacement => ({ towerId, choices, at });
const EIGHT: [string, TowerPlacement[]][] = [
  // A Railbore opens (2026-09-06 evening, the Laser at 110): a build that opens with an unaffordable tower places nothing.
  ['Railbore, then a Laser line, aimed (Capacitor, Fast Cycle, Cutter) + Frost', [P('bolt', RAILBORE), A('laser', [0, 0, 0], 'inline'), P('frost', [1, 0, 1]), A('laser', [0, 0, 0], 'inline'), A('laser', [1, 1, 1], 'inline')]],
  ['Missiles + Bastion (adjacent) + Railbore', [P('missile', [0, 1, 0]), A('bastion', [0, 0, 0], 'adjacent'), P('bolt', RAILBORE), P('missile', [1, 0, 1]), P('bolt', RAILBORE)]],
  ['Tesla + Bastion (adjacent) + Frost', [P('tesla', [0, 0, 0]), A('bastion', [0, 1, 0], 'adjacent'), P('frost', [1, 0, 1]), P('tesla', [1, 1, 0]), P('tesla', [0, 0, 1])]],
  ['Hailstorm (close quarters) line + Frost + Mortar', mixed('choke', HAILSTORM)],
  ['Railbore, then Bastion (adjacent), then three Railbores', [P('bolt', RAILBORE), A('bastion', [0, 1, 0], 'adjacent'), P('bolt', RAILBORE), P('bolt', RAILBORE), P('bolt', RAILBORE)]],
];
/** The crowd bodies: a crowd role's value shows in how many of these fell, not on the death wave. */
const CROWD = new Set(['swarmling', 'skitter']);
const BUILDS: Build[] = [
  ...EIGHT.map(([name, towers]) => ({ name: `choke, ${name}, economy`, towers, content: baseContent, economy: { startingScrap: 100 } })),
  { name: 'choke, KINETIC only (3 Railbore + Mortar + Missiles), economy', towers: soloKinetic('choke'), content: baseContent, economy: { startingScrap: 100 } },
  { name: 'choke, ENERGY only (3 Tesla + 2 Frost), economy', towers: soloEnergy('choke'), content: baseContent, economy: { startingScrap: 100 } },
  { name: 'choke, BOTH types (2 Railbore + Tesla + Frost + Mortar), economy', towers: bothTypes('choke'), content: baseContent, economy: { startingScrap: 100 } },
  { name: 'choke, Railbore line + Frost + Mortar, economy', towers: mixed('choke', RAILBORE), content: baseContent, economy: { startingScrap: 100 } },
  { name: 'spread, same build, economy', towers: mixed('auto', RAILBORE), content: baseContent, economy: { startingScrap: 100 } },
  { name: 'choke, Hailstorm 60% line + Frost + Mortar, economy', towers: mixed('choke', HAILSTORM), content: baseContent, economy: { startingScrap: 100 } },
  { name: 'choke, Hailstorm 75% line + Frost + Mortar, economy', towers: mixed('choke', HAILSTORM), content: withHailstorm(0.75), economy: { startingScrap: 100 } },
  { name: 'choke, same build, unlimited scrap (capability)', towers: mixed('choke', RAILBORE), content: baseContent, economy: undefined },
  { name: 'choke, Hailstorm (close quarters) line + Frost + Mortar, unlimited scrap (capability)', towers: mixed('choke', HAILSTORM), content: baseContent, economy: undefined },
];

/**
 * Session 28, PR 6: the relic sweep. The reference build with a random set
 * of six held relics - drawn by a seeded LCG from the pool minus
 * consumables (the lab never uses one) and fusion-only relics - at a rarity
 * that cycles common, rare, epic across the sets. The spread of the death
 * waves across sets is the number the layer is bounded by (Daniil's power
 * target, 2026-09-06: a reference build with six random relics on Standard
 * lands between 16 and 24; a set past 24 on every seed is flagged).
 */
const RELIC_SETS = 8;
const RELICS_PER_SET = 6;
function relicSet(n: number): { id: string; rarity: number }[] {
  const pool = baseContent.relicDefs.filter((r) => r.kind !== 'consumable' && !r.fusionOnly);
  let x = 2654435761 + n * 40503;
  const next = (): number => { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; return x; };
  const picked: { id: string; rarity: number }[] = [];
  const used = new Set<number>();
  while (picked.length < RELICS_PER_SET && used.size < pool.length) {
    const i = next() % pool.length;
    if (used.has(i)) continue;
    used.add(i);
    picked.push({ id: pool[i].id, rarity: Math.max(['common', 'rare', 'epic'].indexOf(pool[i].rarity), n % 3) });
  }
  return picked;
}
const RELIC_BOARD = { w: 7, h: 5 };
const RELICS_ONLY = process.argv.includes('--relics');
const TREE_ONLY = process.argv.includes('--tree');
const BASE_ONLY = process.argv.includes('--base');
const ENEMIES_ONLY = process.argv.includes('--enemies');

/**
 * Session 32, PR 4-5: the ENEMY SWEEP. Every body alone (its minWave set to
 * 1, its boss-only flag off; a splitter brings its halves) against every
 * tower LINE at the Standard curve on the 7x5 board - the counter table:
 * which line answers which rule, in death waves. A held run reads ">40".
 */
const LINES: { name: string; towers: TowerPlacement[] }[] = [
  { name: 'Bolt line (Railbore)', towers: [P('bolt', RAILBORE), P('bolt', RAILBORE), P('bolt', RAILBORE), P('bolt', RAILBORE)] },
  { name: 'Frost + Bolts', towers: [P('frost', [1, 0, 1]), P('bolt', RAILBORE), P('frost', [1, 0, 1]), P('bolt', RAILBORE)] },
  { name: 'Mortars', towers: [P('mortar', [1, 1, 0]), P('mortar', [1, 1, 0]), P('mortar', [1, 1, 0])] },
  { name: 'Tesla', towers: [P('tesla', [0, 0, 0]), P('tesla', [0, 0, 0]), P('tesla', [0, 0, 0])] },
  { name: 'Missiles', towers: [P('missile', [0, 1, 0]), P('missile', [0, 1, 0]), P('missile', [0, 1, 0])] },
  { name: 'Lasers inline + Bolt', towers: [P('bolt', RAILBORE), A('laser', [0, 0, 0], 'inline'), A('laser', [0, 0, 0], 'inline')] },
  { name: 'Bastion + Bolts', towers: [P('bolt', RAILBORE), P('bolt', RAILBORE), A('bastion', [0, 0, 0], 'adjacent'), P('bolt', RAILBORE)] },
];
if (ENEMIES_ONLY) {
  const ENEMY_SEEDS = SEEDS.slice(0, 2);
  console.log(`## every body alone against every line - Standard curve, ${RELIC_BOARD.w}x${RELIC_BOARD.h}, seeds ${ENEMY_SEEDS.join(', ')}, horizon ${MAX_WAVES}; a cell is the mean death wave (>${MAX_WAVES} = held)\n`);
  console.log('| body (rule) | ' + LINES.map((l) => l.name).join(' | ') + ' |');
  console.log('|---|' + LINES.map(() => '---').join('|') + '|');
  for (const body of baseContent.enemyDefs) {
    const alone = { ...body, minWave: 1, bossOnly: false };
    const defs = [alone, ...(body.splitInto ? baseContent.enemyDefs.filter((d) => d.id === body.splitInto).map((d) => ({ ...d, minWave: 99 })) : [])];
    const content: LabContent = { ...baseContent, enemyDefs: defs };
    const cells: string[] = [];
    for (const line of LINES) {
      const deaths: number[] = [];
      for (const seed of ENEMY_SEEDS) {
        const spec: LabSpec = { seed, map: { width: RELIC_BOARD.w, height: RELIC_BOARD.h, ...demoKnobs(seed) }, towers: line.towers, relicIds: [], unlocks: ['*'], difficulty: STANDARD, maxWaves: MAX_WAVES };
        try { const r = runLab(spec, content); deaths.push(r.deathWave ?? MAX_WAVES + 1); } catch { deaths.push(0); }
      }
      const mean = deaths.reduce((a, c) => a + c, 0) / deaths.length;
      cells.push(mean > MAX_WAVES ? `>${MAX_WAVES}` : mean.toFixed(0));
    }
    console.log(`| **${body.name ?? body.id}** (${(body.traits ?? []).join(', ') || 'plain'}) | ${cells.join(' | ')} |`);
  }
  console.log('');
}

/**
 * Session 36, PR 3: the BAND sweep (PRD sec 28.1, D34). The reliquary sells
 * rarity bands now; this reads what a band BUYS, in death waves, so its
 * price can be set against the tower nodes' instead of guessed. The
 * reference build with six held relics, eight seeded sets per band, drawn
 * from the pool the band allows (no rare-only relic before the rare band)
 * and held at two readings: every relic AT the band's rarity (the ceiling a
 * band can buy) and at the offer's own wave-weighted mix capped by the band
 * (what a run actually deals, read at wave 10: 50 / 30 / 15 of 95).
 */
const BANDS_ONLY = process.argv.includes('--bands');
function bandSet(n: number, band: number, mixed: boolean): { id: string; rarity: number }[] {
  const order = ['common', 'rare', 'epic'];
  const pool = baseContent.relicDefs.filter((r) => r.kind !== 'consumable' && !r.fusionOnly && order.indexOf(r.rarity) <= band);
  let x = 2654435761 + n * 40503;
  const next = (): number => { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; return x; };
  const picked: { id: string; rarity: number }[] = [];
  const used = new Set<number>();
  while (picked.length < RELICS_PER_SET && used.size < pool.length) {
    const i = next() % pool.length;
    if (used.has(i)) continue;
    used.add(i);
    const base = Math.max(0, order.indexOf(pool[i].rarity));
    // The offer's mix at wave 10 (Sim.rollRarity): common 50, rare 30, epic 15.
    const roll = next() % 95;
    const rolled = roll < 50 ? 0 : roll < 80 ? 1 : 2;
    picked.push({ id: pool[i].id, rarity: Math.max(base, Math.min(band, mixed ? rolled : band)) });
  }
  return picked;
}
if (BANDS_ONLY) {
  console.log(`## what a rarity band buys on ${RELIC_BOARD.w}x${RELIC_BOARD.h} - the reference build, economy 100 scrap, six held relics, ${RELIC_SETS} sets x seeds ${SEEDS.join(', ')}, horizon ${MAX_WAVES}\n`);
  console.log('| band bought | reading | mean death wave | min - max over sets | vs no band |');
  console.log('|---|---|---|---|---|');
  let floor = 0;
  for (const band of [0, 1, 2])
    for (const mixedMix of band === 0 ? [true] : [true, false]) {
      const setMeans: number[] = [];
      for (let n = 0; n < RELIC_SETS; n++) {
        const set = bandSet(n, band, mixedMix);
        const deaths: number[] = [];
        for (const seed of SEEDS) {
          const spec: LabSpec = { seed, map: { width: RELIC_BOARD.w, height: RELIC_BOARD.h, ...demoKnobs(seed) }, towers: mixed('choke', RAILBORE), relicIds: [], relics: set, difficulty: STANDARD, maxWaves: MAX_WAVES, economy: { startingScrap: 100 } };
          try { deaths.push(runLab(spec, baseContent).deathWave ?? MAX_WAVES + 1); } catch { /* a seed the carve refuses is no reading */ }
        }
        if (deaths.length) setMeans.push(deaths.reduce((a, c) => a + c, 0) / deaths.length);
      }
      const mean = setMeans.reduce((a, c) => a + c, 0) / setMeans.length;
      if (band === 0) floor = mean;
      const name = ['none (commons only)', 'RARE', 'EPIC'][band];
      console.log(`| ${name} | ${band === 0 ? 'every relic common' : mixedMix ? "the offer's mix, capped by the band" : `every relic at ${['', 'rare', 'epic'][band]} (the ceiling)`} | ${mean.toFixed(1)} | ${Math.min(...setMeans).toFixed(1)} - ${Math.max(...setMeans).toFixed(1)} | ${band === 0 ? '-' : `+${(mean - floor).toFixed(1)}`} |`);
    }
}

/**
 * Session 31, PR 2: the EARLY GAME. The base world (four towers, sixteen
 * relics, six slots - what a new player has) at Calm's knobs (2-3 entries,
 * longer roads, a 55 s clock, fifteen waves) and Standard's, with the
 * builds a new player makes: three plain Bolts; two Bolts, a Frost and a
 * Refinery with the Bolts' first fork; the reference line. Death wave
 * per seed; "survived" means the Calm run's fifteen (or Standard's twenty)
 * were held - the number a first run must reach.
 */
function calmKnobs(seed: number): { entries: number; targetPathCells: number } {
  return threatKnobs(createRng(seed).stream('map'), CALM_T);
}
const EARLY_BUILDS: { name: string; towers: TowerPlacement[] }[] = [
  { name: 'three plain Bolts', towers: [P('bolt', [-1, -1, -1]), P('bolt', [-1, -1, -1]), P('bolt', [-1, -1, -1])] },
  { name: 'two Bolts (Marksman), a Frost, a Refinery', towers: [P('bolt', [0, -1, -1]), A('refinery', [0, 0, 0], 'vein'), P('bolt', [0, -1, -1]), P('frost', [1, -1, -1])] },
  { name: 'the reference: Railbore line + Frost + Mortar + Refinery', towers: [A('refinery', [0, 0, 0], 'vein'), ...mixed('choke', RAILBORE)] },
  // Plans that keep building, the way a player does: more of the same as the scrap comes.
  { name: 'eight Bolts, Marksman then Piercing', towers: Array.from({ length: 8 }, () => P('bolt', [0, 0, -1])) },
  { name: 'Refinery, then 4 Railbores + 2 Frost + Mortar, then 3 more Railbores', towers: [A('refinery', [0, 0, 0], 'vein'), P('bolt', RAILBORE), P('frost', [1, 0, 1]), P('bolt', RAILBORE), P('mortar', [1, 1, 0]), P('bolt', RAILBORE), P('frost', [1, 0, 1]), P('bolt', RAILBORE), P('bolt', RAILBORE), P('bolt', RAILBORE), P('bolt', RAILBORE)] },
];
if (BASE_ONLY) {
  const CALM: DifficultySpec = CALM_T.difficulty;
  for (const world of [{ name: 'CALM before session 31 (the Standard curve)', knobs: calmKnobs, clock: CALM_T.waveSeconds * 20, final: CALM_T.finalWave, spec: STANDARD }, { name: 'CALM (session 31: hp +8%/wave x1.03, 6 + 3/wave, the heavier kinds three waves later)', knobs: calmKnobs, clock: CALM_T.waveSeconds * 20, final: CALM_T.finalWave, spec: CALM }, { name: 'STANDARD', knobs: demoKnobs, clock: STANDARD_T.waveSeconds * 20, final: STANDARD_T.finalWave, spec: STANDARD }]) {
    console.log(`## the base world at ${world.name} knobs on ${RELIC_BOARD.w}x${RELIC_BOARD.h} - economy 100 scrap, no relics, horizon ${MAX_WAVES}; the run holds at wave ${world.final}\n`);
    console.log('| build | ' + SEEDS.map((s) => `death @${s}`).join(' | ') + ' | mean | held the run | ore banked |');
    console.log('|---|' + SEEDS.map(() => '---').join('|') + '|---|---|---|');
    for (const b of EARLY_BUILDS) {
      const deaths: (number | null)[] = [];
      const ores: number[] = [];
      for (const seed of SEEDS) {
        const spec: LabSpec = { seed, map: { width: RELIC_BOARD.w, height: RELIC_BOARD.h, ...world.knobs(seed) }, towers: b.towers, relicIds: [], unlocks: [], interWaveTicks: world.clock, difficulty: world.spec, maxWaves: MAX_WAVES, economy: { startingScrap: 100 } };
        try { const r = runLab(spec, baseContent); deaths.push(r.deathWave); ores.push(r.oreEnd[0]); } catch (e) { deaths.push(-1); ores.push(0); console.log(`<!-- ${b.name} @${seed}: ${e instanceof Error ? e.message : String(e)} -->`); }
      }
      const nums = deaths.map((d) => (d === null ? MAX_WAVES + 1 : d === -1 ? 0 : d));
      const mean = nums.reduce((a, c) => a + c, 0) / nums.length;
      const held = deaths.filter((d) => d === null || d > world.final).length;
      console.log(`| ${b.name} | ${deaths.map((d) => (d === null ? `>${MAX_WAVES}` : d === -1 ? 'n/a' : String(d))).join(' | ')} | ${mean.toFixed(1)} | ${held}/${SEEDS.length} | ${ores.join(' · ')} |`);
    }
    console.log('');
  }
}

/**
 * Session 36, PR 5: THE BALANCE DEBT, measured (issues #234 "the curve" and
 * #235 "Calm's ease" - both sat in Daniil's queue as blocks-ship calls until
 * CONTRIBUTING sec 6 rule 7 moved them back: a question a sweep can answer
 * is never a call). Every earlier reading of the curve used FOUR seeds; this
 * one uses a corpus, the shipped Threat levels (never a copy), and states
 * its targets in docs/lab/balance-debt-2026-09-17.md before reading them.
 *
 *   node tools/build-sweep.mjs --debt [corpus=60]
 */
const DEBT_ONLY = process.argv.includes('--debt');
if (DEBT_ONLY) {
  const N = Number(process.argv.slice(2).find((a) => /^\d+$/.test(a)) ?? 60);
  const CORPUS = Array.from({ length: N }, (_, i) => (i + 1) * 7919 + 13);
  const PLAIN: [number, number, number] = [-1, -1, -1];
  /** The Core's health in the lab and in the app alike (the sim's default; nothing passes another). */
  const CORE_HP = 50;
  const naive = (n: number, at: TowerPlacement['at']): TowerPlacement[] => Array.from({ length: n }, () => ({ towerId: 'bolt', choices: PLAIN, at }));
  const REFERENCE: TowerPlacement[] = [A('refinery', [0, 0, 0], 'vein'), ...mixed('choke', RAILBORE)];
  const pct = (x: number): string => `${Math.round(100 * x)}%`;
  const q = (sorted: number[], p: number): number => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];

  /**
   * unlocks: the tree state the row plays under ([] = the base world); band: the rarity band its six relics are dealt
   * inside; tail: what the player goes on buying once the plan is bought out (issue #348). A row WITHOUT a tail is a
   * player who stops on purpose - the know-nothing rows of L1 - and the purse column shows what that costs them.
   */
  interface Row { name: string; towers: TowerPlacement[]; tail?: TowerPlacement[]; relicSets?: boolean; unlocks?: string[]; band?: number }
  /** The reference goes on buying its own line; the tree's line goes on buying Lasers with a Railbore between. */
  const REFERENCE_TAIL: TowerPlacement[] = mixed('choke', RAILBORE);
  const FORKED_BOLT: TowerPlacement = P('bolt', [0, 0, -1]);
  const read = (threat: (typeof THREAT_LEVELS)[number], rows: Row[], marks: number[]): void => {
    // Five waves past the win and no further: the ladder's targets are win rates, and a player who keeps buying
    // stands thirty towers against sixty bodies by wave 40 - hours of sweep to read a number nobody plays to.
    const HORIZON = threat.finalWave + 5;
    console.log(`## ${threat.name.toUpperCase()} - the shipped curve, ${RELIC_BOARD.w}x${RELIC_BOARD.h}, economy 100 scrap, the ${threat.waveSeconds}s clock, ${N} seeds, horizon ${HORIZON}; the run is WON by holding wave ${threat.finalWave}\n`);
    console.log(`| build | mean death | median | 10th - 90th pct | min | ${marks.map((m) => `holds wave ${m}`).join(' | ')} | WINS (holds ${threat.finalWave}) | first leak (median wave) | Core left at the win (median, of ${CORE_HP}) | towers at the end (median) | Scrap in hand at the end / what the last wave paid (medians) |`);
    console.log(`|---|---|---|---|---|${marks.map(() => '---').join('|')}|---|---|---|---|---|`);
    for (const row of rows) {
      const deaths: number[] = [];
      const firstLeaks: number[] = [];
      const coreAtWin: number[] = [];
      // The purse (issue #348): a run that ends holding several waves' income was not played by a player.
      const towersAtEnd: number[] = [];
      const handAtEnd: number[] = [];
      const lastWavePaid: number[] = [];
      CORPUS.forEach((seed, i) => {
        const spec: LabSpec = {
          seed, map: { width: RELIC_BOARD.w, height: RELIC_BOARD.h, ...threatKnobs(createRng(seed).stream('map'), threat) },
          towers: row.towers, tail: row.tail, relicIds: [], relics: row.relicSets ? bandSet(i % RELIC_SETS, row.band ?? 0, true) : undefined, unlocks: row.unlocks ?? [],
          interWaveTicks: threat.waveSeconds * 20, difficulty: threat.difficulty, maxWaves: HORIZON, economy: { startingScrap: 100 },
        };
        try {
          const r = runLab(spec, baseContent);
          const death = r.deathWave ?? HORIZON + 1;
          deaths.push(death);
          // What the player FEELS: when the first body got through, and how much Core was left when the run was won.
          firstLeaks.push(r.waves.find((w) => w.breaches > 0)?.wave ?? HORIZON + 1);
          const last = r.waves.find((w) => w.wave === threat.finalWave);
          if (death > threat.finalWave && last) coreAtWin.push(last.coreHpEnd);
          // The end of the run as the player has it: the final wave if it was held, the death wave if not.
          const endWave = Math.min(death, threat.finalWave);
          const end = r.waves.find((w) => w.wave === endWave);
          const before = r.waves.find((w) => w.wave === endWave - 1);
          if (end) {
            towersAtEnd.push(end.towersEnd);
            handAtEnd.push(end.scrapEnd);
            if (before) lastWavePaid.push(end.scrapEnd + end.spentEnd - before.scrapEnd - before.spentEnd);
          }
        } catch { /* a seed the carve refuses is no reading */ }
      });
      const sorted = [...deaths].sort((a, b) => a - b);
      const med = (a: number[]): string => (a.length ? String([...a].sort((x, y) => x - y)[Math.floor(a.length / 2)]) : '-');
      const mean = deaths.reduce((a, c) => a + c, 0) / deaths.length;
      // "Holds wave m" = the Core is still standing when wave m has been fought: the death wave is past it.
      const holds = (m: number): string => pct(deaths.filter((d) => d > m).length / deaths.length);
      console.log(`| ${row.name} | ${mean.toFixed(1)} | ${q(sorted, 0.5)} | ${q(sorted, 0.1)} - ${q(sorted, 0.9)} | ${sorted[0]} | ${marks.map(holds).join(' | ')} | ${holds(threat.finalWave)} | ${med(firstLeaks)} | ${med(coreAtWin)} | ${med(towersAtEnd)} | ${med(handAtEnd)} / ${med(lastWavePaid)} |`);
    }
    console.log('');
  };

  read(CALM_T, [
    { name: 'NAIVE: one plain Bolt by the entry, then nothing', towers: naive(1, 'entry') },
    { name: 'NAIVE: three plain Bolts by the entry, no forks', towers: naive(3, 'entry') },
    { name: 'NAIVE: plain Bolts by the entry for as long as Scrap comes, no forks', towers: naive(1, 'entry'), tail: naive(1, 'entry') },
    { name: 'placement learned: plain Bolts at the choke for as long as Scrap comes, no forks', towers: naive(1, 'choke'), tail: naive(1, 'choke') },
    { name: 'forks learned: Bolts at the choke, Marksman then Piercing, for as long as Scrap comes', towers: [FORKED_BOLT], tail: [FORKED_BOLT] },
    { name: 'the reference (Refinery, Railbore line + Frost + Mortar), and it goes on buying its line', towers: REFERENCE, tail: REFERENCE_TAIL },
  ], [3, 5, 10]);
  read(STANDARD_T, [
    { name: 'NAIVE: three plain Bolts by the entry, no forks, then nothing', towers: naive(3, 'entry') },
    { name: 'NAIVE: plain Bolts by the entry for as long as Scrap comes, no forks', towers: naive(1, 'entry'), tail: naive(1, 'entry') },
    { name: 'forks learned: Bolts at the choke, Marksman then Piercing, for as long as Scrap comes', towers: [FORKED_BOLT], tail: [FORKED_BOLT] },
    { name: 'the reference, no relics, and it goes on buying its line', towers: REFERENCE, tail: REFERENCE_TAIL },
    { name: 'the reference + six common relics (the offer as a new player meets it), going on', towers: REFERENCE, tail: REFERENCE_TAIL, relicSets: true },
  ], [5, 10, 15]);
  /** The everything world's line, as the tree sweep plays it (session 29, PR 6): a Railbore, three aimed Lasers, a Frost. */
  const LASER_LINE: TowerPlacement[] = [A('refinery', [0, 0, 0], 'vein'), P('bolt', RAILBORE), A('laser', [0, 0, 0], 'inline'), P('frost', [1, 0, 1]), A('laser', [0, 0, 0], 'inline'), A('laser', [1, 1, 1], 'inline')];
  const LASER_TAIL: TowerPlacement[] = [A('laser', [0, 0, 0], 'inline'), P('bolt', RAILBORE)];
  read(GRIM_T, [
    { name: 'the reference, no relics (the base world), going on', towers: REFERENCE, tail: REFERENCE_TAIL },
    { name: 'the reference + six common relics (the base world), going on', towers: REFERENCE, tail: REFERENCE_TAIL, relicSets: true },
    { name: 'THE TREE: the Laser line, no relics, going on (a Laser, a Railbore, a Laser...)', towers: LASER_LINE, tail: LASER_TAIL, unlocks: ['*'] },
    { name: 'THE TREE: the Laser line + six relics inside the epic band, going on', towers: LASER_LINE, tail: LASER_TAIL, unlocks: ['*'], relicSets: true, band: 2 },
    { name: 'for the record - the OLD instrument: the reference that stops when its six towers are bought', towers: REFERENCE },
  ], [10, 15, 20]);
  read(STANDARD_T, [
    { name: 'THE TREE on Standard, for scale: the Laser line + six relics inside the epic band, going on', towers: LASER_LINE, tail: LASER_TAIL, unlocks: ['*'], relicSets: true, band: 2 },
  ], [5, 10, 15]);
}

/**
 * Session 29, PR 6: the sweep at TREE STATES (PRD sec 11 stage 3's warning,
 * measured). Three worlds - the base set, a mid tree, everything - each
 * with the build its towers allow, a Refinery on the richest vein, six
 * relics from ITS pool, and the Ore the run would bank. The base row is
 * what a new player meets; the Ore column prices the nodes (Daniil:
 * "about 5 runs to unlock all the towers").
 */
const TREE_STATES: { name: string; unlocks: string[]; towers: TowerPlacement[]; loadout?: string[] }[] = [
  { name: 'BASE - Bolt, Mortar, Frost, Refinery; every common relic; 6 slots', unlocks: [], towers: [A('refinery', [0, 0, 0], 'vein'), ...mixed('choke', RAILBORE)] },
  { name: 'MID - + Tesla, Bastion; the rare band; 8 slots', unlocks: ['tesla', 'bastion', 'band_rare', 'slots_8'], towers: [A('refinery', [0, 0, 0], 'vein'), P('bolt', RAILBORE), A('bastion', [0, 1, 0], 'adjacent'), P('tesla', [0, 0, 0]), P('frost', [1, 0, 1]), P('mortar', [1, 1, 0])] },
  { name: 'EVERYTHING - the Laser line, 52 relics, 12 slots', unlocks: ['*'], towers: [A('refinery', [0, 0, 0], 'vein'), P('bolt', RAILBORE), A('laser', [0, 0, 0], 'inline'), P('frost', [1, 0, 1]), A('laser', [0, 0, 0], 'inline'), A('laser', [1, 1, 1], 'inline')] },
  // Session 30, PR 5: the same worlds with a vein tile LOADED - the tier-2 and tier-3 Ore readings the tree's higher nodes are priced against.
  { name: 'MID + rich_vein loaded (tier-2 veins)', unlocks: ['tesla', 'bastion', 'band_rare', 'slots_8', 'ore_t2'], loadout: ['rich_vein'], towers: [A('refinery', [0, 0, 0], 'vein'), P('bolt', RAILBORE), A('bastion', [0, 1, 0], 'adjacent'), P('tesla', [0, 0, 0]), P('frost', [1, 0, 1]), P('mortar', [1, 1, 0])] },
  { name: 'EVERYTHING + mother_lode loaded (a tier-3 vein)', unlocks: ['*'], loadout: ['mother_lode'], towers: [A('refinery', [0, 0, 0], 'vein'), P('bolt', RAILBORE), A('laser', [0, 0, 0], 'inline'), P('frost', [1, 0, 1]), A('laser', [0, 0, 0], 'inline'), A('laser', [1, 1, 1], 'inline')] },
];
/** Six relics from the state's own pool, deterministic per state and seed. */
function poolSet(unlocks: string[], n: number): { id: string; rarity: number }[] {
  const u = resolveUnlocks(baseContent.tree!, { unlocks, earned: [], forged: {} }, baseContent.relicDefs);
  const pool = baseContent.relicDefs.filter((r) => u.relics.has(r.id) && r.kind !== 'consumable' && !r.fusionOnly);
  let x = 2654435761 + n * 40503;
  const next = (): number => { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; return x; };
  const picked: { id: string; rarity: number }[] = [];
  const used = new Set<number>();
  while (picked.length < Math.min(RELICS_PER_SET, pool.length) && used.size < pool.length) {
    const i = next() % pool.length;
    if (used.has(i)) continue;
    used.add(i);
    picked.push({ id: pool[i].id, rarity: Math.max(['common', 'rare', 'epic'].indexOf(pool[i].rarity), 0) });
  }
  return picked;
}
if (TREE_ONLY) {
  console.log(`## the tree's states on ${RELIC_BOARD.w}x${RELIC_BOARD.h} - Standard curve, economy 100 scrap, a Refinery on the richest vein, six relics from the state's pool, horizon ${MAX_WAVES}\n`);
  console.log('| state | ' + SEEDS.map((s) => `death @${s}`).join(' | ') + ' | mean | ore banked per run (t1/t2/t3) | mean t1 ore | towers / relics / slots |');
  console.log('|---|' + SEEDS.map(() => '---').join('|') + '|---|---|---|---|');
  for (const st of TREE_STATES) {
    const deaths: (number | null)[] = [];
    const ores: number[][] = [];
    let world = { towers: 0, relics: 0, relicSlots: 0 };
    SEEDS.forEach((seed, i) => {
      const spec: LabSpec = { seed, map: { width: RELIC_BOARD.w, height: RELIC_BOARD.h, ...demoKnobs(seed) }, towers: st.towers, relicIds: [], relics: poolSet(st.unlocks, i), unlocks: st.unlocks, loadout: st.loadout, difficulty: STANDARD, maxWaves: MAX_WAVES, economy: { startingScrap: 100 } };
      try {
        const r = runLab(spec, baseContent);
        deaths.push(r.deathWave);
        ores.push(r.oreEnd);
        world = r.world;
      } catch (e) {
        deaths.push(-1);
        ores.push([0, 0, 0]);
        console.log(`<!-- ${st.name} @${seed}: ${e instanceof Error ? e.message : String(e)} -->`);
      }
    });
    const nums = deaths.map((d) => (d === null ? MAX_WAVES + 1 : d === -1 ? 0 : d));
    const mean = nums.reduce((a, c) => a + c, 0) / nums.length;
    const meanOre = ores.reduce((a, o) => a + o[0], 0) / ores.length;
    console.log(`| ${st.name} | ${deaths.map((d) => (d === null ? `>${MAX_WAVES}` : d === -1 ? 'n/a' : String(d))).join(' | ')} | ${mean.toFixed(1)} | ${ores.map((o) => o.join('/')).join(' · ')} | ${meanOre.toFixed(1)} | ${world.towers} / ${world.relics} / ${world.relicSlots} |`);
  }
  console.log('');
}

if (!RELICS_ONLY && !TREE_ONLY && !BASE_ONLY && !ENEMIES_ONLY && !BANDS_ONLY && !DEBT_ONLY) console.log(`build sweep · Standard curve · seeds ${SEEDS.join(', ')} · horizon ${MAX_WAVES} · economy 100 scrap where noted\n`);
for (const board of RELICS_ONLY || TREE_ONLY || BASE_ONLY || ENEMIES_ONLY || BANDS_ONLY || DEBT_ONLY ? [] : BOARDS) {
  console.log(`## board ${board.w}x${board.h}\n`);
  console.log('| build | ' + SEEDS.map((s) => `death @${s}`).join(' | ') + ' | mean | crowd kills | all kills |');
  console.log('|---|' + SEEDS.map(() => '---').join('|') + '|---|---|---|');
  for (const b of BUILDS) {
    const deaths: (number | null)[] = [];
    let crowd = 0;
    let all = 0;
    for (const seed of SEEDS) {
      const spec: LabSpec = {
        seed,
        map: { width: board.w, height: board.h, ...demoKnobs(seed) },
        towers: b.towers,
        relicIds: [],
        difficulty: STANDARD,
        maxWaves: MAX_WAVES,
        economy: b.economy,
      };
      try {
        const r = runLab(spec, b.content);
        deaths.push(r.deathWave);
        for (const [id, k] of Object.entries(r.killsByDef)) { all += k; if (CROWD.has(id)) crowd += k; }
      } catch {
        deaths.push(-1);
      }
    }
    const nums = deaths.map((d) => (d === null ? MAX_WAVES + 1 : d === -1 ? 0 : d));
    const mean = nums.reduce((a, c) => a + c, 0) / nums.length;
    console.log(`| ${b.name} | ${deaths.map((d) => (d === null ? `>${MAX_WAVES}` : d === -1 ? 'n/a' : String(d))).join(' | ')} | ${mean.toFixed(1)} | ${(crowd / SEEDS.length).toFixed(0)} | ${(all / SEEDS.length).toFixed(0)} |`);
  }
  console.log('');
}

// ---- the relic sweep (session 28, PR 6) ----
if (!TREE_ONLY && !BASE_ONLY && !ENEMIES_ONLY && !BANDS_ONLY && !DEBT_ONLY) {
console.log(`## relic sets on ${RELIC_BOARD.w}x${RELIC_BOARD.h} - the reference build (Railbore line + Frost + Mortar, choke, economy) with six held relics\n`);
console.log('| set | relics (rarity) | ' + SEEDS.map((s) => `death @${s}`).join(' | ') + ' | mean |');
console.log('|---|---|' + SEEDS.map(() => '---').join('|') + '|---|');
const means: number[] = [];
const flagged: string[] = [];
const noRelics: number[] = [];
for (let n = -1; n < RELIC_SETS; n++) {
  const set = n < 0 ? [] : relicSet(n);
  const deaths: (number | null)[] = [];
  for (const seed of SEEDS) {
    const spec: LabSpec = { seed, map: { width: RELIC_BOARD.w, height: RELIC_BOARD.h, ...demoKnobs(seed) }, towers: mixed('choke', RAILBORE), relicIds: [], relics: set, difficulty: STANDARD, maxWaves: MAX_WAVES, economy: { startingScrap: 100 } };
    try { deaths.push(runLab(spec, baseContent).deathWave); } catch { deaths.push(-1); }
  }
  const nums = deaths.map((d) => (d === null ? MAX_WAVES + 1 : d === -1 ? 0 : d));
  const mean = nums.reduce((a, c) => a + c, 0) / nums.length;
  if (n < 0) noRelics.push(mean); else means.push(mean);
  const label = n < 0 ? 'no relics (reference)' : set.map((r) => `${r.id} (${['c', 'r', 'e'][r.rarity]})`).join(', ');
  if (n >= 0 && nums.every((d) => d > 24)) flagged.push(`set ${n + 1}`);
  console.log(`| ${n < 0 ? 'ref' : n + 1} | ${label} | ${deaths.map((d) => (d === null ? `>${MAX_WAVES}` : d === -1 ? 'n/a' : String(d))).join(' | ')} | ${mean.toFixed(1)} |`);
}
const lo = Math.min(...means);
const hi = Math.max(...means);
console.log(`\nspread across ${RELIC_SETS} sets: ${lo.toFixed(1)} to ${hi.toFixed(1)} (reference without relics ${noRelics[0].toFixed(1)}); target band 16-24; past 24 on every seed: ${flagged.length ? flagged.join(', ') : 'none'}\n`);
}
