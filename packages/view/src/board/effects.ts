/**
 * The effects layer (WBS 4.1): consumes the sim's event feed, owns short-lived
 * effect entities, and draws them over the finished board. This is the only
 * place sim events become pixels, and information flows ONE way - the sim
 * never learns any of this happened (invariant 2; the golden hash is the
 * proof, since events were never part of it).
 *
 * Gameplay effects are anchored to SIM TICKS, so pausing freezes an explosion
 * mid-bloom - an honest pause shows a stopped world, not a world that keeps
 * seething. Ambient animation (drift, water, idles) lives elsewhere on the
 * wall clock. Under reduced motion (PRD sec 15.4) every effect here degrades
 * to a short-lived STATIC mark: the information survives, the motion doesn't.
 */
import type { StampedSimEvent } from '@ascii-defense/engine';
import type { GLTerm } from '@ascii-defense/render';
import { role } from '../palette';
import { isReducedMotion } from '../motion';
import { CELL_H, CELL_W, hash2 } from './style';

interface Effect {
  kind: 'pulse' | 'blast' | 'spark' | 'death' | 'breach' | 'dust';
  x: number; // continuous cell units, same space the sim speaks
  y: number;
  r: number;
  start: number; // sim tick of birth
  ttl: number; // lifetime in sim ticks
}

/** Enough for the busiest wave; past this the oldest eye candy yields. */
const EFFECT_CAP = 128;

const TTL: Record<Effect['kind'], number> = {
  pulse: 10,
  blast: 9,
  spark: 4,
  death: 6,
  breach: 9,
  dust: 8,
};

/** Linear mix of two #rrggbb colours - effects fade by colour, not alpha. */
function mixHex(h1: string, h2: string, t01: number): string {
  const p = (h: string, i: number): number => parseInt(h.slice(i, i + 2), 16);
  const c = (i: number): string =>
    Math.round(p(h1, i) + (p(h2, i) - p(h1, i)) * t01)
      .toString(16)
      .padStart(2, '0');
  return '#' + c(1) + c(3) + c(5);
}

export class EffectsLayer {
  private effects: Effect[] = [];
  private lastSeq = -1;

  /** Forget everything - a reroll starts a new sim whose seq restarts at 0. */
  reset(): void {
    this.effects = [];
    this.lastSeq = -1;
  }

  /**
   * Adopt every event newer than the last one seen. Idempotent per frame:
   * the feed is append-only with monotonic seq, so re-reading it is free.
   */
  ingest(events: readonly StampedSimEvent[]): void {
    for (const e of events) {
      if (e.seq <= this.lastSeq) continue;
      this.lastSeq = e.seq;
      switch (e.kind) {
        case 'pulse':
          this.add({ kind: 'pulse', x: e.x, y: e.y, r: e.r, start: e.tick, ttl: TTL.pulse });
          break;
        case 'impact':
          if (e.r > 0) this.add({ kind: 'blast', x: e.x, y: e.y, r: e.r, start: e.tick, ttl: TTL.blast });
          else this.add({ kind: 'spark', x: e.x, y: e.y, r: 0, start: e.tick, ttl: TTL.spark });
          break;
        case 'death':
          this.add({ kind: 'death', x: e.x, y: e.y, r: 0, start: e.tick, ttl: TTL.death });
          break;
        case 'breach':
          this.add({ kind: 'breach', x: e.x, y: e.y, r: 0, start: e.tick, ttl: TTL.breach });
          break;
        case 'build':
        case 'sell':
          this.add({ kind: 'dust', x: e.x + 0.5, y: e.y + 0.5, r: 0, start: e.tick, ttl: TTL.dust });
          break;
        case 'reveal':
          this.add({ kind: 'dust', x: e.x + 0.5, y: e.y + 0.5, r: 0, start: e.tick, ttl: TTL.dust });
          this.add({ kind: 'spark', x: e.x + 0.5, y: e.y + 0.5, r: 0, start: e.tick, ttl: TTL.spark });
          break;
        case 'waveStart':
          break; // entries are already telegraphed; a screen-wide flash would only startle
        default:
          e satisfies never;
      }
    }
  }

  private add(e: Effect): void {
    this.effects.push(e);
    if (this.effects.length > EFFECT_CAP) this.effects.shift();
  }

  /** Draw everything still alive at this sim tick. Call after the board, before any end screen. */
  draw(term: GLTerm, nowTick: number): void {
    const still = isReducedMotion();
    this.effects = this.effects.filter((e) => nowTick - e.start <= e.ttl && nowTick >= e.start);
    for (const e of this.effects) {
      const age01 = (nowTick - e.start) / e.ttl;
      switch (e.kind) {
        case 'pulse': this.drawPulse(term, e, age01, still); break;
        case 'blast': this.drawBlast(term, e, age01, still); break;
        case 'spark': this.drawSpark(term, e, age01); break;
        case 'death': this.drawDeath(term, e, age01, still); break;
        case 'breach': this.drawBreach(term, e, age01, still); break;
        case 'dust': this.drawDust(term, e, age01, still); break;
      }
    }
  }

  /** Iterate the glyphs whose centre lies on a ring, in cell units. */
  private ring(
    term: GLTerm,
    x: number,
    y: number,
    rNow: number,
    band: number,
    fn: (gx: number, gy: number) => void,
  ): void {
    const minGx = Math.max(0, Math.floor((x - rNow - 1) * CELL_W));
    const maxGx = Math.min(term.cols - 1, Math.ceil((x + rNow + 1) * CELL_W));
    const minGy = Math.max(0, Math.floor((y - rNow - 1) * CELL_H));
    const maxGy = Math.min(term.rows - 1, Math.ceil((y + rNow + 1) * CELL_H));
    for (let gy = minGy; gy <= maxGy; gy++)
      for (let gx = minGx; gx <= maxGx; gx++) {
        const ux = (gx + 0.5) / CELL_W - x;
        const uy = (gy + 0.5) / CELL_H - y;
        if (Math.abs(Math.sqrt(ux * ux + uy * uy) - rNow) <= band) fn(gx, gy);
      }
  }

