/**
 * Terrain demo: a board grown by the real engine.
 *
 * Since the tile-engine PR this is no longer scaffolding-shaped: tiles come
 * from content/assets/tiles/library.json, placement goes through the same
 * canPlace/growBoard the game will use, and the board is mostly void - tiles
 * grow outward from the spawn exactly as the run will (PRD sec 4.4).
 *
 * The per-glyph texture uses a stateless mixing hash, NOT the RNG - that is
 * the ASSETS.md rule: sequence randomness for choices, spatial hash for
 * texture, so redrawing never consumes randomness.
 */
import { GLTerm } from '@ascii-defense/render';
import type { GlyphSet } from '@ascii-defense/render';
import { TILE_SIZE, TileLibrary, createRng, growBoard, resolveCells } from '@ascii-defense/engine';
import type { CellType } from '@ascii-defense/engine';
import { validatePalette } from '@ascii-defense/content';
import paletteJson from '@ascii-defense/content/assets/palette.json';
import tileLibraryJson from '@ascii-defense/content/assets/tiles/library.json';

const BASE = import.meta.env.BASE_URL;
const ASSET_V = '5';
const load = <T>(p: string): Promise<T> =>
  fetch(`${BASE}assets/${p}?v=${ASSET_V}`).then((r) => r.json() as Promise<T>);

// ---- palette: the one source of colour, validated through the pipeline -----

const paletteResult = validatePalette.check(paletteJson);
if (!paletteResult.ok) {
  throw new Error(
    'palette.json failed validation: ' +
      paletteResult.errors.map((e) => `${e.path}: ${e.message}`).join('; '),
  );
}
const ROLES = paletteResult.value.roles;
const role = (name: string): string => {
  const c = ROLES[name];
  if (!c) throw new Error(`palette role missing: ${name}`);
  return c;
};

const PATHS = [role('path.1'), role('path.2'), role('path.3'), role('path.4')];
const COLS: Record<CellType, [string, string, string]> = {
  G: [role('terrain.ground.mid'), role('terrain.ground.lit'), role('terrain.ground.dark')],
  R: [role('terrain.road.mid'), role('terrain.road.lit'), role('terrain.road.dark')],
  K: [role('terrain.rock.mid'), role('terrain.rock.lit'), role('terrain.rock.dark')],
  O: [role('terrain.ore.mid'), role('terrain.ore.lit'), role('terrain.ore.dark')],
  S: [role('terrain.spawn.mid'), role('terrain.spawn.lit'), role('terrain.spawn.dark')],
};

// ---- spleen styling (ASCII + braille + light box drawing only) -------------

const POOLS: Record<CellType, string> = {
  G: "          .'`,\u2800\u2801\u2802\u2804\u2808\u2810\u2820\u2840\u2880\u2803\u2809",
  R: ':;.,=\u2809\u2812\u2824\u2836\u281b\u283f-_~\u2810\u2820',
  K: '#%@&\u28ff\u287f\u28bf\u28fb\u28fd\u28fe\u28f7$WMB\u28f6\u28ef',
  O: '*+.o\u283f\u283e\u283d\u283bO0\u2837',
  S: '>>:.\u2808\u2818\u2838',
};
const TOWERS = [
  ['.-^-.', '|[O]|', "'---'"],
  ['\\ | /', '|(@)|', "'---'"],
  ['* . *', '|<8>|', "* ' *"],
  ['=====', '|{$}|', "'---'"],
];
const ENEMY = '<(o)>';
const CORE = /[O@$8]/;

// ---- geometry --------------------------------------------------------------

const CW = 5, CH = 3;                    // glyphs per cell
const TGX = TILE_SIZE * CW, TGY = TILE_SIZE * CH; // glyphs per tile side

