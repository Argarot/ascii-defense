/**
 * The UI thread: terminals, input, ambient clocks, screens and persistence.
 * The Sim lives in a Worker (D7, session 18) and is reached ONLY through the
 * protocol - this file never touches sim state, it renders FrameSnapshots.
 *
 * Screens are modes over the same board render; none of them owns game state
 * (PRD sec 15.1). Saves: meta in localStorage, the run as seed + input log -
 * a save IS a replay (PRD sec 15.2). Corrupt saves say so; nothing wipes
 * silently.
 */
import { GLTerm } from '@ascii-defense/render';
import type { GlyphSet } from '@ascii-defense/render';
import { TILE_SIZE, TileLibrary } from '@ascii-defense/engine';
import type { GeneratedMap, TileDef } from '@ascii-defense/engine';
import { loadMintedTiles } from './mintedTiles';
import {
  BoardView,
  EffectsLayer,
  HudPanel,
  MenuScreen,
  OfferModal,
  CELL_W,
  CELL_H,
  isReducedMotion,
  role,
  setReducedMotion,
} from '@ascii-defense/view';
import type { CellRef, HudAction, HudState, RenderState } from '@ascii-defense/view';
import { validateSprite } from '@ascii-defense/content';
import tileLibraryJson from '@ascii-defense/content/assets/tiles/library.json';
import boltSpriteJson from '@ascii-defense/content/assets/sprites/bolt.json';
import mortarSpriteJson from '@ascii-defense/content/assets/sprites/mortar.json';
import frostSpriteJson from '@ascii-defense/content/assets/sprites/frost.json';
import refinerySpriteJson from '@ascii-defense/content/assets/sprites/refinery.json';
import { BOARD_SLOTS, SAVE_VERSION, THREAT_LEVELS, type FrameSnapshot, type FromWorker, type RunSave, type ToWorker, type UiState, type WorkerAction } from './protocol';

function must<T>(r: { ok: true; value: T } | { ok: false; errors: { path: string; message: string }[] }, what: string): T {
  if (!r.ok) throw new Error(`${what} failed validation: ` + r.errors.map((e) => `${e.path}: ${e.message}`).join('; '));
  return r.value;
}
const SPRITES = [boltSpriteJson, mortarSpriteJson, frostSpriteJson, refinerySpriteJson].map((s) =>
  must(validateSprite.check(s), `sprite ${(s as { id?: string }).id ?? '?'}`),
);

const BASE = import.meta.env.BASE_URL;
const ASSET_V = '5';
const load = <T>(p: string): Promise<T> =>
  fetch(`${BASE}assets/${p}?v=${ASSET_V}`).then((r) => r.json() as Promise<T>);

const GLYPH_PX_W = 5;
const GLYPH_PX_H = 8;

// ---- persistence (PRD sec 15.2) --------------------------------------------
const META_KEY = 'ascii-defense.meta.v1';
const RUN_KEY = 'ascii-defense.run.v1';

interface MetaSave {
  version: number;
  bankedOre: number;
  settings: { reducedMotion: boolean | null }; // null = follow the OS
  history: { seed: number; threat: string; wave: number; status: string; kills: number }[];
}

const defaultMeta = (): MetaSave => ({ version: SAVE_VERSION, bankedOre: 0, settings: { reducedMotion: null }, history: [] });

