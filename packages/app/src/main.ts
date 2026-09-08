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
import { CORE_STRIP, GENERATOR_VERSION, TILE_SIZE, TileLibrary, fnv1a, relicForWin, RARITIES, resolveUnlocks, whyNot, buyNode, branchNodes, whyNotTile, buyTile, smithOpen, priceTile, validateTileCells, deriveConnectors, mapCells, isRoad } from '@ascii-defense/engine';
import { TUTORIAL_STEPS, goodGround, nearRock, nextStep, type TutorialCtx } from './tutorial';
import type { TreeNode, CellType } from '@ascii-defense/engine';
import type { GeneratedMap, TileDef, MetaState } from '@ascii-defense/engine';
import { loadMintedProblems, loadMintedTiles, removeMintedTile, addMintedTile, libraryTwinOf } from './mintedTiles';
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
  STRIP_ROWS, interpolate, WALKER_MAX_STEP, SHOT_MAX_STEP, RenderClock, setPaletteSet, ForgeModal, setPaletteRoles, setTerrainPack, type TerrainSpritePack, SmithScreen, type SmithState, drawPulseBox, type GlyphRect } from '@ascii-defense/view';
import type { CellRef, HudAction, HudState, RenderState, MenuSpec } from '@ascii-defense/view';
import { validateSprite, validateTree, validateRelics, type Sprite } from '@ascii-defense/content';
import tileLibraryJson from '@ascii-defense/content/assets/tiles/library.json';
import treeJson from '@ascii-defense/content/assets/tree/nodes.json';
import relicsJson from '@ascii-defense/content/assets/relics/pool.json';
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
// The meta tree and the relic pool (session 29, PR 1): the shell reads them to bank a win's relic and to name what is locked.
const TREE = must(validateTree.check(treeJson), 'tree');
const RELIC_POOL = must(validateRelics.check(relicsJson), 'relics').relics;
const TOWER_COUNT = TREE.base.towers!.length + TREE.nodes.reduce((n, x) => n + (x.grants.towers?.length ?? 0), 0);
const SPRITE_JSON = import.meta.glob('../../content/assets/sprites/*.json', { eager: true, import: 'default' }) as Record<string, unknown>;
// The previous pack lives beside the current one (2026-09-06 evening: the
// approved pack became assets/, the old assets became assets-old/, and a
// setting picks either at boot for comparison). A missing folder is an
// empty glob: the current pack.
const PREVIOUS_JSON = import.meta.glob('../../content/assets-old/sprites/*.json', { eager: true, import: 'default' }) as Record<string, unknown>;
const PREVIOUS_PALETTE = import.meta.glob('../../content/assets-old/palette.json', { eager: true, import: 'default' }) as Record<string, { roles?: Record<string, string> }>;
const SPRITE_SET: 'current' | 'previous' = loadMetaFrom(localStorage).meta.settings.spriteSet ?? 'current';
const CURRENT_SPRITES = Object.values(SPRITE_JSON).map((s) => must(validateSprite.check(s), `sprite ${(s as { id?: string }).id ?? '?'}`));
const PREVIOUS_SPRITES = SPRITE_SET === 'previous' ? Object.values(PREVIOUS_JSON).map((s) => must(validateSprite.check(s), `previous sprite ${(s as { id?: string }).id ?? '?'}`)) : [];
// The previous pack first, the current one for anything it lacks.
const SPRITES = SPRITE_SET === 'previous' && PREVIOUS_SPRITES.length > 0
  ? [...PREVIOUS_SPRITES, ...CURRENT_SPRITES.filter((s) => !PREVIOUS_SPRITES.some((r) => r.id === s.id))]
  : CURRENT_SPRITES;
