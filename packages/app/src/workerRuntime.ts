/**
 * The sim worker's runtime (2.27 PR 4): the whole worker lifecycle as a
 * testable state machine, extracted from simWorker.ts so the reserved
 * playtest-16 bugs (phantom resume, dropped specials, boon-composite) can
 * be regression-tested in Node.
 *
 * The lifecycle contract (ARCHITECTURE sec 12):
 *  - `init` yields exactly one of `ready` or `genError` - never silence.
 *    EVERY throw inside newRun is caught, including library construction
 *    and Sim construction, which previously escaped and left the worker
 *    half-switched.
 *  - Init is TRANSACTIONAL: the new library, map and sim are built in
 *    locals and committed together, or not at all. A failed init leaves
 *    the previous run fully intact - the exact mixed map/sim state that
 *    composited a new map's boons over an old sim's board (playtest 16's
 *    "boon on void") is unrepresentable.
 *  - Resume loads the SAVED MAP (D15) - generation never re-runs on
 *    resume, so saves survive generator changes; content drift is refused
 *    by hash, loudly.
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
  validateTile,
  type EnemyDef,
  type GeneratedMap,
  type RelicDef,
  type ReplayAction,
  type TileDef,
  type TowerDef,
} from '@ascii-defense/engine';
import { BOARD_SLOTS, SAVE_VERSION, THREAT_LEVELS, type FrameSnapshot, type FromWorker, type RunSave, type ToWorker, type UiState, type WorkerAction } from './protocol';

export interface WorkerRuntimeDeps {
  post: (m: FromWorker) => void;
  /** The shipped basic tiles; the run's library is basics + loadout. */
  basics: readonly TileDef[];
  enemyDefs: readonly EnemyDef[];
  towerDefs: readonly TowerDef[];
  relicDefs: readonly RelicDef[];
}

const TICK_MS = 1000 / TICK_HZ;
const SPEEDS = [0, 1, 2, 4, 8] as const;
const MIN_SLOTS = 12;

