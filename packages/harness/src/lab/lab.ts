/**
 * The balance lab (WBS 1.5.3/1.5.4): measurement instead of guessing.
 *
 * Two layers that check each other:
 *  - runLab():   the REAL Sim, headless, full speed. Exact by construction,
 *                because it is the game.
 *  - predict():  a closed-form model - coverage x exposure x effective DPS
 *                against the wave HP pool. Fast enough to sweep thousands of
 *                configurations; approximate about overkill and target
 *                contention, honest about being so.
 *
 * The analytic model proposes, the runner verifies, and a persistent gap
 * between them is a bug in one of them - which is itself a finding.
 */
import {
  DEFAULT_DIFFICULTY,
  Sim,
  reworkKnobs,
  withCourier,
  reworkRules,
  type PadOptions,
  computeFlowField,
  createRng,
  generateMap,
  isRoad,
  mapCells,
  waveCount,
  waveHpScale,
  TILE_SIZE,
  TileLibrary,
  type CellType,
  type CombatRules,
  type DifficultySpec,
  type EnemyDef,
  type GeneratedMap,
  type RelicDef,
  type TowerDef,
  resolveUnlocks,
  relicApplies,
  threatKnobs,
  type ThreatLevel,
  type TreeDef,
} from '@ascii-defense/engine';

export interface TowerPlacement {
  towerId: string;
  /** Committed tier choices, -1 for open. */
  choices: [number, number, number];
  /** 'auto': best road coverage anywhere. 'core': best coverage among cells
   *  adjacent to the Core block (how a Loadbearing build actually plays).
   *  'choke' (session 24): best coverage among cells beside the road's last
   *  CHOKE_REACH cells before the Core - the shared tail every lane walks.
   *  'adjacent' (session 27): best coverage among the cells touching the
   *  LAST tower placed - how a Bastion is actually used. 'inline' (session
   *  27): the cell and facing whose straight corridor covers the most road
   *  - how a Laser is actually aimed; the tower is turned to that facing. */
  /** 'vein': a producer on the richest vein it may stand on (session 29, PR 6: the Ore-per-run reading). */
  /** 'entry' (session 36): best coverage among cells within ENTRY_REACH of the FIRST entry - where a first-time player builds,
   *  because that is where the enemies appear. It guards one lane of two or three and sits far from the Core: every other
   *  mode here is greedy-optimal, and "is Calm easy enough for a first run" cannot be read off an optimal player. */
  at: 'auto' | 'core' | 'choke' | 'adjacent' | 'inline' | 'vein' | 'entry' | { x: number; y: number };
}

/** Road cells within this many cells of the Core (by route) are the choke. */
export const CHOKE_REACH = 15;
/** Ground within this many cells (Chebyshev) of the first entry is where the naive placement builds. */
export const ENTRY_REACH = 6;