/** Load-or-explain: a corrupt blob is REPORTED and left in place, never wiped. */
function loadMeta(): { meta: MetaSave; problem: string | null } {
  try {
    const raw = localStorage.getItem(META_KEY);
    if (!raw) return { meta: defaultMeta(), problem: null };
    const m = JSON.parse(raw) as MetaSave;
    // v1 -> v2 changed only the RUN save (loadout); meta migrates in place.
    if (m.version === 1) return { meta: { ...m, version: SAVE_VERSION }, problem: null };
    if (m.version !== SAVE_VERSION) return { meta: defaultMeta(), problem: `meta save is version ${m.version}, this build reads ${SAVE_VERSION} - using defaults, old data kept` };
    return { meta: m, problem: null };
  } catch {
    return { meta: defaultMeta(), problem: 'meta save is corrupt - using defaults, the broken data is kept for export' };
  }
}
function saveMeta(m: MetaSave): void {
  try { localStorage.setItem(META_KEY, JSON.stringify(m)); } catch { /* storage full: the run continues */ }
}
function loadRun(): { run: RunSave | null; problem: string | null } {
  try {
    const raw = localStorage.getItem(RUN_KEY);
    if (!raw) return { run: null, problem: null };
    const r = JSON.parse(raw) as RunSave;
    // v1/v2 saves carry no map; across the generator rebuild their seed
    // would regenerate a DIFFERENT map and the input log would replay onto
    // the wrong cells - refused with a sentence, never silently corrupted.
    if (r.version < SAVE_VERSION) return { run: null, problem: 'run save predates the generator rebuild - it cannot continue' };
    if (r.version !== SAVE_VERSION) return { run: null, problem: `run save is version ${r.version}, this build reads ${SAVE_VERSION} - it cannot continue` };
    return { run: r, problem: null };
  } catch {
    return { run: null, problem: 'run save is corrupt and cannot continue - kept for export' };
  }
}

