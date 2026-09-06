/**
 * Drawing one sprite frame onto any surface (session 24): the board draws
 * towers with it and the strip draws the build buttons with it, so a
 * tower's button IS its board art - no second drawing of the same thing.
 */
import type { TermSurface } from '@ascii-defense/render';
import type { Sprite } from '@ascii-defense/content';
import { role } from '../palette';
import { CELL_H, CELL_W } from './style';

export type SpriteFrame = { art: readonly string[]; ink: readonly string[]; bgInk?: readonly string[]; ms?: number };

export interface DrawSpriteOptions {
  /** Paint every glyph in this role instead of the sprite's own inks (a greyed button). */
  flatFg?: string;
  /** Background for glyphs without a bgInk; default the tower's ground. */
  groundRole?: string;
  /**
   * Glyphs without a bgInk keep whatever is under them (session 25): a
   * walker on the road, an icon on its slot's plate. A sprite's own bgInk
   * still paints.
   */
  transparent?: boolean;
  /** Draw at most this many rows (a recoil that must not spill into the cell below). */
  clipRows?: number;
  /**
   * A ground role PER ROW for glyphs without a bgInk (2026-09-06, item 2:
   * a status is the colour under the walker, not a glyph beside it). A
   * null row stays transparent. Wins over groundRole and transparent.
   */
  rowGround?: readonly (string | null)[];
}

/**
 * Draw one frame at a glyph position. Bounds are the frame's own art (an
 * enemy is 3x2, a relic 4x3), never past the board cell.
 */
/** What a sprite needs from a surface: put, and ideally the font's has(). A scrolled proxy without has() draws every glyph. */
export type SpriteSurface = Pick<TermSurface, 'put'> & { has?: (ch: string) => boolean };

export function drawSpriteFrame(term: SpriteSurface, sp: Sprite, frame: SpriteFrame, gx0: number, gy0: number, opts: DrawSpriteOptions = {}): void {
  const ground = role(opts.groundRole ?? 'tower.ground');
  const rows = Math.min(opts.clipRows ?? CELL_H, CELL_H, frame.art.length);
  for (let r = 0; r < rows; r++) {
    const artRow = [...frame.art[r]];
    const inkRow = [...frame.ink[r]];
    const bgRow = frame.bgInk ? [...frame.bgInk[r]] : null;
    const cols = Math.min(CELL_W, artRow.length);
    for (let c = 0; c < cols; c++) {
      const chr = artRow[c];
      const inkRole = sp.inkMap[inkRow[c]];
      if (chr === ' ' || inkRole === null || inkRole === undefined || (term.has && !term.has(chr))) continue;
      const rn = inkRole === 'PATH' ? 'tower.core' : inkRole;
      const bgRole = bgRow ? sp.inkMap[bgRow[c]] : undefined;
      const ownBg = bgRole === null || bgRole === undefined || bgRole === 'PATH' ? undefined : role(bgRole);
      const rowBg = opts.rowGround ? (opts.rowGround[r] ? role(opts.rowGround[r] as string) : undefined) : undefined;
      const bg = opts.flatFg ? undefined : ownBg ?? (opts.rowGround ? rowBg : opts.transparent ? undefined : ground);
      term.put(gx0 + c, gy0 + r, chr, opts.flatFg ? role(opts.flatFg) : role(rn), bg);
    }
  }
}

/** World-clock milliseconds per sim tick: the sequences' time base. */
export const TICK_MS = 50;

export interface AttackLook {
  frame: SpriteFrame;
  /** Paint every glyph in this role (a flash). */
  flatFg?: string;
  /** Draw the frame this many rows lower, clipped to the cell (a recoil). */
  dy?: number;
  /** One extra glyph over the cell (smoke, a charge spark). */
  overlay?: { x: number; y: number; ch: string; role: string };
}

/** Sum of a sequence's frame durations in ms. */
function seqMs(sp: Sprite, seq: readonly SpriteFrame[]): number {
  return seq.reduce((n, f) => n + (f.ms ?? sp.frameMs ?? 600), 0);
}
/** The frame of a sequence at `ageMs`, or null once it has run out. */
function seqFrame(sp: Sprite, seq: readonly SpriteFrame[], ageMs: number): SpriteFrame | null {
  let t = 0;
  for (const f of seq) {
    t += f.ms ?? sp.frameMs ?? 600;
    if (ageMs < t) return f;
  }
  return null;
}

/** The share of the cooldown during which a tower reads as CHARGING. */
export const CHARGE_SHARE = 0.25;
/** The derived fallback's timings (ms): a muzzle spark, then a wisp of smoke. */
const DERIVED_FIRE_MS = 80;
const DERIVED_COOL_MS = 240;

/**
 * What a tower looks like at this moment of its attack cycle (session 25;
 * ASSETS.md sec 3): its `fire`, `cool` and `charge` sequences when the
 * state has them (every shipped sprite does - the importer and the
 * generator write placeholders), else a SUBTLE fallback over the idle
 * frame: a muzzle spark, a wisp of smoke, a charge spark. Feedback
 * 2026-09-05 item 2: the flash-and-recoil read as a jump; the tower's body
 * never moves now. Null = idle. `sinceFire` is in ticks (-1 before the
 * first shot); `cooldown01` runs 1 (just fired) to 0 (ready).
 */
export function attackLook(sp: Sprite, st: Sprite['states'][string], idle: SpriteFrame, sinceFire: number, cooldown01: number): AttackLook | null {
  if (sinceFire < 0) return null;
  const seqs = st.sequences ?? {};
  const age = sinceFire * TICK_MS;
  // FIRE, then COOL, by age since the shot.
  if (seqs.fire) {
    const f = seqFrame(sp, seqs.fire, age);
    if (f) return { frame: f };
    if (seqs.cool) {
      const c = seqFrame(sp, seqs.cool, age - seqMs(sp, seqs.fire));
      if (c) return { frame: c };
    }
  } else {
    if (age < DERIVED_FIRE_MS) return { frame: idle, overlay: { x: CELL_W - 1, y: 0, ch: '*', role: 'fx.flash' } };
    const coolAge = age - DERIVED_FIRE_MS;
    if (coolAge < DERIVED_COOL_MS) return { frame: idle, overlay: { x: CELL_W - 1, y: coolAge < DERIVED_COOL_MS / 2 ? 0 : -1, ch: '~', role: 'fx.smoke' } };
  }
  // CHARGE: the last share of the cooldown, while the tower is engaged.
  if (cooldown01 > 0 && cooldown01 <= CHARGE_SHARE) {
    const p = 1 - cooldown01 / CHARGE_SHARE; // 0 at the start of the charge, 1 at ready
    if (seqs.charge) return { frame: seqs.charge[Math.min(seqs.charge.length - 1, Math.floor(p * seqs.charge.length))] };
    return { frame: idle, overlay: { x: 0, y: 0, ch: Math.floor(age / 100) % 2 === 0 ? '+' : '*', role: 'fx.ember' } };
  }
  return null;
}

/** The idle frame of a state at a wall-clock time, phase-offset by `salt` so a crowd is out of step. */
export function idleFrame(sp: Sprite, st: Sprite['states'][string], animMs: number, salt = 0): SpriteFrame {
  const cycle = [st, ...(st.frames ?? [])];
  if (cycle.length === 1) return st;
  return cycle[(Math.floor(animMs / (sp.frameMs ?? 600)) + salt) % cycle.length];
}