export interface LabSpec {
  seed: number;
  /**
   * The tree state the run plays under (session 29, PR 6; PRD sec 11
   * stage 3's warning made measurable): node ids bought, or ['*'] for
   * everything. Absent = everything (the sweeps before the tree). The
   * content's tree must be given for this to mean anything.
   */
  unlocks?: string[];
  /** Special tiles guaranteed on the map (session 30, PR 5): the loadout a player would carry - a vein tile for a tier-2 Ore reading. */
  loadout?: string[];
  /** The wave clock, launch to launch, in ticks (session 31: Calm's 55 s vs Standard's 40 s); the sim's default when absent. */
  interWaveTicks?: number;
  /**
   * 'demo' is the app's derivation as it was in session 12 (Standard's knobs, no walk, no land) - kept for the sweeps
   * whose baselines stand on it. `{ threat }` is THE APP'S OWN MAP for this seed as the worker deals it today (session
   * 38): the Threat's knobs drawn off the front of the map stream and the SAME stream carving on. Explicit knobs carve
   * from a fresh stream: the same maps in distribution, not the map a player gets from that seed - right for a
   * statistic, wrong for a list of seeds.
   */
  map: 'demo' | { width: number; height: number; entries: number; targetPathCells: number } | { width: number; height: number; threat: ThreatLevel };
  towers: TowerPlacement[];
  /** Granted before the first tick, in order (offer flow bypassed). */
  relicIds: string[];
  /** Session 28, PR 6: relics with a held rarity (0 common, 1 rare, 2 epic), granted after relicIds. */
  relics?: { id: string; rarity?: number }[];
  difficulty?: DifficultySpec;
  /** A candidate for what a hit is (session 39, D37): overrides of the engine's COMBAT_RULES for this run. */
  rules?: Partial<CombatRules>;
  maxWaves: number;
  coreHp?: number;
  /**
   * Session 24: an ECONOMY. With this set the lab starts with this much
   * scrap and builds the plan INCREMENTALLY - the next tower when it can
   * pay for it, then each listed tier choice in order when it can pay -
   * the way a player actually plays. Without it every tower and choice is
   * placed at tick 0 with unlimited scrap (combat capability, not economy).
   */
  economy?: { startingScrap: number };
  /**
   * What the player buys once the plan is BOUGHT OUT (session 38, issue #348):
   * cycled, one tower at a time, each upgraded through its listed choices
   * before the next is placed - depth before width, which is what the curve
   * rewards (docs/lab/economy-research-2026-09-17.md, finding 5). It ends when
   * the board has no cell left for the next one. Needs `economy`.
   *
   * It exists because a plan that ENDS is not a player: the six-tower
   * reference was fully bought by wave 12 and died holding 3,802 Scrap at
   * wave 20, and every ladder table had been read off it.
   */
  tail?: TowerPlacement[];
  /**
   * THE REWORK'S PROTOTYPE (PRD sec 32.1-32.4): absent, the lab plays the game as it is - every band, the ladder and
   * the corpus. Present, the map is dealt with the pad rule and the sim plays by the prototype's rules, exactly as
   * the app does with its switch on; the plans need no change, because they place by sim.canBuildDefAt. `dig`:
   * 'always' orders a dig on the first rock in sight, once a second, whenever the purse and the queue allow - the
   * player who "digs at every chance" (sec 32.2's target is that such a run ends about six pads up).
   */
  rework?: { pads?: Partial<PadOptions>; dig?: 'never' | 'always' };
}

export interface WaveRow {
  wave: number;
  hpScale: number;
  count: number;
  kills: number;
  breaches: number;
  coreHpEnd: number;
  /** Scrap in hand when the wave ended, after the plan bought everything it could (session 36): a balance that only climbs is a currency with nothing left to buy. */
  scrapEnd: number;
  /** Scrap the plan has SPENT so far (session 36); with `scrapEnd` and the starting purse it gives what the run has EARNED. */
  spentEnd: number;
  /** Towers standing when the wave ended. */
  towersEnd: number;
}

export interface LabReport {
  result: 'died' | 'survived';
  /** Wave the Core fell on; null if it survived maxWaves. */
  deathWave: number | null;
  waves: WaveRow[];
  L: number;
  towersPlaced: { towerId: string; x: number; y: number }[];
  /** Kills per enemy id over the run (session 27): a crowd role shows here, not on the death wave. */
  killsByDef: Record<string, number>;
  /** The purse at the end, by tier (session 29, PR 6): what the run would bank. */
  oreEnd: number[];
  /** Digs ORDERED over the run (the rework's prototype); 0 without it. */
  digs: number;
  /** Every wave cleared, with what its kills paid and what clearing it early paid on top (PRD sec 32.3); [] without the rework. */
  clears: { wave: number; seconds: number; par: number; bonus: number; bounties: number }[];
  /** The towers and relics the tree state allowed this run. */
  world: { towers: number; relics: number; relicSlots: number };
  /** What the run held when it ended, granted and picked alike, each at its rarity (0 common): no row of the lab "holds nothing" - it takes option 0 of every offer. */
  relicsHeld: { id: string; rarity: number }[];
}

export interface LabContent {
  lib: TileLibrary;
  towerDefs: readonly TowerDef[];
  enemyDefs: readonly EnemyDef[];
  relicDefs: readonly RelicDef[];
  /** The meta tree (session 29, PR 6); with it and a spec's unlocks the world is the tree's. */
  tree?: TreeDef;
}