export function createWorkerRuntime(deps: WorkerRuntimeDeps) {
  const { post, basics, enemyDefs, towerDefs, relicDefs } = deps;
  const MAP_X = BOARD_SLOTS.w;
  const MAP_Y = BOARD_SLOTS.h;
  const CONTENT_HASH = contentHashOf(enemyDefs, towerDefs);

  // The current run - null until the first successful init. Everything here
  // is only ever reassigned by newRun's COMMIT block, together.
  let sim: Sim | null = null;
  let map: GeneratedMap | null = null;
  let loadout: TileDef[] = [];
  let seed = 1;
  let threatIdx = 1;
  let speedIdx = 1;
  let offerWasUp = false;
  let speedBeforeOffer = 1;
  let targeting: string | null = null;
  let acc = 0;
  let lastBeat = 0;

  function newRun(wantSeed: number, tIdx: number, wantLoadout: TileDef[], resume?: RunSave): void {
    try {
      const nextThreatIdx = Math.min(THREAT_LEVELS.length - 1, Math.max(0, tIdx));
      const THREAT = THREAT_LEVELS[nextThreatIdx];
      // A stale or invalid special is refused loudly, never half-loaded.
      const nextLoadout = wantLoadout.filter((t) => !basics.some((s) => s.id === t.id));
      for (const t of nextLoadout) {
        const errors = validateTile(t);
        if (errors.length > 0) {
          post({ t: 'genError', message: `special tile '${t.id}' is no longer valid - remove it from the loadout (${errors[0]})` });
          return;
        }
      }
      const nextLib = new TileLibrary([...basics, ...nextLoadout]);

      let nextSeed = wantSeed;
      let nextMap: GeneratedMap;
      if (resume) {
        // D15: a save carries its MAP - resume never regenerates, so a
        // generator change cannot silently corrupt a saved run. Content
        // drift is a different hazard with the same rule: say so.
        if (resume.contentHash !== CONTENT_HASH) {
          post({ t: 'genError', message: 'this save was made against different content - it cannot continue' });
          return;
        }
        if (!resume.map) {
          post({ t: 'genError', message: 'this save predates the generator rebuild - it cannot continue' });
          return;
        }
        nextMap = resume.map;
      } else {
        const specials = nextLoadout.map((t) => t.id);
        // Generation failures reroll the seed - the map the player asked
        // for is "one containing my specials", and a fresh carve usually
        // obliges. Bounded: a loadout no carve can host must SAY so.
        for (let attempt = 0; ; attempt++) {
          try {
            const knobs = createRng(nextSeed).stream('map');
            const entries = knobs.int(THREAT.entries[0], THREAT.entries[1]);
            const targetPathCells = (THREAT.pathBias + Math.max(knobs.int(0, 18), knobs.int(0, 18))) * TILE_SIZE;
            nextMap = generateMap(knobs, nextLib, { width: MAP_X, height: MAP_Y, entries, targetPathCells, relicPoolSize: relicDefs.length, specials });
            break;
          } catch (e) {
            if (attempt >= 60 && specials.length > 0) {
              post({ t: 'genError', message: e instanceof Error ? e.message : 'the loadout cannot fit any map' });
              return;
            }
            if (attempt >= 200) throw e; // even without specials, don't spin forever
            nextSeed = (nextSeed + 1) % 1_000_000; // a player never reads a generator trace
          }
        }
      }

      const nextSim = new Sim(resume ? resume.seed : nextSeed, {
        cells: resolveCells(nextMap.board, nextLib),
        cellsW: MAP_X * TILE_SIZE,
        cellsH: MAP_Y * TILE_SIZE,
        map: nextMap,
        enemyDefs,
        towerDefs,
        mode: 'waves',
        coreHp: 50,
        relicDefs,
        finalWave: THREAT.finalWave,
        difficulty: { hpLinear: 0.18, hpGeometric: THREAT.hpGeometric, countBase: 6, countLinear: 4, countGeometric: 1 },
      });
      if (resume) {
        // A save IS a replay (PRD sec 15.2): re-apply the input log at its
        // recorded ticks, then tick on to the saved moment.
        const pending = [...resume.inputs];
        while (nextSim.tickCount < resume.tick && nextSim.status === 'running') {
          while (pending.length && pending[0].tick === nextSim.tickCount) {
            nextSim.applyAction(pending.shift()!.a as ReplayAction);
          }
          nextSim.tick();
        }
        while (pending.length && pending[0].tick === nextSim.tickCount) {
          nextSim.applyAction(pending.shift()!.a as ReplayAction);
        }
      }

      // COMMIT - all together, only on full success. Failure above leaves
      // the previous run exactly as it was.
      sim = nextSim;
      map = nextMap;
      loadout = nextLoadout;
      seed = resume ? resume.seed : nextSeed;
      threatIdx = nextThreatIdx;
      offerWasUp = false;
      targeting = null;
      acc = 0;
      speedIdx = resume ? 0 : 1; // resume paused: the player left, the world waits
      post({ t: 'ready', seed, map, finalWave: THREAT.finalWave });
    } catch (e) {
      // The contract: init yields ready or genError, NEVER silence. This
      // catch is what kills the phantom resume - an escaped throw here used
      // to leave the main thread 'playing' an old sim with no error.
      post({ t: 'genError', message: e instanceof Error ? e.message : 'map generation failed' });
    }
  }

  function syncOfferPause(): void {
    if (!sim) return;
    const up = sim.offer !== null;
    if (up && !offerWasUp) {
      speedBeforeOffer = speedIdx === 0 ? 1 : speedIdx;
      speedIdx = 0;
    }
    if (!up && offerWasUp) speedIdx = speedBeforeOffer;
    offerWasUp = up;
  }

  /** The tick clock's body (the worker shell drives it on an interval). */
  function beat(now: number): void {
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
  }

  // ---- snapshot assembly (unchanged in spirit from the pre-split worker) ---
  const slotTag = (name: string): string => {
    const words = name.split(' ').filter(Boolean);
    return (words.length > 1 ? words[0][0] + words[1][0] : name.slice(0, 2)).toUpperCase();
  };

  function assemble(ui: UiState): FrameSnapshot {
    if (!sim || !map) throw new Error('no run to snapshot');
    const s = sim;
    const { hover, selected, hudHover } = ui;
    const speed = SPEEDS[speedIdx];
    const towers: { x: number; y: number; id: string }[] = [];
    for (const t of s.towers) if (t) towers.push({ x: t.cellX, y: t.cellY, id: s.towerDef(t).id });
    const projectiles: { x: number; y: number; vx: number; vy: number }[] = [];
    for (let i = 0; i < s.projX.length; i++) {
      if (s.projAlive[i]) projectiles.push({ x: s.projX[i], y: s.projY[i], vx: s.projVX[i], vy: s.projVY[i] });
    }
    const enemies: { x: number; y: number; id: string; hp01: number; shielded: boolean; slowed: boolean }[] = [];
    for (let i = 0; i < s.posX.length; i++) {
      if (!s.alive[i]) continue;
      enemies.push({
        x: s.posX[i], y: s.posY[i], id: s.enemyDefOf(i).id,
        hp01: s.spawnHp[i] > 0 ? s.hp[i] / s.spawnHp[i] : 1,
        shielded: s.shield[i] > 0,
        slowed: s.slowTicks[i] > 0,
      });
    }
    const oreRichness: { x: number; y: number; frac: number }[] = [];
    for (const d of map.deposits ?? []) {
      const dep = s.depositAt(d.x, d.y);
      if (dep) oreRichness.push({ x: d.x, y: d.y, frac: dep.left / DEPOSIT_MAX });
    }
    const caches: { x: number; y: number }[] = [];
    map.caches.forEach((c, i) => {
      if (!s.claimedCaches.includes(i)) caches.push({ x: c.x, y: c.y });
    });

    const paletteDefs = () => {
      if (selected && s.canBuildAt(selected.x, selected.y)) {
        return towerDefs.filter((d) => s.canBuildDefAt(selected.x, selected.y, d.id));
      }
      return towerDefs;
    };
    const palette = paletteDefs();
    const selTower = selected ? s.towerAt(selected.x, selected.y) : null;
    const buildTarget = selected !== null && s.canBuildAt(selected.x, selected.y);
    const previewDef = (hudHover?.kind === 'build' ? palette[hudHover.index] : undefined) ?? palette[0];
    const aimRelic = targeting !== null ? relicDefs.find((r) => r.id === targeting) : undefined;
    const range = aimRelic && hover
      ? { x: hover.x, y: hover.y, r: aimRelic.effects?.orbitalRadius ?? 1 }
      : selTower
        ? { x: selTower.cellX, y: selTower.cellY, r: s.stats(selTower).range }
        : buildTarget && selected && previewDef
          ? { x: selected.x, y: selected.y, r: previewDef.range }
          : null;
    const hoverTower = hover ? s.towerAt(hover.x, hover.y) : null;
    const infoTower = selTower ?? hoverTower;
    const def = infoTower ? s.towerDef(infoTower) : null;
    const eff = infoTower ? s.stats(infoTower) : null;
    let effPreview: ReturnType<typeof s.stats> | null = null;
    if (infoTower && hudHover?.kind === 'choose' && s.choiceCost(infoTower, hudHover.tier, hudHover.option) !== null) {
      const next = [...infoTower.choices] as [number, number, number];
      next[hudHover.tier] = hudHover.option;
      effPreview = s.statsWith(infoTower, next);
    }
    const toStats = (e: NonNullable<typeof eff>) => ({
      dmg: Math.round(e.damage * 10) / 10,
      dps: ((e.damage / e.fireEveryTicks) * TICK_HZ).toFixed(1),
      range: Math.round(e.range * 10) / 10,
      blast: Math.round(e.explodeRadius * 10) / 10,
      slow: e.slowTicks,
      prod: e.productionEveryTicks > 0 ? `${((e.production / e.productionEveryTicks) * TICK_HZ).toFixed(2)}/s` : null,
    });

    const held = s.heldRelicInfo();
    const coreInfo = selected && s.cellAt(selected.x, selected.y) === 'C'
      ? {
          hp: s.coreHp,
          hpMax: s.coreHpMax,
          slots: Array.from({ length: Math.max(MIN_SLOTS, held.length) }, (_, i) => {
            const h = held[i];
            if (!h) return { label: '', name: '', state: 'empty' as const, cooldownSec: 0 };
            const state = h.def.kind === 'active' ? (h.cooldown > 0 ? ('cooling' as const) : ('ready' as const)) : h.def.kind === 'consumable' ? ('consumable' as const) : ('passive' as const);
            // id + targeted let the MAIN thread own aim-mode arming: the
            // worker only mirrors `targeting` back per frame, so the two
            // threads can never fight over who is aiming.
            return { label: slotTag(h.def.name), name: h.def.name, state, cooldownSec: Math.ceil(h.cooldown / TICK_HZ), id: h.def.id, targeted: h.def.kind === 'active' && h.def.effects?.orbitalDamage !== undefined };
          }),
          hoverDesc: (hudHover?.kind === 'relic' && held[hudHover.index])
            ? `${held[hudHover.index].def.name} - ${held[hudHover.index].def.desc}`
            : targeting ? 'click the map to aim, Esc cancels' : null,
          drawCost: RELIC_DRAW_COST,
          canDraw: s.ore[0] >= RELIC_DRAW_COST,
        }
      : null;

    const cellDescribe = (() => {
      const c = selected ?? hover;
      if (!c) return '';
      const dep = s.depositAt(c.x, c.y);
      if (dep && s.cellAt(c.x, c.y) === 'O') return ` · ore left ${dep.left}/${dep.initial}`;
      const boon = s.boonAt(c.x, c.y);
      return boon ? ` · BOON t${boon.tier}: ${Sim.boonEffect(boon.boon, boon.tier).text} for whatever is built here` : '';
    })();

    const offer = s.offerDefs();
    const THREAT = THREAT_LEVELS[threatIdx];
    return {
      board: {
        hover,
        selected,
        routeAllowed: s.flow.allowed,
        caches,
        boons: (map.boons ?? []).map((b) => ({ x: b.x, y: b.y, tier: b.tier })),
        oreRichness,
        enemies,
        towers,
        projectiles,
        range: selTower && effPreview && eff && effPreview.range !== eff.range
          ? { x: selTower.cellX, y: selTower.cellY, r: effPreview.range }
          : range,
        hoverBuildable: hover !== null && s.canBuildAt(hover.x, hover.y) && previewDef !== undefined && s.canAfford(previewDef.id),
        showGrid: ui.showGrid,
        rangeIsPreview: targeting !== null || (!selTower && buildTarget) || (selTower !== null && effPreview !== null),
        telegraph: s.nextWaveEntries,
        activeEntries: s.spawnRemaining() > 0 ? s.waveEntries : [],
        gameOver: false, // the run summary screen owns the ending now (4.19)
      },
      hud: {
        scrap: s.scrap,
        ore: s.ore[0],
        relicCount: s.heldRelics.length,
        kills: s.kills,
        coreHp: s.coreHp,
        coreHpMax: s.coreHpMax,
        wave: s.wave,
        nextFronts: s.nextWaveEntries.length,
        nextWaveIn: Math.ceil(s.ticksToNextWave() / TICK_HZ),
        gameOver: s.status === 'lost',
        victory: s.status === 'won',
        finalWave: THREAT.finalWave,
        L: s.flow.L,
        seed,
        speedLabel: speed === 0 ? 'PAUSED' : `${speed}x`,
        // Sim-only suffix; the view-side describeCell prefix is composed by
        // the main thread, which owns the cell vocabulary.
        inspector: cellDescribe,
        palette: (buildTarget && !(selected && s.cacheAt(selected.x, selected.y)) ? palette : []).map((d) => ({
          name: d.name ?? d.id,
          cost: d.cost,
          affordable: s.canAfford(d.id),
          id: d.id,
        })),
        selectedBuild: 0,
        buildTargetSelected: buildTarget,
        core: coreInfo,
        cache: selected && s.cacheAt(selected.x, selected.y) ? { cost: CACHE_CLAIM_COST, affordable: s.scrap >= CACHE_CLAIM_COST } : null,
        rock: selected && s.cellAt(selected.x, selected.y) === 'R'
          ? {
              cost: PROSPECT_COST,
              affordable: s.scrap >= PROSPECT_COST,
              seconds: Math.ceil(PROSPECT_TICKS / s.prospectSpeed() / TICK_HZ),
              job: (() => {
                const j = s.prospectJobAt(selected.x, selected.y);
                return j ? { pct: Math.round(((j.total - j.remaining) / j.total) * 100) } : null;
              })(),
            }
          : null,
        selectedTower: infoTower && def && eff
          ? {
              name: def.name ?? def.id,
              kills: infoTower.kills,
              deposit: def.production ? (s.depositAt(infoTower.cellX, infoTower.cellY) ?? { left: 0, initial: 1 }) : null,
              stats: toStats(eff),
              preview: effPreview ? toStats(effPreview) : null,
              offVein: def.production !== undefined && (def.production.ore ?? 0) > 0 && s.cellAt(infoTower.cellX, infoTower.cellY) !== 'O',
              priority: infoTower.priority,
              choiceDesc: hudHover?.kind === 'choose' ? (def.tiers?.[hudHover.tier]?.choices[hudHover.option]?.desc ?? null) : null,
              tiers: (def.tiers ?? []).map((tierDef, ti) => ({
                choices: tierDef.choices.map((c, ci) => {
                  const chosen = infoTower.choices[ti] === ci;
                  const rejected = infoTower.choices[ti] !== -1 && !chosen;
                  const available = s.choiceCost(infoTower, ti, ci) !== null;
                  return {
                    name: c.name,
                    cost: c.cost,
                    state: chosen ? ('chosen' as const) : rejected ? ('rejected' as const) : available ? ('available' as const) : ('locked' as const),
                    affordable: s.scrap >= c.cost,
                  };
                }),
              })),
            }
          : null,
      },
      offer: offer
        ? {
            cards: offer.map((d) => ({ name: d.name, kind: d.kind, desc: d.desc })),
            wave: s.wave,
            reroll: { cost: OFFER_REROLL_COST, can: s.ore[0] >= OFFER_REROLL_COST, ore: s.ore[0] },
          }
        : null,
      events: [...s.events],
      cellChanges: [...s.cellChanges],
      tick: s.tickCount,
      status: s.status,
      seed,
      paused: speedIdx === 0,
      speed: SPEEDS[speedIdx],
    };
  }

  function applyAction(a: WorkerAction): void {
    if (!sim) return;
    const s = sim;
    switch (a.k) {
      case 'build': s.buildTower(a.x, a.y, a.defId); break;
      case 'sell': s.sellTower(a.x, a.y); break;
      case 'choose': s.chooseTier(a.x, a.y, a.tier, a.option); break;
      case 'priority': s.setPriority(a.x, a.y, a.value as 'first'); break;
      case 'pickRelic': if (s.pickRelic(a.option)) syncOfferPause(); break;
      case 'rerollOffer': s.rerollOffer(); break;
      case 'buyRelic': s.buyRelic(); break;
      case 'claimCache': s.claimCache(a.x, a.y); break;
      case 'prospect': s.prospect(a.x, a.y); break;
      case 'fireActive': s.fireActive(a.relicId, a.x, a.y); break;
      case 'slot': {
        // Targeted actives never arrive here - the main thread arms aim
        // mode itself from the slot's `targeted` flag.
        const h = s.heldRelicInfo()[a.index];
        if (!h) break;
        if (h.def.kind === 'consumable') s.useConsumable(h.def.id);
        else if (h.def.kind === 'active' && h.cooldown === 0 && h.def.effects?.orbitalDamage === undefined) s.fireActive(h.def.id);
        break;
      }
      default: a satisfies never;
    }
  }

  function handle(m: ToWorker): void {
    switch (m.t) {
      case 'init':
        newRun(m.seed, m.threatIdx, m.resume?.loadout ?? m.loadout ?? [], m.resume);
        break;
      case 'frame': {
        if (!sim) break; // no run yet: nothing to serve, and never a lie
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
        if (!sim || !map) break;
        post({
          t: 'saved',
          id: m.id,
          save: {
            version: SAVE_VERSION,
            seed,
            threatIdx,
            tick: sim.tickCount,
            inputs: [...sim.inputs],
            contentHash: CONTENT_HASH,
            loadout,
            map, // D15: the save carries the map; resume never regenerates
          },
        });
        break;
      case 'debug': {
        // The __ad verification surface, proxied (CONTRIBUTING: headless).
        if (!sim) {
          post({ t: 'debugResult', id: m.id, result: null });
          break;
        }
        const s = sim;
        let result: unknown = null;
        const args = m.args as never[];
        switch (m.op) {
          case 'step': { const n = args[0] as number; for (let i = 0; i < n; i++) s.tick(); syncOfferPause(); result = { breaches: s.breaches, alive: s.aliveCount(), kills: s.kills, coreDamage: s.coreDamage, ore: s.ore[0] }; break; }
          case 'build': result = s.buildTower(args[0], args[1], (args[2] as string) ?? towerDefs[0].id); break;
          case 'canBuild': result = s.canBuildAt(args[0], args[1]); break;
          case 'cellAt': result = s.cellAt(args[0], args[1]); break;
          case 'ore': result = s.ore[0]; break;
          case 'offer': result = s.offerDefs()?.map((d) => d.id) ?? null; break;
          case 'pick': result = s.pickRelic(args[0]); if (result) syncOfferPause(); break;
          case 'relics': result = s.heldRelicInfo().map((h) => h.def.id); break;
          case 'hash': result = s.hashState(); break;
          case 'events': result = [...s.events]; break;
          case 'enemies': { const out: unknown[] = []; for (let i = 0; i < s.posX.length; i++) if (s.alive[i]) out.push({ x: s.posX[i], y: s.posY[i], id: s.enemyDefOf(i).id }); result = out; break; }
          case 'replay': result = JSON.stringify({ version: REPLAY_VERSION, seed, contentHash: CONTENT_HASH, inputs: s.inputs }); break;
        }
        post({ t: 'debugResult', id: m.id, result });
        break;
      }
      default:
        m satisfies never;
    }
  }

  return { handle, beat, tickMs: TICK_MS };
}
