/**
 * The sim worker (D7, session 18): owns the Sim, the map, the tick clock and
 * every read derived from sim state. The UI thread sends UiState and actions;
 * this thread answers with FrameSnapshots of plain data.
 *
 * The sim itself is untouched - same class, same determinism, same golden
 * hash; only WHERE it runs moved. Worker timers are not throttled in hidden
 * tabs, so the run keeps simulating when the tab does not have the screen
 * (D7's whole point); an explicit pause is the only thing that stops time.
 */
import {
  CACHE_CLAIM_COST,
  DEPOSIT_MAX,
  OFFER_REROLL_COST,
  PROSPECT_COST,
  PROSPECT_TICKS,
  RELIC_DRAW_COST,
  REPLAY_VERSION,
  Sim,
  TICK_HZ,
  TILE_SIZE,
  TileLibrary,
  contentHashOf,
  createRng,
  generateMap,
  resolveCells,
  type GeneratedMap,
  type ReplayAction,
} from '@ascii-defense/engine';
import { validateEnemies, validateRelics, validateTowers } from '@ascii-defense/content';
import tileLibraryJson from '@ascii-defense/content/assets/tiles/library.json';
import enemiesJson from '@ascii-defense/content/assets/enemies/roster.json';
import towersJson from '@ascii-defense/content/assets/towers/roster.json';
import relicsJson from '@ascii-defense/content/assets/relics/pool.json';
import { SAVE_VERSION, THREAT_LEVELS, type FrameSnapshot, type FromWorker, type RunSave, type ToWorker, type UiState, type WorkerAction } from './protocol';

function must<T>(r: { ok: true; value: T } | { ok: false; errors: { path: string; message: string }[] }, what: string): T {
  if (!r.ok) throw new Error(`${what} failed validation`);
  return r.value;
}
const ENEMY_DEFS = must(validateEnemies.check(enemiesJson), 'enemies').enemies;
const TOWER_DEFS = must(validateTowers.check(towersJson), 'towers').towers;
const RELIC_DEFS = must(validateRelics.check(relicsJson), 'relics').relics;

// Minted tiles live in localStorage, which workers cannot read - the main
// thread will pass them in with init once the smith's pool matters mid-run
// (session 19); until then the shipped library is the worker's world.
const lib = new TileLibrary(tileLibraryJson.tiles);

const MAP_X = 12;
const MAP_Y = 7;
const TICK_MS = 1000 / TICK_HZ;
const SPEEDS = [0, 1, 2, 4, 8] as const;
const MIN_SLOTS = 12;

let sim: Sim;
let map: GeneratedMap;
let seed = 1;
let threatIdx = 1;
let speedIdx = 1;
let offerWasUp = false;
let speedBeforeOffer = 1;
let targeting: string | null = null;
let acc = 0;
let lastBeat = 0;

const post = (m: FromWorker): void => {
  (globalThis as unknown as { postMessage(m: FromWorker): void }).postMessage(m);
};

function newRun(wantSeed: number, tIdx: number, resume?: RunSave): void {
  threatIdx = Math.min(THREAT_LEVELS.length - 1, Math.max(0, tIdx));
  const THREAT = THREAT_LEVELS[threatIdx];
  seed = wantSeed;
  for (;;) {
    try {
      const knobs = createRng(seed).stream('map');
      const entries = knobs.int(THREAT.entries[0], THREAT.entries[1]);
      const targetPathLength = THREAT.pathBias + Math.max(knobs.int(0, 18), knobs.int(0, 18));
      map = generateMap(knobs, lib, { width: MAP_X, height: MAP_Y, entries, targetPathLength, relicPoolSize: RELIC_DEFS.length });
      break;
    } catch {
      seed = (seed + 1) % 1_000_000; // a player never reads a generator trace
    }
  }
  sim = new Sim(seed, {
    cells: resolveCells(map.board, lib),
    cellsW: MAP_X * TILE_SIZE,
    cellsH: MAP_Y * TILE_SIZE,
    map,
    enemyDefs: ENEMY_DEFS,
    towerDefs: TOWER_DEFS,
    mode: 'waves',
    coreHp: 50,
    relicDefs: RELIC_DEFS,
    finalWave: THREAT.finalWave,
    difficulty: { hpLinear: 0.18, hpGeometric: THREAT.hpGeometric, countBase: 6, countLinear: 4, countGeometric: 1 },
  });
  offerWasUp = false;
  targeting = null;
  acc = 0;
  if (resume) {
    // A save IS a replay (PRD sec 15.2): re-apply the input log at its
    // recorded ticks, then tick on to the saved moment. Exact by
    // determinism - this is the same machinery as the golden test.
    const pending = [...resume.inputs];
    while (sim.tickCount < resume.tick && sim.status === 'running') {
      while (pending.length && pending[0].tick === sim.tickCount) {
        sim.applyAction(pending.shift()!.a as ReplayAction);
      }
      sim.tick();
    }
    while (pending.length && pending[0].tick === sim.tickCount) {
      sim.applyAction(pending.shift()!.a as ReplayAction);
    }
    speedIdx = 0; // resume paused: the player left, the world waits for them
  } else {
    speedIdx = 1;
  }
  post({ t: 'ready', seed, map, finalWave: THREAT.finalWave });
}