/** The live app's map-knob derivation, reproduced draw-for-draw. */
export function demoMap(seed: number, lib: TileLibrary, poolSize: number, board = { w: 12, h: 7 }): { map: GeneratedMap; cellsW: number; cellsH: number; cells: readonly (CellType | null)[] } {
  const knobs = createRng(seed).stream('map');
  const entries = knobs.int(2, 5);
  const targetPathCells = (8 + Math.max(knobs.int(0, 18), knobs.int(0, 18))) * TILE_SIZE;
  // Since D24 the app's board is viewport-derived (7x5 at 1920x1080); the
  // default here is the old 12x7 so existing sweeps keep their baseline.
  const map = generateMap(knobs, lib, { width: board.w, height: board.h, entries, targetPathCells, relicPoolSize: poolSize });
  return { map, cellsW: map.cellsW, cellsH: map.cellsH, cells: mapCells(map, lib) };
}

function makeWorld(spec: LabSpec, content: LabContent, oreTierMax = 1) {
  if (spec.map === 'demo') return demoMap(spec.seed, content.lib, content.relicDefs.length);
  if ('threat' in spec.map) {
    // Draw for draw what workerRuntime.newRun does (its test holds the worker to the engine's map; this holds the lab to it).
    const knobs = createRng(spec.seed).stream('map');
    const dealt = generateMap(knobs, content.lib, { width: spec.map.width, height: spec.map.height, ...threatKnobs(knobs, spec.map.threat), relicPoolSize: content.relicDefs.length, specials: spec.loadout ?? [], oreTierMax, ...(spec.rework ? reworkKnobs(spec.map.threat, spec.rework.pads) : {}) });
    return { map: dealt, cellsW: dealt.cellsW, cellsH: dealt.cellsH, cells: mapCells(dealt, content.lib) };
  }
  const map = generateMap(createRng(spec.seed).stream('map'), content.lib, { ...spec.map, relicPoolSize: content.relicDefs.length, specials: spec.loadout ?? [], oreTierMax });
  return { map, cellsW: map.cellsW, cellsH: map.cellsH, cells: mapCells(map, content.lib) };
}

/**
 * How many lanes walk through each road cell (session 38): every entry's route to the Core, walked down the flow
 * field, one count a cell. 'choke' placement weighs a cell by it, because a choke is where the LANES gather and not
 * where the road is thickest: counting cells alone, the lab stood all five towers of seed 150474 at a busy junction
 * fifteen cells out while a second branch joined the road beside the Core and walked in untouched - dead at wave 6
 * on every plan, and filed as an "unwinnable seed" until the towers' coordinates were read.
 * An approximation on purpose: a bridge's two strands are walked as one cell.
 */
function laneTraffic(cells: readonly (CellType | null)[], W: number, H: number, entries: readonly { x: number; y: number }[]): Int32Array {
  const flow = computeFlowField(cells, W, H, entries);
  const traffic = new Int32Array(W * H);
  const STEPS: readonly [number, number, number][] = [[1, 0, -1], [2, 1, 0], [4, 0, 1], [8, -1, 0]]; // the flow field's N E S W bits
  for (const e of entries) {
    let x = e.x;
    let y = e.y;
    for (let guard = 0; guard < W * H; guard++) {
      const at = y * W + x;
      const d = flow.dist[at];
      if (d < 0) break;
      traffic[at]++;
      if (d === 0) break;
      const step = STEPS.find(([bit, dx, dy]) => {
        const nx = x + dx;
        const ny = y + dy;
        return (flow.allowed[at] & bit) !== 0 && nx >= 0 && ny >= 0 && nx < W && ny < H && flow.dist[ny * W + nx] === d - 1;
      });
      if (!step) break;
      x += step[1];
      y += step[2];
    }
  }
  return traffic;
}

/** `coverage`, each road cell counted once per lane that walks it - what a tower standing at (x, y) would actually see go by. */
function laneCoverage(traffic: Int32Array, W: number, H: number, x: number, y: number, range: number): number {
  let n = 0;
  const r2 = range * range;
  for (let cy = Math.max(0, Math.floor(y - range)); cy <= Math.min(H - 1, Math.ceil(y + range)); cy++)
    for (let cx = Math.max(0, Math.floor(x - range)); cx <= Math.min(W - 1, Math.ceil(x + range)); cx++) {
      const dx = cx - x;
      const dy = cy - y;
      if (dx * dx + dy * dy <= r2) n += traffic[cy * W + cx];
    }
  return n;
}