/** Stateless mixing hash for per-glyph texture (ASSETS.md sec 5). */
function hash2(x: number, y: number, s: number): number {
  let h = (x | 0) * 374761393 + (y | 0) * 668265263 + s * 2246822519;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// ---- rendering -------------------------------------------------------------

function drawBoard(term: GLTerm, seed: number, lib: TileLibrary, mapX: number, mapY: number, offsetY: number): void {
  const rng = createRng(seed);
  const board = growBoard(rng.stream('map'), lib, {
    width: mapX,
    height: mapY,
    startTileId: 'spawn',
    // Mid-run snapshot, not endgame: leave visible void so the "board grows
    // out of unclaimed land" shape of the game (PRD sec 4.4) reads at a glance.
    maxTiles: Math.floor(mapX * mapY * 0.6),
  });
  const cells = resolveCells(board, lib);
  const cellsW = mapX * TILE_SIZE;
  const decor = rng.stream('combat'); // decorative towers/enemies, own stream

  term.clear(role('ui.bg'));
  const laid = board.slots.filter(Boolean).length;
  term.write(0, 0, `ASCII DEFENSE \u00b7 terrain demo \u00b7 seed ${seed}`, role('ui.accent'));
  term.write(
    0,
    1,
    `click or press R to reroll \u00b7 ?seed=${seed} pins this exact board \u00b7 ${laid} tiles grown from the spawn \u00b7 void is unclaimed land`,
    role('ui.dim'),
  );

  let towerN = 0;
  for (let cyCell = 0; cyCell < mapY * TILE_SIZE; cyCell++)
    for (let cxCell = 0; cxCell < cellsW; cxCell++) {
      const kind = cells[cyCell * cellsW + cxCell];
      if (kind === null) continue; // void: background stays
      const pool = POOLS[kind];
      const c3 = COLS[kind];
      const gx0 = cxCell * CW;
      const gy0 = offsetY + cyCell * CH;
      // Texture: spatial hash, never the RNG - see file header.
      for (let y = 0; y < CH; y++)
        for (let x = 0; x < CW; x++) {
          const g = pool[Math.floor(hash2(gx0 + x, gy0 + y, 6) * pool.length) % pool.length];
          term.put(gx0 + x, gy0 + y, g, hash2(gx0 + x, gy0 + y, 9) < 0.2 ? c3[1] : c3[0], c3[2]);
        }
      // Decoration: sequence RNG, so density stays honest per seed.
      if (kind === 'G' && decor.chance(0.16)) {
        const art = TOWERS[towerN % TOWERS.length];
        const col = PATHS[towerN % PATHS.length];
        towerN++;
        for (let r = 0; r < CH; r++)
          for (let c = 0; c < CW; c++) {
            const chr = art[r][c];
            if (chr === ' ' || !term.has(chr)) continue;
            term.put(gx0 + c, gy0 + r, chr, CORE.test(chr) ? col : role('tower.frame'), role('tower.ground'));
          }
      }
      if (kind === 'R' && decor.chance(0.12))
        for (let i = 0; i < Math.min(CW, ENEMY.length); i++)
          if (term.has(ENEMY[i])) term.put(gx0 + i, gy0, ENEMY[i], role('enemy.eye'), COLS.R[2]);
    }
  term.flush();
}

// ---- bootstrap -------------------------------------------------------------

async function main(): Promise<void> {
  const glyphs = await load<GlyphSet>('glyphset-spleen.json');
  const lib = new TileLibrary(tileLibraryJson.tiles);

  const app = document.getElementById('app')!;
  const mapX = 14, mapY = 7;
  const OY = 3; // HUD rows above the board
  const term = new GLTerm(glyphs, {
    cols: mapX * TGX,
    rows: mapY * TGY + OY,
    cellPx: 5,
    cellPxH: 8,
    background: role('ui.bg'),
  });

  // Seed from the URL if pinned, else from the clock (Math.random is banned
  // everywhere, and the whole point is that the seed is the only entropy).
  const fromUrl = Number(new URLSearchParams(location.search).get('seed'));
  let seed = Number.isInteger(fromUrl) && fromUrl > 0 ? fromUrl : Date.now() % 1_000_000;

  const draw = (): void => {
    drawBoard(term, seed, lib, mapX, mapY, OY);
    history.replaceState(null, '', `?seed=${seed}`);
  };

  const reroll = (): void => {
    seed = (seed + 1 + (Date.now() % 997)) % 1_000_000;
    draw();
  };

  app.appendChild(term.canvas);
  const cap = document.createElement('div');
  cap.className = 'hud';
  cap.textContent =
    `spleen 5x8 \u00b7 tiles from content/assets/tiles/library.json \u00b7 ` +
    `laid by engine canPlace/growBoard (derived connectors, road-join rule) \u00b7 ` +
    `palette validated at load`;
  app.appendChild(cap);

  term.canvas.addEventListener('click', reroll);
  window.addEventListener('keydown', (e) => {
    if (e.key === 'r' || e.key === 'R') reroll();
  });

  draw();
}

main().catch((e) => {
  document.getElementById('app')!.textContent = `failed: ${String(e)}`;
  console.error(e);
});
