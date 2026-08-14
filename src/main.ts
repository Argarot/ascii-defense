/**
 * M0 delivery-path proof.
 *
 * This is NOT the game. It exists to prove one thing end to end: that a
 * TypeScript + Vite project builds in CI and reaches a live public URL, with a
 * real Term render loop running on it rather than a static placeholder.
 *
 * The scene is a teaser — a winding road, a few towers, enemies walking it —
 * built on the same Term that the game will use.
 */
import { Term } from './term/Term';

const COLS = 96;
const ROWS = 34;

const C = {
  bg: '#0b0d10',
  ground: '#1c2530',
  road: '#4a5568',
  rock: '#2b3440',
  core: '#06d6a0',
  enemy: '#ff6b6b',
  hurt: '#ffd166',
  towerA: '#4cc9f0',
  towerB: '#ffd166',
  towerC: '#b388ff',
  text: '#cfd6e4',
  dim: '#5c6b7f',
} as const;

/** xorshift32 — seeded and deterministic. `Math.random` never appears in this
 *  project; every roll must be reproducible from a seed. */
function rng(seed: number): () => number {
  let s = seed | 0 || 1;
  return () => {
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}

const rand = rng(0xA5C11);

// ------------------------------------------------------------------ the map
// A rightward random walk carves the road; everything else is ground or rock.
const road: { x: number; y: number }[] = [];
{
  let y = 4 + Math.floor(rand() * (ROWS - 12));
  for (let x = 0; x < COLS; x++) {
    road.push({ x, y });
    const roll = rand();
    if (roll < 0.24 && y > 3) { y--; road.push({ x, y }); }
    else if (roll > 0.76 && y < ROWS - 5) { y++; road.push({ x, y }); }
  }
}
const isRoad = new Set(road.map((p) => `${p.x},${p.y}`));

const rocks: { x: number; y: number }[] = [];
for (let i = 0; i < 90; i++) {
  const x = Math.floor(rand() * COLS);
  const y = 2 + Math.floor(rand() * (ROWS - 4));
  if (!isRoad.has(`${x},${y}`)) rocks.push({ x, y });
}

const towers: { x: number; y: number; glyph: string; color: string }[] = [];
{
  const kinds = [
    { glyph: '^', color: C.towerA },
    { glyph: 'o', color: C.towerB },
    { glyph: '~', color: C.towerC },
  ];
  for (let i = 8; i < road.length - 8; i += 11) {
    const p = road[i];
    const dy = rand() < 0.5 ? -2 : 2;
    const y = p.y + dy;
    if (y < 2 || y >= ROWS - 1 || isRoad.has(`${p.x},${y}`)) continue;
    towers.push({ x: p.x, y, ...kinds[towers.length % kinds.length] });
  }
}

// --------------------------------------------------------------- the enemies
interface Enemy { t: number; speed: number; hp: number; }
const enemies: Enemy[] = [];
for (let i = 0; i < 22; i++) {
  enemies.push({ t: -i * 14, speed: 0.18 + rand() * 0.22, hp: 1 });
}

// ---------------------------------------------------------------- rendering
const term = new Term({ cols: COLS, rows: ROWS, cellW: 11, cellH: 19, background: C.bg });
const mount = document.getElementById('app');
if (!mount) throw new Error('missing #app');
mount.appendChild(term.canvas);

const hud = document.createElement('div');
hud.className = 'hud';
mount.appendChild(hud);

let frames = 0;
let fpsWindowStart = performance.now();
let fps = 0;

function draw() {
  term.clear(C.bg);

  for (let y = 2; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      term.put(x, y, ((x * 7 + y * 13) % 11 === 0) ? "'" : '.', C.ground);
    }
  }
  for (const p of rocks) term.put(p.x, p.y, '#', C.rock);
  for (const p of road) term.put(p.x, p.y, ',', C.road);
  for (const t of towers) term.put(t.x, t.y, t.glyph, t.color);

  const last = road[road.length - 1];
  term.put(last.x, last.y, '@', C.core);

  for (const e of enemies) {
    e.t += e.speed;
    if (e.t >= road.length) e.t -= road.length + 40;
    const idx = Math.floor(e.t);
    if (idx < 0 || idx >= road.length) continue;
    const p = road[idx];
    term.put(p.x, p.y, e.speed > 0.3 ? 'x' : 'o', e.speed > 0.3 ? C.hurt : C.enemy);
  }

  term.write(0, 0, 'ASCII DEFENSE', C.core);
  term.write(15, 0, '// M0 delivery-path proof — not the game yet', C.dim);
  term.write(0, 1, `${COLS}x${ROWS} cells  ${towers.length} towers  ${enemies.length} enemies`, C.text);
  term.write(52, 1, `${fps.toFixed(0).padStart(3)} fps`, fps >= 55 ? C.core : C.hurt);

  term.flush();

  frames++;
  const now = performance.now();
  if (now - fpsWindowStart >= 500) {
    fps = (frames * 1000) / (now - fpsWindowStart);
    frames = 0;
    fpsWindowStart = now;
    hud.textContent = `renderer: glyph atlas + dirty cells — ${fps.toFixed(0)} fps`;
  }
  requestAnimationFrame(draw);
}

// Paint frame 0 synchronously rather than waiting on rAF, so the page is never
// briefly blank — and so the render path is exercised even where rAF is
// throttled (background tabs, headless checks).
draw();