function syncOfferPause(): void {
  const up = sim.offer !== null;
  if (up && !offerWasUp) {
    speedBeforeOffer = speedIdx === 0 ? 1 : speedIdx;
    speedIdx = 0;
  }
  if (!up && offerWasUp) speedIdx = speedBeforeOffer;
  offerWasUp = up;
}

// ---- the tick clock (worker-side; hidden tabs cannot throttle it) ----------
setInterval(() => {
  const now = Date.now();
  const dt = Math.min(now - (lastBeat || now), 250);
  lastBeat = now;
  if (!sim) return;
  acc += dt * SPEEDS[speedIdx];
  let ran = 0;
  while (acc >= TICK_MS && ran < 32) {
    sim.tick();
    acc -= TICK_MS;
    ran++;
  }
  if (ran > 0) syncOfferPause();
}, TICK_MS);

// ---- snapshot assembly (the old draw()'s state half, verbatim in spirit) ---
const slotTag = (name: string): string => {
  const words = name.split(' ').filter(Boolean);
  return (words.length > 1 ? words[0][0] + words[1][0] : name.slice(0, 2)).toUpperCase();
};

function assemble(ui: UiState): FrameSnapshot {
  const { hover, selected, hudHover } = ui;
  const speed = SPEEDS[speedIdx];
  const towers: { x: number; y: number; id: string }[] = [];
  for (const t of sim.towers) if (t) towers.push({ x: t.cellX, y: t.cellY, id: sim.towerDef(t).id });
  const projectiles: { x: number; y: number; vx: number; vy: number }[] = [];
  for (let i = 0; i < sim.projX.length; i++) {
    if (sim.projAlive[i]) projectiles.push({ x: sim.projX[i], y: sim.projY[i], vx: sim.projVX[i], vy: sim.projVY[i] });
  }
  const enemies: { x: number; y: number; id: string; hp01: number; shielded: boolean; slowed: boolean }[] = [];
  for (let i = 0; i < sim.posX.length; i++) {
    if (!sim.alive[i]) continue;
    enemies.push({
      x: sim.posX[i], y: sim.posY[i], id: sim.enemyDefOf(i).id,
      hp01: sim.spawnHp[i] > 0 ? sim.hp[i] / sim.spawnHp[i] : 1,
      shielded: sim.shield[i] > 0,
      slowed: sim.slowTicks[i] > 0,
    });
  }
  const oreRichness: { x: number; y: number; frac: number }[] = [];
  for (const d of map.deposits ?? []) {
    const dep = sim.depositAt(d.x, d.y);
    if (dep) oreRichness.push({ x: d.x, y: d.y, frac: dep.left / DEPOSIT_MAX });
  }
  const caches: { x: number; y: number }[] = [];
  map.caches.forEach((c, i) => {
    if (!sim.claimedCaches.includes(i)) caches.push({ x: c.x, y: c.y });
  });

  const paletteDefs = () => {
    if (selected && sim.canBuildAt(selected.x, selected.y)) {
      return TOWER_DEFS.filter((d) => sim.canBuildDefAt(selected.x, selected.y, d.id));
    }
    return TOWER_DEFS;
  };
  const palette = paletteDefs();
  const selTower = selected ? sim.towerAt(selected.x, selected.y) : null;
  const buildTarget = selected !== null && sim.canBuildAt(selected.x, selected.y);
  const previewDef = (hudHover?.kind === 'build' ? palette[hudHover.index] : undefined) ?? palette[0];
  const aimRelic = targeting !== null ? RELIC_DEFS.find((r) => r.id === targeting) : undefined;
  const range = aimRelic && hover
    ? { x: hover.x, y: hover.y, r: aimRelic.effects?.orbitalRadius ?? 1 }
    : selTower
      ? { x: selTower.cellX, y: selTower.cellY, r: sim.stats(selTower).range }
      : buildTarget && selected && previewDef
        ? { x: selected.x, y: selected.y, r: previewDef.range }
        : null;
  const hoverTower = hover ? sim.towerAt(hover.x, hover.y) : null;
  const infoTower = selTower ?? hoverTower;
  const def = infoTower ? sim.towerDef(infoTower) : null;
  const eff = infoTower ? sim.stats(infoTower) : null;
  let effPreview: ReturnType<typeof sim.stats> | null = null;
  if (infoTower && hudHover?.kind === 'choose' && sim.choiceCost(infoTower, hudHover.tier, hudHover.option) !== null) {
    const next = [...infoTower.choices] as [number, number, number];
    next[hudHover.tier] = hudHover.option;
    effPreview = sim.statsWith(infoTower, next);
  }
  const toStats = (e: NonNullable<typeof eff>) => ({
    dmg: Math.round(e.damage * 10) / 10,
    dps: ((e.damage / e.fireEveryTicks) * TICK_HZ).toFixed(1),
    range: Math.round(e.range * 10) / 10,
    blast: Math.round(e.explodeRadius * 10) / 10,
    slow: e.slowTicks,
    prod: e.productionEveryTicks > 0 ? `${((e.production / e.productionEveryTicks) * TICK_HZ).toFixed(2)}/s` : null,
  });

  const held = sim.heldRelicInfo();
  const coreInfo = selected && sim.cellAt(selected.x, selected.y) === 'C'
    ? {
        hp: sim.coreHp,
        hpMax: sim.coreHpMax,
        slots: Array.from({ length: Math.max(MIN_SLOTS, held.length) }, (_, i) => {
          const h = held[i];
          if (!h) return { label: '', name: '', state: 'empty' as const, cooldownSec: 0 };
          const state = h.def.kind === 'active' ? (h.cooldown > 0 ? ('cooling' as const) : ('ready' as const)) : h.def.kind === 'consumable' ? ('consumable' as const) : ('passive' as const);
          // id + targeted let the MAIN thread own aim-mode arming: the worker
          // only mirrors `targeting` back per frame, so the two threads can
          // never fight over who is aiming.
          return { label: slotTag(h.def.name), name: h.def.name, state, cooldownSec: Math.ceil(h.cooldown / TICK_HZ), id: h.def.id, targeted: h.def.kind === 'active' && h.def.effects?.orbitalDamage !== undefined };
        }),
        hoverDesc: (hudHover?.kind === 'relic' && held[hudHover.index])
          ? `${held[hudHover.index].def.name} - ${held[hudHover.index].def.desc}`
          : targeting ? 'click the map to aim, Esc cancels' : null,
        drawCost: RELIC_DRAW_COST,
        canDraw: sim.ore[0] >= RELIC_DRAW_COST,
      }
    : null;

  const cellDescribe = (() => {
    const c = selected ?? hover;
    if (!c) return '';
    const dep = sim.depositAt(c.x, c.y);
    if (dep && sim.cellAt(c.x, c.y) === 'O') return ` · ore left ${dep.left}/${dep.initial}`;
    const boon = sim.boonAt(c.x, c.y);
    return boon ? ` · BOON t${boon.tier}: ${Sim.boonEffect(boon.boon, boon.tier).text} for whatever is built here` : '';
  })();

  const offer = sim.offerDefs();
  const THREAT = THREAT_LEVELS[threatIdx];
  return {
    board: {
      hover,
      selected,
      routeAllowed: sim.flow.allowed,
      caches,
      boons: (map.boons ?? []).map((b) => ({ x: b.x, y: b.y, tier: b.tier })),
      oreRichness,
      enemies,
      towers,
      projectiles,
      range: selTower && effPreview && eff && effPreview.range !== eff.range
        ? { x: selTower.cellX, y: selTower.cellY, r: effPreview.range }
        : range,
      hoverBuildable: hover !== null && sim.canBuildAt(hover.x, hover.y) && previewDef !== undefined && sim.canAfford(previewDef.id),
      showGrid: ui.showGrid,
      rangeIsPreview: targeting !== null || (!selTower && buildTarget) || (selTower !== null && effPreview !== null),
      telegraph: sim.nextWaveEntries,
      activeEntries: sim.spawnRemaining() > 0 ? sim.waveEntries : [],
      gameOver: false, // the run summary screen owns the ending now (4.19)
    },
    hud: {
      scrap: sim.scrap,
      ore: sim.ore[0],
      relicCount: sim.heldRelics.length,
      kills: sim.kills,
      coreHp: sim.coreHp,
      coreHpMax: sim.coreHpMax,
      wave: sim.wave,
      nextFronts: sim.nextWaveEntries.length,
      nextWaveIn: Math.ceil(sim.ticksToNextWave() / TICK_HZ),
      gameOver: sim.status === 'lost',
      victory: sim.status === 'won',
      finalWave: THREAT.finalWave,
      L: sim.flow.L,
      seed,
      speedLabel: speed === 0 ? 'PAUSED' : `${speed}x`,
      // Sim-only suffix; the view-side describeCell prefix is composed by
      // the main thread, which owns the cell vocabulary.
      inspector: cellDescribe,
      palette: (buildTarget && !(selected && sim.cacheAt(selected.x, selected.y)) ? palette : []).map((d) => ({
        name: d.name ?? d.id,
        cost: d.cost,
        affordable: sim.canAfford(d.id),
        id: d.id,
      })),
      selectedBuild: 0,
      buildTargetSelected: buildTarget,
      core: coreInfo,
      cache: selected && sim.cacheAt(selected.x, selected.y) ? { cost: CACHE_CLAIM_COST, affordable: sim.scrap >= CACHE_CLAIM_COST } : null,
      rock: selected && sim.cellAt(selected.x, selected.y) === 'R'
        ? {
            cost: PROSPECT_COST,
            affordable: sim.scrap >= PROSPECT_COST,
            seconds: Math.ceil(PROSPECT_TICKS / sim.prospectSpeed() / TICK_HZ),
            job: (() => {
              const j = sim.prospectJobAt(selected.x, selected.y);
              return j ? { pct: Math.round(((j.total - j.remaining) / j.total) * 100) } : null;
            })(),
          }
        : null,
      selectedTower: infoTower && def && eff
        ? {
            name: def.name ?? def.id,
            kills: infoTower.kills,
            deposit: def.production ? (sim.depositAt(infoTower.cellX, infoTower.cellY) ?? { left: 0, initial: 1 }) : null,
            stats: toStats(eff),
            preview: effPreview ? toStats(effPreview) : null,
            offVein: def.production !== undefined && (def.production.ore ?? 0) > 0 && sim.cellAt(infoTower.cellX, infoTower.cellY) !== 'O',
            priority: infoTower.priority,
            choiceDesc: hudHover?.kind === 'choose' ? (def.tiers?.[hudHover.tier]?.choices[hudHover.option]?.desc ?? null) : null,
            tiers: (def.tiers ?? []).map((tierDef, ti) => ({
              choices: tierDef.choices.map((c, ci) => {
                const chosen = infoTower.choices[ti] === ci;
                const rejected = infoTower.choices[ti] !== -1 && !chosen;
                const available = sim.choiceCost(infoTower, ti, ci) !== null;
                return {
                  name: c.name,
                  cost: c.cost,
                  state: chosen ? ('chosen' as const) : rejected ? ('rejected' as const) : available ? ('available' as const) : ('locked' as const),
                  affordable: sim.scrap >= c.cost,
                };
              }),
            })),
          }
        : null,
    },
    offer: offer
      ? {
          cards: offer.map((d) => ({ name: d.name, kind: d.kind, desc: d.desc })),
          wave: sim.wave,
          reroll: { cost: OFFER_REROLL_COST, can: sim.ore[0] >= OFFER_REROLL_COST, ore: sim.ore[0] },
        }
      : null,
    events: [...sim.events],
    cellChanges: [...sim.cellChanges],
    tick: sim.tickCount,
    status: sim.status,
    seed,
    paused: speedIdx === 0,
    speed: SPEEDS[speedIdx],
  };
}

