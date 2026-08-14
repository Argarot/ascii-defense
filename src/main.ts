/**
 * Visual scope preview.
 *
 * NOT the game. This composes a scene from the real asset library in
 * public/assets so the art direction can be judged before any game logic
 * exists. Everything drawn here — terrain texture, towers, enemies — is loaded
 * from JSON at runtime. Edit a file under public/assets, reload, see it change.
 *
 * The engine deliberately knows no glyphs. It knows sprite ids and ink keys.
 */
import { Term } from './term/Term';
import { drawSprite, resolveInk, validateSprite } from './sprite/Sprite';
import type { Palette, SpriteDef, SpriteFrame, SpriteSheet } from './sprite/Sprite';

const COLS = 96;
const ROWS = 38;
const MAP_Y0 = 3;
const MAP_H = 25;

/** xorshift32. `Math.random` never appears in this project — see docs/HANDOFF.md. */
function rng(seed: number): () => number {
  let s = seed | 0 || 1;
  return () => {
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}

const BASE = import.meta.env.BASE_URL;
const load = <T>(p: string): Promise<T> => fetch(`${BASE}assets/${p}`).then((r) => r.json() as Promise<T>);

interface TerrainClass {
  glyphs: string[]; density: number; ink: string;
  dimChance?: number; dimInk?: string;
  litChance?: number; litInk?: string;
  capGlyphs?: string[]; capInk?: string;
  haloGlyphs?: string[]; haloChance?: number; haloInk?: string;
}
interface TerrainDef { classes: Record<string, TerrainClass> }

/**
 * Spatial hash in [0,1). Must be a *mixing* hash: the obvious `(x*a + y*b) % n`
 * is linear, which lays down visible diagonal stripes across open ground and
 * makes terrain read as moire rather than as surface.
 */
function hash2(x: number, y: number, salt: number): number {
  let h = (x | 0) * 374761393 + (y | 0) * 668265263 + salt * 2246822519;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

type Cell = 'ground' | 'road' | 'rock' | 'ore';

async function main(): Promise<void> {
  const [palette, terrain, bolt, mortar, frost, refinery, enemies] = await Promise.all([
    load<Palette & { bg: string }>('palette.json'),
    load<TerrainDef>('sprites/terrain.json'),
    load<SpriteDef>('sprites/tower_bolt.json'),
    load<SpriteDef>('sprites/tower_mortar.json'),
    load<SpriteDef>('sprites/tower_frost.json'),
    load<SpriteDef>('sprites/tower_refinery.json'),
    load<SpriteSheet>('sprites/enemies.json'),
  ]);

  // Asset validation, reported rather than thrown. Moves into CI in M1.
  const problems: string[] = [];
  for (const t of [bolt, mortar, frost, refinery]) problems.push(...validateSprite(t.id, t.size, t.tiers));
  for (const [id, s] of Object.entries(enemies.sprites)) problems.push(...validateSprite(id, s.size, s.tiers));
  if (problems.length) console.warn('asset problems:\n' + problems.join('\n'));

  const P = palette as Palette;
  const ink = (k: string): string => resolveInk(k, P, '#fff') ?? '#f0f';
  const bg = palette.bg;

  // ------------------------------------------------------------------ scene
  const rand = rng(0x5EED17);
  const grid: Cell[] = new Array(COLS * MAP_H).fill('ground');
  const at = (x: number, y: number): number => y * COLS + x;
  const inMap = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < COLS && y < MAP_H;

  // Road: a rightward meander. Two cells thick so it reads as a road, not a line.
  const spine: { x: number; y: number }[] = [];
  {
    let y = 8 + Math.floor(rand() * 8);
    for (let x = 0; x < COLS; x++) {
      spine.push({ x, y });
      const roll = rand();
      if (roll < 0.22 && y > 3) y--;
      else if (roll > 0.78 && y < MAP_H - 5) y++;
    }
  }
  // Three cells thick: with 7-wide towers a two-cell road reads as a scratch.
  for (const p of spine) {
    for (let dy = 0; dy < 3; dy++) if (inMap(p.x, p.y + dy)) grid[at(p.x, p.y + dy)] = 'road';
  }

  // Rock formations: clustered, never on road.
  for (let i = 0; i < 14; i++) {
    const cx = Math.floor(rand() * COLS);
    const cy = Math.floor(rand() * MAP_H);
    const rw = 2 + Math.floor(rand() * 5);
    const rh = 1 + Math.floor(rand() * 3);
    for (let y = cy; y < cy + rh; y++) {
      for (let x = cx; x < cx + rw; x++) {
        // Solid, with ragged edges only. Holes through the middle read as
        // scattered noise rather than as a mass of rock.
        const edge = x === cx || x === cx + rw - 1 || y === cy || y === cy + rh - 1;
        if (inMap(x, y) && grid[at(x, y)] === 'ground' && (!edge || rand() > 0.45)) grid[at(x, y)] = 'rock';
      }
    }
  }

  // Distance-from-road, by BFS. Ore is scattered where that distance is high —
  // the same idea the real generator uses, and the reason mining pulls you away
  // from your defense.
  const dist = new Int16Array(COLS * MAP_H).fill(-1);
  const queue: number[] = [];
  for (let i = 0; i < grid.length; i++) if (grid[i] === 'road') { dist[i] = 0; queue.push(i); }
  for (let head = 0; head < queue.length; head++) {
    const i = queue[head];
    const x = i % COLS, y = (i / COLS) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx, ny = y + dy;
      if (!inMap(nx, ny)) continue;
      const j = at(nx, ny);
      if (dist[j] !== -1) continue;
      dist[j] = dist[i] + 1;
      queue.push(j);
    }
  }
  for (let i = 0; i < grid.length; i++) {
    if (grid[i] === 'ground' && dist[i] >= 7 && rand() < 0.05) grid[i] = 'ore';
  }

  // Towers, placed clear of the road. Each carries the path it specialised into.
  const towerDefs = { bolt, mortar, frost, refinery };
  type Placed = { def: SpriteDef; tier: string; x: number; y: number; path: string };
  const placed: Placed[] = [];
  const plan: [keyof typeof towerDefs, string, string][] = [
    ['bolt', '5', 'path.A'], ['mortar', '3', 'path.B'], ['frost', '5', 'path.C'],
    ['bolt', '3', 'path.A'], ['refinery', '1', 'path.B'], ['mortar', '1', 'path.B'],
    ['frost', '1', 'path.C'], ['bolt', '1', 'path.A'],
  ];
  let planIdx = 0;
  for (let i = 6; i < spine.length - 10 && planIdx < plan.length; i += 7) {
    const [key, tier, pathKey] = plan[planIdx];
    const def = towerDefs[key];
    const [w, h] = def.size;
    const above = rand() < 0.5;
    const x = spine[i].x - 3;
    const y = above ? spine[i].y - h - 1 : spine[i].y + 3;
    let clear = true;
    for (let yy = y; yy < y + h && clear; yy++)
      for (let xx = x; xx < x + w; xx++)
        if (!inMap(xx, yy) || grid[at(xx, yy)] === 'road') { clear = false; break; }
    if (!clear) continue;
    placed.push({ def, tier, x, y, path: ink(pathKey) });
    planIdx++;
  }

  // Enemies walking the spine.
  const kinds = ['hulk', 'grunt', 'grunt', 'flyer', 'swarmling', 'grunt', 'swarmling'] as const;
  const walkers = kinds.map((k, i) => ({ kind: k, t: -i * 11 - 4, speed: 0.12 + rand() * 0.14 }));

  // ---------------------------------------------------------------- render
  const term = new Term({ cols: COLS, rows: ROWS, cellW: 11, cellH: 19, background: bg });
  const mount = document.getElementById('app');
  if (!mount) throw new Error('missing #app');
  mount.appendChild(term.canvas);
  const hud = document.createElement('div');
  hud.className = 'hud';
  mount.appendChild(hud);

  const T = terrain.classes;
  const pick = (arr: string[], x: number, y: number, salt: number): string =>
    arr[Math.floor(hash2(x, y, salt) * arr.length) % arr.length];
  const isRoad = (x: number, y: number): boolean => inMap(x, y) && grid[at(x, y)] === 'road';

  function drawTerrain(): void {
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < COLS; x++) {
        const c = grid[at(x, y)];
        const sy = MAP_Y0 + y;

        if (c === 'ground') {
          const g = T.ground;
          if (hash2(x, y, 1) >= g.density) continue; // mostly empty: this is the point
          const dim = hash2(x, y, 2) < (g.dimChance ?? 0);
          term.put(x, sy, pick(g.glyphs, x, y, 3), ink(dim ? (g.dimInk ?? g.ink) : g.ink));

        } else if (c === 'road') {
          // A boundary row gets the edge treatment, which is what makes the
          // road read as a band with sides rather than a smear of punctuation.
          if (!isRoad(x, y - 1) || !isRoad(x, y + 1)) {
            const e = T.roadEdge;
            term.put(x, sy, pick(e.glyphs, x, y, 4), ink(e.ink));
          } else {
            const g = T.road;
            if (hash2(x, y, 5) >= g.density) continue;
            const lit = hash2(x, y, 6) < (g.litChance ?? 0);
            term.put(x, sy, pick(g.glyphs, x, y, 7), ink(lit ? (g.litInk ?? g.ink) : g.ink));
          }

        } else if (c === 'rock') {
          const g = T.rock;
          const cap = !inMap(x, y - 1) || grid[at(x, y - 1)] !== 'rock';
          if (cap && g.capGlyphs) term.put(x, sy, pick(g.capGlyphs, x, y, 8), ink(g.capInk ?? g.ink));
          else term.put(x, sy, pick(g.glyphs, x, y, 9), ink(g.ink));

        } else {
          const g = T.ore;
          term.put(x, sy, g.glyphs[0], ink(g.ink));
          if (g.haloGlyphs) {
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
              if (!inMap(x + dx, y + dy) || grid[at(x + dx, y + dy)] !== 'ground') continue;
              if (hash2(x + dx, y + dy, 10) >= (g.haloChance ?? 1)) continue;
              term.put(x + dx, MAP_Y0 + y + dy, pick(g.haloGlyphs, x + dx, y + dy, 11), ink(g.haloInk ?? g.ink));
            }
          }
        }
      }
    }
  }

  const showcase: { label: string; frame: SpriteFrame; map: Record<string, string | null>; bgk?: string | null; path: string; w: number }[] = [
    { label: 'T1', frame: bolt.tiers['1'], map: bolt.inkMap, bgk: bolt.bg, path: ink('path.A'), w: 7 },
    { label: 'T3', frame: bolt.tiers['3'], map: bolt.inkMap, bgk: bolt.bg, path: ink('path.A'), w: 7 },
    { label: 'T5', frame: bolt.tiers['5'], map: bolt.inkMap, bgk: bolt.bg, path: ink('path.A'), w: 7 },
    { label: 'mortar', frame: mortar.tiers['5'], map: mortar.inkMap, bgk: mortar.bg, path: ink('path.B'), w: 7 },
    { label: 'frost', frame: frost.tiers['5'], map: frost.inkMap, bgk: frost.bg, path: ink('path.C'), w: 7 },
    { label: 'refine', frame: refinery.tiers['5'], map: refinery.inkMap, bgk: refinery.bg, path: ink('path.B'), w: 7 },
  ];

  let frames = 0, fpsAt = performance.now(), fps = 0;

  function draw(): void {
    term.clear(bg);
    drawTerrain();

    for (const t of placed) {
      drawSprite(term, t.def.tiers[t.tier], t.def.inkMap, P, t.x, MAP_Y0 + t.y, t.path, t.def.bg);
    }

    for (const w of walkers) {
      w.t += w.speed;
      if (w.t >= spine.length) w.t -= spine.length + 30;
      const idx = Math.floor(w.t);
      if (idx < 0 || idx >= spine.length) continue;
      const s = enemies.sprites[w.kind];
      const p = spine[idx];
      const x = p.x - ((s.size[0] / 2) | 0);
      const y = MAP_Y0 + p.y - (s.size[1] - 2);
      drawSprite(term, s.tiers['1'], enemies.inkMap, P, x, y, '#fff', enemies.bg);
    }

    // Header
    term.write(0, 0, 'ASCII DEFENSE', ink('ui.accent'));
    term.write(15, 0, '// visual scope preview - art loaded from public/assets, not from code', ink('ui.dim'));
    term.write(0, 1, 'towers 7x4 . enemies 2x1 to 5x3 . terrain textured with edges . colour = upgrade path', ink('ui.text'));

    // Showcase strip
    let sx = 1;
    const sy = MAP_Y0 + MAP_H + 1;
    for (const item of showcase) {
      drawSprite(term, item.frame, item.map, P, sx, sy, item.path, item.bgk);
      term.write(sx, sy + 4, item.label, ink('ui.dim'));
      sx += item.w + 2;
    }
    for (const [name, ex] of [['hulk', 62], ['grunt', 70], ['flyer', 76], ['swarmling', 82]] as const) {
      const s = enemies.sprites[name];
      drawSprite(term, s.tiers['1'], enemies.inkMap, P, ex, sy + 1, '#fff', enemies.bg);
      term.write(ex, sy + 4, name.slice(0, 6), ink('ui.dim'));
    }
    term.write(1, sy + 5, 'same drawing, three tiers: detail and brightness climb, footprint never changes', ink('ui.dim'));

    term.write(78, 1, `${fps.toFixed(0).padStart(3)} fps`, fps >= 55 ? ink('ui.accent') : ink('ui.warn'));
    term.flush();
    (window as unknown as Record<string, unknown>).__screen = () => term.toText();

    frames++;
    const now = performance.now();
    if (now - fpsAt >= 500) {
      fps = (frames * 1000) / (now - fpsAt);
      frames = 0; fpsAt = now;
      hud.textContent = `${placed.length} towers placed - ${fps.toFixed(0)} fps - assets: public/assets/*.json`;
    }
    requestAnimationFrame(draw);
  }

  draw();
}

main().catch((e) => {
  const mount = document.getElementById('app');
  if (mount) mount.textContent = `failed to load assets: ${String(e)}`;
  console.error(e);
});