/** Road cells within `range` of cell (x, y), measured centre to centre.
 *  isRoad, not a letter: the '=== omni' version predated the segment
 *  re-encode and left greedy placement nearly road-blind (found session 19). */
function coverage(cells: readonly (CellType | null)[], W: number, H: number, x: number, y: number, range: number): number {
  let n = 0;
  const r2 = range * range;
  for (let cy = 0; cy < H; cy++)
    for (let cx = 0; cx < W; cx++) {
      const c = cells[cy * W + cx];
      if (c === null || !isRoad(c)) continue;
      const dx = cx - x;
      const dy = cy - y;
      if (dx * dx + dy * dy <= r2) n++;
    }
  return n;
}

/**
 * The straight corridor a beam would cover from (x, y) facing f (the sim's
 * own rule, mirrored): cross to the road, run along it while it keeps
 * straight, stop where it turns or ends. Returns the road cells covered.
 */
function corridorRoad(cells: readonly (CellType | null)[], W: number, H: number, x: number, y: number, f: number): number {
  const DX = [0, 1, 0, -1];
  const DY = [-1, 0, 1, 0];
  let road = 0;
  let onRoad = false;
  for (let k = 1; k <= W + H; k++) {
    const nx = x + DX[f] * k;
    const ny = y + DY[f] * k;
    if (nx < 0 || ny < 0 || nx >= W || ny >= H) break;
    const c = cells[ny * W + nx];
    const isR = c !== null && isRoad(c);
    if (onRoad && !isR) break;
    if (isR) { onRoad = true; road++; }
  }
  return road;
}

/** A beam has no range; placed by a coverage instrument other than 'inline' it is placed as a gun of this range would be. */
const BEAM_AS_GUN_RANGE = 6;

/** How far (by route) the corridor's first road cell is from the Core; -1 when the corridor meets no road. */
function corridorDistance(cells: readonly (CellType | null)[], W: number, H: number, dist: Int32Array | number[], x: number, y: number, f: number): number {
  const DX = [0, 1, 0, -1];
  const DY = [-1, 0, 1, 0];
  for (let k = 1; k <= W + H; k++) {
    const nx = x + DX[f] * k;
    const ny = y + DY[f] * k;
    if (nx < 0 || ny < 0 || nx >= W || ny >= H) return -1;
    const c = cells[ny * W + nx];
    if (c !== null && isRoad(c)) return dist[ny * W + nx];
  }
  return -1;
}

/** Route distance weighs against road covered: a corridor of ten cells thirty out loses to one of six at the choke. */
export const INLINE_DISTANCE_WEIGHT = 0.25;

/**
 * The cell and facing whose corridor covers the most road NEAR THE CHOKE
 * (ties: first in scan order). Session 27 scored road alone, and the first
 * laser watched an empty run far from the Core while the wave leaked
 * elsewhere (the instruments sweep); session 28 PR 6 adds the distance
 * term: road covered minus a quarter of the corridor's route distance.
 */
function inlineSpot(sim: Sim, cells: readonly (CellType | null)[], W: number, H: number, towerId: string): { x: number; y: number; facing: number } | null {
  const flow = computeFlowField(cells, W, H, []);
  let best: { x: number; y: number; facing: number } | null = null;
  let bestScore = -Infinity;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!sim.canBuildDefAt(x, y, towerId)) continue;
      for (let f = 0; f < 4; f++) {
        const road = corridorRoad(cells, W, H, x, y, f);
        if (road === 0) continue;
        const d = corridorDistance(cells, W, H, flow.dist, x, y, f);
        const score = road - (d < 0 ? W + H : d) * INLINE_DISTANCE_WEIGHT;
        if (score > bestScore) { bestScore = score; best = { x, y, facing: f }; }
      }
    }
  return best;
}

