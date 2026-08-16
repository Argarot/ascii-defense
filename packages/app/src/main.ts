/**
 * Bootstrap, input and the FRAME clock - nothing else. The sim owns ticks
 * (fixed 20 Hz, invariant 6); this file only decides how many ticks each
 * animation frame is worth (pause/1x/2x/4x) and hands the accumulator to
 * requestAnimationFrame. What things look like lives in view; what things
 * ARE lives in engine.
 */
import { GLTerm } from '@ascii-defense/render';
import type { GlyphSet } from '@ascii-defense/render';
import {
  CACHE_CLAIM_COST,
  OFFER_REROLL_COST,
  PROSPECT_COST,
  RELIC_DRAW_COST,
  REPLAY_VERSION,
  Sim,
  TICK_HZ,
  TILE_SIZE,
  TileLibrary,
  contentHashOf,
  createRng,
  effectiveStats,
  generateMap,
  resolveCells,
} from '@ascii-defense/engine';
import { BoardView, HudPanel, OfferModal, CELL_W, CELL_H, role } from '@ascii-defense/view';
import type { CellRef } from '@ascii-defense/view';
import { validateEnemies, validateRelics, validateTowers } from '@ascii-defense/content';
import tileLibraryJson from '@ascii-defense/content/assets/tiles/library.json';
import enemiesJson from '@ascii-defense/content/assets/enemies/roster.json';
import towersJson from '@ascii-defense/content/assets/towers/roster.json';
import relicsJson from '@ascii-defense/content/assets/relics/pool.json';

// Content enters the app validated or not at all (ARCHITECTURE sec 8).
function must<T>(r: { ok: true; value: T } | { ok: false; errors: { path: string; message: string }[] }, what: string): T {
  if (!r.ok) throw new Error(`${what} failed validation: ` + r.errors.map((e) => `${e.path}: ${e.message}`).join('; '));
  return r.value;
}
const ENEMY_DEFS = must(validateEnemies.check(enemiesJson), 'enemies roster').enemies;
const TOWER_DEFS = must(validateTowers.check(towersJson), 'towers roster').towers;
const RELIC_DEFS = must(validateRelics.check(relicsJson), 'relic pool').relics;

const BASE = import.meta.env.BASE_URL;
const ASSET_V = '5';
const load = <T>(p: string): Promise<T> =>
  fetch(`${BASE}assets/${p}?v=${ASSET_V}`).then((r) => r.json() as Promise<T>);

const GLYPH_PX_W = 5;
const GLYPH_PX_H = 8;
const TICK_MS = 1000 / TICK_HZ;
const SPEEDS = [0, 1, 2, 4] as const;

