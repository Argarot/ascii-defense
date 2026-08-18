/**
 * Tile Smith: author terrain tiles with the game's legality rules baked in.
 *
 * The verdict and the export gate both come from engine validateTileCells -
 * the same function the game and the content CI run - so a tile this tool
 * exports cannot be invalid, and a rule change in the engine changes this
 * tool on the next build with zero effort.
 *
 * Brushes are EXPLICIT segment types in a 4x4 matrix (2.23, Daniil's layout):
 * what you click is what you place, no inference anywhere. Inference was
 * tried and reversed - it derives ports from adjacency, so two touching
 * same-lane cells always merge, which destroys the one property (touch
 * without merge) the port model exists for. The matrix mirrors the shapes:
 * the road block composes into a box (F T 7 / E X 3 / L U J) with the
 * straights and the bridge in the fourth column, terrain beneath.
 */
import { GLTerm } from '@ascii-defense/render';
import type { GlyphSet } from '@ascii-defense/render';
import {
  TILE_SIZE,
  deriveConnectors,
  segmentRimMask,
  validateTileCells,
  type CellType,
} from '@ascii-defense/engine';
import { CELL_W, CELL_H, drawTerrainCell, role } from '@ascii-defense/view';
import tileLibraryJson from '@ascii-defense/content/assets/tiles/library.json';
import { addMintedTile, loadMintedTiles } from './mintedTiles';

const BASE = import.meta.env.BASE_URL;
const ASSET_V = '5';
const load = <T>(p: string): Promise<T> =>
  fetch(`${BASE}assets/${p}?v=${ASSET_V}`).then((r) => r.json() as Promise<T>);

/** Daniil's matrix: the road block reads as a box, terrain under it. */
const BRUSH_GRID: CellType[][] = [
  ['F', 'T', '7', '|'],
  ['E', 'X', '3', '-'],
  ['L', 'U', 'J', 'B'],
  ['G', 'R', 'O', 'C'],
];

const ZOOM_W = 10; // px per glyph at the smith's 2x zoom
const ZOOM_H = 16;
const CELL_PX_W = ZOOM_W * CELL_W;
const CELL_PX_H = ZOOM_H * CELL_H;

// Buttons stay BUTTONS (Daniil, mock review round 2): a schematic glyph per
// brush - the box-drawing shape it places - while the tile preview is where
// the actual sprites live. The first sprite-palette attempt inverted that.
const BRUSH_GLYPH: Record<string, string> = {
  F: '\u250c', T: '\u252c', '7': '\u2510', '|': '\u2502',
  E: '\u251c', X: '\u253c', '3': '\u2524', '-': '\u2500',
  L: '\u2514', U: '\u2534', J: '\u2518', B: '\u256b',
  G: 'G', R: 'R', O: 'O', C: 'C',
};
const BRUSH_ACCENT: Record<string, string> = {
  B: '#6f89a5', G: '#3d4f61', R: '#5a6a7c', O: '#ffd15c', C: '#2bbfae',
};
const ROAD_ACCENT = '#86a0bc';

/** Hover names; the \u256b button needs words the glyph alone cannot carry. */
const BRUSH_NAME: Record<string, string> = {
  '-': 'road \u00b7 east-west',
  '|': 'road \u00b7 north-south',
  L: 'road \u00b7 bends north-east',
  J: 'road \u00b7 bends north-west',
  F: 'road \u00b7 bends south-east',
  '7': 'road \u00b7 bends south-west',
  T: 'T-junction \u00b7 stem south',
  U: 'T-junction \u00b7 stem north',
  E: 'T-junction \u00b7 opens east',
  '3': 'T-junction \u00b7 opens west',
  X: 'crossroads \u00b7 joins all sides',
  B: 'bridge \u00b7 two roads cross here and never merge \u00b7 deck runs east-west, the other road passes under',
  G: 'ground',
  R: 'rock',
  O: 'ore',
  C: 'core',
};

let cells: string[] = ['GGGGG', 'GGGGG', 'GGGGG', 'GGGGG', 'GGGGG'];
let brush: CellType = 'G'; // ground default: nothing paints by surprise (playtest 10)
const undoStack: string[][] = [];

function setCell(x: number, y: number, t: string): void {
  const row = cells[y];
  cells = cells.map((r, i) => (i === y ? row.slice(0, x) + t + row.slice(x + 1) : r));
}