/** Greedy best-coverage placement, the way a player actually builds. */
function autoSpot(sim: Sim, cells: readonly (CellType | null)[], W: number, H: number, towerId: string, range: number, where: 'auto' | 'core' | 'choke' | 'adjacent' | 'entry' = 'auto', last?: { x: number; y: number }, entry?: { x: number; y: number }, lanes?: readonly { x: number; y: number }[]): { x: number; y: number } | null {
  const allowed = new Set<number>();
  if (where === 'entry') {
    if (!entry) where = 'auto';
    else for (let y = Math.max(0, entry.y - ENTRY_REACH); y <= Math.min(H - 1, entry.y + ENTRY_REACH); y++)
      for (let x = Math.max(0, entry.x - ENTRY_REACH); x <= Math.min(W - 1, entry.x + ENTRY_REACH); x++) allowed.add(y * W + x);
  }
  if (where === 'adjacent' && last) {
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) allowed.add((last.y + dy) * W + (last.x + dx));
  } else if (where === 'adjacent') {
    where = 'choke'; // nothing placed yet: the first tower goes where a first tower goes
  }
  if (where === 'core') {
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        if (cells[y * W + x] !== 'C') continue;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) allowed.add((y + dy) * W + (x + dx));
      }
  } else if (where === 'choke') {
    // Ground touching a road cell within CHOKE_REACH of the Core by route.
    const flow = computeFlowField(cells, W, H, []);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        if (cells[y * W + x] !== 'G') continue;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const c = cells[ny * W + nx];
          if (c === null || !isRoad(c)) continue;
          const d = flow.dist[ny * W + nx];
          if (d >= 0 && d <= CHOKE_REACH) allowed.add(y * W + x);
        }
      }
  }
  // The choke is scored by LANES seen, road cells breaking a tie; everywhere else by road cells, as it always was.
  const traffic = where === 'choke' && lanes && lanes.length > 0 ? laneTraffic(cells, W, H, lanes) : null;
  let best: { x: number; y: number } | null = null;
  let bestCov = -1;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (where !== 'auto' && !allowed.has(y * W + x)) continue;
      if (!sim.canBuildDefAt(x, y, towerId)) continue;
      const cov = traffic ? laneCoverage(traffic, W, H, x, y, range) * 10_000 + coverage(cells, W, H, x, y, range) : coverage(cells, W, H, x, y, range);
      if (cov > bestCov) {
        bestCov = cov;
        best = { x, y };
      }
    }
  return best;
}