function applyAction(a: WorkerAction): void {
  switch (a.k) {
    case 'build': sim.buildTower(a.x, a.y, a.defId); break;
    case 'sell': sim.sellTower(a.x, a.y); break;
    case 'choose': sim.chooseTier(a.x, a.y, a.tier, a.option); break;
    case 'priority': sim.setPriority(a.x, a.y, a.value as 'first'); break;
    case 'pickRelic': if (sim.pickRelic(a.option)) syncOfferPause(); break;
    case 'rerollOffer': sim.rerollOffer(); break;
    case 'buyRelic': sim.buyRelic(); break;
    case 'claimCache': sim.claimCache(a.x, a.y); break;
    case 'prospect': sim.prospect(a.x, a.y); break;
    case 'fireActive': sim.fireActive(a.relicId, a.x, a.y); break;
    case 'slot': {
      // Targeted actives never arrive here - the main thread arms aim mode
      // itself from the slot's `targeted` flag and sends fireActive on click.
      const h = sim.heldRelicInfo()[a.index];
      if (!h) break;
      if (h.def.kind === 'consumable') sim.useConsumable(h.def.id);
      else if (h.def.kind === 'active' && h.cooldown === 0 && h.def.effects?.orbitalDamage === undefined) sim.fireActive(h.def.id);
      break;
    }
    default: a satisfies never;
  }
}