  /** The expanding tower pulse - the visual that used to live in BoardView. */
  private drawPulse(term: GLTerm, e: Effect, age01: number, still: boolean): void {
    const rNow = still ? e.r : e.r * age01;
    const strength = still ? 1.5 : 1 + 1.4 * (1 - age01);
    this.ring(term, e.x, e.y, rNow, 0.24, (gx, gy) => term.shade(gx, gy, strength, 0.08));
  }

  /**
   * Mortar blast (4.26; reworked, playtest 12): the blast's TOTAL visual
   * extent IS the kill radius. The shockwave ring expands TO r and dies
   * there - it and the flash together show the radius, never a multiplier
   * on top of it. Playtest 12: the 1.5r overshoot read as a much bigger
   * blast than the one that kills.
   */
  private drawBlast(term: GLTerm, e: Effect, age01: number, still: boolean): void {
    // Shockwave ring: expands to the kill radius over the lifetime and
    // fades to smoke as it arrives - nothing is ever drawn beyond r.
    const rNow = still ? e.r : Math.max(0.4, e.r * age01);
    const phase = still ? 1 : age01 < 0.35 ? 0 : age01 < 0.7 ? 1 : 2;
    const glyphs = ['*', 'x', '.'];
    const fg = [role('fx.flash'), role('fx.ember'), role('fx.smoke')][phase];
    this.ring(term, e.x, e.y, rNow, 0.3, (gx, gy) => {
      // Debris is grainy, not a solid wall: the hash thins the ring and
      // varies the glyph so two blasts never look stamped.
      const h = hash2(gx, gy, 31 + phase);
      if (h < (phase === 2 ? 0.5 : 0.72)) {
        term.put(gx, gy, glyphs[phase === 0 ? (h < 0.3 ? 0 : 1) : phase], fg);
      }
    });
    if (!still && age01 < 0.4) {
      // Ground zero whites out - a disc of the FULL kill radius, decaying
      // as the shockwave crosses it.
      const minGx = Math.max(0, Math.floor((e.x - e.r) * CELL_W));
      const maxGx = Math.min(term.cols - 1, Math.ceil((e.x + e.r) * CELL_W));
      const minGy = Math.max(0, Math.floor((e.y - e.r) * CELL_H));
      const maxGy = Math.min(term.rows - 1, Math.ceil((e.y + e.r) * CELL_H));
      const strength = 3.2 - 4 * age01; // 3.2 at birth, gone by 0.4
      for (let gy = minGy; gy <= maxGy; gy++)
        for (let gx = minGx; gx <= maxGx; gx++) {
          const ux = (gx + 0.5) / CELL_W - e.x;
          const uy = (gy + 0.5) / CELL_H - e.y;
          if (Math.sqrt(ux * ux + uy * uy) <= e.r) term.shade(gx, gy, strength, 0.25);
        }
    }
  }

  /** A plain hit: one bright glyph, gone in a blink. Already static. */
  private drawSpark(term: GLTerm, e: Effect, age01: number): void {
    const gx = Math.floor(e.x * CELL_W);
    const gy = Math.floor(e.y * CELL_H);
    if (age01 < 0.5) term.put(gx, gy, 'x', role('fx.flash'));
    else term.put(gx, gy, '.', role('fx.ember'));
  }

  /** A kill: a puff that rises and thins. Reduced motion: it stays put. */
  private drawDeath(term: GLTerm, e: Effect, age01: number, still: boolean): void {
    const gx = Math.floor(e.x * CELL_W);
    const rise = still ? 0 : Math.floor(age01 * 2);
    const gy = Math.floor(e.y * CELL_H) - rise;
    if (age01 < 0.45) term.put(gx, gy, '%', role('fx.ember'));
    else term.put(gx, gy, ':', role('fx.smoke'));
  }

  /**
   * A breach: the cell the enemy died into flashes red and decays. Damage to
   * the Core is the one event that must never be missable (PRD sec 5.4).
   */
  private drawBreach(term: GLTerm, e: Effect, age01: number, still: boolean): void {
    const bg = still ? '#4a1520' : mixHex('#8a2231', '#12060a', age01);
    const gx0 = Math.floor(e.x) * CELL_W;
    const gy0 = Math.floor(e.y) * CELL_H;
    for (let y = 0; y < CELL_H; y++)
      for (let x = 0; x < CELL_W; x++) term.tint(gx0 + x, gy0 + y, bg);
  }

  /** Construction dust: a sparse settle around the cell. Skipped when still - the tower appearing is its own feedback. */
  private drawDust(term: GLTerm, e: Effect, age01: number, still: boolean): void {
    if (still) return;
    const gx0 = Math.floor(e.x) * CELL_W;
    const gy0 = Math.floor(e.y) * CELL_H;
    for (let y = -1; y <= CELL_H; y++)
      for (let x = -1; x <= CELL_W; x++) {
        const edge = y === -1 || y === CELL_H || x === -1 || x === CELL_W;
        if (!edge) continue;
        // Density decays with age: each mote has a hash-fixed death time.
        if (hash2(gx0 + x, gy0 + y, 41) > age01) term.put(gx0 + x, gy0 + y, '.', role('fx.smoke'));
      }
  }
}