if (SPRITE_SET === 'previous' && PREVIOUS_SPRITES.length > 0) {
  const pal = Object.values(PREVIOUS_PALETTE)[0]?.roles;
  if (pal) setPaletteRoles(pal);
  // The previous pack has no authored terrain: the board falls back to its hashed texture.
  const pack: TerrainSpritePack = {};
  for (const s of PREVIOUS_SPRITES) { if (s.id === 'ground_slate') pack.G = s; if (s.id === 'rock_slate') pack.R = s; if (s.id === 'ore_slate') pack.O = s; }
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
  const FULLSCREEN_MODES = new Set(['title', 'setup', 'loadout', 'howto', 'settings', 'summary', 'workshop', 'history']);
  const offerModal = new OfferModal(new Map(SPRITES.map((s) => [s.id, s])));
  // The Forge (feedback 2026-09-06 evening, item 4): its own window, two slots, one button.
  const forgeModal = new ForgeModal(new Map(SPRITES.map((s) => [s.id, s])));
  let forgeOpen = false;
  let forgePicked: [number | null, number | null] = [null, null];
  const forgeState = (): import('@ascii-defense/view').ForgeState | null => {
    const card = snap?.hud.coreCard;
    if (!card) return null;
    const held = card.slots.map((sl, i) => ({ index: i, name: sl.name, kind: sl.state, rarity: sl.rarity, id: sl.id })).filter((h) => h.kind !== 'empty' && h.kind !== 'locked'); // a locked slot is not a relic (session 29)
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
  // ---- the tutorial (session 31) ------------------------------------------
  // A sequence of things to look at, each a pulsing box on the terminal it
  // lives on and a sentence in the column; the step lives in the meta save.
  let tutStep = 0; // read from the meta save once it loads, below
  let tutNextPressed = false;
  /** The run's cells on the main thread, for the ground and rock the tutorial points at. */
  let tutCells: readonly (string | null)[] = [];
  const tutorialOn = (): boolean => !meta.settings.onboarded && inGame();
  const tutorialAction = (kind: 'tutNext' | 'tutSkip'): void => {
    if (kind === 'tutNext') { tutNextPressed = true; return; }
    meta.settings.onboarded = true;
    saveMeta(meta);
  };
  /** Where the current step's box goes, in the glyphs of the terminal named. */
  const tutorialTarget = (): { term: 'board' | 'hud' | 'strip' | 'modal'; rect: GlyphRect } | null => {
    const step = TUTORIAL_STEPS[tutStep];
    if (!step || !snap || !currentMap) return null;
    const cellRect = (c: CellRef): GlyphRect => ({ x: c.x * CELL_W, y: c.y * CELL_H, w: CELL_W, h: CELL_H });
    switch (step.target) {
      case 'core': {
        const f = currentMap.coreFace;
        if (!f.length) return null;
        const xs = f.map((c) => c.x); const ys = f.map((c) => c.y);
        return { term: 'board', rect: { x: Math.min(...xs) * CELL_W, y: Math.min(...ys) * CELL_H, w: (Math.max(...xs) - Math.min(...xs) + 1) * CELL_W, h: (Math.max(...ys) - Math.min(...ys) + 1) * CELL_H } };
      }
      case 'entry': { const e = snap.board.telegraph?.[0] ?? currentMap.entries[0]; return e ? { term: 'board', rect: cellRect(e) } : null; }
      case 'ground': { const g = goodGround(tutCells, currentMap.cellsW, currentMap.cellsH, currentMap.coreFace, (c) => isRoad(c as import('@ascii-defense/engine').CellType)); return g ? { term: 'board', rect: cellRect(g) } : null; }
      case 'upgrade': {
        // A selected tower: its forks in the card; otherwise the first tower on the board.
        if (snap.hud.selectedTower) { const r = hud.regionOf((a) => a.kind === 'choose'); if (r) return { term: 'hud', rect: { x: 0, y: r.y, w: HUD_COLS - 2, h: r.h } }; }
        const t = snap.board.towers?.[0];
        return t ? { term: 'board', rect: cellRect({ x: t.x, y: t.y }) } : null;
      }
      case 'rock': { const r = nearRock(tutCells, currentMap.cellsW, currentMap.cellsH, currentMap.coreFace, (c) => isRoad(c as import('@ascii-defense/engine').CellType)); return r ? { term: 'board', rect: cellRect(r) } : null; }
      case 'strip:bolt': { const r = strip.regionOf((a) => a.kind === 'buildId' && a.id === 'bolt'); return r ? { term: 'strip', rect: r } : null; }
      case 'strip:wave': return { term: 'strip', rect: strip.lastLayout.wave };
      case 'strip:slots': return strip.lastLayout.slots ? { term: 'strip', rect: strip.lastLayout.slots } : { term: 'strip', rect: strip.lastLayout.core };
      case 'hud:card': { const r = hud.regionOf((a) => a.kind === 'priority' || a.kind === 'choose'); return r ? { term: 'hud', rect: { x: 0, y: Math.max(0, r.y - 7), w: HUD_COLS - 2, h: r.h + 7 } } : null; }
      case 'hud:scrap': return { term: 'hud', rect: { x: 0, y: 2, w: HUD_COLS - 2, h: 2 } };
      case 'hud:call': { const r = hud.regionOf((a) => a.kind === 'callWave'); return r ? { term: 'hud', rect: r } : null; }
      case 'offer': { const b = offerModal.bounds(); return b ? { term: 'modal', rect: b } : null; }
      default: return null;
    }
  };
  // ---- the Tile Smith as a page (session 30, PR 2) ------------------------
  // The same verbs as the standalone tool; the tile lives here, the screen
  // draws it, MINT pays the shared price into the owned pool.
  const smithScreen = new SmithScreen();
  const DEV = new URLSearchParams(location.search).has('dev');
  const BLANK_TILE = ['GGGGG', 'GGGGG', 'GGGGG', 'GGGGG', 'GGGGG'];
  type SmithDeposit = { x: number; y: number; amount: number; tier?: number };
  type SmithBoon = { x: number; y: number; boon: 'range' | 'damage' | 'rate'; tier: 1 | 2 | 3 | 4 };
  let smithCells: string[] = [...BLANK_TILE];
  let smithBrush: CellType = 'G';
  let smithMode: 'cells' | 'overlay' = 'cells';
  let smithTier = 1;
  let smithDeposits: SmithDeposit[] = [];
  let smithBoons: SmithBoon[] = [];
  let smithNote = 'a blank tile: paint roads with the brushes, then MINT';
  const smithUndo: { cells: string[]; deposits: SmithDeposit[]; boons: SmithBoon[] }[] = [];
  let smithPainting = false;
  const smithSnapshot = (): void => { smithUndo.push({ cells: smithCells.slice(), deposits: smithDeposits.map((d) => ({ ...d })), boons: smithBoons.map((b) => ({ ...b })) }); if (smithUndo.length > 60) smithUndo.shift(); };
  const smithId = (): string => { let h = 0x811c9dc5; const t = smithCells.join(''); for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 0x01000193); } return 'tile_' + (h >>> 0).toString(36); };
  const smithTile = (): TileDef => { const t: TileDef = { id: smithId(), cells: [...smithCells] }; if (smithDeposits.length) t.deposits = smithDeposits.map((d) => ({ ...d })) as TileDef['deposits']; if (smithBoons.length) t.boons = smithBoons.map((b) => ({ ...b })) as TileDef['boons']; return t; };
  const smithErrors = (): string[] => {
    const errors = validateTileCells(smithCells);
    const id = smithId();
    const minted = loadMintedTiles();
    if (tileLibraryJson.tiles.some((t) => t.id === id) || minted.some((t) => t.id === id)) errors.push(`'${id}' is already in the pool`);
    const twin = libraryTwinOf(smithCells);
    if (twin && errors.length === 0) errors.push(`this shape is the basic '${twin}' - basics are infinite, no need to mint one`);
    if (smithCells.every((r) => r === 'GGGGG') && errors.length === 0) errors.push('a blank tile is a meadow the game already has');
    return errors;
  };
  const smithState = (phase: number): SmithState => {
    const c = deriveConnectors(smithCells);
    return {
      cells: smithCells, brush: smithBrush, mode: smithMode, veinTier: smithTier, veinTierMax: unlockedNow().oreTierMax,
      deposits: smithDeposits, boons: smithBoons, connectors: { n: c.n, e: c.e, s: c.s, w: c.w },
      errors: smithErrors(), id: smithId(), price: priceTile(smithTile()), ore: meta.ore, canUndo: smithUndo.length > 0, note: smithNote, dev: DEV, phase,
    };
  };
  const smithSetCell = (x: number, y: number, t: string): void => {
    const row = smithCells[y];
    smithCells = smithCells.map((r, i) => (i === y ? row.slice(0, x) + t + row.slice(x + 1) : r));
    smithDeposits = smithDeposits.filter((d) => smithCells[d.y][d.x] === 'O');
    smithBoons = smithBoons.filter((b) => smithCells[b.y][b.x] === 'G');
  };
  const smithAction = (id: string): void => {
    if (id.startsWith('brush:')) { smithBrush = id.slice(6) as CellType; smithMode = 'cells'; return; }
    if (id === 'mode:cells' || id === 'mode:overlay') { smithMode = id === 'mode:cells' ? 'cells' : 'overlay'; return; }
    if (id.startsWith('tier:')) { smithTier = Math.min(unlockedNow().oreTierMax, Number(id.slice(5))); return; }
    if (id === 'undo') { const prev = smithUndo.pop(); if (prev) { smithCells = prev.cells; smithDeposits = prev.deposits; smithBoons = prev.boons; } return; }
    if (id.startsWith('cell:')) {
      const [x, y] = id.slice(5).split(',').map(Number);
      if (smithMode === 'cells') {
        if (smithCells[y][x] === smithBrush) return;
        smithSnapshot();
        smithSetCell(x, y, smithBrush);
      } else {
        const cell = smithCells[y][x];
        if (cell === 'O') {
          smithSnapshot();
          const cur = smithDeposits.find((d) => d.x === x && d.y === y);
          const steps = [30, 60, 90];
          if (!cur) smithDeposits = [...smithDeposits, { x, y, amount: steps[0], tier: smithTier }];
          else { const next = steps[steps.indexOf(cur.amount) + 1]; smithDeposits = next === undefined ? smithDeposits.filter((d) => d !== cur) : smithDeposits.map((d) => (d === cur ? { ...d, amount: next, tier: smithTier } : d)); }
        } else if (cell === 'G') {
          smithSnapshot();
          const cur = smithBoons.find((b) => b.x === x && b.y === y);
          const cycle: SmithBoon['boon'][] = ['range', 'damage', 'rate'];
          if (!cur) smithBoons = [...smithBoons, { x, y, boon: cycle[0], tier: 1 }];
          else { const next = cycle[cycle.indexOf(cur.boon) + 1]; smithBoons = next === undefined ? smithBoons.filter((b) => b !== cur) : smithBoons.map((b) => (b === cur ? { ...b, boon: next } : b)); }
        }
      }
      return;
    }
    if (id === 'mint') {
      const errors = smithErrors();
      if (errors.length) { smithNote = errors[0]; return; }
      const tile = smithTile();
      const price = priceTile(tile);
      if ((meta.ore[price.tier - 1] ?? 0) < price.ore) { smithNote = `needs ${price.ore} tier-${price.tier} ore`; return; }
      meta.ore[price.tier - 1] -= price.ore;
      addMintedTile(tile);
      meta.owned[tile.id] = 1;
      saveMeta(meta);
      smithNote = `minted '${tile.id}' for ${price.ore} tier-${price.tier} ore - it is in the loadout pool now`;
      smithUndo.length = 0;
      smithCells = [...BLANK_TILE]; smithDeposits = []; smithBoons = [];
      return;
    }
    if (id === 'back') { mode = 'workshop'; workshopBranch = 'tiles'; }
  };

  // ---- state ---------------------------------------------------------------
  const { meta, problem: metaProblem } = loadMeta();
  tutStep = meta.settings.tutorialStep ?? 0;
  const runLoad = loadRunForThisScreen();
  let saveProblem = metaProblem ?? runLoad.problem;
  if (meta.settings.reducedMotion !== null) setReducedMotion(meta.settings.reducedMotion);
  setPaletteSet(meta.settings.palette);

  type Mode = 'title' | 'setup' | 'loadout' | 'howto' | 'settings' | 'playing' | 'paused' | 'summary' | 'workshop' | 'history' | 'smith';
  // The workshop (session 29, PR 2; PRD sec 11): the tree's branches as
  // pages, banked Ore as the currency, a node bought with one click.
  type WorkshopPage = TreeNode['branch'] | 'tiles';
  let workshopBranch: WorkshopPage = 'arsenal';
  /** The node last clicked (session 30): its sentence and its reason show in the body; a second click buys. */
  let workshopFocus: string | null = null;
  // The keyboard on every page (session 31; WBS 4.24's other half): the
  // arrows walk the page's clickable rows, Enter clicks the one they are on;
  // the cursor resets when the page changes.
  let menuCursor: string | null = null;
  let menuCursorMode: Mode | null = null;
  const moveCursor = (dir: 1 | -1): void => {
    const ids = menu.itemIds();
    if (ids.length === 0) return;
    const at = menuCursor === null ? -1 : ids.indexOf(menuCursor);
    const next = at === -1 ? (dir === 1 ? 0 : ids.length - 1) : (at + dir + ids.length) % ids.length;
    menuCursor = ids[next];
  };
  const BRANCHES: { id: WorkshopPage; label: string }[] = [
    { id: 'arsenal', label: 'ARSENAL' },
    { id: 'reliquary', label: 'RELIQUARY' },
    { id: 'capacity', label: 'CAPACITY' },
    { id: 'threat', label: 'THREAT' },
    { id: 'ore', label: 'ORE' },
    { id: 'tiles', label: 'TILES' },
  ];
  /** The loadout pool (PRD sec 11.1; session 29, PR 5): minted tiles are always owned; a shipped special only once bought. */
  const ownedSpecials = (): TileDef[] => shippedSpecials.filter((t) => (meta.owned[t.id] ?? 0) > 0);
  /** What the tree has granted, resolved from the meta save as it is NOW (the page after a purchase reads the purchase). */
  const unlockedNow = () => resolveUnlocks(TREE, meta, RELIC_POOL);
  let setupEndless = false;
  /** What each Threat means, in a phrase (session 31): the setup row said only a wave number. */
  const THREAT_HINT = ['fewer fronts, a slow ramp, the tutorial\'s home', 'the game as measured', 'more fronts, shorter roads, a fast ramp'];
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
  // The loadout's slot count is the tree's (session 29, PR 2; PRD sec 11.1: slots are an upgrade).
  const loadoutSlots = (): number => unlockedNow().tileSlots;
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
  let summary: { won: boolean; wave: number; kills: number; oreBanked: number; /** Ore banked by tier (session 29, PR 4). */ oreTiers: number[]; seed: number; story?: FrameSnapshot['story']; /** The relic a win earned (session 29, PR 1), by name; null when nothing was left to earn. */ earned?: string | null; /** The Threat index the run was played at. */ threat?: number } | null = null;
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
      tutCells = mapCells(m.map, lib);
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
  // The tree state a new run starts under (session 29, PR 1): a copy, so the
  // run's identity is fixed at its start whatever the workshop sells later.
  const metaForRun = (): MetaState => ({ unlocks: [...meta.unlocks], earned: [...meta.earned], forged: { ...meta.forged } });
  let lastMeta: MetaState = metaForRun();
  const startRun = (tIdx: number, wantSeed?: number, resume?: RunSave, loadout?: TileDef[], endless?: boolean): void => {
    threatIdx = tIdx;
    lastLoadout = resume?.loadout ?? loadout ?? [];
    lastMeta = resume?.meta ?? metaForRun();
    send({ t: 'init', seed: wantSeed ?? Date.now() % 1_000_000, threatIdx: tIdx, resume, loadout, board: { w: mapX, h: mapY }, meta: lastMeta, endless: resume?.endless ?? endless ?? false });
    pendingStart = true; // 'playing' begins on 'ready', not on send
    mirroredSpeed = 1;
  };

  // Boot: an attract-mode run simmers behind the title (paused = board only).
  const urlSeed = Number(new URLSearchParams(location.search).get('seed'));
  send({ t: 'init', seed: Number.isInteger(urlSeed) && urlSeed > 0 ? urlSeed : Date.now() % 1_000_000, threatIdx, board: { w: mapX, h: mapY }, meta: lastMeta });
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
  // The Tile Smith's door (Daniil, answer 6, 2026-09-06): the link appears
  // only once every tile the workshop sells is owned; until then the caption
  // says what opens it.
  const smithLink = document.createElement('a');
  smithLink.href = 'tilesmith.html';
  smithLink.textContent = 'tile smith ->';
  smithLink.style.color = '#4cc9f0';
  const smithLocked = document.createElement('span');
  smithLocked.style.color = '#4b5a6a';
  cap.appendChild(smithLink);
  cap.appendChild(smithLocked);
  const smithDoor = (): void => {
    const s = smithOpen(TREE, meta.owned);
    smithLink.style.display = s.open ? '' : 'none';
    smithLocked.textContent = s.open ? '' : `tile smith: locked - own every workshop tile to open it (${s.owned}/${s.total})`;
  };
  smithDoor();
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
            ...(!meta.settings.onboarded ? ['new here? NEW RUN starts on Calm with the tutorial: thirteen steps, a box on each thing to look at'] : []),
            '',
            ...(saveProblem ? [`! ${saveProblem}`] : []),
            meta.ore.some((o) => o > 0) ? `banked ore ${meta.ore[0]}${meta.ore[1] > 0 || meta.ore[2] > 0 ? ` \u2802 tier 2: ${meta.ore[1]} \u2802 tier 3: ${meta.ore[2]}` : ''}` : '',
          ].filter((l, i, a) => l !== '' || a[i - 1] !== ''),
          items: [
            { id: 'new', label: 'NEW RUN' },
            { id: 'continue', label: 'CONTINUE', disabled: runSave.run === null, note: runSave.run ? `wave-era tick ${runSave.run.tick}` : runSave.problem ? 'unreadable' : 'no save' },
            { id: 'workshop', label: 'WORKSHOP', note: `${meta.unlocks.length}/${TREE.nodes.length} bought \u2802 ${meta.ore[0]} ore` },
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
            `${THREAT_LEVELS[setupThreat].name.toUpperCase()}: ${THREAT_HINT[setupThreat] ?? ''}`,
            ...(genError ? ['', `! ${genError}`] : []),
          ],
          items: [
            // Threats above the tree's grant are shown locked, never hidden (a visible ladder).
            ...THREAT_LEVELS.map((t, i) => ({
              id: `threat:${i}`,
              label: t.name.toUpperCase(),
              note: i > unlockedNow().threatMax ? 'locked - the workshop opens it' : `to wave ${t.finalWave}`,
              selected: i === setupThreat,
              disabled: i > unlockedNow().threatMax,
            })),
            { id: 'loadout', label: 'LOADOUT', note: loadMintedTiles().length + ownedSpecials().length === 0 ? 'no special tiles yet - the workshop sells them' : `${setupLoadout.length}/${loadoutSlots()} special(s) >` },
            ...(unlockedNow().endless ? [{ id: 'endless', label: 'ENDLESS', note: setupEndless ? 'ON - no final wave, the ramp runs until the Core falls' : 'OFF', selected: setupEndless }] : []),
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
        const pool = [...minted, ...ownedSpecials()];
        const pages = Math.max(1, Math.ceil(pool.length / TILES_PER_PAGE));
        const page = Math.min(loadoutPage, pages - 1);
        const shown = pool.slice(page * TILES_PER_PAGE, (page + 1) * TILES_PER_PAGE);
        return {
          title: loadoutDeleteArmed ? 'LOADOUT - DELETE MODE' : 'LOADOUT',
          body: [
            loadoutDeleteArmed
              ? 'click a MINTED tile to remove it permanently (shipped tiles stay)'
              : pool.length > 0
                ? `load up to ${loadoutSlots()} special tile${loadoutSlots() === 1 ? '' : 's'} - a loaded tile is GUARANTEED on the map`
                : 'no special tiles yet - the workshop sells them, the tile smith mints them',
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
          footer: `${setupLoadout.length}/${loadoutSlots()} loaded` + (pages > 1 ? ` - page ${page + 1}/${pages}` : ''),
        };
      }
      case 'howto':
        return codexSpec();
      case 'workshop': {
        // The tree as pages (session 29, PR 2): one branch at a time, its
        // nodes as rows - the price or the reason it cannot be bought on the
        // right, BOUGHT when it was. The body carries each node's sentence.
        const u = unlockedNow();
        const ore = meta.ore;
        if (workshopBranch === 'tiles') {
          // The tile shop (PRD sec 11.1; session 29, PR 5): the specials the
          // tree has opened, SEEN as previews (sec 4.8), one copy each; a
          // click buys. The Smith's door opens when every one is owned.
          const forSale = shippedSpecials.filter((t) => t.price);
          const smith = smithOpen(TREE, meta.owned);
          return {
            title: 'WORKSHOP - TILES',
            body: [
              `banked ore: ${ore[0]} tier 1 \u2802 ${ore[1]} tier 2 \u2802 ${ore[2]} tier 3`,
              'a bought tile joins the loadout pool; a loaded tile is guaranteed on the map',
              smith.open ? 'every tile is yours: THE TILE SMITH IS OPEN (the link under the board)' : `the tile smith opens when every tile is owned (${smith.owned}/${smith.total})`,
              '',
              ...forSale.map((t) => {
                const why = whyNotTile(u, meta.owned, ore, t);
                return `${t.name ?? t.id}: ${why === null ? `BUY - ${t.price!.ore} tier-${t.price!.tier} ore - click the tile` : why === 'owned' ? 'OWNED' : why}`;
              }),
            ],
            // A vein tile wears its tier as a frame colour (session 30): tier 2 rare-blue, tier 3 epic-purple.
            tiles: forSale.map((t) => { const tier = Math.max(1, ...(t.deposits ?? []).map((d) => d.tier ?? 1)); return { id: t.id, cells: t.cells, selected: (meta.owned[t.id] ?? 0) > 0, tone: tier >= 3 ? 'rarity.epic' : tier === 2 ? 'rarity.rare' : undefined }; }),
            items: [
              { id: 'smith', label: 'THE TILE SMITH', note: smith.open ? 'author a tile >' : `locked - own every tile (${smith.owned}/${smith.total})`, disabled: !smith.open },
              { id: 'br:arsenal', label: 'THE TREE', note: 'back to the branches' },
              { id: 'back', label: 'BACK' },
            ],
            keys: [{ key: 'Esc', does: 'back' }],
            footer: 'a framed tile is owned; a tile carrying a tier-N vein costs tier-(N-1) ore',
          };
        }
        // The tree drawn as a tree (session 30, PR 1): every branch a column
        // of node plates, a node hanging from the one it requires; a first
        // click reads the node into the body, a second buys it.
        const focus = workshopFocus ? TREE.nodes.find((n) => n.id === workshopFocus) : undefined;
        const focusWhy = focus ? whyNot(TREE, meta, meta.ore, focus.id) : null;
        const smith = smithOpen(TREE, meta.owned);
        return {
          title: 'WORKSHOP',
          body: [
            `banked ore: ${ore[0]} tier 1 \u2802 ${ore[1]} tier 2 \u2802 ${ore[2]} tier 3`,
            `towers ${u.towers.size}/${TOWER_COUNT} \u2802 relics in the pool ${u.relics.size}/${RELIC_POOL.length} \u2802 relic slots ${u.relicSlots} \u2802 tile slots ${u.tileSlots} \u2802 tiles owned ${smith.owned}/${smith.total}`,
            '',
            ...(focus
              ? [...wrapLine(`${focus.name.toUpperCase()}: ${focus.desc}`, Math.min(100, screenCols - 12)), focusWhy === 'already bought' ? 'bought' : focusWhy ? `cannot buy yet: ${focusWhy}` : `click it again to buy for ${focus.cost.ore} tier-${focus.cost.tier} ore`]
              : ['click a node to read it; click it again to buy']),
          ],
          columns: BRANCHES.filter((b) => b.id !== 'tiles').map((b) => {
            const nodes = branchNodes(TREE, b.id as TreeNode['branch']);
            return {
              heading: `${b.label} ${nodes.filter((n) => meta.unlocks.includes(n.id)).length}/${nodes.length}`,
              items: nodes.map((n, i) => {
                const why = whyNot(TREE, meta, meta.ore, n.id);
                const bought = meta.unlocks.includes(n.id);
                const prev = nodes[i - 1];
                return {
                  id: `node:${n.id}`,
                  label: n.name,
                  note: bought ? 'BOUGHT' : why === null ? (workshopFocus === n.id ? 'BUY' : `${n.cost.ore} t${n.cost.tier}`) : why.startsWith('needs') && !why.includes('ore') ? 'locked' : `${n.cost.ore} t${n.cost.tier}`,
                  link: prev !== undefined && (n.requires ?? []).includes(prev.id),
                  selected: workshopFocus === n.id,
                  tone: bought ? 'rarity.legendary' : why === null ? undefined : 'ui.dim',
                };
              }),
            };
          }),
          items: [
            { id: 'br:tiles', label: 'TILES', note: `${smith.owned}/${smith.total} owned >` },
            { id: 'history', label: 'RUN HISTORY', note: `${meta.history.length} runs` },
            { id: 'back', label: 'BACK' },
          ],
          keys: [{ key: 'Esc', does: 'back' }],
          footer: 'a node is bought once; a node hangs from the one it needs; higher nodes want rarer ore; wins earn the rarer relics of an open branch',
        };
      }
      case 'history': {
        // Run history (WBS 7.3): the last runs, newest first.
        const rows = [...meta.history].reverse().slice(0, 14);
        // Personal bests (session 31, PR 8; the register since session 29): per Threat, the deepest wave and the most kills.
        const bests = THREAT_LEVELS.map((t) => {
          const runs = meta.history.filter((h) => h.threat === t.name);
          if (runs.length === 0) return null;
          const wave = Math.max(...runs.map((h) => h.wave));
          const kills = Math.max(...runs.map((h) => h.kills));
          const won = runs.filter((h) => h.status === 'won').length;
          return `${t.name.padEnd(8)}  best wave ${String(wave).padStart(2)}  most kills ${String(kills).padStart(4)}  won ${won}/${runs.length}`;
        }).filter((l): l is string => l !== null);
        return {
          title: 'RUN HISTORY',
          body: rows.length
            ? [...bests, '', ...rows.map((h) => `${h.status === 'won' ? 'WON ' : 'lost'}  ${h.threat.padEnd(8)}  wave ${String(h.wave).padStart(2)}  kills ${String(h.kills).padStart(4)}  seed ${h.seed}`)]
            : ['no runs yet'],
          items: [{ id: 'back', label: 'BACK' }],
          footer: `${meta.history.length} runs played \u2802 ${meta.history.filter((h) => h.status === 'won').length} won`,
        };
      }
      case 'settings':
        return {
          title: 'SETTINGS',
          body: ['saves live in this browser; export moves them'],
          // A run's keys only when the page was opened from the pause (session 31: the title's settings listed "next wave").
          keys: settingsFrom === 'paused'
            ? [{ key: 'Space', does: 'pause' }, { key: '1-4', does: 'speed' }, { key: 'N', does: 'next wave' }, { key: 'R', does: 'turn a laser' }, { key: 'X', does: 'sell' }, { key: 'G', does: 'tile seams' }, { key: '1-3', does: 'take a relic' }, { key: 'Esc', does: 'back' }]
            : [{ key: 'Esc', does: 'back' }],
          items: [
            { id: 'motion', label: 'REDUCED MOTION', note: isReducedMotion() ? 'ON' : 'OFF' },
            { id: 'scale', label: 'HUD TEXT SCALE', note: `${meta.settings.hudScale}x - click to switch (reloads)` },
            { id: 'palette', label: 'PALETTE', note: meta.settings.palette === 'colourblind' ? 'COLOURBLIND' : 'DEFAULT' },
            { id: 'sprites', label: 'SPRITE PACK', note: `${(meta.settings.spriteSet ?? 'current').toUpperCase()} (reloads)` },
            { id: 'hints', label: 'TUTORIAL', note: meta.settings.onboarded ? 'done - click to replay it' : `ON - step ${Math.min(TUTORIAL_STEPS.length, tutStep + 1)} of ${TUTORIAL_STEPS.length} - click to turn it off` },
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
            `wave ${snap?.hud.wave ?? 0} of ${finalWave > 0 ? finalWave : 'endless'} \u2802 seed ${seed}`,
            `run code ${runCode(seed)}`,
          ],
          keys: [{ key: 'Esc', does: 'resume' }, { key: 'Space', does: 'pause' }, { key: '1-4', does: 'speed' }, { key: 'N', does: 'next wave' }, { key: '1-3', does: 'take a relic' }, { key: 'S', does: 'skip an offer' }, { key: 'R', does: 'turn a laser' }, { key: 'X', does: 'sell' }, { key: 'G', does: 'tile seams' }],
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
                `wave ${summary.wave} of ${finalWave > 0 ? finalWave : 'endless'} \u2802 seed ${summary.seed}`,
                `run code ${runCode(summary.seed)}`,
                `kills ${summary.kills}`,
                `ore banked +${summary.oreBanked} (total ${meta.ore[0]})` + (summary.oreTiers.slice(1).some((o) => o > 0) ? ` \u2802 tier 2 +${summary.oreTiers[1]} (${meta.ore[1]}) \u2802 tier 3 +${summary.oreTiers[2]} (${meta.ore[2]})` : ''),
                // A win earns a relic of the Threat's rarity (session 29, PR 1; PRD sec 19 item 3).
                ...(summary.won ? [summary.earned ? `earned: ${summary.earned} - it joins the pool from the next run` : summary.threat === 0 ? 'Calm banks Ore; a win on Standard earns a relic, on Grim an epic one' : 'nothing left to earn at this threat - the workshop opens more branches'] : []),
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
                'the WORKSHOP spends banked ore on towers, relic branches, slots and tiles',
              ],
              items: [
                { id: 'again', label: summary.won ? 'GO AGAIN' : 'TRY AGAIN' },
                { id: 'workshop', label: 'WORKSHOP', note: `spend ${meta.ore[0]} ore >` },
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
  // seed, threat, a loadout fingerprint (ids + cells, since the pool can
  // change) and, since session 29 PR 1, a fingerprint of the tree state the
  // run started under (the pool, the slots and the caps are part of what
  // the run IS; PRD sec 12). Display-only for now; when paste-to-replay
  // ships, a code from another generator version is refused loudly, never
  // silently regenerated into a different map.
  const runCode = (forSeed: number): string => {
    const l = lastLoadout.length > 0
      ? fnv1a(lastLoadout.map((t) => `${t.id}:${t.cells.join('/')}`).join('|')).toString(36)
      : '0';
    const m = fnv1a([...lastMeta.unlocks].sort().join(',') + '|' + [...lastMeta.earned].sort().join(',') + '|' + Object.entries(lastMeta.forged).sort().map(([k, v]) => `${k}=${v}`).join(',')).toString(36);
    return `AD${GENERATOR_VERSION}-${forSeed.toString(36)}-${threatIdx}-${l}-${m}`.toUpperCase();
  };

  const download = (name: string, text: string): void => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  /** Wrap a sentence to the codex plate's width. */
  const wrapLine = (s: string, w = Math.min(64, screenCols - 12)): string[] => {
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
        'refineries on gold veins mine Ore, by tier; every 2nd wave, once the board is quiet, offers a relic - rules, not numbers; some relics are passives that work on every tower.',
        'between runs the WORKSHOP spends banked Ore on the tree: towers, relic branches, slots, threats, vein tiles. locked towers and relics stay in this codex, marked LOCKED with what opens them; wins earn the rarer relics of an open branch.',
        'a chest surfaces on the water or on empty ground now and then and sinks after twelve seconds - select it and CLAIM; a rarer chest pays more. every reward in the game comes from one loot table, printed in the catalogue.',
        'a held relic is a decision: click it in the strip for its card - salvage it for Ore, or combine two of a kind into the next rarity, or two recipe partners into a fused relic. full slots ask which one a pick replaces; S skips an offer.',
        'rock hides ore and caches; prospecting opens it. R turns a laser. N calls the next wave.',
        ...CODEX.rules,
        'hold to the final wave and THE CORE STANDS.',
      ].flatMap((l) => wrapLine(l));
    } else if (codexSection === 'towers') {
      const t = CODEX.towers[page];
      // Locked entries are shown locked, never hidden (session 29, PR 7; thought dump item 15): the node that opens it is named.
      const lockedBy = unlockedNow().towers.has(t.id) ? null : TREE.nodes.find((n) => n.grants.towers?.includes(t.id));
      title = `${t.name.toUpperCase()}  ${page + 1}/${count}` + (lockedBy ? '  - LOCKED' : '');
      const sp = SPRITES.find((s) => s.id === t.id);
      hero = sp ? [sp] : [];
      body = [
        ...(lockedBy ? [`LOCKED - the workshop's ARSENAL branch opens it: ${lockedBy.name} (${lockedBy.cost.ore} tier-${lockedBy.cost.tier} ore)`, ''] : []),
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
      const recipesOf = CODEX.recipes.filter((x) => x.a === r.id || x.b === r.id || x.result === r.id);
      const sp = SPRITES.find((s) => s.id === `relic_${r.id}`);
      // A fusion not yet discovered keeps its secret (item 23): the name, the partners and the rule stay hidden until fused once.
      const undiscovered = r.fusionOnly && !meta.discovered.includes(r.id);
      // A locked relic says what opens it (item 15): a branch of the workshop, or the win that earns it.
      const u = unlockedNow();
      const lockReason = r.fusionOnly || u.relics.has(r.id) ? null
        : !r.tags.some((t) => u.relicTags.has(t)) ? `the workshop's RELIQUARY branch: ${r.tags.map((t) => TREE.nodes.find((n) => n.grants.relicTags?.includes(t))?.name ?? t).join(' or ')}`
          : r.rarity === 'rare' ? 'earned by a win at Standard or above' : r.rarity === 'epic' ? 'earned by a win at Grim' : 'the workshop';
      if (undiscovered) {
        title = `???  ${page + 1}/${count}`;
        hero = [];
        body = ['a fused relic not yet discovered - two held relics of a recipe pair combine into it in the Forge', `${meta.discovered.length} of ${CODEX.relics.filter((x) => x.fusionOnly).length} fusions discovered`];
      } else {
        title = `${r.name.toUpperCase()}  ${page + 1}/${count}` + (lockReason ? '  - LOCKED' : '');
        hero = sp ? [sp] : [];
        body = [
          ...(lockReason ? [`LOCKED - ${lockReason}`, ''] : []),
          ...(r.fusionOnly ? ['DISCOVERED - fused at least once', ''] : []),
          [r.kind, `base rarity ${r.rarity}`, r.tags.length ? `tags ${r.tags.join(' ')}` : '', r.stacks ? 'stacks' : '', r.recharge ? `recharges in ${r.recharge}` : ''].filter(Boolean).join('  \u2802  '),
          ...wrapLine(r.desc),
          ...(r.rare ? ['', ...wrapLine(`rare: ${r.rare}`)] : []),
          ...(r.epic ? wrapLine(`epic: ${r.epic}`) : []),
          ...(r.legendary ? wrapLine(`legendary (forge two epics): ${r.legendary}`) : []),
          ...(recipesOf.length ? ['', ...recipesOf.flatMap((x) => wrapLine(x.result === r.id ? `reached only by combining ${x.aName} and ${x.bName}` : `combines with ${x.a === r.id ? x.bName : x.aName} into ${x.resultName}: ${x.desc}`))] : []),
        ];
      }
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
    if (id.startsWith('br:')) {
      workshopBranch = id.slice('br:'.length) as WorkshopPage;
      return;
    }
    if (id.startsWith('tile:') && mode === 'workshop') {
      // A purchase (session 29, PR 5): pure in the engine, saved here; the Smith's door follows.
      const t = shippedSpecials.find((x) => x.id === id.slice('tile:'.length));
      const bought = t ? buyTile(unlockedNow(), meta.owned, meta.ore, t) : null;
      if (bought) {
        meta.owned = bought.owned;
        meta.ore = bought.ore;
        saveMeta(meta);
        smithDoor();
      }
      return;
    }
    if (id.startsWith('node:')) {
      // First click reads the node (session 30); the second buys it - pure in the engine, saved here.
      const nid = id.slice('node:'.length);
      if (workshopFocus !== nid) { workshopFocus = nid; return; }
      const bought = buyNode(TREE, meta, meta.ore, nid);
      if (bought) {
        meta.unlocks = [...bought.meta.unlocks];
        meta.ore = bought.ore;
        saveMeta(meta);
      }
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
      else if (setupLoadout.length < loadoutSlots()) setupLoadout = [...setupLoadout, tid];
      return;
    }
    switch (id) {
      case 'new':
        // A first run is Calm (session 31): the tutorial walks it, and the base world's towers hold it.
        setupThreat = !meta.settings.onboarded && !meta.history.some((h) => h.status === 'won') ? 0 : threatIdx;
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
        const pool = [...loadMintedTiles(), ...ownedSpecials()];
        const defs = setupLoadout
          .map((tid) => pool.find((t) => t.id === tid))
          .filter((t): t is NonNullable<typeof t> => t !== undefined);
        genError = null;
        startRun(setupThreat, undefined, undefined, defs, setupEndless);
        break;
      }
      case 'continue': {
        const r = loadRunForThisScreen();
        if (r.run) startRun(r.run.threatIdx, r.run.seed, r.run);
        break;
      }
      case 'settings': settingsFrom = mode; mode = 'settings'; break;
      case 'howto': howtoFrom = mode; codexSection = 'basics'; codexPage = 0; mode = 'howto'; break;
      case 'back': mode = mode === 'settings' ? settingsFrom : mode === 'howto' ? howtoFrom : mode === 'loadout' ? 'setup' : mode === 'history' ? 'workshop' : 'title'; break;
      case 'workshop': mode = 'workshop'; break;
      case 'smith': if (smithOpen(TREE, meta.owned).open || DEV) { mode = 'smith'; smithNote = 'a blank tile: paint roads with the brushes, then MINT'; } break;
      case 'history': mode = 'history'; break;
      case 'endless': setupEndless = !setupEndless; break;
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
        meta.settings.spriteSet = (meta.settings.spriteSet ?? 'current') === 'previous' ? 'current' : 'previous';
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
        if (!meta.settings.onboarded) { tutStep = 0; meta.settings.tutorialStep = 0; }
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
      case 'again': startRun(threatIdx, undefined, undefined, lastLoadout, setupEndless); break;
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
    if (action.kind === 'tutNext' || action.kind === 'tutSkip') tutorialAction(action.kind);
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

  // The Smith paints by click and by drag (cells mode); every other click is a plate.
  screenTerm.canvas.addEventListener('mousedown', (e) => {
    if (mode !== 'smith') return;
    smithPainting = true;
    const id = smithScreen.itemAt(e.offsetX, e.offsetY, GLYPH_PX_W * UI_SCALE, GLYPH_PX_H * UI_SCALE);
    if (id?.startsWith('cell:') && smithMode === 'cells') smithAction(id);
  });
  screenTerm.canvas.addEventListener('mousemove', (e) => {
    if (mode !== 'smith' || !smithPainting || smithMode !== 'cells') return;
    const id = smithScreen.itemAt(e.offsetX, e.offsetY, GLYPH_PX_W * UI_SCALE, GLYPH_PX_H * UI_SCALE);
    if (id?.startsWith('cell:')) smithAction(id);
  });
  window.addEventListener('mouseup', () => { smithPainting = false; });
  screenTerm.canvas.addEventListener('click', (e) => {
    if (mode === 'smith') {
      const id = smithScreen.itemAt(e.offsetX, e.offsetY, GLYPH_PX_W * UI_SCALE, GLYPH_PX_H * UI_SCALE);
      // A cell click in cells mode was painted on mousedown already.
      if (id && !(id.startsWith('cell:') && smithMode === 'cells')) smithAction(id);
      return;
    }
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
      if (mode === 'smith') {
        if (e.key === 'Escape') smithAction('back');
        if (e.ctrlKey && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); smithAction('undo'); }
        return;
      }
      // Any page with rows: the arrows and Enter (session 31).
      if (menuSpec()) {
        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); moveCursor(1); return; }
        if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); moveCursor(-1); return; }
        if (e.key === 'Enter' && menuCursor !== null && menu.itemIds().includes(menuCursor)) { e.preventDefault(); menuAction(menuCursor); return; }
      }
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
    if (e.key === 'Enter' && tutorialOn()) tutorialAction('tutNext');
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
        const tiers = snap.hud.oreTiers ?? [snap.hud.ore];
        summary = { won: snap.status === 'won', wave: snap.hud.wave, kills: snap.hud.kills, oreBanked: snap.hud.ore, oreTiers: [...tiers], seed, story: snap.story, threat: threatIdx };
        // Banked BY TIER (session 29, PR 4): a tier-2 vein pays into the tier-2 purse.
        for (let i = 0; i < meta.ore.length; i++) meta.ore[i] += tiers[i] ?? 0;
        // What the run leaves behind for the tree (session 29, PR 1): the
        // rarities forged, the fusions found, and a win's relic.
        for (const f of snap.story?.forged ?? []) meta.forged[f.id] = Math.max(meta.forged[f.id] ?? 0, f.rarity);
        for (const id of snap.story?.fused ?? []) if (!meta.discovered.includes(id)) meta.discovered.push(id);
        if (snap.status === 'won') {
          const id = relicForWin(TREE, lastMeta, RELIC_POOL, threatIdx, seed);
          if (id && !meta.earned.includes(id)) meta.earned.push(id);
          const def = id ? RELIC_POOL.find((r) => r.id === id) : undefined;
          summary.earned = def ? `${def.name} (${RARITIES.indexOf(def.rarity) >= 0 ? def.rarity : 'common'})` : null;
        }
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
      // The tutorial (session 31; it replaced the three hints of WBS 4.23):
      // the step advances on the player's action or on NEXT, its sentence is
      // the column's prompt, its target a pulsing box; the meta save keeps
      // the step and, at the end, the fact that it is done.
      let prompt = '';
      let promptButtons: HudState['promptButtons'];
      let tutTarget: ReturnType<typeof tutorialTarget> = null;
      if (tutorialOn()) {
        const ctx: TutorialCtx = {
          towers: snap.board.towers?.length ?? 0, wave: snap.hud.wave, relics: snap.hud.relicCount, offerUp: snap.offer !== null,
          selected, selectedBuildable: snap.board.selectedBuildable === true, towerSelected: snap.hud.selectedTower !== null && snap.hud.selectedTower !== undefined, next: tutNextPressed,
          upgrades: (snap.board.towers ?? []).filter((t) => (t.choices?.[0] ?? -1) >= 0).length,
        };
        tutNextPressed = false;
        const advanced = nextStep(tutStep, ctx);
        if (advanced !== tutStep) { tutStep = advanced; meta.settings.tutorialStep = advanced; saveMeta(meta); }
        if (tutStep >= TUTORIAL_STEPS.length) { meta.settings.onboarded = true; saveMeta(meta); }
        else {
          const step = TUTORIAL_STEPS[tutStep];
          prompt = `TUTORIAL ${tutStep + 1}/${TUTORIAL_STEPS.length}: ${step.text}`;
          promptButtons = { next: step.needsNext };
          tutTarget = tutorialTarget();
        }
      }
      view.render(board, (t) => {
        effects.ingest(snap!.events);
        effects.draw(t, pair ? renderTick : snap!.tick);
        if (tutTarget?.term === 'board') drawPulseBox(t, tutTarget.rect, animPhase);
      });
      const hudState: HudState = {
        ...snap.hud,
        prompt,
        promptButtons,
        phase: animPhase,
        inspector: view.describeCell(selected ?? hover) + snap.hud.inspector,
        selectedBuild: snap.hud.palette.findIndex((p) => p.id === selectedBuildId),
      };
      hud.render(hudState);
      strip.render({ ...hudState, selectedBuildId });
      // The tutorial's box on the panel it points at, after the panel drew (a second flush is cheap).
      if (tutTarget?.term === 'hud') { drawPulseBox(hudTerm, tutTarget.rect, animPhase, 'x'); hudTerm.flush(); }
      if (tutTarget?.term === 'strip') { drawPulseBox(stripTerm, tutTarget.rect, animPhase, 'x'); stripTerm.flush(); }

      // Overlay: a screen, else the offer, else nothing. The HUD hides
      // behind fullscreen menus (playtest 12, item 4) - a menu is not a
      // moment to read tower stats, and the panel pulled the eye.
      const spec = menuSpec();
      if (mode !== menuCursorMode) { menuCursor = null; menuCursorMode = mode; }
      const smithPage = mode === 'smith';
      const fullscreen = (spec !== null && FULLSCREEN_MODES.has(mode)) || smithPage;
      hudTerm.canvas.style.visibility = (spec || smithPage) && mode !== 'paused' ? 'hidden' : 'visible';
      stripTerm.canvas.style.visibility = (spec || smithPage) && mode !== 'paused' ? 'hidden' : 'visible';
      screenTerm.canvas.style.display = fullscreen ? '' : 'none';
      modalTerm.clear();
      renderedMenuMode = spec || smithPage ? mode : null;
      if (smithPage) {
        screenTerm.clear();
        smithScreen.render(screenTerm, smithState(animPhase));
        screenTerm.flush();
        modalTerm.flush();
        modalTerm.canvas.style.display = '';
      } else if (fullscreen && spec) {
        screenTerm.clear();
        menu.render(screenTerm, { ...spec, phase: animPhase, cursor: menuCursor ?? undefined });
        screenTerm.flush();
        modalTerm.flush();
        modalTerm.canvas.style.display = '';
      } else if (spec) {
        menu.render(modalTerm, { ...spec, phase: animPhase, cursor: menuCursor ?? undefined });
        modalTerm.flush();
        modalTerm.canvas.style.display = '';
      } else if (snap.offer && inGame()) {
        offerModal.render(modalTerm, snap.offer.cards, snap.offer.wave, animPhase, snap.offer.reroll, pendingReplace ? `TAKING CARD ${pendingReplace.option + 1} - click the held relic it replaces (S skips)` : snap.offer.title);
        if (tutTarget?.term === 'modal') { const b = offerModal.bounds(); if (b) drawPulseBox(modalTerm, b, animPhase); }
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
    pool: () => debug('pool'), // the run's relic pool as the tree dealt it (session 29, PR 1)
    meta: (): MetaSave => meta,
    // The workshop, driven a level below the click (session 29, PR 2): buy a node, read what is unlocked.
    buy: (id: string): boolean => { const b = buyNode(TREE, meta, meta.ore, id); if (b) { meta.unlocks = [...b.meta.unlocks]; meta.ore = b.ore; saveMeta(meta); } return b !== null; },
    unlocked: () => { const u = unlockedNow(); return { towers: [...u.towers], relics: u.relics.size, relicSlots: u.relicSlots, threatMax: u.threatMax, tileSlots: u.tileSlots, endless: u.endless, everything: u.everything }; },
    bank: (ore: number[]): void => { meta.ore = [...ore]; saveMeta(meta); },
    buyTile: (id: string): boolean => { const t = shippedSpecials.find((x) => x.id === id); const b = t ? buyTile(unlockedNow(), meta.owned, meta.ore, t) : null; if (b) { meta.owned = b.owned; meta.ore = b.ore; saveMeta(meta); smithDoor(); } return b !== null; },
    smith: () => ({ ...smithOpen(TREE, meta.owned), linkShown: smithLink.style.display !== 'none', caption: smithLocked.textContent }),
    relicsHeld: () => debug('relicsHeld'),
    salvage: (index: number) => debug('salvage', index),
    combine: (a: number, b: number) => debug('combine', a, b),
    skipOffer: () => debug('skipOffer'),
    combineTargets: (index: number) => debug('combineTargets', index),
    uses: () => debug('uses'),
    chests: () => debug('chests'),
    surfaceChest: (x: number, y: number, rarity = 0) => debug('surfaceChest', x, y, rarity),
    killAll: () => debug('killAll'),
    choose: (x: number, y: number, tier: number, option: number) => debug('choose', x, y, tier, option),
    sell: (x: number, y: number) => debug('sell', x, y),
    stats: (x: number, y: number) => debug('stats', x, y),
    claimChest: (x: number, y: number) => debug('claimChest', x, y),
    lootLog: () => debug('lootLog'),
    openRelic: (index: number | null): void => { selectedRelic = index; },
    forge: (open?: boolean): boolean => { if (open !== undefined) { forgeOpen = open; if (!open) forgePicked = [null, null]; } return forgeOpen; },
    forgePick: (index: number): void => forgeAct({ kind: 'held', index }),
    forgeCombine: (): void => forgeAct({ kind: 'combine' }),
    forgeState: () => forgeState(),
    spriteSet: (): { set: string; sprites: number; previous: number; terrain: boolean } => ({ set: SPRITE_SET, sprites: SPRITES.length, previous: PREVIOUS_SPRITES.length, terrain: SPRITES.some((s) => s.id === 'ground_slate') }),
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
    tutorial: (): { step: number; id: string | null; target: ReturnType<typeof tutorialTarget> } => ({ step: tutStep, id: TUTORIAL_STEPS[tutStep]?.id ?? null, target: tutorialTarget() }),
    boardText: (): string => term.toText(),
    stripText: (): string => stripTerm.toText(),
    select: (x: number, y: number): void => { selected = { x, y }; },
    mode: (m?: Mode): Mode => { if (m) mode = m; return mode; },
    motion: (reduced: boolean): void => { setReducedMotion(reduced); },
    // Menu verification (2.21): drive the same menuAction the click path
    // calls, one level below the pixel hit-test. modalText shows what the
    // player would see (CONTRIBUTING: toText over screenshots).
    menu: (id: string): void => { menuAction(id); },
    // The page on screen: the fullscreen terminal for the shell's pages, the
    // board's modal for the pause overlay and the offer.
    modalText: (): string => (mode === 'smith' || (FULLSCREEN_MODES.has(mode) && menuSpec()) ? screenTerm : modalTerm).toText(),
    // The Smith (session 30, PR 2): open the page past the door, act by id, read the state.
    smithPage: (): void => { mode = 'smith'; },
    smithDo: (id: string): void => smithAction(id),
    smithState: () => { const s = smithState(0); return { cells: s.cells, brush: s.brush, mode: s.mode, errors: s.errors, id: s.id, price: s.price, deposits: s.deposits, boons: s.boons, note: s.note, connectors: s.connectors }; },
    setupState: (): { threat: number; loadout: string[]; genError: string | null } => ({ threat: setupThreat, loadout: [...setupLoadout], genError }),
  };
}

main().catch((e) => {
  document.getElementById('app')!.textContent = `failed: ${String(e)}`;
  console.error(e);
});