export function runLab(spec: LabSpec, content: LabContent): LabReport {
  // The tree decides the world (session 29, PR 6), the way the worker does it - the map's veins included (the ore ladder, D30).
  const unlocked = content.tree && spec.unlocks ? resolveUnlocks(content.tree, { unlocks: spec.unlocks, earned: [], forged: {} }, content.relicDefs) : null;
  const { map, cellsW, cellsH, cells } = makeWorld(spec, content, unlocked?.oreTierMax ?? 1);
  const towerDefs = unlocked ? content.towerDefs.filter((d) => unlocked.towers.has(d.id)) : content.towerDefs;
  const relicDefs = (unlocked ? content.relicDefs.filter((d) => unlocked.relics.has(d.id)) : content.relicDefs).filter((d) => relicApplies(d, towerDefs.map((t) => t.id)));
  content = { ...content, towerDefs, relicDefs };
  const sim = new Sim(spec.seed, {
    cells,
    cellsW,
    cellsH,
    map,
    enemyDefs: spec.rework ? withCourier(content.enemyDefs) : content.enemyDefs,
    towerDefs,
    relicDefs,
    relicSlots: unlocked?.relicSlots,
    // The band the tree bought caps what an offer may deal, as in the worker (D29: the base world deals commons alone).
    // Until 2026-09-18 the lab passed the slots and not the cap, so every base-world row rolled rares and epics from
    // its offers - a richer world than the one a player without the workshop is in.
    rarityMax: unlocked?.rarityMax,
    rework: spec.rework ? reworkRules() : undefined,
    interWaveTicks: spec.interWaveTicks,
    mode: 'waves',
    firstWaveWaits: false,
    coreHp: spec.coreHp ?? 50,
    // Without an economy the lab measures combat capability, not scrap.
    startingScrap: spec.economy ? spec.economy.startingScrap : 1_000_000,
    difficulty: spec.difficulty ?? DEFAULT_DIFFICULTY,
    rules: spec.rules,
  });

  // Grant relics directly - acquisition flow is not what is being measured.
  for (const id of spec.relicIds) {
    const idx = content.relicDefs.findIndex((r) => r.id === id);
    if (idx === -1) throw new Error(`unknown relic '${id}'`);
    sim.offer = [idx];
    sim.offerRarity = [0];
    if (!sim.pickRelic(0)) throw new Error(`could not grant relic '${id}'`);
  }
  for (const r of spec.relics ?? []) {
    const idx = content.relicDefs.findIndex((d) => d.id === r.id);
    if (idx === -1) throw new Error(`unknown relic '${r.id}'`);
    sim.offer = [idx];
    sim.offerRarity = [r.rarity ?? 0];
    if (!sim.pickRelic(0)) throw new Error(`could not grant relic '${r.id}'`);
  }

  const placed: LabReport['towersPlaced'] = [];
  /** The plan as it stands: the listed towers, then each tail tower as it is placed - `placed[i]` is where `plan[i]` went. */
  const plan: TowerPlacement[] = [...spec.towers];
  let spent = 0;
  /** Place the next tower of the plan; returns false when it cannot (no spot, or - with an economy - no scrap). */
  const placeNext = (p: TowerPlacement, soft = false): boolean => {
    const def = content.towerDefs.find((d) => d.id === p.towerId);
    if (!def) throw new Error(`unknown tower '${p.towerId}'`);
    if (spec.economy && !sim.canAfford(p.towerId)) return false;
    let facing: number | null = null;
    let spot: { x: number; y: number } | null;
    if (p.at === 'inline') {
      const inl = inlineSpot(sim, cells, cellsW, cellsH, p.towerId);
      if (inl) { spot = inl; facing = inl.facing; }
      else spot = autoSpot(sim, cells, cellsW, cellsH, p.towerId, def.range ?? BEAM_AS_GUN_RANGE, 'choke', undefined, undefined, map.entries);
    } else if (p.at === 'vein') {
      // The richest vein it may stand on: highest tier, then most Ore left.
      spot = null;
      let bestKey = -1;
      for (let y = 0; y < cellsH; y++)
        for (let x = 0; x < cellsW; x++) {
          if (cells[y * cellsW + x] !== 'O' || !sim.canBuildDefAt(x, y, p.towerId)) continue;
          const d = sim.depositAt(x, y);
          const key = d ? d.tier * 10000 + d.left : 0;
          if (key > bestKey) { bestKey = key; spot = { x, y }; }
        }
      if (!spot) return false; // no vein: the plan goes on without its producer
    } else if (typeof p.at === 'string') {
      spot = autoSpot(sim, cells, cellsW, cellsH, p.towerId, def.range ?? BEAM_AS_GUN_RANGE, p.at, placed[placed.length - 1], map.entries[0], map.entries) ?? autoSpot(sim, cells, cellsW, cellsH, p.towerId, def.range ?? BEAM_AS_GUN_RANGE);
    } else {
      spot = p.at;
    }
    const purse = sim.scrap;
    if (!spot && soft) return false; // the tail, on a board with no cell left: the plan is over, not broken
    if (!spot || !sim.buildTower(spot.x, spot.y, p.towerId)) throw new Error(`cannot place ${p.towerId}`);
    spent += purse - sim.scrap;
    if (facing !== null) sim.setFacing(spot.x, spot.y, facing);
    placed.push({ towerId: p.towerId, x: spot.x, y: spot.y });
    return true;
  };
  /** Buy the next listed tier choice on a placed tower; false when it cannot pay or nothing is left. */
  const upgradeNext = (i: number): boolean => {
    const p = plan[i];
    const at = placed[i];
    if (at.x < 0) return false; // a skipped producer
    for (let tier = 0; tier < 3; tier++) {
      const opt = p.choices[tier];
      if (opt < 0) return false;
      const tower = sim.towerAt(at.x, at.y);
      if (!tower) return false;
      if (tower.choices[tier] >= 0) continue; // bought already
      const cost = sim.choiceCost(tower, tier, opt);
      if (cost === null) return false;
      if (spec.economy && sim.scrap < cost) return false;
      const purse = sim.scrap;
      if (!sim.chooseTier(at.x, at.y, tier, opt)) throw new Error(`cannot choose t${tier} on ${p.towerId}`);
      spent += purse - sim.scrap;
      return true;
    }
    return false;
  };
  let nextToPlace = 0;
  let tailAt = 0;
  let tailOver = spec.tail === undefined || spec.tail.length === 0 || !spec.economy;
  /** Every listed choice of every standing tower is bought: nothing in the plan is waiting on the purse. */
  const boughtOut = (): boolean => placed.every((at, i) => {
    if (at.x < 0) return true;
    const tower = sim.towerAt(at.x, at.y);
    return !tower || plan[i].choices.every((opt, tier) => opt < 0 || tower.choices[tier] >= 0);
  });
  /** One pass of the plan: towers first, then upgrades in listed order, then the tail; loops until nothing more is affordable. */
  const advancePlan = (): void => {
    for (;;) {
      if (nextToPlace < plan.length) {
        const p = plan[nextToPlace];
        if (!placeNext(p)) {
          // A producer with no vein is skipped, not waited for (the plan would stall forever).
          if (p.at === 'vein' && (!spec.economy || sim.canAfford(p.towerId))) { placed.push({ towerId: p.towerId, x: -1, y: -1 }); nextToPlace++; continue; }
          return;
        }
        nextToPlace++;
        continue;
      }
      let bought = false;
      for (let i = 0; i < placed.length && !bought; i++) bought = upgradeNext(i);
      if (bought) continue;
      // Nothing bought: the purse is short, or the plan is bought out - and only then does the tail go on.
      if (tailOver || !boughtOut()) return;
      const next = spec.tail![tailAt % spec.tail!.length];
      if (!sim.canAfford(next.towerId)) return;
      if (!placeNext(next, true)) { tailOver = true; return; }
      plan.push(next);
      nextToPlace++;
      tailAt++;
    }
  };
  advancePlan();

  const diff = spec.difficulty ?? DEFAULT_DIFFICULTY;
  const waves: WaveRow[] = [];
  let kills0 = 0;
  let breaches0 = 0;
  let lastWave = 0;
  let digs = 0;
  // Auto-pick offers so long runs are not blocked by a pending offer.
  const guard = spec.maxWaves * 20_000;
  for (let t = 0; t < guard; t++) {
    sim.tick();
    // Once a second: scrap arrives with kills. NEVER after the run has ended (#367): the sim refuses every purchase
    // once its status is not 'running', and placeNext / upgradeNext throw on a refusal - so a Core that died on a
    // plan tick, with a purse that could afford something, turned a LOST run into a thrown one, and every tool
    // recorded it as "refused" and dropped it from its row's denominator. One loss in twenty-odd, since issue #348
    // gave the lab a player who keeps buying; every win rate read since then was nudged up by it.
    if (spec.economy && t % 20 === 0 && sim.status === 'running') advancePlan();
    // The digger: AFTER the plan has had its turn at the purse, so a dig never starves the build it is for.
    if (spec.rework?.dig === 'always' && t % 20 === 0 && sim.status === 'running' && sim.scrap >= sim.prospectCost()) {
      dig: for (let y = 0; y < cellsH; y++)
        for (let x = 0; x < cellsW; x++) {
          if (sim.cellAt(x, y) !== 'R' || sim.prospectJobAt(x, y) !== null || !sim.cellKnown(x, y)) continue;
          if (sim.prospect(x, y)) digs++;
          break dig;
        }
    }
    if (sim.offer !== null) sim.pickRelic(0);
    if (sim.wave !== lastWave) {
      if (lastWave > 0) {
        waves.push({
          wave: lastWave,
          hpScale: waveHpScale(diff, lastWave),
          count: waveCount(diff, lastWave),
          kills: sim.kills - kills0,
          breaches: sim.breaches - breaches0,
          coreHpEnd: sim.coreHp,
          scrapEnd: sim.scrap,
          spentEnd: spent,
          towersEnd: placed.filter((p) => p.x >= 0).length,
        });
      }
      kills0 = sim.kills;
      breaches0 = sim.breaches;
      lastWave = sim.wave;
    }
    if (sim.status === 'lost' || lastWave > spec.maxWaves) break;
  }
  if (sim.status === 'lost' && lastWave > 0) {
    waves.push({
      wave: lastWave,
      hpScale: waveHpScale(diff, lastWave),
      count: waveCount(diff, lastWave),
      kills: sim.kills - kills0,
      breaches: sim.breaches - breaches0,
      coreHpEnd: sim.coreHp,
      scrapEnd: sim.scrap,
      spentEnd: spent,
      towersEnd: placed.filter((p) => p.x >= 0).length,
    });
  }

  const killsByDef: Record<string, number> = {};
  content.enemyDefs.forEach((d, i) => { if ((sim.killsByDef[i] ?? 0) > 0) killsByDef[d.id] = sim.killsByDef[i]; });
  return {
    result: sim.status === 'lost' ? 'died' : 'survived',
    deathWave: sim.status === 'lost' ? lastWave : null,
    waves,
    L: sim.flow.L,
    towersPlaced: placed,
    killsByDef,
    oreEnd: [...sim.ore],
    digs,
    clears: sim.clears.map((c) => ({ ...c })),
    world: { towers: towerDefs.length, relics: relicDefs.length, relicSlots: sim.relicSlots },
    relicsHeld: sim.heldRelics.map((di, i) => ({ id: relicDefs[di].id, rarity: sim.heldRarity[i] ?? 0 })),
  };
}

