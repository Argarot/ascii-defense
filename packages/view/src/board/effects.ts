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
import type { TermSurface } from '@ascii-defense/render';
import { role } from '../palette';
import { isReducedMotion } from '../motion';
import { CELL_H, CELL_W, hash2 } from './style';

interface Effect {
  kind: 'pulse' | 'blast' | 'spark' | 'death' | 'breach' | 'dust' | 'beam' | 'frost' | 'arc' | 'lance';
  x: number; // continuous cell units, same space the sim speaks
  y: number;
  r: number;
  start: number; // sim tick of birth
  ttl: number; // lifetime in sim ticks
  /** The arc's points: the tower's centre, then every body hit (session 25). */
  pts?: readonly { x: number; y: number }[];
  /** A lance's far end and heat (session 26). */
  x1?: number;
  y1?: number;
  heat?: number;
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
  beam: 8,
  frost: 40, // overridden per event by the freeze's own length
  arc: 4,
  lance: 3, // one fire every three ticks: the line never blinks
};
/** The beam's fall before its blast opens, in ticks. */
const BEAM_FALL = 3;

/** Linear mix of two #rrggbb colours - effects fade by colour, not alpha. */
function mixHex(h1: string, h2: string, t01: number): string {
  const p = (h: string, i: number): number => parseInt(h.slice(i, i + 2), 16);
  const c = (i: number): string =>
    Math.round(p(h1, i) + (p(h2, i) - p(h1, i)) * t01)
      .toString(16)
      .padStart(2, '0');
  return '#' + c(1) + c(3) + c(5);
}

/** How far (in glyph rows) an arc may bow away from the straight line. */
const ARC_BOW = 2.5;

/**
 * The glyph cells of one continuous line from (x0, y0) to (x1, y1) in
 * glyph units (feedback 2026-09-05 item 4: "a continuous line, which can
 * curve"): a walk along the longer axis, one cell per step, with a
 * perpendicular BOW that is zero at both ends (a half sine, `bow` rows at
 * its peak) and a small crackle from the hash. Every consecutive pair of
 * cells is 8-adjacent, so the glyphs join into one stroke; when the curve
 * asks for a bigger jump the walk fills the cells between.
 */
