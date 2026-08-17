/**
 * Tile Smith: author terrain tiles with the game's legality rules baked in.
 *
 * The verdict and the export gate both come from engine validateTileCells -
 * the same function the game and the content CI run - so a tile this tool
 * exports cannot be invalid, and a rule change in the engine changes this
 * tool on the next build with zero effort.
 */
import { GLTerm } from '@ascii-defense/render';
import type { GlyphSet } from '@ascii-defense/render';
import {
  CELL_TYPES,
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

const BRUSH_LABEL: Partial<Record<CellType, string>> = {
  G: 'G ground',
  '-': '\u2500 road E-W',
  '|': '\u2502 road N-S',
  L: '\u2514 bend N+E',
  J: '\u2518 bend N+W',
  F: '\u250c bend S+E',
  '7': '\u2510 bend S+W',
  K: 'K rock',
  O: 'O ore',
  C: 'C core',
};
const BRUSH_BG: Partial<Record<CellType, string>> = {
  G: '#3d4f61',
  '-': '#86a0bc',
  '|': '#86a0bc',
  L: '#86a0bc',
  J: '#86a0bc',
  F: '#86a0bc',
  '7': '#86a0bc',
  K: '#5a6a7c',
  O: '#ffd15c',
  C: '#2bbfae',
};

let cells: string[] = ['GGGGG', 'GGGGG', 'GGGGG', 'GGGGG', 'GGGGG'];
let brush: CellType = 'R';

function setCell(x: number, y: number, t: CellType): void {
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
      <div class="sub">paint a 5x5 tile \u00b7 the export button obeys the same rules the game does \u00b7 <a href="./">back to the board</a></div>
    </div>`;

  const brushes = document.createElement('div');
  brushes.className = 'brushes';
  const brushBtns = new Map<CellType, HTMLButtonElement>();
  for (const t of CELL_TYPES) {
    if (!BRUSH_LABEL[t]) continue; // playtest 5: only segment road brushes
    const b = document.createElement('button');
    b.textContent = BRUSH_LABEL[t];
    b.style.borderLeft = `10px solid ${BRUSH_BG[t]}`;
    b.addEventListener('click', () => {
      brush = t;
      update();
    });
    brushBtns.set(t, b);
    brushes.appendChild(b);
  }
  left.appendChild(brushes);

  const paintHint = document.createElement('div');
  paintHint.className = 'sub';
  paintHint.textContent = 'click the preview to paint with the selected brush (playtest 5: the tile IS the canvas)';
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
    cellPx: 10,
    cellPxH: 16,
    background: role('ui.bg'),
  });
  right.appendChild(term.canvas);
  term.canvas.style.cursor = 'crosshair';
  term.canvas.addEventListener('click', (e) => {
    const x = Math.floor(e.offsetX / (10 * CELL_W));
    const y = Math.floor(e.offsetY / (16 * CELL_H));
    if (x < 0 || y < 0 || x >= TILE_SIZE || y >= TILE_SIZE) return;
    setCell(x, y, brush);
    idDirty = idInput.value !== '' && idDirty; // keep manual ids
    update();
  });

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
    for (const [t, b] of brushBtns) b.className = t === brush ? 'active' : '';


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
