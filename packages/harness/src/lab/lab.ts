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
  type DifficultySpec,
  type EnemyDef,
  type GeneratedMap,
  type RelicDef,
  type TowerDef,
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
  at: 'auto' | 'core' | 'choke' | 'adjacent' | 'inline' | { x: number; y: number };
}

/** Road cells within this many cells of the Core (by route) are the choke. */
export const CHOKE_REACH = 15;

export interface LabSpec {
  seed: number;
  /** 'demo' derives the map exactly as the live app does for this seed. */
  map: 'demo' | { width: number; height: number; entries: number; targetPathCells: number };
  towers: TowerPlacement[];
  /** Granted before the first tick, in order (offer flow bypassed). */
  relicIds: string[];
  difficulty?: DifficultySpec;
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
}

export interface WaveRow {
  wave: number;
  hpScale: number;
  count: number;
  kills: number;
  breaches: number;
  coreHpEnd: number;
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
}

export interface LabContent {
  lib: TileLibrary;
  towerDefs: readonly TowerDef[];
  enemyDefs: readonly EnemyDef[];
  relicDefs: readonly RelicDef[];
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

function makeWorld(spec: LabSpec, content: LabContent) {
  if (spec.map === 'demo') return demoMap(spec.seed, content.lib, content.relicDefs.length);
  const map = generateMap(createRng(spec.seed).stream('map'), content.lib, { ...spec.map, relicPoolSize: content.relicDefs.length });
  return { map, cellsW: map.cellsW, cellsH: map.cellsH, cells: mapCells(map, content.lib) };
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
function corridorRoad(cells: readonly (CellType | null)[], W: number, H: number, x: number, y: number, f: number, cap: number): number {
  const DX = [0, 1, 0, -1];
  const DY = [-1, 0, 1, 0];
  let road = 0;
  let onRoad = false;
  for (let k = 1; k <= cap; k++) {
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

/** The cell and facing whose corridor covers the most road (ties: first in scan order). */
function inlineSpot(sim: Sim, cells: readonly (CellType | null)[], W: number, H: number, towerId: string, cap: number): { x: number; y: number; facing: number } | null {
  let best: { x: number; y: number; facing: number } | null = null;
  let bestRoad = 0;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!sim.canBuildDefAt(x, y, towerId)) continue;
      for (let f = 0; f < 4; f++) {
        const road = corridorRoad(cells, W, H, x, y, f, cap);
        if (road > bestRoad) { bestRoad = road; best = { x, y, facing: f }; }
      }
    }
  return best;
}

/** Greedy best-coverage placement, the way a player actually builds. */
function autoSpot(sim: Sim, cells: readonly (CellType | null)[], W: number, H: number, towerId: string, range: number, where: 'auto' | 'core' | 'choke' | 'adjacent' = 'auto', last?: { x: number; y: number }): { x: number; y: number } | null {
  const allowed = new Set<number>();
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
  let best: { x: number; y: number } | null = null;
  let bestCov = -1;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (where !== 'auto' && !allowed.has(y * W + x)) continue;
      if (!sim.canBuildDefAt(x, y, towerId)) continue;
      const cov = coverage(cells, W, H, x, y, range);
      if (cov > bestCov) {
        bestCov = cov;
        best = { x, y };
      }
    }
  return best;
}

export function runLab(spec: LabSpec, content: LabContent): LabReport {
  const { map, cellsW, cellsH, cells } = makeWorld(spec, content);
  const sim = new Sim(spec.seed, {
    cells,
    cellsW,
    cellsH,
    map,
    enemyDefs: content.enemyDefs,
    towerDefs: content.towerDefs,
    relicDefs: content.relicDefs,
    mode: 'waves',
    firstWaveWaits: false,
    coreHp: spec.coreHp ?? 50,
    // Without an economy the lab measures combat capability, not scrap.
    startingScrap: spec.economy ? spec.economy.startingScrap : 1_000_000,
    difficulty: spec.difficulty ?? DEFAULT_DIFFICULTY,
  });

  // Grant relics directly - acquisition flow is not what is being measured.
  for (const id of spec.relicIds) {
    const idx = content.relicDefs.findIndex((r) => r.id === id);
    if (idx === -1) throw new Error(`unknown relic '${id}'`);
    sim.offer = [idx];
    if (!sim.pickRelic(0)) throw new Error(`could not grant relic '${id}'`);
  }

  const placed: LabReport['towersPlaced'] = [];
  /** Place the next tower of the plan; returns false when it cannot (no spot, or - with an economy - no scrap). */
  const placeNext = (p: TowerPlacement): boolean => {
    const def = content.towerDefs.find((d) => d.id === p.towerId);
    if (!def) throw new Error(`unknown tower '${p.towerId}'`);
    if (spec.economy && !sim.canAfford(p.towerId)) return false;
    let facing: number | null = null;
    let spot: { x: number; y: number } | null;
    if (p.at === 'inline') {
      const inl = inlineSpot(sim, cells, cellsW, cellsH, p.towerId, Math.ceil(def.range));
      if (inl) { spot = inl; facing = inl.facing; }
      else spot = autoSpot(sim, cells, cellsW, cellsH, p.towerId, def.range, 'choke');
    } else if (typeof p.at === 'string') {
      spot = autoSpot(sim, cells, cellsW, cellsH, p.towerId, def.range, p.at, placed[placed.length - 1]) ?? autoSpot(sim, cells, cellsW, cellsH, p.towerId, def.range);
    } else {
      spot = p.at;
    }
    if (!spot || !sim.buildTower(spot.x, spot.y, p.towerId)) throw new Error(`cannot place ${p.towerId}`);
    if (facing !== null) sim.setFacing(spot.x, spot.y, facing);
    placed.push({ towerId: p.towerId, x: spot.x, y: spot.y });
    return true;
  };
  /** Buy the next listed tier choice on a placed tower; false when it cannot pay or nothing is left. */
  const upgradeNext = (i: number): boolean => {
    const p = spec.towers[i];
    const at = placed[i];
    for (let tier = 0; tier < 3; tier++) {
      const opt = p.choices[tier];
      if (opt < 0) return false;
      const tower = sim.towerAt(at.x, at.y);
      if (!tower) return false;
      if (tower.choices[tier] >= 0) continue; // bought already
      const cost = sim.choiceCost(tower, tier, opt);
      if (cost === null) return false;
      if (spec.economy && sim.scrap < cost) return false;
      if (!sim.chooseTier(at.x, at.y, tier, opt)) throw new Error(`cannot choose t${tier} on ${p.towerId}`);
      return true;
    }
    return false;
  };
  let nextToPlace = 0;
  /** One pass of the plan: towers first, then upgrades in listed order; loops until nothing more is affordable. */
  const advancePlan = (): void => {
    for (;;) {
      if (nextToPlace < spec.towers.length) {
        if (!placeNext(spec.towers[nextToPlace])) return;
        nextToPlace++;
        continue;
      }
      let bought = false;
      for (let i = 0; i < placed.length && !bought; i++) bought = upgradeNext(i);
      if (!bought) return;
    }
  };
  advancePlan();

  const diff = spec.difficulty ?? DEFAULT_DIFFICULTY;
  const waves: WaveRow[] = [];
  let kills0 = 0;
  let breaches0 = 0;
  let lastWave = 0;
  // Auto-pick offers so long runs are not blocked by a pending offer.
  const guard = spec.maxWaves * 20_000;
  for (let t = 0; t < guard; t++) {
    sim.tick();
    if (spec.economy && t % 20 === 0) advancePlan(); // once a second: scrap arrives with kills
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
