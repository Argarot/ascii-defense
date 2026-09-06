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
import { CORE_STRIP, GENERATOR_VERSION, TILE_SIZE, TileLibrary, fnv1a } from '@ascii-defense/engine';
import type { GeneratedMap, TileDef } from '@ascii-defense/engine';
import { loadMintedProblems, loadMintedTiles, removeMintedTile } from './mintedTiles';
import {
  BoardView,
  EffectsLayer,
  HudPanel,
  MenuScreen,
  OfferModal,
  tileCapacity,
  CELL_W,
  CELL_H,
  GLYPH_PX_W,
  GLYPH_PX_H,
  isReducedMotion,
  role,
  setReducedMotion,
  StripPanel,
  STRIP_ROWS, interpolate, WALKER_MAX_STEP, SHOT_MAX_STEP, RenderClock, setPaletteSet, ForgeModal, setPaletteRoles, setTerrainPack, type TerrainSpritePack } from '@ascii-defense/view';
import type { CellRef, HudAction, HudState, RenderState, MenuSpec } from '@ascii-defense/view';
import { validateSprite, type Sprite } from '@ascii-defense/content';
import tileLibraryJson from '@ascii-defense/content/assets/tiles/library.json';
import { THREAT_LEVELS, type FrameSnapshot, type FromWorker, type RunSave, type ToWorker, type UiState, type WorkerAction } from './protocol';
import { META_KEY, RUN_KEY, loadMetaFrom, loadRunFrom, saveMetaTo, type MetaSave } from './persistence';
import { boardSlotsFor } from './boardSize';
import { CODEX } from './generated/codex';

function must<T>(r: { ok: true; value: T } | { ok: false; errors: { path: string; message: string }[] }, what: string): T {
  if (!r.ok) throw new Error(`${what} failed validation: ` + r.errors.map((e) => `${e.path}: ${e.message}`).join('; '));
  return r.value;
}
// Every sprite content ships (session 25): towers, enemies, relics, the
// Core face - one glob, validated at boot. The title's hero row is the
// tower sprites in roster order.
const SPRITE_JSON = import.meta.glob('../../content/assets/sprites/*.json', { eager: true, import: 'default' }) as Record<string, unknown>;
// The art agent's reworked pack lives beside the shipped assets (2026-09-06
// evening, Daniil: "try the new sprites"); a setting picks the pack at boot.
// Missing folder = empty globs = the shipped pack.
const REWORKED_JSON = import.meta.glob('../../content/assets-reworked/sprites/*.json', { eager: true, import: 'default' }) as Record<string, unknown>;
const REWORKED_PALETTE = import.meta.glob('../../content/assets-reworked/palette.json', { eager: true, import: 'default' }) as Record<string, { roles?: Record<string, string> }>;
const SPRITE_SET: 'shipped' | 'reworked' = loadMetaFrom(localStorage).meta.settings.spriteSet ?? 'shipped';
const SHIPPED_SPRITES = Object.values(SPRITE_JSON).map((s) => must(validateSprite.check(s), `sprite ${(s as { id?: string }).id ?? '?'}`));
const REWORKED_SPRITES = SPRITE_SET === 'reworked' ? Object.values(REWORKED_JSON).map((s) => must(validateSprite.check(s), `reworked sprite ${(s as { id?: string }).id ?? '?'}`)) : [];
// The reworked pack first, the shipped one for anything it lacks.
const SPRITES = SPRITE_SET === 'reworked' && REWORKED_SPRITES.length > 0
  ? [...REWORKED_SPRITES, ...SHIPPED_SPRITES.filter((s) => !REWORKED_SPRITES.some((r) => r.id === s.id))]
  : SHIPPED_SPRITES;
if (SPRITE_SET === 'reworked') {
  const pal = Object.values(REWORKED_PALETTE)[0]?.roles;
  if (pal) setPaletteRoles(pal);
  const pack: TerrainSpritePack = {};
  for (const s of REWORKED_SPRITES) { if (s.id === 'ground_slate') pack.G = s; if (s.id === 'rock_slate') pack.R = s; if (s.id === 'ore_slate') pack.O = s; }
  setTerrainPack(pack);
}
const HERO = ['bolt', 'mortar', 'frost', 'refinery', 'tesla', 'missile', 'laser', 'bastion'].map((id) => SPRITES.find((s) => s.id === id)).filter((s) => s !== undefined);

const BASE = import.meta.env.BASE_URL;
const ASSET_V = '6';
const load = <T>(p: string): Promise<T> =>
  fetch(`${BASE}assets/${p}?v=${ASSET_V}`).then((r) => r.json() as Promise<T>);

/** The HUD and the menus draw at this integer multiple of the font (crisp); a setting since session 27, read once at boot. */
const UI_SCALE: number = loadMetaFrom(localStorage).meta.settings.hudScale;
/** The HUD's width in its own glyph columns. */
const HUD_COLS = 30;

