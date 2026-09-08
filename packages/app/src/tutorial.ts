/**
 * The tutorial (session 31; Daniil, 2026-09-07: "some sort of tutorial for
 * new players, with the expected sequence of things the player should pay
 * attention to highlighted in a coloured box that pulses" - his friend
 * found the interface unintuitive). A SEQUENCE of steps, each naming what
 * to look at (a target the shell turns into a pulsing box on the right
 * terminal), what it means, and what ends the step: the player's own
 * action where there is one, a NEXT otherwise. Pure: the shell feeds it a
 * context per frame and draws what it says. No state lives here beyond the
 * step index the shell keeps (and persists, so a reload resumes).
 */
import type { CellRef } from '@ascii-defense/engine';

export type TutorialTarget =
  | 'core' // the Core's face on the board
  | 'entry' // an entry the next wave comes from
  | 'ground' // a good ground cell beside the road, near the Core
  | 'strip:bolt' // the Bolt's button in the strip
  | 'hud:card' // the selected tower's card in the column
  | 'hud:scrap' // the Scrap and Ore line
  | 'hud:call' // the CALL WAVE button
  | 'strip:wave' // the strip's NOW and NEXT
  | 'offer' // the relic offer over the board
  | 'strip:slots' // the Core's relic slots in the strip
  | 'rock' // a rock cell near the road
  | 'upgrade' // the first tower on the board, or the selected tower's forks in its card
  | null;

export interface TutorialCtx {
  towers: number;
  wave: number;
  relics: number;
  offerUp: boolean;
  /** The selected cell, and whether the sim would build on it. */
  selected: CellRef | null;
  selectedBuildable: boolean;
  /** A tower is selected (its card is in the column). */
  towerSelected: boolean;
  /** Towers with at least one fork taken (session 31: the probe's plain Bolts died at wave 8; eight forked ones held Calm with no breach). */
  upgrades: number;
  /** The player pressed NEXT (or Enter) since the last frame. */
  next: boolean;
}

export interface TutorialStep {
  id: string;
  target: TutorialTarget;
  text: string;
  /** The step ends on NEXT; otherwise on the player's own action (done). */
  needsNext: boolean;
  done: (c: TutorialCtx) => boolean;
}

export const TUTORIAL_STEPS: readonly TutorialStep[] = [
  { id: 'core', target: 'core', text: 'This is the CORE, at the east edge. Enemies march to it; if it falls, the run ends. Everything you build defends it.', needsNext: true, done: (c) => c.next },
  { id: 'entry', target: 'entry', text: 'Enemies enter from the road\'s ends - the blinking markers - and walk the road to the Core. The next wave\'s entries blink before it comes.', needsNext: true, done: (c) => c.next },
  { id: 'ground', target: 'ground', text: 'Ground beside the road is where towers stand - and the ground by the CORE, where every road ends, sees every front. Click the highlighted cell to select it.', needsNext: false, done: (c) => c.selectedBuildable || c.towers >= 1 },
  { id: 'build', target: 'strip:bolt', text: 'Now the BOLT TURRET: click its button in the strip under the board. Hover a button first if you want its card.', needsNext: false, done: (c) => c.towers >= 1 },
  { id: 'card', target: 'hud:card', text: 'Your tower\'s card: what it does, its range, and its UPGRADE TREE - each fork is two jobs, never two numbers. Click a tower any time to see it.', needsNext: true, done: (c) => c.next },
  { id: 'scrap', target: 'hud:scrap', text: 'SCRAP pays for towers and upgrades; kills pay Scrap back. ORE is mined by a Refinery on a gold vein - it buys relics now, and the WORKSHOP between runs.', needsNext: true, done: (c) => c.next },
  { id: 'call', target: 'hud:call', text: 'Send the first wave: click CALL WAVE, or press N. Waves come on a clock after that; calling early pays Scrap.', needsNext: false, done: (c) => c.wave >= 1 },
  { id: 'watch', target: 'strip:wave', text: 'The strip\'s NOW is what walks; NEXT is what comes, with a mark per trait and how its packs walk; the column names what answers it. Space pauses, 1-4 set the speed.', needsNext: true, done: (c) => c.next || c.wave >= 2 },
  { id: 'offer', target: 'offer', text: 'A quiet board after wave 2 offers three RELICS - rules that bend the game, not numbers. Take one (click it, or press 1-3).', needsNext: false, done: (c) => c.relics >= 1 || (c.wave >= 3 && !c.offerUp) },
  { id: 'slots', target: 'strip:slots', text: 'Held relics live in the Core\'s slots. Click one for its card; actives fire from there; two of a kind combine in the FORGE.', needsNext: true, done: (c) => c.next },
  { id: 'upgrade', target: 'upgrade', text: 'Scrap piles up - spend it. Select a tower and take a FORK in its card (the first costs 25): a forked tower near the Core beats a plain one far away.', needsNext: false, done: (c) => c.upgrades >= 1 || c.wave >= 6 },
  { id: 'rock', target: 'rock', text: 'ROCK hides ore, caches and bare ground. Select a rock and PROSPECT it to find out - Scrap and time, and the veins it opens pay Ore.', needsNext: true, done: (c) => c.next },
  { id: 'end', target: null, text: 'Hold the final wave and THE CORE STANDS. Every run banks its Ore for the WORKSHOP on the title page: towers, relic branches, slots, threats, tiles. That is the tutorial - the rest is yours.', needsNext: true, done: (c) => c.next },
];

