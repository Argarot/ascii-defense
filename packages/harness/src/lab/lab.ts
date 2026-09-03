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
  resolveCells,
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
   *  adjacent to the Core block (how a Loadbearing build actually plays). */
  at: 'auto' | 'core' | { x: number; y: number };
}

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
}

export interface LabContent {
  lib: TileLibrary;
  towerDefs: readonly TowerDef[];
  enemyDefs: readonly EnemyDef[];
  relicDefs: readonly RelicDef[];
}

/** The live app's map-knob derivation, reproduced draw-for-draw. */
export function demoMap(seed: number, lib: TileLibrary, poolSize: number): { map: GeneratedMap; cellsW: number; cellsH: number; cells: readonly (CellType | null)[] } {
  const knobs = createRng(seed).stream('map');
  const entries = knobs.int(2, 5);
  const targetPathCells = (8 + Math.max(knobs.int(0, 18), knobs.int(0, 18))) * TILE_SIZE;
  const map = generateMap(knobs, lib, { width: 12, height: 7, entries, targetPathCells, relicPoolSize: poolSize });
  return { map, cellsW: 12 * TILE_SIZE, cellsH: 7 * TILE_SIZE, cells: resolveCells(map.board, lib) };
}

function makeWorld(spec: LabSpec, content: LabContent) {
  if (spec.map === 'demo') return demoMap(spec.seed, content.lib, content.relicDefs.length);
  const map = generateMap(createRng(spec.seed).stream('map'), content.lib, { ...spec.map, relicPoolSize: content.relicDefs.length });
  return { map, cellsW: spec.map.width * TILE_SIZE, cellsH: spec.map.height * TILE_SIZE, cells: resolveCells(map.board, content.lib) };
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

/** Greedy best-coverage placement, the way a player actually builds. */
function autoSpot(sim: Sim, cells: readonly (CellType | null)[], W: number, H: number, towerId: string, range: number, nearCoreOnly = false): { x: number; y: number } | null {
  const nearCore = new Set<number>();
  if (nearCoreOnly) {
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        if (cells[y * W + x] !== 'C') continue;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) nearCore.add((y + dy) * W + (x + dx));
      }
  }
  let best: { x: number; y: number } | null = null;
  let bestCov = -1;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (nearCoreOnly && !nearCore.has(y * W + x)) continue;
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
    startingScrap: 1_000_000, // the lab measures combat capability, not economy
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
  for (const p of spec.towers) {
    const def = content.towerDefs.find((d) => d.id === p.towerId);
    if (!def) throw new Error(`unknown tower '${p.towerId}'`);
    const spot =
      p.at === 'auto' || p.at === 'core'
        ? (autoSpot(sim, cells, cellsW, cellsH, p.towerId, def.range, p.at === 'core') ?? autoSpot(sim, cells, cellsW, cellsH, p.towerId, def.range))
        : p.at;
    if (!spot || !sim.buildTower(spot.x, spot.y, p.towerId)) throw new Error(`cannot place ${p.towerId}`);
    for (let tier = 0; tier < 3; tier++) {
      const opt = p.choices[tier];
      if (opt >= 0 && !sim.chooseTier(spot.x, spot.y, tier, opt)) throw new Error(`cannot choose t${tier} on ${p.towerId}`);
    }
    placed.push({ towerId: p.towerId, x: spot.x, y: spot.y });
  }

  const diff = spec.difficulty ?? DEFAULT_DIFFICULTY;
  const waves: WaveRow[] = [];
  let kills0 = 0;
  let breaches0 = 0;
  let lastWave = 0;
  // Auto-pick offers so long runs are not blocked by a pending offer.
  const guard = spec.maxWaves * 20_000;
  for (let t = 0; t < guard; t++) {
    sim.tick();
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

  return {
    result: sim.status === 'lost' ? 'died' : 'survived',
    deathWave: sim.status === 'lost' ? lastWave : null,
    waves,
    L: sim.flow.L,
    towersPlaced: placed,
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