onmessage = (ev: MessageEvent<ToWorker>) => {
  const m = ev.data;
  switch (m.t) {
    case 'init':
      newRun(m.seed, m.threatIdx, m.resume);
      break;
    case 'frame': {
      targeting = m.ui.targeting; // main owns arming/cancel; worker mirrors
      post({ t: 'snapshot', s: assemble(m.ui) });
      break;
    }
    case 'speed':
      speedIdx = Math.max(0, Math.min(SPEEDS.length - 1, m.idx));
      break;
    case 'action':
      applyAction(m.a);
      break;
    case 'save':
      post({
        t: 'saved',
        id: m.id,
        save: {
          version: SAVE_VERSION,
          seed,
          threatIdx,
          tick: sim.tickCount,
          inputs: [...sim.inputs],
          contentHash: contentHashOf(ENEMY_DEFS, TOWER_DEFS),
        },
      });
      break;
    case 'debug': {
      // The __ad verification surface, proxied (CONTRIBUTING: headless panes).
      let result: unknown = null;
      const args = m.args as never[];
      switch (m.op) {
        case 'step': { const n = args[0] as number; for (let i = 0; i < n; i++) sim.tick(); syncOfferPause(); result = { breaches: sim.breaches, alive: sim.aliveCount(), kills: sim.kills, coreDamage: sim.coreDamage, ore: sim.ore[0] }; break; }
        case 'build': result = sim.buildTower(args[0], args[1], (args[2] as string) ?? TOWER_DEFS[0].id); break;
        case 'canBuild': result = sim.canBuildAt(args[0], args[1]); break;
        case 'cellAt': result = sim.cellAt(args[0], args[1]); break;
        case 'ore': result = sim.ore[0]; break;
        case 'offer': result = sim.offerDefs()?.map((d) => d.id) ?? null; break;
        case 'pick': result = sim.pickRelic(args[0]); if (result) syncOfferPause(); break;
        case 'relics': result = sim.heldRelicInfo().map((h) => h.def.id); break;
        case 'hash': result = sim.hashState(); break;
        case 'events': result = [...sim.events]; break;
        case 'enemies': { const out: unknown[] = []; for (let i = 0; i < sim.posX.length; i++) if (sim.alive[i]) out.push({ x: sim.posX[i], y: sim.posY[i], id: sim.enemyDefOf(i).id }); result = out; break; }
        case 'replay': result = JSON.stringify({ version: REPLAY_VERSION, seed, contentHash: contentHashOf(ENEMY_DEFS, TOWER_DEFS), inputs: sim.inputs }); break;
      }
      post({ t: 'debugResult', id: m.id, result });
      break;
    }
    default:
      m satisfies never;
  }
};