/** The step index after this frame: advances through every step the context has already finished. */
export function nextStep(index: number, c: TutorialCtx): number {
  let i = index;
  let guard = 0;
  while (i < TUTORIAL_STEPS.length && TUTORIAL_STEPS[i].done(c) && guard++ < TUTORIAL_STEPS.length) {
    i++;
    // NEXT is consumed by the one step it ends.
    if (TUTORIAL_STEPS[i - 1].needsNext) c = { ...c, next: false };
  }
  return i;
}

/**
 * A good ground cell to point a new player at: buildable ground touching
 * the road, nearest the Core's face by plain distance. Null when the board
 * has none (it always has some since session 24).
 */
export function goodGround(cells: readonly (string | null)[], W: number, H: number, coreFace: readonly CellRef[], isRoad: (c: string) => boolean): CellRef | null {
  const mid = coreFace[Math.floor(coreFace.length / 2)] ?? coreFace[0];
  if (!mid) return null;
  let best: CellRef | null = null;
  let bestD = Infinity;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (cells[y * W + x] !== 'G') continue;
      let touchesRoad = false;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const c = cells[(y + dy) * W + (x + dx)];
        if (x + dx < 0 || y + dy < 0 || x + dx >= W || y + dy >= H || c === null || c === undefined) continue;
        if (isRoad(c)) touchesRoad = true;
      }
      if (!touchesRoad) continue;
      const d = (x - mid.x) ** 2 + (y - mid.y) ** 2;
      if (d < bestD) { bestD = d; best = { x, y }; }
    }
  return best;
}

/** A rock cell touching the road, nearest the Core's face; null when the board has none. */
export function nearRock(cells: readonly (string | null)[], W: number, H: number, coreFace: readonly CellRef[], isRoad: (c: string) => boolean): CellRef | null {
  const mid = coreFace[Math.floor(coreFace.length / 2)] ?? coreFace[0];
  if (!mid) return null;
  let best: CellRef | null = null;
  let bestD = Infinity;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (cells[y * W + x] !== 'R') continue;
      let near = false;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const c = cells[(y + dy) * W + (x + dx)];
        if (x + dx < 0 || y + dy < 0 || x + dx >= W || y + dy >= H || c === null || c === undefined) continue;
        if (isRoad(c) || c === 'G') near = true;
      }
      if (!near) continue;
      const d = (x - mid.x) ** 2 + (y - mid.y) ** 2;
      if (d < bestD) { bestD = d; best = { x, y }; }
    }
  return best;
}