export function arcPath(x0: number, y0: number, x1: number, y1: number, bow: number, crackleSeed: number): [number, number][] {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const steps = Math.max(1, Math.round(Math.max(Math.abs(dx), Math.abs(dy) * (CELL_W / CELL_H))));
  // The perpendicular in glyph space (rows are taller than columns, so
  // the bow is scaled to look like a curve, not a lean).
  const len = Math.hypot(dx, dy) || 1;
  const px = -dy / len;
  const py = dx / len;
  const out: [number, number][] = [];
  let last: [number, number] | null = null;
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    const arch = Math.sin(Math.PI * t) * bow;
    const crackle = crackleSeed === 0 ? 0 : (hash2(s, crackleSeed, 11) - 0.5) * 0.9;
    const off = arch + crackle * Math.sin(Math.PI * t);
    const gx = Math.round(x0 + dx * t + px * off * (CELL_W / CELL_H));
    const gy = Math.round(y0 + dy * t + py * off);
    if (last) {
      // Fill so every pair of cells touches (8-adjacency).
      let fx: number = last[0];
      let fy: number = last[1];
      while (Math.abs(gx - fx) > 1 || Math.abs(gy - fy) > 1) {
        fx += Math.sign(gx - fx);
        fy += Math.sign(gy - fy);
        out.push([fx, fy]);
      }
      if (fx === gx && fy === gy) continue;
    }
    out.push([gx, gy]);
    last = [gx, gy];
  }
  return out;
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
        case 'strike':
          // The orbital (6.10): a column from the top edge to the cell, then
          // the blast of the kill radius opening where it lands.
          this.add({ kind: 'beam', x: e.x, y: e.y, r: e.r, start: e.tick, ttl: TTL.beam });
          this.add({ kind: 'blast', x: e.x, y: e.y, r: e.r, start: e.tick + BEAM_FALL, ttl: TTL.blast });
          break;
        case 'freeze':
          this.add({ kind: 'frost', x: 0, y: 0, r: 0, start: e.tick, ttl: Math.max(1, e.ticks) });
          break;
        case 'beam':
          this.add({ kind: 'lance', x: e.x0, y: e.y0, r: e.w, start: e.tick, ttl: TTL.lance, x1: e.x1, y1: e.y1, heat: e.heat });
          break;
        case 'arc':
          this.add({ kind: 'arc', x: e.pts[0]?.x ?? 0, y: e.pts[0]?.y ?? 0, r: 0, start: e.tick, ttl: TTL.arc, pts: e.pts });
          for (let i = 1; i < e.pts.length; i++) this.add({ kind: 'spark', x: e.pts[i].x, y: e.pts[i].y, r: 0, start: e.tick, ttl: TTL.spark });
          break;
        case 'impact':
          // A delayed impact is Splinter's second blast: the same spot, a beat later.
          if (e.r > 0) this.add({ kind: 'blast', x: e.x, y: e.y, r: e.r, start: e.tick + (e.delay ?? 0), ttl: TTL.blast });
          else this.add({ kind: 'spark', x: e.x, y: e.y, r: 0, start: e.tick + (e.delay ?? 0), ttl: TTL.spark });
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
        case 'loot':
          this.add({ kind: 'spark', x: e.x, y: e.y, r: 0, start: e.tick, ttl: TTL.spark });
          this.add({ kind: 'dust', x: e.x, y: e.y, r: 0, start: e.tick, ttl: TTL.dust });
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
  draw(term: TermSurface, nowTick: number): void {
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
        case 'beam': this.drawBeam(term, e, age01, still); break;
        case 'frost': this.drawFrost(term, e, age01, still); break;
        case 'arc': this.drawArc(term, e, age01, still); break;
        case 'lance': this.drawLance(term, e, age01, still); break;
      }
    }
  }

  /** Iterate the glyphs whose centre lies on a ring, in cell units. */
  private ring(
    term: TermSurface,
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
  private drawPulse(term: TermSurface, e: Effect, age01: number, still: boolean): void {
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
  private drawBlast(term: TermSurface, e: Effect, age01: number, still: boolean): void {
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
  private drawSpark(term: TermSurface, e: Effect, age01: number): void {
    const gx = Math.floor(e.x * CELL_W);
    const gy = Math.floor(e.y * CELL_H);
    if (age01 < 0.5) term.put(gx, gy, 'x', role('fx.flash'));
    else term.put(gx, gy, '.', role('fx.ember'));
  }

  /** A kill: a puff that rises and thins. Reduced motion: it stays put. */
  private drawDeath(term: TermSurface, e: Effect, age01: number, still: boolean): void {
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
  private drawBreach(term: TermSurface, e: Effect, age01: number, still: boolean): void {
    const bg = still ? '#4a1520' : mixHex('#8a2231', '#12060a', age01);
    const gx0 = Math.floor(e.x) * CELL_W;
    const gy0 = Math.floor(e.y) * CELL_H;
    for (let y = 0; y < CELL_H; y++)
      for (let x = 0; x < CELL_W; x++) term.tint(gx0 + x, gy0 + y, bg);
  }

  /** Construction dust: a sparse settle around the cell. Skipped when still - the tower appearing is its own feedback. */
  /**
   * The orbital's column: a line of light from the top edge down to the
   * cell, three glyphs wide at its brightest, thinning and cooling as the
   * blast takes over. Reduced motion: a single static column.
   */
  private drawBeam(term: TermSurface, e: Effect, age01: number, still: boolean): void {
    const gx = Math.floor(e.x * CELL_W);
    const gyEnd = Math.floor(e.y * CELL_H);
    const bright = still ? 0.5 : 1 - age01;
    const fg = mixHex(role('fx.smoke'), role('fx.flash'), bright);
    const wide = !still && age01 < 0.45;
    for (let gy = 0; gy <= gyEnd; gy++) {
      term.put(gx, gy, age01 < 0.7 || still ? '|' : ':', fg);
      if (wide) {
        term.put(gx - 1, gy, hash2(gx - 1, gy, 7) < 0.6 ? '|' : ':', mixHex(role('fx.smoke'), role('fx.flash'), bright * 0.6));
        term.put(gx + 1, gy, hash2(gx + 1, gy, 7) < 0.6 ? '|' : ':', mixHex(role('fx.smoke'), role('fx.flash'), bright * 0.6));
      }
    }
  }

  /**
   * A freeze (Stasis, Flashbang): the board's edges frost over for as long
   * as the enemies are held - a cold frame two glyphs deep, with hashed
   * sparkles that thin out as the effect ends. Cheap: the border only.
   */
  private drawFrost(term: TermSurface, _e: Effect, age01: number, still: boolean): void {
    const ice = role('tower.frost.ice_edge');
    const depth = 2;
    const fade = still ? 1 : 1 - age01;
    for (let gy = 0; gy < term.rows; gy++)
      for (let gx = 0; gx < term.cols; gx++) {
        const d = Math.min(gx, gy, term.cols - 1 - gx, term.rows - 1 - gy);
        if (d >= depth) continue;
        term.shade(gx, gy, 1.3 + 0.5 * fade, 0.1);
        if (!still && hash2(gx, gy, 19) < 0.08 * fade) term.put(gx, gy, '*', ice);
      }
  }

  /**
   * A chain arc (session 25, the Tesla Coil): a jagged line of light from
   * the tower through every body it hit, glyph by direction, jittered by
   * the hash so no two arcs look stamped, cooling to smoke over four
   * ticks. Reduced motion: the straight line, one tick.
   */
  private drawArc(term: TermSurface, e: Effect, age01: number, still: boolean): void {
    const pts = e.pts ?? [];
    if (still && age01 > 0.3) return;
    const fg = mixHex(role('tower.tesla.arc'), role('fx.smoke'), still ? 0 : age01);
    for (let i = 1; i < pts.length; i++) {
      const cells = arcPath(pts[i - 1].x * CELL_W, pts[i - 1].y * CELL_H, pts[i].x * CELL_W, pts[i].y * CELL_H, still ? 0 : (hash2(i, e.start, 5) - 0.5) * 2 * ARC_BOW, still ? 0 : Math.floor(age01 * 4));
      // From the cell after the source to the body itself: the stroke
      // reaches what it hits, and the next segment starts there.
      for (let k = 1; k < cells.length; k++) {
        const [gx, gy] = cells[k];
        const [nx, ny] = cells[Math.min(k + 1, cells.length - 1)];
        const dx = nx - gx;
        const dy = ny - gy;
        const ch = dy === 0 ? '-' : dx === 0 ? '|' : dx * dy > 0 ? '\\' : '/';
        if (gx >= 0 && gy >= 0 && gx < term.cols && gy < term.rows) term.put(gx, gy, ch, fg);
      }
    }
  }

  /**
   * The Laser Lance's beam (session 26): a straight line of light down the
   * corridor from the tower's edge to its far end, '=' along a row, '|'
   * down a column, whiter as the heat climbs. Reduced motion: the same line
   * at its cold colour.
   */
  private drawLance(term: TermSurface, e: Effect, age01: number, still: boolean): void {
    // Reworked 2026-09-06 (Daniil): BACKGROUND colour only, so the walkers
    // in it stay readable - three glyphs wide, the centre line the beam,
    // the two beside it an afterglow of lower luminance and a slightly
    // different shade. It PULSES: bright at the fire, decaying over the
    // ticks to the next, so a firing lance throbs rather than sits lit.
    // Whiter as the heat climbs. Reduced motion: the cold centre, no throb.
    const x1 = e.x1 ?? e.x;
    const y1 = e.y1 ?? e.y;
    const horizontal = Math.abs(x1 - e.x) >= Math.abs(y1 - e.y);
    const heat01 = still ? 0 : Math.max(0, Math.min(1, (e.heat ?? 1) - 1));
    const pulse = still ? 0.6 : 1 - age01 * 0.7;
    const beam = mixHex(role('tower.laser.beam'), role('fx.flash'), heat01 * 0.6);
    const dark = role('terrain.road.dark');
    const centre = mixHex(dark, beam, 0.75 * pulse);
    const glow = mixHex(dark, role('tower.laser.lens'), 0.35 * pulse);
    const gx0 = Math.floor(e.x * CELL_W);
    const gy0 = Math.floor(e.y * CELL_H);
    const gx1 = Math.floor(x1 * CELL_W);
    const gy1 = Math.floor(y1 * CELL_H);
    if (horizontal) {
      const step = gx1 >= gx0 ? 1 : -1;
      for (let gx = gx0 + step * Math.ceil(CELL_W / 2); gx !== gx1 + step; gx += step) {
        if (gx < 0 || gx >= term.cols) continue;
        term.tint(gx, gy0, centre);
        if (!still) { if (gy0 > 0) term.tint(gx, gy0 - 1, glow); if (gy0 + 1 < term.rows) term.tint(gx, gy0 + 1, glow); }
      }
    } else {
      const step = gy1 >= gy0 ? 1 : -1;
      for (let gy = gy0 + step * Math.ceil(CELL_H / 2); gy !== gy1 + step; gy += step) {
        if (gy < 0 || gy >= term.rows) continue;
        term.tint(gx0, gy, centre);
        if (!still) { if (gx0 > 0) term.tint(gx0 - 1, gy, glow); if (gx0 + 1 < term.cols) term.tint(gx0 + 1, gy, glow); }
      }
    }
  }

  private drawDust(term: TermSurface, e: Effect, age01: number, still: boolean): void {
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