// ---------------------------------------------------------------------------
// The analytic half (1.5.4).
// ---------------------------------------------------------------------------

export interface Prediction {
  /** First wave whose HP pool exceeds deliverable damage; null = never within horizon. */
  firstLeakWave: number | null;
  /** Predicted wave the Core falls; null = survives the horizon. */
  deathWave: number | null;
  /** margin[w-1] = deliverable damage / wave HP pool for wave w. */
  margins: number[];
}

/**
 * Closed form: per wave, deliverable damage vs the wave's HP pool.
 *
 * Deliverable per tower: dps x window, where the window is the stretch the
 * tower has targets - spawn spread plus its own covered traversal time.
 * Ignores overkill, target contention and slow (optimistic there), and
 * ignores Frost's utility entirely (pessimistic there). A bound with a
 * tolerance, not an oracle - the runner is the oracle.
 */
export function predict(
  spec: LabSpec,
  content: LabContent,
  placedStats: { x: number; y: number; dps: number; range: number }[],
  horizon: number,
): Prediction {
  const { map, cellsW, cellsH, cells } = makeWorld(spec, content);
  const flow = computeFlowField(cells, cellsW, cellsH, map.entries);

  // Walk each entry's path downhill, the same neighbour order the sim uses.
  const paths: { x: number; y: number }[][] = map.entries.map((e) => {
    const path: { x: number; y: number }[] = [];
    let { x, y } = e;
    for (;;) {
      path.push({ x, y });
      const here = flow.dist[y * cellsW + x];
      if (here === 0) break;
      let moved = false;
      for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]] as const) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= cellsW || ny >= cellsH) continue;
        if (flow.dist[ny * cellsW + nx] === here - 1) {
          x = nx;
          y = ny;
          moved = true;
          break;
        }
      }
      if (!moved) throw new Error('analytic: no downhill step');
    }
    return path;
  });

  const enemy = content.enemyDefs[0]; // reference enemy: the walker archetype
  const speed = enemy.speed;
  const spawnGap = 6; // sim's intra-wave spawn spacing

  // Per tower: average covered cells over entry paths (only entries it sees).
  const towerWindows = placedStats.map((t) => {
    const covered = paths.map((path) => path.filter((c) => {
      const dx = c.x - t.x;
      const dy = c.y - t.y;
      return dx * dx + dy * dy <= t.range * t.range;
    }).length);
    const avgCovered = covered.reduce((a, b) => a + b, 0) / paths.length;
    return { dps: t.dps, traversalTicks: avgCovered / speed };
  });

  const diff = spec.difficulty ?? DEFAULT_DIFFICULTY;
  const margins: number[] = [];
  let firstLeakWave: number | null = null;
  let deathWave: number | null = null;
  let coreHp = spec.coreHp ?? 50;

  for (let w = 1; w <= horizon; w++) {
    const n = waveCount(diff, w);
    const hp = enemy.hp * waveHpScale(diff, w) + (enemy.shield ?? 0);
    const waveHpPool = n * hp;
    const deliverable = towerWindows.reduce(
      (sum, t) => sum + (t.dps / 20) * ((n - 1) * spawnGap + t.traversalTicks),
      0,
    );
    const margin = deliverable / waveHpPool;
    margins.push(margin);
    if (margin < 1) {
      if (firstLeakWave === null) firstLeakWave = w;
      const leaked = Math.min(n, Math.ceil(n * (1 - margin)));
      coreHp -= leaked * enemy.damage;
      if (coreHp <= 0 && deathWave === null) {
        deathWave = w;
        break;
      }
    }
  }
  return { firstLeakWave, deathWave, margins };
}
