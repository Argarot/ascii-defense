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
  Sim,
  TICK_HZ,
  TILE_SIZE,
  TileLibrary,
  createRng,
  generateMap,
  resolveCells,
} from '@ascii-defense/engine';
import { BoardView, HudPanel, CELL_W, CELL_H, role } from '@ascii-defense/view';
import type { CellRef } from '@ascii-defense/view';
import { validateEnemies, validateTowers } from '@ascii-defense/content';
import tileLibraryJson from '@ascii-defense/content/assets/tiles/library.json';
import enemiesJson from '@ascii-defense/content/assets/enemies/roster.json';
import towersJson from '@ascii-defense/content/assets/towers/roster.json';

// Content enters the app validated or not at all (ARCHITECTURE sec 8).
function must<T>(r: { ok: true; value: T } | { ok: false; errors: { path: string; message: string }[] }, what: string): T {
  if (!r.ok) throw new Error(`${what} failed validation: ` + r.errors.map((e) => `${e.path}: ${e.message}`).join('; '));
  return r.value;
}
const ENEMY_DEFS = must(validateEnemies.check(enemiesJson), 'enemies roster').enemies;
const TOWER_DEFS = must(validateTowers.check(towersJson), 'towers roster').towers;

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

  const mapX = 14, mapY = 7;
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

  // The HUD below the board, at 2x glyph size (10x16 px - integer multiple,
  // the bitmap font stays crisp). Half the columns, same pixel width.
  const hudTerm = new GLTerm(glyphs, {
    cols: Math.floor(boardCols / 2),
    rows: 4,
    cellPx: GLYPH_PX_W * 2,
    cellPxH: GLYPH_PX_H * 2,
    background: role('ui.bg'),
  });
  const hud = new HudPanel(hudTerm, GLYPH_PX_W * 2, GLYPH_PX_H * 2);

  // Seed from the URL if pinned, else from the clock (Math.random is banned
  // everywhere, and the whole point is that the seed is the only entropy).
  const fromUrl = Number(new URLSearchParams(location.search).get('seed'));
  let seed = Number.isInteger(fromUrl) && fromUrl > 0 ? fromUrl : Date.now() % 1_000_000;

  let hover: CellRef | null = null;
  let selected: CellRef | null = null;
  let sim!: Sim;
  let speedIdx = 1; // start at 1x
  let showGrid = false;
  let selectedBuild = 0; // palette index of the active build choice
  let dirty = true;

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
        map = generateMap(knobs, lib, { width: mapX, height: mapY, entries, targetPathLength });
        break;
      } catch (err) {
        console.warn(`seed ${seed} could not generate, stepping`, err);
        seed = (seed + 1) % 1_000_000;
      }
    }
    view.setMap(map);
    sim = new Sim(seed, {
      cells: resolveCells(map.board, lib),
      cellsW: mapX * TILE_SIZE,
      cellsH: mapY * TILE_SIZE,
      map,
      enemyDefs: ENEMY_DEFS,
      towerDefs: TOWER_DEFS,
      mode: 'waves',
      coreHp: 50,
    });
    selected = null;
    history.replaceState(null, '', `?seed=${seed}`);
    dirty = true;
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
    const range = selTower
      ? { x: selTower.cellX, y: selTower.cellY, r: sim.towerDef(selTower).range }
      : null;
    view.render({
      hover,
      selected,
      enemies: collectEnemies(),
      towers,
      projectiles,
      range,
      // Green only when the sim would actually accept the click: placeable
      // AND affordable.
      hoverBuildable:
        hover !== null &&
        sim.canBuildAt(hover.x, hover.y) &&
        sim.canAfford(TOWER_DEFS[selectedBuild].id),
      showGrid,
      telegraph: sim.nextWaveEntries,
      gameOver: sim.status === 'lost',
      pulses: sim.pulses
        .map((pu) => ({ x: pu.x, y: pu.y, r: pu.r, age01: (sim.tickCount - pu.tick) / 10 }))
        .filter((pu) => pu.age01 >= 0 && pu.age01 <= 1),
      phase: animPhase,
    });

    const hoverTower = hover ? sim.towerAt(hover.x, hover.y) : null;
    const infoTower = selTower ?? hoverTower;
    const def = infoTower ? sim.towerDef(infoTower) : null;
    const eff = infoTower ? sim.stats(infoTower) : null;
    hud.render({
      scrap: sim.scrap,
      kills: sim.kills,
      coreDamage: sim.coreDamage,
      coreHp: sim.coreHp,
      coreHpMax: sim.coreHpMax,
      wave: sim.wave,
      nextFronts: sim.nextWaveEntries.length,
      gameOver: sim.status === 'lost',
      L: sim.flow.L,
      seed,
      speedLabel: speed === 0 ? 'PAUSED' : `${speed}x`,
      inspector: view.describeCell(selected ?? hover),
      palette: TOWER_DEFS.map((d) => ({
        name: d.name ?? d.id,
        cost: d.cost,
        affordable: sim.canAfford(d.id),
      })),
      selectedBuild,
      selectedTower:
        infoTower && def && eff
          ? {
              name: def.name ?? def.id,
              kills: infoTower.kills,
              dmg: eff.damage,
              dps: ((eff.damage / eff.fireEveryTicks) * TICK_HZ).toFixed(1),
              range: eff.range,
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
  app.appendChild(term.canvas);
  hudTerm.canvas.style.marginTop = '4px';
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
  app.appendChild(cap);

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
  // Mouse-first: the HUD's labels ARE its buttons.
  hudTerm.canvas.addEventListener('click', (e) => {
    const action = hud.actionAt(e.offsetX, e.offsetY);
    if (!action) return;
    if (action.kind === 'build') selectedBuild = action.index;
    if (action.kind === 'priority' && selected) sim.setPriority(selected.x, selected.y, action.value);
    if (action.kind === 'choose' && selected) sim.chooseTier(selected.x, selected.y, action.tier, action.option);
    dirty = true;
  });
  term.canvas.addEventListener('click', (e) => {
    const cell = view.cellFromPixel(e.offsetX, e.offsetY);
    // Build on buildable ground (free until the economy lands, session B);
    // anything else is selection.
    if (cell && sim.canBuildAt(cell.x, cell.y)) {
      sim.buildTower(cell.x, cell.y, TOWER_DEFS[selectedBuild].id);
      selected = cell;
    } else {
      selected = same(cell, selected) ? null : cell; // click again to deselect
    }
    dirty = true;
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'r' || e.key === 'R') setSeed((seed + 1 + (Date.now() % 997)) % 1_000_000);
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
    step: (n: number): { breaches: number; alive: number; kills: number; coreDamage: number } => {
      for (let i = 0; i < n; i++) sim.tick();
      draw();
      return { breaches: sim.breaches, alive: sim.aliveCount(), kills: sim.kills, coreDamage: sim.coreDamage };
    },
    build: (x: number, y: number): boolean => {
      const ok = sim.buildTower(x, y, TOWER_DEFS[0].id);
      draw();
      return ok;
    },
    canBuild: (x: number, y: number): boolean => sim.canBuildAt(x, y),
    enemies: collectEnemies,
  };
}

main().catch((e) => {
  document.getElementById('app')!.textContent = `failed: ${String(e)}`;
  console.error(e);
});