async function main(): Promise<void> {
  const glyphs = await load<GlyphSet>('glyphset-spleen.json');
  const lib = new TileLibrary(tileLibraryJson.tiles);

  const mapX = 12, mapY = 7; // 2 tile columns ceded to the side panel (Daniil)
  const boardCols = mapX * TILE_SIZE * CELL_W;
  const term = new GLTerm(glyphs, {
    cols: boardCols,
    rows: mapY * TILE_SIZE * CELL_H,
    cellPx: GLYPH_PX_W,
    cellPxH: GLYPH_PX_H,
    background: role('ui.bg'),
  });

  const view = new BoardView(term, lib, {
    mapX,
    mapY,
    glyphPxW: GLYPH_PX_W,
    glyphPxH: GLYPH_PX_H,
  });

  // The HUD beside the board, full height at 2x glyph size (10x16 px -
  // integer multiple, the bitmap font stays crisp).
  const hudTerm = new GLTerm(glyphs, {
    cols: 30,
    rows: Math.floor((mapY * TILE_SIZE * CELL_H * GLYPH_PX_H) / (GLYPH_PX_H * 2)),
    cellPx: GLYPH_PX_W * 2,
    cellPxH: GLYPH_PX_H * 2,
    background: role('ui.bg'),
  });
  const hud = new HudPanel(hudTerm, GLYPH_PX_W * 2, GLYPH_PX_H * 2);
  const offerModal = new OfferModal();

  // Seed from the URL if pinned, else from the clock (Math.random is banned
  // everywhere, and the whole point is that the seed is the only entropy).
  const fromUrl = Number(new URLSearchParams(location.search).get('seed'));
  let seed = Number.isInteger(fromUrl) && fromUrl > 0 ? fromUrl : Date.now() % 1_000_000;

  let hover: CellRef | null = null;
  let selected: CellRef | null = null;
  let sim!: Sim;
  let speedIdx = 1; // start at 1x
  let showGrid = false;
  let selectedBuildId = TOWER_DEFS[0].id; // def id of the active build choice
  let hudHover: import('@ascii-defense/view').HudAction | null = null;
  let dirty = true;
  /** Relic id awaiting a board-click target (Orbital); Esc cancels. */
  let targeting: string | null = null;

  // Two-letter slot tags: initials of the name's words ("Orbital Lance"->OL).
  const slotTag = (name: string): string => {
    const words = name.split(' ').filter(Boolean);
    return (words.length > 1 ? words[0][0] + words[1][0] : name.slice(0, 2)).toUpperCase();
  };

  const MIN_SLOTS = 12;
  const coreInfoFor = (): import('@ascii-defense/view').HudCoreInfo | null => {
    if (!selected || sim.cellAt(selected.x, selected.y) !== 'C') return null;
    const held = sim.heldRelicInfo();
    const slots = Array.from({ length: Math.max(MIN_SLOTS, held.length) }, (_, i): import('@ascii-defense/view').HudRelicSlot => {
      const h = held[i];
      if (!h) return { label: '', name: '', state: 'empty', cooldownSec: 0 };
      const state =
        h.def.kind === 'active'
          ? h.cooldown > 0
            ? ('cooling' as const)
            : ('ready' as const)
          : h.def.kind === 'consumable'
            ? h.used
              ? ('used' as const)
              : ('consumable' as const)
            : ('passive' as const);
      return { label: slotTag(h.def.name), name: h.def.name, state, cooldownSec: Math.ceil(h.cooldown / TICK_HZ) };
    });
    const hov = hudHover?.kind === 'relic' ? held[hudHover.index] : undefined;
    return {
      hp: sim.coreHp,
      hpMax: sim.coreHpMax,
      slots,
      hoverDesc: hov ? `${hov.def.name} - ${hov.def.desc}` : targeting ? 'click the map to aim, Esc cancels' : null,
      drawCost: RELIC_DRAW_COST,
      canDraw: sim.ore[0] >= RELIC_DRAW_COST && sim.heldRelics.length < RELIC_DEFS.length,
    };
  };

  /** Click a filled slot: actives fire (targeted ones arm), consumables use. */
  const slotClicked = (index: number): void => {
    const h = sim.heldRelicInfo()[index];
    if (!h) return;
    if (h.def.kind === 'consumable') {
      sim.useConsumable(h.def.id);
    } else if (h.def.kind === 'active' && h.cooldown === 0) {
      if (h.def.effects?.orbitalDamage !== undefined) targeting = h.def.id;
      else sim.fireActive(h.def.id);
    }
    dirty = true;
  };

  // An offer freezes time: auto-pause when it appears, restore the previous
  // speed on pick. The pause is app-level - the sim never wall-clock waits,
  // so replays and the bot are untouched (they pick between ticks).
  let offerWasUp = false;
  let speedBeforeOffer = 1;
  const syncOfferPause = (): void => {
    const up = sim.offer !== null;
    if (up && !offerWasUp) {
      speedBeforeOffer = speedIdx === 0 ? 1 : speedIdx;
      speedIdx = 0;
    }
    if (!up && offerWasUp) speedIdx = speedBeforeOffer;
    offerWasUp = up;
  };
  const pickOffer = (option: number): void => {
    if (sim.pickRelic(option)) {
      syncOfferPause();
      dirty = true;
    }
  };

  // Ore carries across rerolls in memory - the demo stand-in for M2's real
  // banking (PRD sec 6). Three carries, then the fourth reroll wipes: enough
  // to feel persistence without an actual store.
  let carriedOre = 0;
  let oreCarries = 0;
  const bankForReroll = (): void => {
    if (++oreCarries > 3) {
      carriedOre = 0;
      oreCarries = 0;
    } else {
      carriedOre = sim.ore[0];
    }
  };

  const setSeed = (s: number): void => {
    seed = s;
    // Difficulty knobs (PRD sec 4.4), randomized per seed for the demo so the
    // space of possible maps is visible. Road length is BIASED long (max of
    // two draws) rather than pinned - shorter roads are the harder end of the
    // dial, and threat levels will move this bias, not a constant.
    //
    // The engine already retries generation internally; if a seed still
    // fails, quietly step to the next one - a player must never read a
    // generator stack trace (Daniil).
    let map;
    for (;;) {
      try {
        const knobs = createRng(seed).stream('map');
        const entries = knobs.int(2, 5);
        const targetPathLength = 8 + Math.max(knobs.int(0, 18), knobs.int(0, 18));
        map = generateMap(knobs, lib, { width: mapX, height: mapY, entries, targetPathLength, relicPoolSize: RELIC_DEFS.length });
        break;
      } catch (err) {
        console.warn(`seed ${seed} could not generate, stepping`, err);
        seed = (seed + 1) % 1_000_000;
      }
    }
    view.setMap(map);
    currentMap = map;
    sim = new Sim(seed, {
      cells: resolveCells(map.board, lib),
      cellsW: mapX * TILE_SIZE,
      cellsH: mapY * TILE_SIZE,
      map,
      enemyDefs: ENEMY_DEFS,
      towerDefs: TOWER_DEFS,
      mode: 'waves',
      coreHp: 50,
      startingOre: carriedOre,
      relicDefs: RELIC_DEFS,
    });
    selected = null;
    history.replaceState(null, '', `?seed=${seed}`);
    dirty = true;
  };

  // Dynamic palette (Daniil): with a buildable tile selected, offer ONLY the
  // towers legal there - a vein offers the Refinery, ground offers fighters.
  // With nothing selected, the full roster shows for browsing.
  const paletteDefs = (): (typeof TOWER_DEFS)[number][] => {
    if (selected && sim.canBuildAt(selected.x, selected.y)) {
      return TOWER_DEFS.filter((d) => sim.canBuildDefAt(selected!.x, selected!.y, d.id));
    }
    return TOWER_DEFS;
  };

  // The app keeps the generated map (the sim's opts are private): caches are
  // rendered from it, minus what the sim says is claimed.
  let currentMap: import('@ascii-defense/engine').GeneratedMap | null = null;
  const mapCaches = (): { x: number; y: number }[] => {
    const out: { x: number; y: number }[] = [];
    currentMap?.caches.forEach((c, i) => {
      if (!sim.claimedCaches.includes(i)) out.push({ x: c.x, y: c.y });
    });
    return out;
  };

  const collectEnemies = (): { x: number; y: number; id: string }[] => {
    const out: { x: number; y: number; id: string }[] = [];
    for (let i = 0; i < sim.posX.length; i++) {
      if (sim.alive[i]) out.push({ x: sim.posX[i], y: sim.posY[i], id: sim.enemyDefOf(i).id });
    }
    return out;
  };

  const draw = (): void => {
    const speed = SPEEDS[speedIdx];
    const towers: { x: number; y: number; id: string }[] = [];
    for (const t of sim.towers) if (t) towers.push({ x: t.cellX, y: t.cellY, id: sim.towerDef(t).id });
    const projectiles: { x: number; y: number }[] = [];
    for (let i = 0; i < sim.projX.length; i++) {
      if (sim.projAlive[i]) projectiles.push({ x: sim.projX[i], y: sim.projY[i] });
    }
    // Selected tower shows its true reach - "range 6" as paint, not prose.
    const selTower = selected ? sim.towerAt(selected.x, selected.y) : null;
    const buildTarget = selected !== null && sim.canBuildAt(selected.x, selected.y);
    // Hovering a palette entry previews THAT tower's radius (the staged-tile
    // ring follows the mouse, not just the last click - Daniil's fix).
    const palette = paletteDefs();
    const previewDef =
      (hudHover?.kind === 'build' ? palette[hudHover.index] : undefined) ??
      palette.find((d) => d.id === selectedBuildId) ??
      palette[0];
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
    // Choice hover: fold the would-be pick into a stat preview.
    let effPreview: ReturnType<typeof sim.stats> | null = null;
    if (infoTower && hudHover?.kind === 'choose' && sim.choiceCost(infoTower, hudHover.tier, hudHover.option) !== null) {
      const next = [...infoTower.choices] as [number, number, number];
      next[hudHover.tier] = hudHover.option;
      effPreview = effectiveStats(sim.towerDef(infoTower), next);
    }
    const toStats = (e: NonNullable<typeof eff>) => ({
      dmg: Math.round(e.damage * 10) / 10,
      dps: ((e.damage / e.fireEveryTicks) * TICK_HZ).toFixed(1),
      range: Math.round(e.range * 10) / 10,
      slow: e.slowTicks,
      prod:
        e.productionEveryTicks > 0
          ? `${((e.production / e.productionEveryTicks) * TICK_HZ).toFixed(2)}/s`
          : null,
    });
    view.applyCellChanges(sim.cellChanges);
    view.render({
      hover,
      caches: mapCaches(),
      selected,
      enemies: collectEnemies(),
      towers,
      projectiles,
      // A hovered upgrade that grows range previews it on the map, pulsing.
      range:
        selTower && effPreview && effPreview.range !== eff?.range
          ? { x: selTower.cellX, y: selTower.cellY, r: effPreview.range }
          : range,
      // Green only when the sim would actually accept the click: placeable
      // for SOME tower and affordable for the staged one.
      hoverBuildable:
        hover !== null &&
        sim.canBuildAt(hover.x, hover.y) &&
        previewDef !== undefined &&
        sim.canAfford(previewDef.id),
      showGrid,
      rangeIsPreview: targeting !== null || (!selTower && buildTarget) || (selTower !== null && effPreview !== null),
      // Blink = the NEXT wave will enter here; steady = spawning RIGHT NOW.
      // One marker for both read as a lie when a telegraphed entry sat quiet
      // for a whole wave (Daniil's report).
      telegraph: sim.nextWaveEntries,
      activeEntries: sim.spawnRemaining() > 0 ? sim.waveEntries : [],
      gameOver: sim.status === 'lost',
      pulses: sim.pulses
        .map((pu) => ({ x: pu.x, y: pu.y, r: pu.r, age01: (sim.tickCount - pu.tick) / 10 }))
        .filter((pu) => pu.age01 >= 0 && pu.age01 <= 1),
      phase: animPhase,
    });

    // The offer pop-up paints OVER the finished board frame; closing it is
    // simply not painting it - the board underneath was never disturbed.
    const offer = sim.offerDefs();
    if (offer) {
      offerModal.render(
        term,
        offer.map((d) => ({ name: d.name, kind: d.kind, desc: d.desc })),
        sim.wave,
        animPhase,
        { cost: OFFER_REROLL_COST, can: sim.ore[0] >= OFFER_REROLL_COST },
      );
      // BoardView.render flushed to the GPU before we painted; without this
      // second flush the modal exists only in the CPU glyph buffer - text
      // snapshots see it, the SCREEN does not. Found by Daniil clicking
      // cards he could not see.
      term.flush();
    }

    hud.render({
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
      L: sim.flow.L,
      seed,
      speedLabel: speed === 0 ? 'PAUSED' : `${speed}x`,
      inspector: view.describeCell(selected ?? hover),
      palette: (buildTarget && !(selected && sim.cacheAt(selected.x, selected.y)) ? palette : []).map((d) => ({
        name: d.name ?? d.id,
        cost: d.cost,
        affordable: sim.canAfford(d.id),
      })),
      selectedBuild: palette.findIndex((d) => d.id === selectedBuildId),
      buildTargetSelected: buildTarget,
      phase: animPhase,
      core: coreInfoFor(),
      cache:
        selected && sim.cacheAt(selected.x, selected.y)
          ? { cost: CACHE_CLAIM_COST, affordable: sim.scrap >= CACHE_CLAIM_COST }
          : null,
      rock:
        selected && sim.cellAt(selected.x, selected.y) === 'K'
          ? { cost: PROSPECT_COST, affordable: sim.scrap >= PROSPECT_COST, unlocked: sim.prospectUnlocked() }
          : null,
      selectedTower:
        infoTower && def && eff
          ? {
              name: def.name ?? def.id,
              kills: infoTower.kills,
              stats: toStats(eff),
              preview: effPreview ? toStats(effPreview) : null,
              offVein:
                def.production !== undefined &&
                (def.production.ore ?? 0) > 0 &&
                sim.cellAt(infoTower.cellX, infoTower.cellY) !== 'O',
              priority: infoTower.priority,
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
    });
    dirty = false;
  };

  const app = document.getElementById('app')!;
  app.style.display = 'flex';
  app.style.alignItems = 'flex-start';
  app.style.gap = '6px';
  // Board + its caption stack in a left column; the caption stays under the
  // board (Daniil), leaving the panel the full height beside them.
  const leftCol = document.createElement('div');
  leftCol.appendChild(term.canvas);
  app.appendChild(leftCol);
  app.appendChild(hudTerm.canvas);
  const cap = document.createElement('div');
  cap.className = 'hud';
  cap.textContent =
    `spleen 5x8 \u00b7 engine: generated map, 20 Hz fixed tick, flow field to the Core, subcell walkers \u00b7 ` +
    `space pauses, 1/2/3 set speed, R rerolls \u00b7 `;
  const smithLink = document.createElement('a');
  smithLink.href = 'tilesmith.html';
  smithLink.textContent = 'tile smith \u2192';
  smithLink.style.color = '#4cc9f0';
  cap.appendChild(smithLink);
  leftCol.appendChild(cap);

  const same = (a: CellRef | null, b: CellRef | null): boolean =>
    a === b || (a !== null && b !== null && a.x === b.x && a.y === b.y);

  term.canvas.addEventListener('mousemove', (e) => {
    const next = view.cellFromPixel(e.offsetX, e.offsetY);
    if (!same(next, hover)) {
      hover = next;
      dirty = true;
    }
  });
  term.canvas.addEventListener('mouseleave', () => {
    hover = null;
    dirty = true;
  });
  // Hovering HUD labels previews them (radius for palette, stats for
  // choices); the same regions answer clicks.
  hudTerm.canvas.addEventListener('mousemove', (e) => {
    const a = hud.actionAt(e.offsetX, e.offsetY);
    const changed = JSON.stringify(a) !== JSON.stringify(hudHover);
    if (changed) {
      hudHover = a;
      dirty = true;
    }
  });
  hudTerm.canvas.addEventListener('mouseleave', () => {
    hudHover = null;
    dirty = true;
  });
  // Mouse-first: the HUD's labels ARE its buttons.
  hudTerm.canvas.addEventListener('click', (e) => {
    const action = hud.actionAt(e.offsetX, e.offsetY);
    if (!action) return;
    if (action.kind === 'build') {
      const def = paletteDefs()[action.index];
      if (def) {
        selectedBuildId = def.id;
        // The palette IS the build button when a tile is staged.
        if (selected) sim.buildTower(selected.x, selected.y, def.id);
      }
    }
    if (action.kind === 'priority' && selected) sim.setPriority(selected.x, selected.y, action.value);
    if (action.kind === 'choose' && selected) sim.chooseTier(selected.x, selected.y, action.tier, action.option);
    if (action.kind === 'relic') slotClicked(action.index);
    if (action.kind === 'coreDraw') sim.buyRelic();
    if (action.kind === 'claimCache' && selected) sim.claimCache(selected.x, selected.y);
    if (action.kind === 'prospect' && selected) sim.prospect(selected.x, selected.y);
    dirty = true;
  });
  term.canvas.addEventListener('click', (e) => {
    // An offer up = the board IS the modal; clicks route to its cards.
    if (sim.offer !== null) {
      const option = offerModal.optionAt(e.offsetX, e.offsetY, GLYPH_PX_W, GLYPH_PX_H);
      if (option === -1) sim.rerollOffer();
      else if (option !== null) pickOffer(option);
      dirty = true;
      return;
    }
    const cell = view.cellFromPixel(e.offsetX, e.offsetY);
    if (targeting !== null) {
      if (cell) sim.fireActive(targeting, cell.x, cell.y);
      targeting = null;
      dirty = true;
      return;
    }
    // Select-first flow (Daniil): clicking never builds. Pick the tile,
    // then pick the tower in the HUD; the preview ring breathes meanwhile.
    selected = same(cell, selected) ? null : cell;
    dirty = true;
  });
  window.addEventListener('keydown', (e) => {
    // While an offer is up, 1/2/3 pick cards (speed keys are moot: paused).
    if (sim.offer !== null && (e.key === '1' || e.key === '2' || e.key === '3')) {
      pickOffer(Number(e.key) - 1);
      return;
    }
    if (e.key === 'r' || e.key === 'R') {
      bankForReroll();
      setSeed((seed + 1 + (Date.now() % 997)) % 1_000_000);
    }
    if (e.key === ' ') {
      speedIdx = speedIdx === 0 ? 1 : 0;
      dirty = true;
      e.preventDefault();
    }
    if (e.key === '1') { speedIdx = 1; dirty = true; }
    if (e.key === '2') { speedIdx = 2; dirty = true; }
    if (e.key === '3') { speedIdx = 3; dirty = true; }
    if (e.key === 'g' || e.key === 'G') { showGrid = !showGrid; dirty = true; }
    if ((e.key === 'x' || e.key === 'X' || e.key === 'Delete') && selected) {
      if (sim.sellTower(selected.x, selected.y)) dirty = true;
    }
    if (selected) {
      const prio = { f: 'first', l: 'last', c: 'closest', w: 'weakest' } as const;
      const p = prio[e.key.toLowerCase() as keyof typeof prio];
      if (p && sim.setPriority(selected.x, selected.y, p)) dirty = true;
    }
    if (e.key === 'Escape') {
      selected = null;
      targeting = null;
      dirty = true;
    }
  });

  // ---- the frame loop ------------------------------------------------------
  // Accumulate scaled wall time; every full TICK_MS runs exactly one tick.
  // Speed changes tick FREQUENCY, never tick size (invariant 6). dt is
  // clamped so a backgrounded tab does not fast-forward on return.
  let last = performance.now();
  let acc = 0;
  let animPhase = 0;
  const frame = (now: number): void => {
    const dt = Math.min(now - last, 250);
    last = now;
    acc += dt * SPEEDS[speedIdx];
    animPhase = (now / 900) % 1; // breathing UI, independent of sim speed
    let ran = 0;
    while (acc >= TICK_MS && ran < 32) {
      sim.tick();
      acc -= TICK_MS;
      ran++;
    }
    syncOfferPause(); // an offer born this frame pauses before the next
    // Redraw every frame: telegraphs breathe and pulses expand even while
    // the player thinks; the renderer costs well under a millisecond.
    draw();
    void ran;
    void dirty;
    requestAnimationFrame(frame);
  };

  setSeed(seed);
  draw(); // first paint synchronously - rAF may be throttled in hidden tabs
  requestAnimationFrame(frame);

  // Debug handle for headless verification (the browser pane throttles rAF,
  // see CONTRIBUTING). Steps the sim and redraws on demand; harmless in prod.
  (globalThis as Record<string, unknown>).__ad = {
    step: (n: number): { breaches: number; alive: number; kills: number; coreDamage: number; ore: number } => {
      for (let i = 0; i < n; i++) sim.tick();
      draw();
      return { breaches: sim.breaches, alive: sim.aliveCount(), kills: sim.kills, coreDamage: sim.coreDamage, ore: sim.ore[0] };
    },
    build: (x: number, y: number, id?: string): boolean => {
      const ok = sim.buildTower(x, y, id ?? TOWER_DEFS[0].id);
      draw();
      return ok;
    },
    canBuild: (x: number, y: number): boolean => sim.canBuildAt(x, y),
    cellAt: (x: number, y: number): string | null => sim.cellAt(x, y),
    ore: (): number => sim.ore[0],
    // Text snapshots of both terminals - the reliable way to verify UI from
    // a headless pane (rAF frozen, screenshots refused - session 10).
    hudText: (): string => hudTerm.toText(),
    boardText: (): string => term.toText(),
    select: (x: number, y: number): void => {
      selected = { x, y };
      draw();
    },
    offer: (): string[] | null => sim.offerDefs()?.map((d) => d.id) ?? null,
    pick: (option: number): boolean => {
      const ok = sim.pickRelic(option);
      syncOfferPause();
      draw();
      return ok;
    },
    relics: (): string[] => sim.heldRelicInfo().map((h) => h.def.id),
    // The whole run as a file (PRD sec 12): paste this into a bug report and
    // the run is reproducible to the tick.
    replay: (): string =>
      JSON.stringify({
        version: REPLAY_VERSION,
        seed,
        contentHash: contentHashOf(ENEMY_DEFS, TOWER_DEFS),
        inputs: sim.inputs,
      }),
    hash: (): number => sim.hashState(),
    reroll: (): void => {
      bankForReroll();
      setSeed((seed + 1) % 1_000_000);
      draw();
    },
    enemies: collectEnemies,
  };
}

main().catch((e) => {
  document.getElementById('app')!.textContent = `failed: ${String(e)}`;
  console.error(e);
});