async function main(): Promise<void> {
  const glyphs = await load<GlyphSet>('glyphset-spleen.json');
  const app = document.getElementById('app')!;

  // ---- left column: editor -------------------------------------------------
  const left = document.createElement('div');
  left.className = 'col';
  left.innerHTML = `
    <div>
      <h1>TILE SMITH</h1>
      <div class="sub">what you click is what you place \u00b7 the export button obeys the same rules the game does \u00b7 <a href="./">back to the board</a></div>
    </div>`;

  // The brush matrix: plain buttons in Daniil's 4x4 layout, one schematic
  // box-drawing glyph each. Rows 1-3 are the road block (it composes into a
  // box figure), row 4 is terrain; the two gutter labels are the only text.
  const palWrap = document.createElement('div');
  palWrap.className = 'palette';
  const palLabels = document.createElement('div');
  palLabels.className = 'pal-labels';
  palLabels.innerHTML =
    '<div style="flex: 3">roads</div>' +
    '<div style="flex: 1">terrain</div>';
  const palGrid = document.createElement('div');
  palGrid.className = 'pal-grid';
  const brushBtns = new Map<CellType, HTMLButtonElement>();
  for (const row of BRUSH_GRID)
    for (const t of row) {
      const b = document.createElement('button');
      b.className = 'brush';
      b.innerHTML = `<span class="glyph">${BRUSH_GLYPH[t]}</span>`;
      b.title = BRUSH_NAME[t];
      b.style.borderTop = `3px solid ${BRUSH_ACCENT[t] ?? ROAD_ACCENT}`;
      b.addEventListener('click', () => {
        brush = t;
        update();
      });
      brushBtns.set(t, b);
      palGrid.appendChild(b);
    }
  palWrap.appendChild(palLabels);
  palWrap.appendChild(palGrid);
  left.appendChild(palWrap);

  const undoRow = document.createElement('div');
  undoRow.className = 'actions';
  const undoBtn = document.createElement('button');
  undoBtn.textContent = '\u27f2 UNDO';
  undoBtn.addEventListener('click', () => {
    const prev = undoStack.pop();
    if (prev) {
      cells = prev.slice();
      update();
    }
  });
  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'z') {
      e.preventDefault();
      undoBtn.click();
    }
  });
  undoRow.appendChild(undoBtn);
  left.appendChild(undoRow);

  const paintHint = document.createElement('div');
  paintHint.className = 'sub';
  paintHint.textContent = 'click or drag on the tile to paint with the held brush \u00b7 paint terrain to erase road \u00b7 Ctrl+Z undoes one change';
  left.appendChild(paintHint);

  const loadRow = document.createElement('div');
  const loadLabel = document.createElement('label');
  loadLabel.textContent = 'load an existing tile as a starting point';
  const select = document.createElement('select');
  select.innerHTML =
    '<option value="">- blank -</option>' +
    tileLibraryJson.tiles.map((t) => `<option value="${t.id}">${t.id}${t.name ? ` (${t.name})` : ''}</option>`).join('');
  select.addEventListener('change', () => {
    const found = tileLibraryJson.tiles.find((t) => t.id === select.value);
    cells = found ? found.cells.slice() : ['GGGGG', 'GGGGG', 'GGGGG', 'GGGGG', 'GGGGG'];
    undoStack.length = 0;
    idDirty = Boolean(found);
    if (found) idInput.value = found.id + '_v2';
    update();
  });
  loadRow.appendChild(loadLabel);
  loadRow.appendChild(select);
  left.appendChild(loadRow);

  // ---- right column: truth ------------------------------------------------
  const right = document.createElement('div');
  right.className = 'col';

  const previewLabel = document.createElement('label');
  previewLabel.textContent = 'in-game preview (2x zoom)';
  right.appendChild(previewLabel);
  const term = new GLTerm(glyphs, {
    cols: TILE_SIZE * CELL_W,
    rows: TILE_SIZE * CELL_H,
    cellPx: ZOOM_W,
    cellPxH: ZOOM_H,
    background: role('ui.bg'),
  });
  right.appendChild(term.canvas);
  term.canvas.style.cursor = 'crosshair';
  let painting = false;
  const paintAt = (e: MouseEvent): void => {
    const x = Math.floor(e.offsetX / CELL_PX_W);
    const y = Math.floor(e.offsetY / CELL_PX_H);
    if (x < 0 || y < 0 || x >= TILE_SIZE || y >= TILE_SIZE) return;
    if (cells[y][x] === brush) return; // no-op paints do not eat undo steps
    undoStack.push(cells.slice());
    setCell(x, y, brush);
    idDirty = idInput.value !== '' && idDirty; // keep manual ids
    update();
  };
  term.canvas.addEventListener('mousedown', (e) => {
    painting = true;
    paintAt(e);
  });
  term.canvas.addEventListener('mousemove', (e) => {
    if (painting) paintAt(e);
  });
  window.addEventListener('mouseup', () => (painting = false));

  const connLine = document.createElement('div');
  connLine.className = 'conn';
  right.appendChild(connLine);

  const verdict = document.createElement('div');
  right.appendChild(verdict);

  const idLabel = document.createElement('label');
  idLabel.textContent = 'tile id (lowercase, digits, _)';
  const idInput = document.createElement('input');
  let idDirty = false;
  idInput.addEventListener('input', () => {
    idDirty = true;
    update();
  });
  const nameLabel = document.createElement('label');
  nameLabel.textContent = 'display name (optional)';
  const nameInput = document.createElement('input');
  right.appendChild(idLabel);
  right.appendChild(idInput);
  right.appendChild(nameLabel);
  right.appendChild(nameInput);

  const actions = document.createElement('div');
  actions.className = 'actions';
  const addBtn = document.createElement('button');
  addBtn.textContent = 'ADD TO POOL';
  const addNote = document.createElement('div');
  addNote.className = 'sub';
  const copyBtn = document.createElement('button');
  copyBtn.textContent = 'copy JSON';
  const out = document.createElement('pre');
  copyBtn.addEventListener('click', async () => {
    await navigator.clipboard.writeText(out.textContent ?? '');
    copyBtn.textContent = 'copied \u2713';
    setTimeout(() => (copyBtn.textContent = 'copy JSON'), 1200);
  });
  let justAdded = '';
  addBtn.addEventListener('click', () => {
    const tile: { id: string; name?: string; cells: string[] } = { id: idInput.value.trim(), cells: [...cells] };
    const name = nameInput.value.trim();
    if (name) tile.name = name;
    addMintedTile(tile);
    justAdded = tile.id;
    // Confirmation POPUP, then the button greys until the tile changes -
    // flashing "duplicate id" right after a successful add read as an error
    // (Daniil, playtest 3).
    const pop = document.createElement('div');
    pop.textContent = `\u2713 '${tile.id}' added to the pool - it can appear on the next map`;
    pop.style.cssText = 'position:fixed;top:24px;left:50%;transform:translateX(-50%);background:#1f6f43;color:#eafff2;padding:10px 18px;border-radius:4px;z-index:10;font-family:inherit';
    document.body.appendChild(pop);
    setTimeout(() => pop.remove(), 2200);
    update();
  });
  actions.appendChild(addBtn);
  actions.appendChild(copyBtn);
  right.appendChild(actions);
  right.appendChild(addNote);
  right.appendChild(out);

  app.appendChild(left);
  app.appendChild(right);

  // ---- one update path: state -> engine verdict -> every widget ------------
  function update(): void {
    for (const [t, b] of brushBtns) b.classList.toggle('active', t === brush);

    undoBtn.disabled = undoStack.length === 0;

    term.clear(role('ui.bg'));
    for (let cy = 0; cy < TILE_SIZE; cy++)
      for (let cx = 0; cx < TILE_SIZE; cx++)
        drawTerrainCell(term, cells[cy][cx] as CellType, cx * CELL_W, cy * CELL_H, { rim: segmentRimMask(cells[cy][cx], cx, cy) });
    term.flush();

    const conn = deriveConnectors(cells);
    connLine.innerHTML =
      'derived connectors: ' +
      (['n', 'e', 's', 'w'] as const)
        .map((e) => `<b>${e.toUpperCase()}</b> ${conn[e] ? 'road' : '\u2014'}`)
        .join(' \u00b7 ');

    // Automatic naming (playtest 5, item 4): a stable id straight from the
    // grid bytes; renaming is optional, never required.
    if (!idDirty) {
      let h = 0x811c9dc5;
      const text = cells.join('');
      for (let i = 0; i < text.length; i++) {
        h ^= text.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
      }
      idInput.value = 'tile_' + (h >>> 0).toString(36);
    }
    const errors = validateTileCells(cells);
    const id = idInput.value.trim();
    const idOk = /^[a-z][a-z0-9_]*$/.test(id);
    const minted = loadMintedTiles();
    if (id !== justAdded) justAdded = '';
    addNote.textContent = minted.length > 0 ? `minted pool: ${minted.length} tile(s) \u00b7 they join the generator on the next map` : 'minted tiles join the generator on the next map (this browser only)';
    const dupe = id !== justAdded && (tileLibraryJson.tiles.some((t) => t.id === id) || minted.some((t) => t.id === id));
    if (!idOk) errors.push(`id '${id}' must be lowercase letters, digits, underscores`);
    if (dupe) errors.push(`id '${id}' already exists in the library`);

    if (errors.length === 0) {
      verdict.innerHTML = '<span class="verdict-ok">\u2713 valid tile \u2014 the game would accept this</span>';
      const tile: { id: string; name?: string; cells: string[] } = { id, cells };
      const name = nameInput.value.trim();
      if (name) tile.name = name;
      out.textContent = JSON.stringify(tile, null, 2);
      copyBtn.disabled = false;
      addBtn.disabled = id === justAdded; // just added: grey, not an error
      if (id === justAdded) verdict.innerHTML = '<span class="verdict-ok">\u2713 in the pool \u2014 change the tile or id to mint another</span>';
      out.style.display = '';
    } else {
      verdict.innerHTML =
        '<span class="verdict-bad">\u2717 invalid \u2014 export disabled</span><ul>' +
        errors.map((e) => `<li>${e}</li>`).join('') +
        '</ul>';
      out.textContent = '';
      out.style.display = 'none';
      copyBtn.disabled = true;
      addBtn.disabled = true;
    }
  }

  nameInput.addEventListener('input', () => update());
  update();
}

main().catch((e) => {
  document.getElementById('app')!.textContent = `failed: ${String(e)}`;
  console.error(e);
});
