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
  validateTileCells,
  type CellType,
} from '@ascii-defense/engine';
import { CELL_W, CELL_H, drawTerrainCell, role } from '@ascii-defense/view';
import tileLibraryJson from '@ascii-defense/content/assets/tiles/library.json';

const BASE = import.meta.env.BASE_URL;
const ASSET_V = '5';
const load = <T>(p: string): Promise<T> =>
  fetch(`${BASE}assets/${p}?v=${ASSET_V}`).then((r) => r.json() as Promise<T>);

const BRUSH_LABEL: Record<CellType, string> = {
  G: 'G ground',
  R: 'R road',
  K: 'K rock',
  O: 'O ore',
  S: 'S spawn',
};
const BRUSH_BG: Record<CellType, string> = {
  G: '#3d4f61',
  R: '#93abc4',
  K: '#5a6a7c',
  O: '#ffd15c',
  S: '#ff9090',
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

  const grid = document.createElement('div');
  grid.className = 'grid';
  const cellBtns: HTMLButtonElement[][] = [];
  for (let y = 0; y < TILE_SIZE; y++) {
    cellBtns.push([]);
    for (let x = 0; x < TILE_SIZE; x++) {
      const b = document.createElement('button');
      b.addEventListener('click', () => {
        setCell(x, y, brush);
        update();
      });
      cellBtns[y].push(b);
      grid.appendChild(b);
    }
  }
  left.appendChild(grid);

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

  const connLine = document.createElement('div');
  connLine.className = 'conn';
  right.appendChild(connLine);

  const verdict = document.createElement('div');
  right.appendChild(verdict);

  const idLabel = document.createElement('label');
  idLabel.textContent = 'tile id (lowercase, digits, _)';
  const idInput = document.createElement('input');
  idInput.value = 'my_tile';
  idInput.addEventListener('input', () => update());
  const nameLabel = document.createElement('label');
  nameLabel.textContent = 'display name (optional)';
  const nameInput = document.createElement('input');
  right.appendChild(idLabel);
  right.appendChild(idInput);
  right.appendChild(nameLabel);
  right.appendChild(nameInput);

  const actions = document.createElement('div');
  actions.className = 'actions';
  const copyBtn = document.createElement('button');
  copyBtn.textContent = 'copy JSON';
  const out = document.createElement('pre');
  copyBtn.addEventListener('click', async () => {
    await navigator.clipboard.writeText(out.textContent ?? '');
    copyBtn.textContent = 'copied \u2713';
    setTimeout(() => (copyBtn.textContent = 'copy JSON'), 1200);
  });
  actions.appendChild(copyBtn);
  right.appendChild(actions);
  right.appendChild(out);

  app.appendChild(left);
  app.appendChild(right);

  // ---- one update path: state -> engine verdict -> every widget ------------
  function update(): void {
    for (const [t, b] of brushBtns) b.className = t === brush ? 'active' : '';

    for (let y = 0; y < TILE_SIZE; y++)
      for (let x = 0; x < TILE_SIZE; x++) {
        const t = cells[y][x] as CellType;
        const b = cellBtns[y][x];
        b.textContent = t;
        b.style.background = BRUSH_BG[t];
        b.style.color = t === 'O' || t === 'R' ? '#1b232c' : '#e8eef6';
      }

    term.clear(role('ui.bg'));
    for (let cy = 0; cy < TILE_SIZE; cy++)
      for (let cx = 0; cx < TILE_SIZE; cx++)
        drawTerrainCell(term, cells[cy][cx] as CellType, cx * CELL_W, cy * CELL_H);
    term.flush();

    const conn = deriveConnectors(cells);
    connLine.innerHTML =
      'derived connectors: ' +
      (['n', 'e', 's', 'w'] as const)
        .map((e) => `<b>${e.toUpperCase()}</b> ${conn[e] ? 'road' : '\u2014'}`)
        .join(' \u00b7 ');

    const errors = validateTileCells(cells);
    const id = idInput.value.trim();
    const idOk = /^[a-z][a-z0-9_]*$/.test(id);
    const dupe = tileLibraryJson.tiles.some((t) => t.id === id);
    if (!idOk) errors.push(`id '${id}' must be lowercase letters, digits, underscores`);
    if (dupe) errors.push(`id '${id}' already exists in the library`);

    if (errors.length === 0) {
      verdict.innerHTML = '<span class="verdict-ok">\u2713 valid tile \u2014 the game would accept this</span>';
      const tile: { id: string; name?: string; cells: string[] } = { id, cells };
      const name = nameInput.value.trim();
      if (name) tile.name = name;
      out.textContent = JSON.stringify(tile, null, 2);
      copyBtn.disabled = false;
      out.style.display = '';
    } else {
      verdict.innerHTML =
        '<span class="verdict-bad">\u2717 invalid \u2014 export disabled</span><ul>' +
        errors.map((e) => `<li>${e}</li>`).join('') +
        '</ul>';
      out.textContent = '';
      out.style.display = 'none';
      copyBtn.disabled = true;
    }
  }

  nameInput.addEventListener('input', () => update());
  update();
}

main().catch((e) => {
  document.getElementById('app')!.textContent = `failed: ${String(e)}`;
  console.error(e);
});