// ---- persistence (PRD sec 15.2) lives in persistence.ts (Node-testable) ----
const loadMeta = (): ReturnType<typeof loadMetaFrom> => loadMetaFrom(localStorage);
const saveMeta = (m: MetaSave): void => saveMetaTo(localStorage, m);
const loadRun = (): ReturnType<typeof loadRunFrom> => loadRunFrom(localStorage);

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

  // The board fits THIS screen (D24, option 1): tile slots from the viewport,
  // clamped to what the generator is tuned for. The worker is told with
  // every init; a resumed save must be this size too (checked below).
  const { w: mapX, h: mapY } = boardSlotsFor(window.innerWidth, window.innerHeight, {
    cellW: CELL_W, cellH: CELL_H, glyphPxW: GLYPH_PX_W, glyphPxH: GLYPH_PX_H, hudCols: HUD_COLS, hudScale: UI_SCALE,
  });
  /**
   * A save carries its map, and the board on screen is sized to THIS
   * viewport: a save made for another size cannot draw here. Refused with
   * a sentence (the data stays for export), never squeezed or stretched.
   */
  const loadRunForThisScreen = (): ReturnType<typeof loadRunFrom> => {
    const r = loadRun();
    if (r.run && (r.run.map.board.width !== mapX || r.run.map.board.height !== mapY)) {
      return { run: null, problem: `run save was made for a ${r.run.map.board.width}x${r.run.map.board.height}-tile board; this screen fits ${mapX}x${mapY} - it cannot continue here` };
    }
    return r;
  };
  // The board's cells plus the Core strip past the east border (session 24).
  const boardCols = (mapX * TILE_SIZE + CORE_STRIP) * CELL_W;
  const boardRows = mapY * TILE_SIZE * CELL_H;
  const term = new GLTerm(glyphs, { cols: boardCols, rows: boardRows, cellPx: GLYPH_PX_W, cellPxH: GLYPH_PX_H, background: role('ui.bg') });
  const view = new BoardView(term, lib, { mapX, mapY, glyphPxW: GLYPH_PX_W, glyphPxH: GLYPH_PX_H, sprites: SPRITES });
  const effects = new EffectsLayer();
  // UI surfaces at UI_SCALE: the same pixel height as the board, so the
  // modal covers it exactly (the old /2 rounding left an 8 px gap).
  // The column runs the whole left column's height - board AND strip - so
  // nothing under it is blank (feedback 2026-09-06, item 3). The modal
  // keeps the board's height: it covers the board, not the strip.
  const uiRows = Math.floor((boardRows + STRIP_ROWS) / UI_SCALE);
  const modalRows = Math.floor(boardRows / UI_SCALE);
  const hudTerm = new GLTerm(glyphs, { cols: HUD_COLS, rows: uiRows, cellPx: GLYPH_PX_W * UI_SCALE, cellPxH: GLYPH_PX_H * UI_SCALE, background: role('ui.bg') });
  const hud = new HudPanel(hudTerm, GLYPH_PX_W * UI_SCALE, GLYPH_PX_H * UI_SCALE, SPRITES);
  // The strip (4.27): a full-width panel under the board at the HUD's
  // scale - build buttons as the towers' own sprites, the wave, the Core.
  // The strip at the BOARD's scale (feedback item 6, 2026-09-05): the same
  // 128 px as before, twice the columns and rows.
  const stripTerm = new GLTerm(glyphs, { cols: boardCols, rows: STRIP_ROWS, cellPx: GLYPH_PX_W, cellPxH: GLYPH_PX_H, background: role('ui.bg') });
  const strip = new StripPanel(stripTerm, GLYPH_PX_W, GLYPH_PX_H, SPRITES);
  let stripHover: HudAction | null = null;
  /** What the last copy button put on the clipboard, shown on the button for a moment (feedback 2026-09-06). */
  let lastCopied: 'code' | 'seed' | null = null;
  const copyLabel = (what: 'code' | 'seed', label: string): string => (lastCopied === what ? `${label} - COPIED` : label);
  // The opened held relic (session 28, PR 3) and a pick waiting for the slot it replaces.
  let selectedRelic: number | null = null;
  let pendingReplace: { option: number } | null = null;
  // Motion v2 (session 27): the picture is drawn at a STEADY time on the
  // world clock, one tick behind the newest snapshot, blended between the
  // two snapshots that bracket it - whatever bursts the worker's ticks
  // arrive in. The ring keeps the last few snapshots for that.
  const clock = new RenderClock<FrameSnapshot>();
  let worldMs = 0;
  const modalTerm = new GLTerm(glyphs, { cols: Math.floor(boardCols / UI_SCALE), rows: modalRows, cellPx: GLYPH_PX_W * UI_SCALE, cellPxH: GLYPH_PX_H * UI_SCALE, transparent: true });
  modalTerm.canvas.style.position = 'absolute';
  modalTerm.canvas.style.left = '0';
  modalTerm.canvas.style.top = '0';
  // The shell owns the whole screen (4.28, Daniil): the title, setup,
  // loadout, how-to, settings and summary are PAGES on a terminal sized to
  // the viewport, over everything. The pause overlay and the relic offer
  // stay on the board's own modal: they are moments IN the run.
  const screenCols = Math.max(60, Math.floor(window.innerWidth / (GLYPH_PX_W * UI_SCALE)));
  const screenRows = Math.max(30, Math.floor(window.innerHeight / (GLYPH_PX_H * UI_SCALE)));
  const screenTerm = new GLTerm(glyphs, { cols: screenCols, rows: screenRows, cellPx: GLYPH_PX_W * UI_SCALE, cellPxH: GLYPH_PX_H * UI_SCALE, background: role('ui.bg') });
  screenTerm.canvas.style.position = 'fixed';
  screenTerm.canvas.style.left = '0';
  screenTerm.canvas.style.top = '0';
  screenTerm.canvas.style.zIndex = '20';
  screenTerm.canvas.style.border = 'none';
  const FULLSCREEN_MODES = new Set(['title', 'setup', 'loadout', 'howto', 'settings', 'summary']);
  const offerModal = new OfferModal();
  // The Forge (feedback 2026-09-06 evening, item 4): its own window, two slots, one button.
  const forgeModal = new ForgeModal(new Map(SPRITES.map((s) => [s.id, s])));
  let forgeOpen = false;
  let forgePicked: [number | null, number | null] = [null, null];
  const forgeState = (): import('@ascii-defense/view').ForgeState | null => {
    const card = snap?.hud.coreCard;
    if (!card) return null;
    const held = card.slots.map((sl, i) => ({ index: i, name: sl.name, kind: sl.state, rarity: sl.rarity, id: sl.id })).filter((h) => h.kind !== 'empty');
    // A held index that vanished (salvaged, combined) leaves its slot.
    const picked: [number | null, number | null] = [forgePicked[0] !== null && held.some((h) => h.index === forgePicked[0]) ? forgePicked[0] : null, forgePicked[1] !== null && held.some((h) => h.index === forgePicked[1]) ? forgePicked[1] : null];
    const pair = picked[0] !== null && picked[1] !== null ? (card.combines ?? []).find((c) => c.a === picked[0] && c.b === picked[1]) : undefined;
    return { held, picked, result: pair ? { name: pair.result, rarity: pair.resultRarity } : null };
  };
  const forgeAct = (a: import('@ascii-defense/view').ForgeAction): void => {
    if (a.kind === 'close') { forgeOpen = false; forgePicked = [null, null]; return; }
    if (a.kind === 'slot') { forgePicked[a.slot] = null; return; }
    if (a.kind === 'held') {
      if (forgePicked[0] === a.index) forgePicked[0] = null;
      else if (forgePicked[1] === a.index) forgePicked[1] = null;
      else if (forgePicked[0] === null) forgePicked[0] = a.index;
      else forgePicked[1] = a.index;
      return;
    }
    if (a.kind === 'combine') {
      const st = forgeState();
      if (st && st.result && st.picked[0] !== null && st.picked[1] !== null) { act({ k: 'combine', a: st.picked[0], b: st.picked[1] }); forgePicked = [null, null]; }
    }
  };
  const menu = new MenuScreen();

  // ---- state ---------------------------------------------------------------
  const { meta, problem: metaProblem } = loadMeta();
  const runLoad = loadRunForThisScreen();
  let saveProblem = metaProblem ?? runLoad.problem;
  if (meta.settings.reducedMotion !== null) setReducedMotion(meta.settings.reducedMotion);
  setPaletteSet(meta.settings.palette);

  type Mode = 'title' | 'setup' | 'loadout' | 'howto' | 'settings' | 'playing' | 'paused' | 'summary';
  let mode: Mode = 'title';
  let settingsFrom: Mode = 'title';
  // The how-to is the CODEX (session 27): sections of pages rendered from
  // the same generated facts as docs/CATALOGUE.md; reachable from the
  // title and from pause, and it returns where it came from.
  let howtoFrom: Mode = 'title';
  type CodexSection = 'basics' | 'towers' | 'enemies' | 'relics';
  let codexSection: CodexSection = 'basics';
  let codexPage = 0;
  let wipeArmed = false;
  // Run setup state (2.21): the threat is picked, the loadout assembled, and
  // START commits both. Loadout entries are minted-tile ids; 3 slots for now
  // (the slot economy is 7.5).
  const LOADOUT_SLOTS = 5;
  // Shipped SPECIALS (playtest 2026-08-19): library tiles whose roads touch
  // without merging or split into two segments - selectable like minted
  // tiles, never rolled from the random pools.
  const shippedSpecials: TileDef[] = tileLibraryJson.tiles.filter((t) => t.special === true);
  let setupThreat = 1; // synced to the live threat when the screen opens
  let setupLoadout: string[] = [];
  // The loadout pool pages at what the modal can SHOW (playtest 18 found
  // the overflow at 5x3 as a literal 10; at 8x5 a preview is 40x25 glyphs
  // and the count comes from the same arithmetic the screen lays out with).
  // Reserved rows: title block 4, one body line, up to 4 item rows x2, a
  // footer 2.
  // The loadout page lives on the fullscreen terminal now: it pages at
  // what THAT screen can show.
  const TILES_PER_PAGE = tileCapacity(screenCols, screenRows, 4 + 1 + 8 + 2);
  let loadoutPage = 0;
  // Delete mode (playtest 18): armed, clicking a MINTED tile removes it
  // permanently - the pool is the player's content, so pruning it is a
  // button in their hands, not a heuristic. Shipped tiles are untouchable.
  let loadoutDeleteArmed = false;
  let genError: string | null = null;
  // The lifecycle contract (spec sec 12): 'playing' begins on the worker's
  // 'ready', never on send - a failed init can no longer strand the player
  // in a phantom of the previous run.
  let pendingStart = false;
  let summary: { won: boolean; wave: number; kills: number; oreBanked: number; seed: number; story?: FrameSnapshot['story'] } | null = null;
  let summaryBanked = false;

  let hover: CellRef | null = null;
  let selected: CellRef | null = null;
  let hudHover: HudAction | null = null;
  let targeting: string | null = null;
  let showGrid = false;
  let selectedBuildId: string | null = null;
  let seed = 1;
  // `?threat=abc` is NaN, and NaN indexes THREAT_LEVELS to undefined - a
  // crash before the title screen. Anything unparseable means Standard.
  const threatParam = Number(new URLSearchParams(location.search).get('threat') ?? 1);
  let threatIdx = Number.isInteger(threatParam) ? Math.min(2, Math.max(0, threatParam)) : 1;
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
      // The previous run's last snapshot must not render over the new map:
      // a frame between 'ready' and the first new snapshot would bank a
      // finished run's ore a second time and apply its prospected rocks to
      // the wrong board.
      snap = null;
      clock.reset();
    } else if (m.t === 'snapshot') {
      clock.push(m.s, worldMs);
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
    send({ t: 'init', seed: wantSeed ?? Date.now() % 1_000_000, threatIdx: tIdx, resume, loadout, board: { w: mapX, h: mapY } });
    pendingStart = true; // 'playing' begins on 'ready', not on send
    mirroredSpeed = 1;
  };

  // Boot: an attract-mode run simmers behind the title (paused = board only).
  const urlSeed = Number(new URLSearchParams(location.search).get('seed'));
  send({ t: 'init', seed: Number.isInteger(urlSeed) && urlSeed > 0 ? urlSeed : Date.now() % 1_000_000, threatIdx, board: { w: mapX, h: mapY } });
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
  stripTerm.canvas.style.display = 'block';
  stripTerm.canvas.style.marginTop = '4px';
  leftCol.appendChild(stripTerm.canvas);
  app.appendChild(leftCol);
  app.appendChild(hudTerm.canvas);
  document.body.appendChild(screenTerm.canvas);
  const cap = document.createElement('div');
  cap.className = 'hud';
  cap.textContent = `spleen 5x8 \u2802 ${CELL_W}x${CELL_H} glyph cells \u2802 ${mapX}x${mapY} tiles \u2802 space pauses, 1-4 set speed, N calls the wave, Esc menus \u2802 `;
  const smithLink = document.createElement('a');
  smithLink.href = 'tilesmith.html';
  smithLink.textContent = 'tile smith ->';
  smithLink.style.color = '#4cc9f0';
  cap.appendChild(smithLink);
  leftCol.appendChild(cap);

  // ---- screens -------------------------------------------------------------
  const menuSpec = (): import('@ascii-defense/view').MenuSpec | null => {
    const runSave = loadRunForThisScreen();
    switch (mode) {
      case 'title':
        return {
          title: 'ASCII DEFENSE',
          hero: HERO,
          caption: `spleen 5x8 \u2802 ${CELL_W}x${CELL_H} glyph cells \u2802 ${mapX}x${mapY} tiles`,
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
            { id: 'loadout', label: 'LOADOUT', note: `${setupLoadout.length}/${LOADOUT_SLOTS} special(s) >` },
            { id: 'start', label: 'START RUN' },
            { id: 'back', label: 'BACK' },
          ],
        };
      case 'loadout': {
        // Its own screen (playtest 12, item 1): the pool will not fit a
        // strip, and picking tiles deserves the whole surface. The pool is
        // minted tiles plus the shipped specials, PAGED (playtest 18).
        const minted = loadMintedTiles();
        const problems = loadMintedProblems();
        const pool = [...minted, ...shippedSpecials];
        const pages = Math.max(1, Math.ceil(pool.length / TILES_PER_PAGE));
        const page = Math.min(loadoutPage, pages - 1);
        const shown = pool.slice(page * TILES_PER_PAGE, (page + 1) * TILES_PER_PAGE);
        return {
          title: loadoutDeleteArmed ? 'LOADOUT - DELETE MODE' : 'LOADOUT',
          body: [
            loadoutDeleteArmed
              ? 'click a MINTED tile to remove it permanently (shipped tiles stay)'
              : pool.length > 0
                ? `load up to ${LOADOUT_SLOTS} special tiles - a loaded tile is GUARANTEED on the map`
                : 'no special tiles yet - the tile smith mints them',
            // Tiles the pool holds but cannot offer, and why - never silent.
            ...problems.slice(0, 4).map((p) => `not offered: ${p.id} - ${p.problem}`),
            ...(problems.length > 4 ? [`and ${problems.length - 4} more - fix them in the tile smith`] : []),
          ],
          tiles: shown.map((t) => ({ id: t.id, cells: t.cells, selected: setupLoadout.includes(t.id) })),
          items: [
            ...(pages > 1
              ? [
                  { id: 'page:prev', label: '< PREV PAGE', disabled: page === 0 },
                  { id: 'page:next', label: 'NEXT PAGE >', disabled: page === pages - 1 },
                ]
              : []),
            ...(minted.length > 0
              ? [{ id: 'delmode', label: loadoutDeleteArmed ? 'DONE DELETING' : 'DELETE MINTED TILES' }]
              : []),
            { id: 'back', label: 'DONE' },
          ],
          footer: `${setupLoadout.length}/${LOADOUT_SLOTS} loaded` + (pages > 1 ? ` - page ${page + 1}/${pages}` : ''),
        };
      }
      case 'howto':
        return codexSpec();
      case 'settings':
        return {
          title: 'SETTINGS',
          body: [
            'saves live in this browser; export moves them',
            '',
            'keys: space pause  \u2802  1-4 speed  \u2802  N next wave  \u2802  R rotate a laser',
            'X sell  \u2802  G grid  \u2802  Esc back  \u2802  1/2/3 pick a relic',
          ],
          items: [
            { id: 'motion', label: 'REDUCED MOTION', note: isReducedMotion() ? 'ON' : 'OFF' },
            { id: 'scale', label: 'HUD TEXT SCALE', note: `${meta.settings.hudScale}x - click to switch (reloads)` },
            { id: 'palette', label: 'PALETTE', note: meta.settings.palette === 'colourblind' ? 'COLOURBLIND' : 'DEFAULT' },
            { id: 'sprites', label: 'SPRITE PACK', note: `${(meta.settings.spriteSet ?? 'shipped').toUpperCase()} (reloads)` },
            { id: 'hints', label: 'FIRST-RUN HINTS', note: meta.settings.onboarded ? 'seen - click to show again' : 'ON' },
            { id: 'export', label: 'EXPORT SAVES' },
            { id: 'import', label: 'IMPORT SAVES' },
            { id: 'wipe', label: wipeArmed ? 'CLICK AGAIN TO WIPE' : 'WIPE DATA' },
            { id: 'back', label: 'BACK' },
          ],
        };
      case 'paused':
        return {
          title: 'PAUSED',
          body: [
            `wave ${snap?.hud.wave ?? 0} of ${finalWave} \u2802 seed ${seed}`,
            `run code ${runCode(seed)}`,
          ],
          items: [
            { id: 'resume', label: 'RESUME' },
            { id: 'copycode', label: copyLabel('code', 'COPY RUN CODE') },
            { id: 'copyseed', label: copyLabel('seed', `COPY SEED ${seed}`) },
            { id: 'howto', label: 'HOW TO PLAY' },
            { id: 'settings', label: 'SETTINGS' },
            { id: 'abandon', label: 'SAVE & EXIT TO TITLE' },
          ],
        };
      case 'summary':
        return summary
          ? {
              title: summary.won ? 'THE CORE STANDS' : 'THE CORE HAS FALLEN',
              body: [
                `wave ${summary.wave} of ${finalWave} \u2802 seed ${summary.seed}`,
                `run code ${runCode(summary.seed)}`,
                `kills ${summary.kills}`,
                `ore banked +${summary.oreBanked} (total ${meta.bankedOre})`,
                // The run's story (session 27): who killed, who came, what was held.
                ...(summary.story
                  ? [
                      '',
                      summary.story.killsByTower.length ? 'kills by tower: ' + summary.story.killsByTower.slice(0, 6).map((k) => `${k.name} ${k.kills}`).join(' \u2802 ') : 'no tower killed anything',
                      summary.story.met.length ? 'you met: ' + summary.story.met.map((m) => `${m.count} ${m.name}`).join(', ') : '',
                      summary.story.relics.length ? 'relics held: ' + summary.story.relics.join(', ') : 'no relics held',
                      summary.story.relicUses.length ? 'relic rules fired: ' + summary.story.relicUses.slice(0, 6).map((u) => `${u.name} ${u.uses}`).join(' \u2802 ') : '',
                      '',
                    ].filter((l, i, a) => l !== '' || a[i - 1] !== '')
                  : []),
                'banked ore will buy the workshop tree between runs (not built yet)',
              ],
              items: [
                { id: 'again', label: summary.won ? 'GO AGAIN' : 'TRY AGAIN' },
                { id: 'copycode', label: copyLabel('code', 'COPY RUN CODE') },
                { id: 'copyseed', label: copyLabel('seed', `COPY SEED ${summary.seed}`) },
                { id: 'title', label: 'TITLE' },
              ],
              footer: 'the next run starts where this one taught you',
            }
          : null;
      default:
        return null;
    }
  };

  // The run code (D15): a compact displayed identity - generator version,
  // seed, threat, and a loadout fingerprint (ids + cells, since the pool
  // can change). Display-only for now; when paste-to-replay ships, a code
  // from another generator version is refused loudly, never silently
  // regenerated into a different map.
  const runCode = (forSeed: number): string => {
    const l = lastLoadout.length > 0
      ? fnv1a(lastLoadout.map((t) => `${t.id}:${t.cells.join('/')}`).join('|')).toString(36)
      : '0';
    return `AD${GENERATOR_VERSION}-${forSeed.toString(36)}-${threatIdx}-${l}`.toUpperCase();
  };

  const download = (name: string, text: string): void => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  /** Wrap a sentence to the codex plate's width. */
  const wrapLine = (s: string, w = 64): string[] => {
    const out: string[] = [];
    let line = '';
    for (const word of s.split(' ')) {
      if (word === '') continue;
      if (line !== '' && line.length + 1 + word.length > w) { out.push(line); line = word; }
      else line = line === '' ? word : line + ' ' + word;
    }
    if (line !== '') out.push(line);
    return out;
  };
  /** The codex pages (session 27): basics, then one tower, enemy or relic per page with its sprite as the hero. */
  const codexSpec = (): MenuSpec => {
    const sections: { id: CodexSection; label: string; count: number }[] = [
      { id: 'basics', label: 'BASICS', count: 1 },
      { id: 'towers', label: `TOWERS ${CODEX.towers.length}`, count: CODEX.towers.length },
      { id: 'enemies', label: `ENEMIES ${CODEX.enemies.length}`, count: CODEX.enemies.length },
      { id: 'relics', label: `RELICS ${CODEX.relics.length}`, count: CODEX.relics.length },
    ];
    const count = sections.find((s) => s.id === codexSection)!.count;
    const page = Math.min(codexPage, count - 1);
    let title = 'HOW TO PLAY';
    let hero: Sprite[] = [];
    let body: string[] = [];
    if (codexSection === 'basics') {
      body = [
        'enemies march the road toward the Core at the east edge; if it falls, the run ends.',
        'select ground, then a tower in the strip under the board, to build. hover a button for its card.',
        'towers upgrade in either/or tiers - each fork is two jobs, never two numbers.',
        'refineries on gold veins mine Ore; every 2nd wave offers a relic - rules, not numbers; some relics are passives that work on every tower, twelve slots a run.',
        'the water has business: a chest surfaces on it now and then and sinks after twelve seconds - select it and CLAIM. every reward in the game comes from one loot table, printed in the catalogue.',
        'a held relic is a decision: click it in the strip for its card - salvage it for Ore, or combine two of a kind into the next rarity, or two recipe partners into a fused relic. full slots ask which one a pick replaces; S skips an offer.',
        'rock hides ore and caches; prospecting opens it. R turns a laser. N calls the next wave.',
        ...CODEX.rules,
        'hold to the final wave and THE CORE STANDS.',
      ].flatMap((l) => wrapLine(l));
    } else if (codexSection === 'towers') {
      const t = CODEX.towers[page];
      title = `${t.name.toUpperCase()}  ${page + 1}/${count}`;
      const sp = SPRITES.find((s) => s.id === t.id);
      hero = sp ? [sp] : [];
      body = [
        ...wrapLine(t.desc),
        [t.type ? `type ${t.type}` : '', `cost $${t.cost}`, typeof t.range === 'number' ? `range ${t.range}` : `reach ${t.range}`, t.rate ? `rate ${t.rate}/s` : '', t.dmg ? `dmg ${t.dmg}` : '', t.dps ? `dps ${t.dps}` : ''].filter(Boolean).join('  \u2802  '),
        ...wrapLine(t.shape),
        '',
        ...t.tiers.flatMap((tier, i) => [`T${i + 1}  ${tier[0].name} ($${tier[0].cost})  /  ${tier[1].name} ($${tier[1].cost})`, ...wrapLine('  ' + tier[0].desc), ...wrapLine('  ' + tier[1].desc)]),
        '',
        ...wrapLine(`next to the Core: ${t.coreBoon}`),
      ];
    } else if (codexSection === 'enemies') {
      const e = CODEX.enemies[page];
      title = `${e.name.toUpperCase()}  ${page + 1}/${count}`;
      const sp = SPRITES.find((s) => s.id === `enemy_${e.id}`);
      hero = sp ? [sp] : [];
      body = [
        [`hp ${e.hp}`, `speed ${e.speed} cells/s`, `breach ${e.breach}`, `bounty ${e.bounty}`, `from wave ${e.fromWave}`].join('  \u2802  '),
        [e.armour ? `armour ${e.armour}` : '', e.shield ? `shield ${e.shield}` : '', e.kinetic ? `vs kinetic ${e.kinetic}` : '', e.energy ? `vs energy ${e.energy}` : ''].filter(Boolean).join('  \u2802  ') || 'no armour, no shield, takes every type at x1',
        ...e.traits.flatMap((t) => wrapLine(t)),
      ];
    } else {
      const r = CODEX.relics[page];
      title = `${r.name.toUpperCase()}  ${page + 1}/${count}`;
      const recipesOf = CODEX.recipes.filter((x) => x.a === r.id || x.b === r.id || x.result === r.id);
      const sp = SPRITES.find((s) => s.id === `relic_${r.id}`);
      hero = sp ? [sp] : [];
      body = [
        [r.kind, `base rarity ${r.rarity}`, r.tags.length ? `tags ${r.tags.join(' ')}` : '', r.stacks ? 'stacks' : '', r.recharge ? `recharges in ${r.recharge}` : ''].filter(Boolean).join('  \u2802  '),
        ...wrapLine(r.desc),
        ...(r.rare ? ['', ...wrapLine(`rare: ${r.rare}`)] : []),
        ...(r.epic ? wrapLine(`epic: ${r.epic}`) : []),
        ...(recipesOf.length ? ['', ...recipesOf.flatMap((x) => wrapLine(x.result === r.id ? `reached only by combining ${x.aName} and ${x.bName}` : `combines with ${x.a === r.id ? x.bName : x.aName} into ${x.resultName}: ${x.desc}`))] : []),
      ];
    }
    return {
      title,
      hero,
      body,
      items: [
        ...(count > 1 ? [{ id: 'page:prev', label: '< PREV', disabled: page === 0 }, { id: 'page:next', label: 'NEXT >', disabled: page === count - 1 }] : []),
        ...sections.map((s) => ({ id: `sec:${s.id}`, label: s.label, selected: s.id === codexSection })),
        { id: 'back', label: 'BACK' },
      ],
      footer: 'the same facts as docs/CATALOGUE.md',
    };
  };

  const menuAction = (id: string): void => {
    if (id !== 'wipe') wipeArmed = false;
    if (id.startsWith('threat:')) {
      setupThreat = Number(id.slice('threat:'.length));
      return;
    }
    if (id.startsWith('sec:')) {
      codexSection = id.slice('sec:'.length) as CodexSection;
      codexPage = 0;
      return;
    }
    if (id.startsWith('tile:')) {
      const tid = id.slice('tile:'.length);
      if (loadoutDeleteArmed) {
        // Minted tiles only - shipped specials are assets, not his pool.
        if (!shippedSpecials.some((s) => s.id === tid)) {
          removeMintedTile(tid);
          setupLoadout = setupLoadout.filter((t) => t !== tid);
        }
        return;
      }
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
        loadoutPage = 0;
        loadoutDeleteArmed = false;
        mode = 'loadout';
        break;
      case 'delmode':
        loadoutDeleteArmed = !loadoutDeleteArmed;
        break;
      case 'page:prev':
        if (mode === 'howto') { codexPage = Math.max(0, codexPage - 1); break; }
        loadoutPage = Math.max(0, loadoutPage - 1);
        break;
      case 'page:next':
        if (mode === 'howto') { codexPage = codexPage + 1; break; } // clamped at render
        loadoutPage = loadoutPage + 1; // clamped against the pool at render
        break;
      case 'start': {
        const pool = [...loadMintedTiles(), ...shippedSpecials];
        const defs = setupLoadout
          .map((tid) => pool.find((t) => t.id === tid))
          .filter((t): t is NonNullable<typeof t> => t !== undefined);
        genError = null;
        startRun(setupThreat, undefined, undefined, defs);
        break;
      }
      case 'continue': {
        const r = loadRunForThisScreen();
        if (r.run) startRun(r.run.threatIdx, r.run.seed, r.run);
        break;
      }
      case 'settings': settingsFrom = mode; mode = 'settings'; break;
      case 'howto': howtoFrom = mode; codexSection = 'basics'; codexPage = 0; mode = 'howto'; break;
      case 'back': mode = mode === 'settings' ? settingsFrom : mode === 'howto' ? howtoFrom : mode === 'loadout' ? 'setup' : 'title'; break;
      case 'motion': {
        const v = !isReducedMotion();
        setReducedMotion(v);
        meta.settings.reducedMotion = v;
        saveMeta(meta);
        break;
      }
      case 'scale': {
        // Every terminal is sized at boot; the honest switch is a reload.
        meta.settings.hudScale = meta.settings.hudScale === 2 ? 1 : 2;
        saveMeta(meta);
        location.reload();
        break;
      }
      case 'sprites': {
        meta.settings.spriteSet = (meta.settings.spriteSet ?? 'shipped') === 'reworked' ? 'shipped' : 'reworked';
        saveMeta(meta);
        location.reload();
        break;
      }
      case 'palette': {
        meta.settings.palette = meta.settings.palette === 'colourblind' ? 'default' : 'colourblind';
        setPaletteSet(meta.settings.palette);
        saveMeta(meta);
        break;
      }
      case 'hints': {
        meta.settings.onboarded = !meta.settings.onboarded;
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
      case 'copycode':
      case 'copyseed': {
        // Display is the contract, the clipboard a courtesy - but a courtesy
        // that says when it happened (feedback 2026-09-06: "make it possible
        // to copy those numbers from there").
        const forSeed = mode === 'summary' && summary ? summary.seed : seed;
        const text = id === 'copycode' ? runCode(forSeed) : String(forSeed);
        const what = id === 'copycode' ? 'code' : 'seed';
        void navigator.clipboard?.writeText(text).then(() => { lastCopied = what; setTimeout(() => { if (lastCopied === what) lastCopied = null; }, 2500); }).catch(() => { /* display remains */ });
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
    selectedRelic = null; // the relic card follows the eye (feedback 2026-09-06, item 2)
  });

  hudTerm.canvas.addEventListener('mousemove', (e) => { hudHover = hud.actionAt(e.offsetX, e.offsetY); });
  hudTerm.canvas.addEventListener('mouseleave', () => { hudHover = null; });
  hudTerm.canvas.addEventListener('wheel', (e) => { hud.scrollBy(e.deltaY > 0 ? 2 : -2); e.preventDefault(); }, { passive: false });
  /** One handler for HUD-shaped actions, whichever panel raised them. */
  /** Turn the selected line-shaped tower a quarter clockwise (WBS 2.34); the sim ignores it on radial towers. */
  const rotateSelected = (): void => {
    if (!selected || !snap) return;
    const t = snap.board.towers?.find((tw) => tw.x === selected!.x && tw.y === selected!.y);
    if (!t || t.facing === undefined) return;
    act({ k: 'facing', x: selected.x, y: selected.y, value: (t.facing + 1) % 4 });
  };
  const onHudAction = (action: HudAction): void => {
    if (!snap) return;
    if (action.kind === 'buildId') {
      selectedBuildId = action.id;
      if (selected) act({ k: 'build', x: selected.x, y: selected.y, defId: action.id });
    }
    if (action.kind === 'build') {
      const entry = snap.hud.palette[action.index];
      if (entry?.id) {
        selectedBuildId = entry.id;
        if (selected) act({ k: 'build', x: selected.x, y: selected.y, defId: entry.id });
      }
    }
    if (action.kind === 'priority' && selected) act({ k: 'priority', x: selected.x, y: selected.y, value: action.value });
    if (action.kind === 'rotate' && selected) rotateSelected();
    if (action.kind === 'choose' && selected) act({ k: 'choose', x: selected.x, y: selected.y, tier: action.tier, option: action.option });
    if (action.kind === 'relic') {
      // A pick waiting for the slot it replaces (session 28, PR 3) takes this click.
      if (pendingReplace) { act({ k: 'pickRelic', option: pendingReplace.option, replace: action.index }); pendingReplace = null; return; }
      // The strip's card is always there; the column's only when the face is
      // selected - reading the column alone left a targeted active unarmed
      // (feedback 2026-09-06, item 2).
      const slot = (snap.hud.coreCard ?? snap.hud.core)?.slots[action.index];
      if (slot?.state === 'ready' && slot.targeted && slot.id) targeting = slot.id;
      else if (slot?.state === 'ready' || slot?.state === 'consumable') act({ k: 'slot', index: action.index });
      // A passive or a cooling active opens its card in the column (session 28, PR 3): salvage, combine, its fires.
      else if (slot && slot.state !== 'empty') selectedRelic = selectedRelic === action.index ? null : action.index;
    }
    if (action.kind === 'salvage') { act({ k: 'salvage', index: action.index }); selectedRelic = null; }
    if (action.kind === 'combine') { act({ k: 'combine', a: action.a, b: action.b }); selectedRelic = null; }
    if (action.kind === 'closeRelic') selectedRelic = null;
    if (action.kind === 'forge') { forgeOpen = true; selectedRelic = null; }
    if (action.kind === 'skipOffer') { pendingReplace = null; act({ k: 'skipOffer' }); }
    if (action.kind === 'coreDraw') act({ k: 'buyRelic' });
    if (action.kind === 'openCache' && selected) act({ k: 'openCache', x: selected.x, y: selected.y });
    if (action.kind === 'claimChest' && selected) act({ k: 'claimChest', x: selected.x, y: selected.y });
    if (action.kind === 'prospect' && selected) act({ k: 'prospect', x: selected.x, y: selected.y });
    if (action.kind === 'callWave') act({ k: 'callWave' });
  };
  /** A pick from the standing offer: straight through, or - with the slots full - parked until the player clicks the slot it replaces. */
  const pickFromOffer = (option: number): void => {
    if (!snap?.offer) return;
    if (snap.offer.full) { pendingReplace = { option }; return; }
    act({ k: 'pickRelic', option });
  };
  hudTerm.canvas.addEventListener('click', (e) => {
    if (!inGame()) return;
    const action = hud.actionAt(e.offsetX, e.offsetY);
    if (action) onHudAction(action);
  });
  stripTerm.canvas.addEventListener('mousemove', (e) => { stripHover = strip.actionAt(e.offsetX, e.offsetY); });
  stripTerm.canvas.addEventListener('mouseleave', () => { stripHover = null; });
  stripTerm.canvas.addEventListener('click', (e) => {
    if (!inGame()) return;
    const action = strip.actionAt(e.offsetX, e.offsetY);
    if (action) onHudAction(action);
  });

  screenTerm.canvas.addEventListener('click', (e) => {
    if (!menuSpec() || !FULLSCREEN_MODES.has(mode)) return;
    // Hit-test against the regions of the page actually ON SCREEN: a click
    // that arrives before the next render would otherwise land on the
    // previous page's rows (found by synthetic-click verification).
    if (mode !== renderedMenuMode) return;
    const id = menu.itemAt(e.offsetX, e.offsetY, GLYPH_PX_W * UI_SCALE, GLYPH_PX_H * UI_SCALE);
    if (id) menuAction(id);
  });
  modalTerm.canvas.addEventListener('click', (e) => {
    const spec = menuSpec();
    if (spec) {
      if (FULLSCREEN_MODES.has(mode)) return; // the fullscreen page owns these clicks
      if (mode !== renderedMenuMode) return;
      const id = menu.itemAt(e.offsetX, e.offsetY, GLYPH_PX_W * UI_SCALE, GLYPH_PX_H * UI_SCALE);
      if (id) menuAction(id);
      return;
    }
    if (forgeOpen && !snap?.offer) {
      const a = forgeModal.actionAt(e.offsetX, e.offsetY, GLYPH_PX_W * UI_SCALE, GLYPH_PX_H * UI_SCALE);
      if (a) forgeAct(a);
      return;
    }
    if (snap?.offer) {
      const option = offerModal.optionAt(e.offsetX, e.offsetY, GLYPH_PX_W * UI_SCALE, GLYPH_PX_H * UI_SCALE);
      if (option === -1) { if (snap.offer.kind === 'relic') act({ k: 'rerollOffer' }); }
      else if (option === -2) { pendingReplace = null; act({ k: 'skipOffer' }); }
      else if (option !== null) pickFromOffer(option);
    }
  });
  // The overlay canvas sits over the board; forward hover/board clicks when
  // no screen and no offer is up so it never becomes an invisible wall.
  modalTerm.canvas.style.pointerEvents = 'auto';
  const overlayInert = (): boolean => menuSpec() === null && !snap?.offer && !forgeOpen;
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
        mode = mode === 'settings' ? settingsFrom : mode === 'howto' ? howtoFrom : mode === 'loadout' ? 'setup' : leavingPause ? 'playing' : 'title';
        if (leavingPause) send({ t: 'speed', idx: mirroredSpeed });
      }
      return;
    }
    if (snap?.offer && (e.key === '1' || e.key === '2' || e.key === '3')) {
      pickFromOffer(Number(e.key) - 1);
      return;
    }
    if (snap?.offer && (e.key === 's' || e.key === 'S')) {
      pendingReplace = null;
      act({ k: 'skipOffer' });
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
    if ((e.key === 'r' || e.key === 'R') && selected) rotateSelected();
    if (e.key === 'n' || e.key === 'N') act({ k: 'callWave' }); // the sim refuses when it may not
    if ((e.key === 'x' || e.key === 'X' || e.key === 'Delete') && selected) act({ k: 'sell', x: selected.x, y: selected.y });
    if (selected) {
      const prio = { f: 'first', l: 'last', c: 'closest', w: 'weakest' } as const;
      const p = prio[e.key.toLowerCase() as keyof typeof prio];
      if (p) act({ k: 'priority', x: selected.x, y: selected.y, value: p });
    }
    if (e.key === 'Escape') {
      if (targeting) { targeting = null; return; }
      if (forgeOpen) { forgeOpen = false; forgePicked = [null, null]; return; }
      if (selectedRelic !== null) { selectedRelic = null; return; }
      if (selected) { selected = null; return; }
      // The pause SCREEN pauses the WORLD - a menu over a running sim would
      // be the hidden-tab lie in reverse.
      mode = 'paused';
      send({ t: 'speed', idx: 0 });
    }
  });

  // ---- the frame loop ------------------------------------------------------
  let last = performance.now();
  const frame = (now: number): void => {
    const dt = Math.min(now - last, 250);
    last = now;
    const still = isReducedMotion();
    const speed = snap?.speed ?? 0;
    worldMs += dt * speed;
    const animPhase = still ? 0.25 : (now / 900) % 1;
    const animMs = still ? 0 : worldMs;
    const drift = still ? 0 : Math.floor(worldMs / 1400);

    send({ t: 'frame', ui: { hover, selected, hudHover: hudHover ?? stripHover, targeting, showGrid, selectedRelic } as UiState });

    if (snap && currentMap) {
      // The run ended while playing: bank once, then the summary owns the eye.
      if (snap.status !== 'running' && (mode === 'playing' || mode === 'paused') && !summaryBanked) {
        summaryBanked = true;
        summary = { won: snap.status === 'won', wave: snap.hud.wave, kills: snap.hud.kills, oreBanked: snap.hud.ore, seed, story: snap.story };
        meta.bankedOre += snap.hud.ore;
        meta.history.push({ seed, threat: THREAT_LEVELS[threatIdx].name, wave: snap.hud.wave, status: snap.status, kills: snap.hud.kills });
        if (meta.history.length > 50) meta.history.shift();
        saveMeta(meta);
        try { localStorage.removeItem(RUN_KEY); } catch { /* the run is over either way */ }
        mode = 'summary';
      }

      view.applyCellChanges(snap.cellChanges);
      // The world at a steady render time: walkers and shots between the
      // two snapshots that bracket it, effects aged by the same continuous
      // tick - never ahead of the sim; pause holds everything where it is.
      const renderTick = clock.renderTick(worldMs);
      const pair = clock.bracket(renderTick);
      // Everything that is not a walker or a shot comes from the NEWEST
      // snapshot: towers, the selection, the range preview, cell changes.
      // The bracketed snapshot is a tick behind by design and, while paused,
      // stands still - a build made on pause was invisible until unpause
      // (Daniil, 2026-09-06: 'the screen fails to update my actions').
      const board: RenderState = {
        ...snap.board,
        phase: animPhase,
        animMs,
        drift,
        enemies: pair ? interpolate(pair.a.board.enemies ?? [], pair.b.board.enemies ?? [], pair.alpha, WALKER_MAX_STEP) : snap.board.enemies,
        projectiles: pair ? interpolate(pair.a.board.projectiles ?? [], pair.b.board.projectiles ?? [], pair.alpha, SHOT_MAX_STEP) : snap.board.projectiles,
      };
      view.render(board, (t) => {
        effects.ingest(snap!.events);
        effects.draw(t, pair ? renderTick : snap!.tick);
      });
      // The first run's prompts (WBS 4.23): one at a time, until the third
      // wave is out - then the meta save remembers.
      let prompt = '';
      if (!meta.settings.onboarded && inGame()) {
        const towersBuilt = snap.board.towers?.length ?? 0;
        if (towersBuilt === 0) prompt = 'HINT 1/3: select a ground tile, then click a tower button in the strip under the board. hover a button for its card.';
        else if (snap.hud.wave === 0) prompt = 'HINT 2/3: press N or click CALL WAVE to send the first wave. space pauses; 1-4 set the speed.';
        else if (snap.hud.wave < 3) prompt = 'HINT 3/3: every third wave offers a relic. rock hides ore and caches - select rock to prospect it. the two cells beside the Core face give every tower a gift.';
        else { meta.settings.onboarded = true; saveMeta(meta); }
      }
      const hudState: HudState = {
        ...snap.hud,
        prompt,
        phase: animPhase,
        inspector: view.describeCell(selected ?? hover) + snap.hud.inspector,
        selectedBuild: snap.hud.palette.findIndex((p) => p.id === selectedBuildId),
      };
      hud.render(hudState);
      strip.render({ ...hudState, selectedBuildId });

      // Overlay: a screen, else the offer, else nothing. The HUD hides
      // behind fullscreen menus (playtest 12, item 4) - a menu is not a
      // moment to read tower stats, and the panel pulled the eye.
      const spec = menuSpec();
      const fullscreen = spec !== null && FULLSCREEN_MODES.has(mode);
      hudTerm.canvas.style.visibility = spec && mode !== 'paused' ? 'hidden' : 'visible';
      stripTerm.canvas.style.visibility = spec && mode !== 'paused' ? 'hidden' : 'visible';
      screenTerm.canvas.style.display = fullscreen ? '' : 'none';
      modalTerm.clear();
      renderedMenuMode = spec ? mode : null;
      if (fullscreen) {
        screenTerm.clear();
        menu.render(screenTerm, { ...spec, phase: animPhase });
        screenTerm.flush();
        modalTerm.flush();
        modalTerm.canvas.style.display = '';
      } else if (spec) {
        menu.render(modalTerm, { ...spec, phase: animPhase });
        modalTerm.flush();
        modalTerm.canvas.style.display = '';
      } else if (snap.offer && inGame()) {
        offerModal.render(modalTerm, snap.offer.cards, snap.offer.wave, animPhase, snap.offer.reroll, pendingReplace ? `TAKING CARD ${pendingReplace.option + 1} - click the held relic it replaces (S skips)` : snap.offer.title);
        modalTerm.flush();
        modalTerm.canvas.style.display = '';
      } else if (forgeOpen && inGame()) {
        const st = forgeState();
        if (st) forgeModal.render(modalTerm, st, animPhase);
        modalTerm.flush();
        modalTerm.canvas.style.display = '';
      } else {
        modalTerm.flush();
        modalTerm.canvas.style.display = '';
      }
    }
  };
  // The loop is a thin wrapper so a debug probe can run ONE frame by hand
  // while the pane is hidden (no animation frames fire there; the worker
  // keeps ticking). Two frames a tick, driven by a timer, is the motion
  // check that works unseen.
  const loop = (now: number): void => {
    frame(now);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

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
    relicsHeld: () => debug('relicsHeld'),
    salvage: (index: number) => debug('salvage', index),
    combine: (a: number, b: number) => debug('combine', a, b),
    skipOffer: () => debug('skipOffer'),
    combineTargets: (index: number) => debug('combineTargets', index),
    uses: () => debug('uses'),
    chests: () => debug('chests'),
    surfaceChest: (x: number, y: number) => debug('surfaceChest', x, y),
    claimChest: (x: number, y: number) => debug('claimChest', x, y),
    lootLog: () => debug('lootLog'),
    openRelic: (index: number | null): void => { selectedRelic = index; },
    forge: (open?: boolean): boolean => { if (open !== undefined) { forgeOpen = open; if (!open) forgePicked = [null, null]; } return forgeOpen; },
    forgePick: (index: number): void => forgeAct({ kind: 'held', index }),
    forgeCombine: (): void => forgeAct({ kind: 'combine' }),
    forgeState: () => forgeState(),
    spriteSet: (): { set: string; sprites: number; reworked: number; terrain: boolean } => ({ set: SPRITE_SET, sprites: SPRITES.length, reworked: REWORKED_SPRITES.length, terrain: REWORKED_SPRITES.some((s) => s.id === 'ground_slate') }),
    sets: () => debug('sets'),
    // Debug-only: a relic by id outside any offer (replays diverge), and an active fired at a cell.
    grant: (id: string) => debug('grant', id),
    fire: (id: string, x?: number, y?: number) => debug('fire', id, x, y),
    hash: () => debug('hash'),
    events: () => debug('events'),
    // Effects held vs drawn last frame: the probe for "nothing renders" (feedback 2026-09-06, item 1).
    fx: (): { alive: number; drawn: number } => effects.alive(),
    frame: (now?: number): void => frame(now ?? performance.now()),
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
    // The page on screen: the fullscreen terminal for the shell's pages, the
    // board's modal for the pause overlay and the offer.
    modalText: (): string => (FULLSCREEN_MODES.has(mode) && menuSpec() ? screenTerm : modalTerm).toText(),
    setupState: (): { threat: number; loadout: string[]; genError: string | null } => ({ threat: setupThreat, loadout: [...setupLoadout], genError }),
  };
}

main().catch((e) => {
  document.getElementById('app')!.textContent = `failed: ${String(e)}`;
  console.error(e);
});