async function main(): Promise<void> {
  const glyphs = await load<GlyphSet>('glyphset-spleen.json');
  // The view's library mirrors the worker's world (2.21): shipped basics,
  // the minted pool, and any saved run's loadout (whose defs ride the save,
  // so a special deleted from the pool still resolves on continue).
  const savedLoadout = loadRun().run?.loadout ?? [];
  const mintedNow = loadMintedTiles();
  const lib = new TileLibrary([
    ...tileLibraryJson.tiles,
    ...mintedNow,
    ...savedLoadout.filter((t) => !mintedNow.some((m) => m.id === t.id) && !tileLibraryJson.tiles.some((s) => s.id === t.id)),
  ]);

  const mapX = BOARD_SLOTS.w, mapY = BOARD_SLOTS.h; // one truth, shared with the worker
  const boardCols = mapX * TILE_SIZE * CELL_W;
  const term = new GLTerm(glyphs, { cols: boardCols, rows: mapY * TILE_SIZE * CELL_H, cellPx: GLYPH_PX_W, cellPxH: GLYPH_PX_H, background: role('ui.bg') });
  const view = new BoardView(term, lib, { mapX, mapY, glyphPxW: GLYPH_PX_W, glyphPxH: GLYPH_PX_H, sprites: SPRITES });
  const effects = new EffectsLayer();
  const hudTerm = new GLTerm(glyphs, { cols: 30, rows: Math.floor((mapY * TILE_SIZE * CELL_H) / 2), cellPx: GLYPH_PX_W * 2, cellPxH: GLYPH_PX_H * 2, background: role('ui.bg') });
  const hud = new HudPanel(hudTerm, GLYPH_PX_W * 2, GLYPH_PX_H * 2);
  const modalTerm = new GLTerm(glyphs, { cols: Math.floor(boardCols / 2), rows: Math.floor((mapY * TILE_SIZE * CELL_H) / 2), cellPx: GLYPH_PX_W * 2, cellPxH: GLYPH_PX_H * 2, transparent: true });
  modalTerm.canvas.style.position = 'absolute';
  modalTerm.canvas.style.left = '0';
  modalTerm.canvas.style.top = '0';
  const offerModal = new OfferModal();
  const menu = new MenuScreen();

  // ---- state ---------------------------------------------------------------
  const { meta, problem: metaProblem } = loadMeta();
  const runLoad = loadRun();
  let saveProblem = metaProblem ?? runLoad.problem;
  if (meta.settings.reducedMotion !== null) setReducedMotion(meta.settings.reducedMotion);

  type Mode = 'title' | 'setup' | 'loadout' | 'howto' | 'settings' | 'playing' | 'paused' | 'summary';
  let mode: Mode = 'title';
  let settingsFrom: Mode = 'title';
  let wipeArmed = false;
  // Run setup state (2.21): the threat is picked, the loadout assembled, and
  // START commits both. Loadout entries are minted-tile ids; 3 slots for now
  // (the slot economy is 7.5).
  const LOADOUT_SLOTS = 3;
  let setupThreat = 1; // synced to the live threat when the screen opens
  let setupLoadout: string[] = [];
  let genError: string | null = null;
  // The lifecycle contract (spec sec 12): 'playing' begins on the worker's
  // 'ready', never on send - a failed init can no longer strand the player
  // in a phantom of the previous run.
  let pendingStart = false;
  let summary: { won: boolean; wave: number; kills: number; oreBanked: number; seed: number } | null = null;
  let summaryBanked = false;

  let hover: CellRef | null = null;
  let selected: CellRef | null = null;
  let hudHover: HudAction | null = null;
  let targeting: string | null = null;
  let showGrid = false;
  let selectedBuildId: string | null = null;
  let seed = 1;
  let threatIdx = Math.min(2, Math.max(0, Number(new URLSearchParams(location.search).get('threat') ?? 1)));
  let finalWave: number = THREAT_LEVELS[threatIdx].finalWave;
  let currentMap: GeneratedMap | null = null;
  let snap: FrameSnapshot | null = null;
  let mirroredSpeed = 1; // last speed the UI asked for (space toggle memory)
  let renderedMenuMode: Mode | null = null; // which screen's regions are live

  // ---- the worker ----------------------------------------------------------
  const worker = new Worker(new URL('./simWorker.ts', import.meta.url), { type: 'module' });
  const send = (m: ToWorker): void => worker.postMessage(m);
  const act = (a: WorkerAction): void => send({ t: 'action', a });
  let debugSeq = 0;
  const debugWaiters = new Map<number, (r: unknown) => void>();
  const saveWaiters = new Map<number, (r: RunSave) => void>();
  const debug = (op: string, ...args: unknown[]): Promise<unknown> =>
    new Promise((res) => {
      const id = ++debugSeq;
      debugWaiters.set(id, res);
      send({ t: 'debug', id, op, args });
    });
  const requestSave = (): Promise<RunSave> =>
    new Promise((res) => {
      const id = ++debugSeq;
      saveWaiters.set(id, res);
      send({ t: 'save', id });
    });

  worker.onmessage = (ev: MessageEvent<FromWorker>) => {
    const m = ev.data;
    if (m.t === 'ready') {
      seed = m.seed;
      finalWave = m.finalWave;
      currentMap = m.map;
      view.setMap(m.map);
      effects.reset();
      selected = null;
      targeting = null;
      summary = null;
      summaryBanked = false;
      if (pendingStart) {
        pendingStart = false;
        mode = 'playing';
      }
      history.replaceState(null, '', `?seed=${seed}&threat=${threatIdx}`);
    } else if (m.t === 'snapshot') {
      snap = m.s;
    } else if (m.t === 'saved') {
      saveWaiters.get(m.id)?.(m.save);
      saveWaiters.delete(m.id);
    } else if (m.t === 'genError') {
      // The run could not start (2.21/2.27): say so ON the setup screen and
      // stay there - a special is never silently dropped, and the previous
      // run (still intact in the worker) is never mistaken for a new one.
      pendingStart = false;
      genError = m.message;
      mode = 'setup';
    } else if (m.t === 'debugResult') {
      debugWaiters.get(m.id)?.(m.result);
      debugWaiters.delete(m.id);
    }
  };

  let lastLoadout: TileDef[] = [];
  const startRun = (tIdx: number, wantSeed?: number, resume?: RunSave, loadout?: TileDef[]): void => {
    threatIdx = tIdx;
    lastLoadout = resume?.loadout ?? loadout ?? [];
    send({ t: 'init', seed: wantSeed ?? Date.now() % 1_000_000, threatIdx: tIdx, resume, loadout });
    pendingStart = true; // 'playing' begins on 'ready', not on send
    mirroredSpeed = 1;
  };

  // Boot: an attract-mode run simmers behind the title (paused = board only).
  const urlSeed = Number(new URLSearchParams(location.search).get('seed'));
  send({ t: 'init', seed: Number.isInteger(urlSeed) && urlSeed > 0 ? urlSeed : Date.now() % 1_000_000, threatIdx });
  send({ t: 'speed', idx: 0 });

  // ---- autosave (PRD sec 15.2): every few seconds and on the way out -------
  const persistRun = async (): Promise<void> => {
    if (mode !== 'playing' && mode !== 'paused') return;
    if (!snap || snap.status !== 'running') return;
    const save = await requestSave();
    try { localStorage.setItem(RUN_KEY, JSON.stringify(save)); } catch { /* full */ }
  };
  setInterval(() => { void persistRun(); }, 5000);
  window.addEventListener('pagehide', () => { void persistRun(); });

  // ---- DOM -----------------------------------------------------------------
  const app = document.getElementById('app')!;
  app.style.display = 'flex';
  app.style.alignItems = 'flex-start';
  app.style.gap = '6px';
  const leftCol = document.createElement('div');
  leftCol.style.position = 'relative';
  leftCol.appendChild(term.canvas);
  leftCol.appendChild(modalTerm.canvas);
  app.appendChild(leftCol);
  app.appendChild(hudTerm.canvas);
  const cap = document.createElement('div');
  cap.className = 'hud';
  cap.textContent = 'spleen 5x8 \u00b7 sim in a worker \u00b7 space pauses, 1/2/3/4 set speed, Esc menus \u00b7 ';
  const smithLink = document.createElement('a');
  smithLink.href = 'tilesmith.html';
  smithLink.textContent = 'tile smith \u2192';
  smithLink.style.color = '#4cc9f0';
  cap.appendChild(smithLink);
  leftCol.appendChild(cap);

  // ---- screens -------------------------------------------------------------
  const menuSpec = (): import('@ascii-defense/view').MenuSpec | null => {
    const runSave = loadRun();
    switch (mode) {
      case 'title':
        return {
          title: 'ASCII DEFENSE',
          body: [
            'the board is a press; the waves want it stopped',
            '',
            ...(saveProblem ? [`! ${saveProblem}`] : []),
            meta.bankedOre > 0 ? `banked ore ${meta.bankedOre}` : '',
          ].filter((l, i, a) => l !== '' || a[i - 1] !== ''),
          items: [
            { id: 'new', label: 'NEW RUN' },
            { id: 'continue', label: 'CONTINUE', disabled: runSave.run === null, note: runSave.run ? `wave-era tick ${runSave.run.tick}` : runSave.problem ? 'unreadable' : 'no save' },
            { id: 'settings', label: 'SETTINGS' },
            { id: 'howto', label: 'HOW TO PLAY' },
          ],
          footer: `runs played ${meta.history.length}`,
        };
      case 'setup':
        return {
          title: 'RUN SETUP',
          body: [
            'threat sets waves, path length and the final wave',
            ...(genError ? ['', `! ${genError}`] : []),
          ],
          items: [
            ...THREAT_LEVELS.map((t, i) => ({
              id: `threat:${i}`,
              label: t.name.toUpperCase(),
              note: `to wave ${t.finalWave}`,
              selected: i === setupThreat,
            })),
            { id: 'loadout', label: 'LOADOUT', note: `${setupLoadout.length}/${LOADOUT_SLOTS} special(s) \u00bb` },
            { id: 'start', label: 'START RUN' },
            { id: 'back', label: 'BACK' },
          ],
        };
      case 'loadout': {
        // Its own screen (playtest 12, item 1): the pool will not fit a
        // strip, and picking tiles deserves the whole surface.
        const minted = loadMintedTiles();
        return {
          title: 'LOADOUT',
          body: [
            minted.length > 0
              ? `load up to ${LOADOUT_SLOTS} special tiles - a loaded tile is GUARANTEED on the map`
              : 'no special tiles yet - the tile smith mints them',
          ],
          tiles: minted.map((t) => ({ id: t.id, cells: t.cells, selected: setupLoadout.includes(t.id) })),
          items: [{ id: 'back', label: 'DONE' }],
          footer: `${setupLoadout.length}/${LOADOUT_SLOTS} loaded`,
        };
      }
      case 'howto':
        return {
          title: 'HOW TO PLAY',
          body: [
            'enemies march the road toward the Core;',
            'if it falls, the run ends.',
            '',
            'click ground, then a tower in the panel',
            'to build. towers upgrade in either/or',
            'tiers. refineries on gold veins mine Ore.',
            'every 3rd wave offers a relic - rules,',
            'not numbers. rock hides ore and caches;',
            'prospecting opens it. hold to the final',
            'wave and THE CORE STANDS.',
          ],
          items: [{ id: 'back', label: 'BACK' }],
        };
      case 'settings':
        return {
          title: 'SETTINGS',
          body: ['saves live in this browser; export moves them'],
          items: [
            { id: 'motion', label: 'REDUCED MOTION', note: isReducedMotion() ? 'ON' : 'OFF' },
            { id: 'export', label: 'EXPORT SAVES' },
            { id: 'import', label: 'IMPORT SAVES' },
            { id: 'wipe', label: wipeArmed ? 'CLICK AGAIN TO WIPE' : 'WIPE DATA' },
            { id: 'back', label: 'BACK' },
          ],
        };
      case 'paused':
        return {
          title: 'PAUSED',
          body: [`wave ${snap?.hud.wave ?? 0} of ${finalWave} \u00b7 seed ${seed}`],
          items: [
            { id: 'resume', label: 'RESUME' },
            { id: 'settings', label: 'SETTINGS' },
            { id: 'abandon', label: 'SAVE & EXIT TO TITLE' },
          ],
        };
      case 'summary':
        return summary
          ? {
              title: summary.won ? 'THE CORE STANDS' : 'THE CORE HAS FALLEN',
              body: [
                `wave ${summary.wave} of ${finalWave} \u00b7 seed ${summary.seed}`,
                `kills ${summary.kills}`,
                `ore banked +${summary.oreBanked} (total ${meta.bankedOre})`,
                ...(snap ? [`relics held ${snap.hud.relicCount}`] : []),
              ],
              items: [
                { id: 'again', label: summary.won ? 'GO AGAIN' : 'TRY AGAIN' },
                { id: 'title', label: 'TITLE' },
              ],
              footer: 'the next run starts where this one taught you',
            }
          : null;
      default:
        return null;
    }
  };

  const download = (name: string, text: string): void => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const menuAction = (id: string): void => {
    if (id !== 'wipe') wipeArmed = false;
    if (id.startsWith('threat:')) {
      setupThreat = Number(id.slice('threat:'.length));
      return;
    }
    if (id.startsWith('tile:')) {
      const tid = id.slice('tile:'.length);
      if (setupLoadout.includes(tid)) setupLoadout = setupLoadout.filter((t) => t !== tid);
      else if (setupLoadout.length < LOADOUT_SLOTS) setupLoadout = [...setupLoadout, tid];
      return;
    }
    switch (id) {
      case 'new':
        setupThreat = threatIdx;
        genError = null;
        mode = 'setup';
        break;
      case 'loadout':
        mode = 'loadout';
        break;
      case 'start': {
        const minted = loadMintedTiles();
        const defs = setupLoadout
          .map((tid) => minted.find((t) => t.id === tid))
          .filter((t): t is NonNullable<typeof t> => t !== undefined);
        genError = null;
        startRun(setupThreat, undefined, undefined, defs);
        break;
      }
      case 'continue': {
        const r = loadRun();
        if (r.run) startRun(r.run.threatIdx, r.run.seed, r.run);
        break;
      }
      case 'settings': settingsFrom = mode; mode = 'settings'; break;
      case 'howto': mode = 'howto'; break;
      case 'back': mode = mode === 'settings' ? settingsFrom : mode === 'loadout' ? 'setup' : 'title'; break;
      case 'motion': {
        const v = !isReducedMotion();
        setReducedMotion(v);
        meta.settings.reducedMotion = v;
        saveMeta(meta);
        break;
      }
      case 'export': {
        download('ascii-defense-saves.json', JSON.stringify({ meta: localStorage.getItem(META_KEY), run: localStorage.getItem(RUN_KEY) }));
        break;
      }
      case 'import': {
        const inp = document.createElement('input');
        inp.type = 'file';
        inp.accept = 'application/json';
        inp.onchange = async () => {
          try {
            const text = await inp.files![0].text();
            const data = JSON.parse(text) as { meta?: string | null; run?: string | null };
            if (data.meta) localStorage.setItem(META_KEY, data.meta);
            if (data.run) localStorage.setItem(RUN_KEY, data.run);
            location.reload();
          } catch {
            saveProblem = 'that file is not an ASCII Defense save';
          }
        };
        inp.click();
        break;
      }
      case 'wipe': {
        if (!wipeArmed) { wipeArmed = true; break; }
        localStorage.removeItem(META_KEY);
        localStorage.removeItem(RUN_KEY);
        location.reload();
        break;
      }
      case 'resume': mode = 'playing'; send({ t: 'speed', idx: 0 }); send({ t: 'speed', idx: mirroredSpeed }); break;
      case 'abandon': void persistRun().then(() => { mode = 'title'; send({ t: 'speed', idx: 0 }); }); break;
      // GO AGAIN keeps the loadout: "the same run again" includes the tiles
      // it was set up with, not just the threat (playtest 12).
      case 'again': startRun(threatIdx, undefined, undefined, lastLoadout); break;
      case 'title': mode = 'title'; send({ t: 'speed', idx: 0 }); break;
    }
  };

  // ---- input ---------------------------------------------------------------
  const same = (a: CellRef | null, b: CellRef | null): boolean => a === b || (a !== null && b !== null && a.x === b.x && a.y === b.y);
  const inGame = (): boolean => mode === 'playing';

  term.canvas.addEventListener('mousemove', (e) => {
    const next = view.cellFromPixel(e.offsetX, e.offsetY);
    if (!same(next, hover)) hover = next;
  });
  term.canvas.addEventListener('mouseleave', () => { hover = null; });
  term.canvas.addEventListener('click', (e) => {
    if (!inGame()) return;
    if (snap?.offer) return; // the offer modal owns clicks while it stands
    const cell = view.cellFromPixel(e.offsetX, e.offsetY);
    if (targeting !== null) {
      if (cell) act({ k: 'fireActive', relicId: targeting, x: cell.x, y: cell.y });
      targeting = null;
      return;
    }
    selected = same(cell, selected) ? null : cell;
  });

  hudTerm.canvas.addEventListener('mousemove', (e) => { hudHover = hud.actionAt(e.offsetX, e.offsetY); });
  hudTerm.canvas.addEventListener('mouseleave', () => { hudHover = null; });
  hudTerm.canvas.addEventListener('wheel', (e) => { hud.scrollBy(e.deltaY > 0 ? 2 : -2); e.preventDefault(); }, { passive: false });
  hudTerm.canvas.addEventListener('click', (e) => {
    if (!inGame()) return;
    const action = hud.actionAt(e.offsetX, e.offsetY);
    if (!action || !snap) return;
    if (action.kind === 'build') {
      const entry = snap.hud.palette[action.index];
      if (entry?.id) {
        selectedBuildId = entry.id;
        if (selected) act({ k: 'build', x: selected.x, y: selected.y, defId: entry.id });
      }
    }
    if (action.kind === 'priority' && selected) act({ k: 'priority', x: selected.x, y: selected.y, value: action.value });
    if (action.kind === 'choose' && selected) act({ k: 'choose', x: selected.x, y: selected.y, tier: action.tier, option: action.option });
    if (action.kind === 'relic') {
      const slot = snap.hud.core?.slots[action.index];
      if (slot?.state === 'ready' && slot.targeted && slot.id) targeting = slot.id;
      else act({ k: 'slot', index: action.index });
    }
    if (action.kind === 'coreDraw') act({ k: 'buyRelic' });
    if (action.kind === 'claimCache' && selected) act({ k: 'claimCache', x: selected.x, y: selected.y });
    if (action.kind === 'prospect' && selected) act({ k: 'prospect', x: selected.x, y: selected.y });
  });

  modalTerm.canvas.addEventListener('click', (e) => {
    const spec = menuSpec();
    if (spec) {
      // Hit-test against the regions of the screen actually ON SCREEN: a
      // click that arrives before the next render would otherwise land on
      // the previous menu's rows (found by synthetic-click verification).
      if (mode !== renderedMenuMode) return;
      const id = menu.itemAt(e.offsetX, e.offsetY, GLYPH_PX_W * 2, GLYPH_PX_H * 2);
      if (id) menuAction(id);
      return;
    }
    if (snap?.offer) {
      const option = offerModal.optionAt(e.offsetX, e.offsetY, GLYPH_PX_W * 2, GLYPH_PX_H * 2);
      if (option === -1) act({ k: 'rerollOffer' });
      else if (option !== null) act({ k: 'pickRelic', option });
    }
  });
  // The overlay canvas sits over the board; forward hover/board clicks when
  // no screen and no offer is up so it never becomes an invisible wall.
  modalTerm.canvas.style.pointerEvents = 'auto';
  const overlayInert = (): boolean => menuSpec() === null && !snap?.offer;
  modalTerm.canvas.addEventListener('mousemove', (e) => {
    if (overlayInert()) {
      const next = view.cellFromPixel(e.offsetX, e.offsetY);
      if (!same(next, hover)) hover = next;
    }
  });
  modalTerm.canvas.addEventListener('click', (e) => {
    if (overlayInert()) {
      term.canvas.dispatchEvent(new MouseEvent('click', { clientX: e.clientX, clientY: e.clientY }));
    }
  });

  window.addEventListener('keydown', (e) => {
    if (mode !== 'playing') {
      if (e.key === 'Escape' && (mode === 'paused' || mode === 'settings' || mode === 'howto' || mode === 'setup' || mode === 'loadout')) {
        const leavingPause = mode === 'paused';
        mode = mode === 'settings' ? settingsFrom : mode === 'loadout' ? 'setup' : leavingPause ? 'playing' : 'title';
        if (leavingPause) send({ t: 'speed', idx: mirroredSpeed });
      }
      return;
    }
    if (snap?.offer && (e.key === '1' || e.key === '2' || e.key === '3')) {
      act({ k: 'pickRelic', option: Number(e.key) - 1 });
      return;
    }
    if (e.key === ' ') {
      const paused = snap?.paused ?? false;
      send({ t: 'speed', idx: paused ? mirroredSpeed : 0 });
      e.preventDefault();
      return;
    }
    if (e.key >= '1' && e.key <= '4') {
      mirroredSpeed = Number(e.key);
      send({ t: 'speed', idx: mirroredSpeed });
    }
    if (e.key === 'g' || e.key === 'G') showGrid = !showGrid;
    if ((e.key === 'x' || e.key === 'X' || e.key === 'Delete') && selected) act({ k: 'sell', x: selected.x, y: selected.y });
    if (selected) {
      const prio = { f: 'first', l: 'last', c: 'closest', w: 'weakest' } as const;
      const p = prio[e.key.toLowerCase() as keyof typeof prio];
      if (p) act({ k: 'priority', x: selected.x, y: selected.y, value: p });
    }
    if (e.key === 'Escape') {
      if (targeting) { targeting = null; return; }
      if (selected) { selected = null; return; }
      // The pause SCREEN pauses the WORLD - a menu over a running sim would
      // be the hidden-tab lie in reverse.
      mode = 'paused';
      send({ t: 'speed', idx: 0 });
    }
  });

  // ---- the frame loop ------------------------------------------------------
  let last = performance.now();
  let worldMs = 0;
  const frame = (now: number): void => {
    const dt = Math.min(now - last, 250);
    last = now;
    const still = isReducedMotion();
    const speed = snap?.speed ?? 0;
    worldMs += dt * speed;
    const animPhase = still ? 0.25 : (now / 900) % 1;
    const animMs = still ? 0 : worldMs;
    const drift = still ? 0 : Math.floor(worldMs / 1400);

    send({ t: 'frame', ui: { hover, selected, hudHover, targeting, showGrid } as UiState });

    if (snap && currentMap) {
      // The run ended while playing: bank once, then the summary owns the eye.
      if (snap.status !== 'running' && (mode === 'playing' || mode === 'paused') && !summaryBanked) {
        summaryBanked = true;
        summary = { won: snap.status === 'won', wave: snap.hud.wave, kills: snap.hud.kills, oreBanked: snap.hud.ore, seed };
        meta.bankedOre += snap.hud.ore;
        meta.history.push({ seed, threat: THREAT_LEVELS[threatIdx].name, wave: snap.hud.wave, status: snap.status, kills: snap.hud.kills });
        if (meta.history.length > 50) meta.history.shift();
        saveMeta(meta);
        try { localStorage.removeItem(RUN_KEY); } catch { /* the run is over either way */ }
        mode = 'summary';
      }

      view.applyCellChanges(snap.cellChanges);
      const board: RenderState = { ...snap.board, phase: animPhase, animMs, drift };
      view.render(board, (t) => {
        effects.ingest(snap!.events);
        effects.draw(t, snap!.tick);
      });
      const hudState: HudState = {
        ...snap.hud,
        phase: animPhase,
        inspector: view.describeCell(selected ?? hover) + snap.hud.inspector,
        selectedBuild: snap.hud.palette.findIndex((p) => p.id === selectedBuildId),
      };
      hud.render(hudState);

      // Overlay: a screen, else the offer, else nothing. The HUD hides
      // behind fullscreen menus (playtest 12, item 4) - a menu is not a
      // moment to read tower stats, and the panel pulled the eye.
      const spec = menuSpec();
      hudTerm.canvas.style.visibility = spec && mode !== 'paused' ? 'hidden' : 'visible';
      modalTerm.clear();
      renderedMenuMode = spec ? mode : null;
      if (spec) {
        menu.render(modalTerm, { ...spec, phase: animPhase });
        modalTerm.flush();
        modalTerm.canvas.style.display = '';
      } else if (snap.offer && inGame()) {
        offerModal.render(modalTerm, snap.offer.cards, snap.offer.wave, animPhase, snap.offer.reroll);
        modalTerm.flush();
        modalTerm.canvas.style.display = '';
      } else {
        modalTerm.flush();
        modalTerm.canvas.style.display = '';
      }
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  // ---- debug handle (async now: the sim answers from its worker) -----------
  (globalThis as Record<string, unknown>).__ad = {
    step: (n: number) => debug('step', n),
    build: (x: number, y: number, id?: string) => debug('build', x, y, id),
    canBuild: (x: number, y: number) => debug('canBuild', x, y),
    cellAt: (x: number, y: number) => debug('cellAt', x, y),
    ore: () => debug('ore'),
    offer: () => debug('offer'),
    pick: (option: number) => debug('pick', option),
    relics: () => debug('relics'),
    hash: () => debug('hash'),
    events: () => debug('events'),
    enemies: () => debug('enemies'),
    replay: () => debug('replay'),
    hudText: (): string => hudTerm.toText(),
    boardText: (): string => term.toText(),
    select: (x: number, y: number): void => { selected = { x, y }; },
    mode: (m?: Mode): Mode => { if (m) mode = m; return mode; },
    motion: (reduced: boolean): void => { setReducedMotion(reduced); },
    // Menu verification (2.21): drive the same menuAction the click path
    // calls, one level below the pixel hit-test. modalText shows what the
    // player would see (CONTRIBUTING: toText over screenshots).
    menu: (id: string): void => { menuAction(id); },
    modalText: (): string => modalTerm.toText(),
    setupState: (): { threat: number; loadout: string[]; genError: string | null } => ({ threat: setupThreat, loadout: [...setupLoadout], genError }),
  };
}

main().catch((e) => {
  document.getElementById('app')!.textContent = `failed: ${String(e)}`;
  console.error(e);
});
