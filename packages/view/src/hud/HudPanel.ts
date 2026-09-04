/**
 * The HUD: a full-height side panel at 2x font (10x16 px per glyph - integer
 * multiple, crisp), to the right of a 12-tile board. This text is meant to
 * be READ (Daniil), and the visual tier tree needs the vertical room.
 *
 * Mouse-first: every actionable label is a click region, and HOVERING a
 * region previews it - palette hover previews that tower's radius on the
 * board, choice hover previews the post-purchase stats in pulsing green.
 * The words, the buttons and the previews are all the same region data, so
 * they cannot drift apart.
 */
import type { TermSurface } from '@ascii-defense/render';
import { PRIORITIES, type Priority } from '@ascii-defense/engine';
import { role } from '../palette';

export interface HudChoiceInfo {
  name: string;
  cost: number;
  state: 'chosen' | 'rejected' | 'available' | 'locked';
  affordable: boolean;
}

export interface HudTierInfo {
  choices: readonly HudChoiceInfo[];
}

export interface HudStats {
  dmg: number;
  dps: string;
  range: number;
  /** The dead zone in cells; 0 = none. Lower is better. */
  minRange: number;
  /** Projectiles per volley (1 = a single shot). */
  shots: number;
  /** Enemies a shot passes into after its target. */
  pierce: number;
  slow: number;
  /** Blast radius in cells; 0 for non-explosive shots (WBS 2.19). */
  blast: number;
  /** Producers: yield per second, e.g. "0.3/s"; null for fighters. */
  prod: string | null;
}

export interface HudTowerInfo {
  name: string;
  kills: number;
  /** Producers: the vein under the tower. null for fighters. */
  deposit: { left: number; initial: number } | null;
  stats: HudStats;
  /** Post-purchase stats while hovering an available choice; else null. */
  preview: HudStats | null;
  /** A producer standing off its ore vein - mining nothing (PRD sec 5.3). */
  offVein: boolean;
  priority: Priority;
  tiers: readonly HudTierInfo[];
  /** The hovered choice's written sentence (2.10); null when nothing hovers. */
  choiceDesc?: string | null;
}

export interface HudState {
  scrap: number;
  ore: number;
  /** Seconds until the next wave; 0 while one is in progress. */
  nextWaveIn: number;
  /** Held relics; the full inventory panel arrives with the Core vessel (1.6.4). */
  relicCount: number;
  kills: number;
  /** 0 = endless; otherwise the wave that wins the run (D6). */
  finalWave: number;
  victory: boolean;
  coreHp: number;
  coreHpMax: number;
  wave: number;
  nextFronts: number;
  /**
   * The next wave, composed one wave ahead (design round 1, item 11), and
   * the CALL button's state (item 9): `waiting` = wave 1 not yet called,
   * `canCall` = the current wave has finished spawning, `callBonus` = Scrap
   * for calling now. null once the final wave is out.
   */
  nextWave: { wave: number; boss: boolean; kinds: readonly { name: string; count: number }[]; canCall: boolean; callBonus: number; waiting: boolean } | null;
  gameOver: boolean;
  L: number;
  seed: number;
  speedLabel: string;
  inspector: string;
  palette: readonly { name: string; cost: number; affordable: boolean; id?: string }[];
  selectedBuild: number;
  buildTargetSelected: boolean;
  selectedTower: HudTowerInfo | null;
  /** The Core card, when a Core cell is selected. */
  core: HudCoreInfo | null;
  /** The cache card, when an unopened cache is selected (PRD sec 4.6): its source. */
  cache: { source: string } | null;
  /** What the last opened cache gave, shown briefly; null otherwise. */
  loot: string | null;
  /** The prospect card, when a rock cell is selected. */
  rock: { cost: number; affordable: boolean; seconds: number; job: { pct: number } | null } | null;
  /** Animation phase 0..1 - preview numbers pulse on it. */
  phase: number;
}

export type HudAction =
  | { kind: 'priority'; value: Priority }
  | { kind: 'build'; index: number }
  | { kind: 'choose'; tier: number; option: number }
  | { kind: 'relic'; index: number }
  | { kind: 'coreDraw' }
  | { kind: 'openCache' }
  | { kind: 'prospect' }
  | { kind: 'callWave' };

/** One inventory slot on the Core card. Empty slots render too (Daniil). */
export interface HudRelicSlot {
  /** Two-letter tag, '' when empty. */
  label: string;
  name: string;
  state: 'empty' | 'passive' | 'ready' | 'cooling' | 'consumable';
  /** Seconds until an active is ready again; 0 otherwise. */
  cooldownSec: number;
  /** Relic id + whether firing needs a board-click aim (main-thread arming). */
  id?: string;
  targeted?: boolean;
}

export interface HudCoreInfo {
  hp: number;
  hpMax: number;
  slots: readonly HudRelicSlot[];
  /** "Name - desc" of the hovered slot, or null. */
  hoverDesc: string | null;
  /** Ore price of a blind draw; the button greys when unaffordable or pool-dry. */
  drawCost: number;
  canDraw: boolean;
}

interface Region {
  row: number;
  x0: number;
  x1: number;
  action: HudAction;
}

const PRIORITY_LABEL: Record<Priority, string> = {
  first: '[F]irst',
  last: '[L]ast',
  closest: '[C]losest',
  weakest: '[W]eakest',
};

export class HudPanel {
  private regions: Region[] = [];
  // Panel scroll (2.13): the whole panel is a column that may outgrow its
  // rows; the wheel slides it. Regions are stored in CONTENT rows and
  // translated at hit-test time, so scrolling can never desync a click.
  private scroll = 0;
  private contentH = 0;

  constructor(
    private term: TermSurface,
    private glyphPxW: number,
    private glyphPxH: number,
  ) {}

  /** Wheel input: positive = down. Clamped to the last render's overflow. */
  scrollBy(lines: number): void {
    const max = Math.max(0, this.contentH + 2 - this.term.rows);
    this.scroll = Math.max(0, Math.min(max, this.scroll + lines));
  }

  actionAt(px: number, py: number): HudAction | null {
    const gx = Math.floor(px / this.glyphPxW);
    const gy = Math.floor(py / this.glyphPxH) + this.scroll;
    for (const r of this.regions) {
      if (r.row === gy && gx >= r.x0 && gx < r.x1) return r.action;
    }
    return null;
  }

  /**
   * A clickable label rendered as a BUTTON: a solid background plate the
   * full width of its region, so the click target is visible instead of
   * implied (Daniil: options should look like buttons, not clickable text).
   * Returns nothing; the caller registers the region itself.
   */
  private button(x: number, row: number, w: number, label: string, fg: string, bg: string): void {
    const padded = (' ' + label).padEnd(w, ' ').slice(0, w);
    this.contentH = Math.max(this.contentH, row);
    this.term.write(x, row - this.scroll, padded, fg, bg);
  }

  /** Greedy word-wrap into at most `maxLines` lines of width `w`. */
  private wrap(text: string, w: number, maxLines: number): string[] {
    const lines: string[] = [];
    let line = '';
    for (const word of text.split(' ')) {
      if (line !== '' && line.length + 1 + word.length > w) {
        lines.push(line);
        line = word;
      } else {
        line = line === '' ? word : line + ' ' + word;
      }
    }
    if (line !== '') lines.push(line);
    // Never silently drop words: cram the tail into the last allowed line.
    if (lines.length > maxLines) {
      const head = lines.slice(0, maxLines - 1);
      head.push(lines.slice(maxLines - 1).join(' ').slice(0, w));
      return head;
    }
    return lines;
  }

  render(s: HudState): void {
    // Every draw below goes through this offset shim: content speaks in its
    // own rows, the shim slides them by the scroll, GLTerm clips the rest.
    const raw = this.term;
    this.regions = [];
    this.contentH = 0;
    raw.clear(role('ui.bg'));
    const shim = {
      cols: raw.cols,
      rows: raw.rows,
      write: (x: number, y2: number, s2: string, fg: string, bg?: string): void => {
        this.contentH = Math.max(this.contentH, y2);
        raw.write(x, y2 - this.scroll, s2, fg, bg);
      },
      put: (x: number, y2: number, ch: string, fg: string, bg?: string): void => {
        this.contentH = Math.max(this.contentH, y2);
        raw.put(x, y2 - this.scroll, ch, fg, bg);
      },
      flush: (): void => raw.flush(),
    };
    const term = shim;
    const W = term.cols;
    const blink = s.phase % 1 < 0.5;
    const previewCol = blink ? role('path.4') : role('ui.accent');

    // ---- header + vitals ---------------------------------------------------
    term.write(0, 0, 'ASCII DEFENSE', role('ui.accent'));
    if (s.nextWaveIn > 0) {
      const cd = `next wave ${s.nextWaveIn}s`;
      term.write(W - cd.length, 0, cd, role('enemy.fast'));
    }
    term.write(0, 1, `seed ${s.seed} \u2802 ${s.speedLabel}`, role('ui.dim'));
    term.write(0, 3, `SCRAP ${s.scrap}`, role('ui.accent'));
    // Ore on the same line, right-aligned: the two currencies never compete
    // for the same pool (PRD sec 6), so they share a row, not a column.
    const oreLabel = `ORE ${s.ore}`;
    term.write(W - oreLabel.length, 3, oreLabel, role('terrain.ore.lit'));
    const hpFrac = s.coreHpMax > 0 ? s.coreHp / s.coreHpMax : 0;
    const barLen = Math.round(hpFrac * (W - 2));
    const coreCol = hpFrac <= 0.25 ? role('enemy.fast') : role('terrain.core.mid');
    term.write(0, 4, `CORE ${s.coreHp}/${s.coreHpMax}`, coreCol);
    term.write(0, 5, '='.repeat(Math.max(0, barLen)), coreCol);
    term.write(0, 7, s.finalWave > 0 ? `WAVE ${s.wave}/${s.finalWave}` : `WAVE ${s.wave}`, role('ui.text'));
    if (s.relicCount > 0) {
      const rl = `RELICS ${s.relicCount}`;
      term.write(W - rl.length, 7, rl, role('ui.accent'));
    }
    term.write(0, 8, `kills ${s.kills} \u2802 road L=${s.L}`, role('ui.dim'));
    // ---- the next wave, and the CALL button -------------------------------
    // What is coming is shown before it comes (item 11): counts by kind,
    // the fronts, and BOSS when one rides behind the escort. The button
    // is the player's clock (item 9): calling early banks the remaining
    // seconds as Scrap; wave 1 waits for the call and pays nothing.
    let y = 9;
    const nw = s.nextWave;
    if (nw) {
      const kinds = nw.kinds.map((k) => `${k.count} ${k.name}`).join(', ');
      const fronts = `${s.nextFronts} front${s.nextFronts === 1 ? '' : 's'}`;
      const head = `wave ${nw.wave} \u2802 ${fronts}${nw.boss ? ' \u2802 BOSS' : ''}`;
      term.write(0, y++, head, nw.boss ? role('enemy.fast') : role('ui.text'));
      for (const line of this.wrap(kinds, W, 2)) term.write(0, y++, line, role('ui.dim'));
      const label = nw.waiting ? `CALL WAVE 1` : nw.canCall ? `CALL WAVE ${nw.wave} +${nw.callBonus} scrap` : 'wave still arriving';
      this.button(0, y, W - 4, label, nw.canCall ? role('ui.bg') : role('ui.dim'), nw.canCall ? role('ui.accent') : role('ui.grid'));
      if (nw.canCall) this.regions.push({ row: y, x0: 0, x1: W - 4, action: { kind: 'callWave' } });
      y++;
    }
    if (s.loot) term.write(0, y++, `found: ${s.loot}`, role('terrain.ore.lit'));

    // ---- build palette (vertical, hover previews radius on the board) ------
    // Shown ONLY when an empty buildable tile is selected (Daniil): the
    // palette is the answer to "what can go HERE", not a permanent fixture.
    // The app filters it to what is legal on that tile - a vein offers the
    // Refinery, ground offers fighters. Rows are buttons.
    y += 1;
    if (s.palette.length > 0) {
      term.write(0, y++, 'BUILD', role('ui.dim'));
      s.palette.forEach((p, i) => {
        const sel = i === s.selectedBuild;
        const label = `${p.name} $${p.cost}`;
        this.button(0, y, W - 8, label, sel ? role('ui.bg') : p.affordable ? role('ui.text') : role('ui.dim'), sel ? role('ui.accent') : role('ui.grid'));
        this.regions.push({ row: y, x0: 0, x1: W - 8, action: { kind: 'build', index: i } });
        y++;
      });
      term.write(0, y + 1, 'click a button: builds on', role('ui.accent'));
      term.write(0, y + 2, 'the selected tile', role('ui.accent'));
      y += 4;
    } else if (!s.selectedTower && !s.gameOver) {
      term.write(0, y++, 'select an empty tile to', role('ui.dim'));
      term.write(0, y++, 'build on it', role('ui.dim'));
      y += 2;
    }

    // ---- selection ---------------------------------------------------------
    term.write(0, y++, '-'.repeat(W), role('ui.grid'));
    if (s.victory) {
      term.write(0, y + 1, 'THE CORE STANDS', role('terrain.core.lit'));
      term.write(0, y + 2, `wave ${s.finalWave} held`, role('ui.accent'));
      term.write(0, y + 4, 'the summary has the rest', role('ui.text'));
    } else if (s.gameOver) {
      term.write(0, y + 1, 'THE CORE HAS FALLEN', role('enemy.fast'));
      term.write(0, y + 3, 'the summary has the rest', role('ui.text'));
    } else if (s.cache) {
      // ---- the claim card: replaces the build palette on a cache ----------
      term.write(0, y++, s.cache.source === 'boss_drop' ? 'BOSS CACHE' : 'CACHE', role('terrain.ore.lit'));
      y++;
      for (const line of this.wrap('Sealed. Opening it costs nothing but the click: Scrap, Ore, a relic - or the ground itself turns into a boon.', W, 5)) {
        term.write(0, y++, line, role('ui.text'));
      }
      y++;
      this.button(0, y, W - 6, 'OPEN', role('ui.bg'), role('terrain.ore.lit'));
      this.regions.push({ row: y, x0: 0, x1: W - 6, action: { kind: 'openCache' } });
    } else if (s.rock) {
      // ---- the prospect card: rocks are containers (PRD sec 4.6) ----------
      term.write(0, y++, 'ROCK', role('ui.text'));
      y++;
      for (const line of this.wrap(
        'Break it open: an ore vein, a sealed cache, or bare ground. Dealt when the map was made - prospecting only reveals. Survey refineries nearby work faster, and prospect on their own.',
        W,
        6,
      )) {
        term.write(0, y++, line, role('ui.dim'));
      }
      y++;
      if (s.rock.job) {
        term.write(0, y++, `PROSPECTING.. ${s.rock.job.pct}%`, role('ui.accent'));
        term.write(0, y++, '='.repeat(Math.max(1, Math.round((s.rock.job.pct / 100) * (W - 2)))), role('ui.accent'));
      } else {
        const can = s.rock.affordable;
        this.button(0, y, W - 6, `PROSPECT - $${s.rock.cost} \u2802 ${s.rock.seconds}s`, can ? role('ui.bg') : role('ui.dim'), can ? role('ui.accent') : role('ui.grid'));
        if (can) this.regions.push({ row: y, x0: 0, x1: W - 6, action: { kind: 'prospect' } });
      }
    } else if (s.core) {
      // ---- the Core card: the vessel and its relic slots (1.6.4) ----------
      const c = s.core;
      term.write(0, y++, 'THE CORE', role('terrain.core.lit'));
      const frac = c.hpMax > 0 ? c.hp / c.hpMax : 0;
      const hpCol = frac <= 0.25 ? role('enemy.fast') : role('terrain.core.mid');
      term.write(0, y++, `hp ${c.hp}/${c.hpMax}`, hpCol);
      term.write(0, y++, '='.repeat(Math.max(0, Math.round(frac * (W - 2)))), hpCol);
      y++;
      term.write(0, y++, 'RELIC SLOTS', role('ui.dim'));
      // Stone Story-style grid: empty slots render as empty boxes - what you
      // COULD hold is as visible as what you do (Daniil). SQUARE slots
      // (playtest 8): 5 glyphs x 3 rows is 50x48 px at panel scale - an
      // inventory reads as an inventory only if the cells do. The middle row
      // carries the tag, the bottom the state; board-scale relic ART fills
      // these at the art pass (6.7).
      const perRow = 6;
      const slotW = 5;
      const slotH = 3;
      c.slots.forEach((slot, i) => {
        const x0 = (i % perRow) * slotW;
        const rowBase = y + Math.floor(i / perRow) * slotH;
        const [fg, bg] =
          slot.state === 'empty'
            ? [role('ui.grid'), role('ui.bg')]
            : slot.state === 'ready'
              ? [role('ui.bg'), role('ui.accent')]
              : slot.state === 'cooling'
                ? [role('ui.dim'), role('ui.grid')]
                : slot.state === 'consumable'
                  ? [role('ui.bg'), role('terrain.ore.lit')]
                  : [role('ui.text'), role('ui.grid')]; // passive
        for (let r = 0; r < slotH; r++)
          for (let cx = 0; cx < slotW - 1; cx++) term.put(x0 + cx, rowBase + r, ' ', fg, bg);
        if (slot.state === 'empty') {
          // An empty box is drawn as its outline, not painted absence.
          term.put(x0, rowBase, '┌', fg); term.put(x0 + 3, rowBase, '┐', fg);
          term.put(x0, rowBase + 2, '└', fg); term.put(x0 + 3, rowBase + 2, '┘', fg);
        } else {
          term.write(x0 + 1, rowBase + 1, slot.label.slice(0, 2), fg, bg);
          if (slot.state === 'cooling') {
            term.write(x0 + 1, rowBase + 2, String(Math.min(99, slot.cooldownSec)).padStart(2), fg, bg);
          }
          for (let r = 0; r < slotH; r++) {
            this.regions.push({ row: rowBase + r, x0, x1: x0 + slotW - 1, action: { kind: 'relic', index: i } });
          }
        }
      });
      y += Math.ceil(c.slots.length / perRow) * slotH + 1;
      // Channel C (PRD sec 7.3): spend banked Ore on a blind draw.
      const drawLabel = `DRAW RELIC  ${c.drawCost} ore`;
      this.button(0, y, W - 6, drawLabel, c.canDraw ? role('ui.bg') : role('ui.dim'), c.canDraw ? role('terrain.ore.lit') : role('ui.grid'));
      if (c.canDraw) this.regions.push({ row: y, x0: 0, x1: W - 6, action: { kind: 'coreDraw' } });
      y += 2;
      if (c.hoverDesc) {
        for (const line of this.wrap(c.hoverDesc, W, 4)) term.write(0, y++, line, role('ui.text'));
      } else {
        term.write(0, y++, 'hover a slot for details;', role('ui.dim'));
        term.write(0, y++, 'click actives to fire,', role('ui.dim'));
        term.write(0, y++, 'consumables to use', role('ui.dim'));
      }
    } else if (s.selectedTower) {
      const t = s.selectedTower;
      term.write(0, y++, t.name, role('ui.accent'));
      if (t.deposit) {
        // A refinery's kills are meaningless; its DEPOSIT is its life story.
        const frac = t.deposit.initial > 0 ? t.deposit.left / t.deposit.initial : 0;
        const col = t.deposit.left === 0 ? role('enemy.fast') : role('terrain.ore.lit');
        term.write(0, y++, t.deposit.left === 0 ? 'VEIN SPENT' : `deposit ${t.deposit.left}/${t.deposit.initial}`, col);
        term.write(0, y++, '='.repeat(Math.max(0, Math.round(frac * (W - 2)))), col);
      } else {
        term.write(0, y++, `kills ${t.kills}`, role('ui.dim'));
      }
      y++;
      // Stats, with hover-preview deltas pulsing green (Daniil: see what
      // you are buying BEFORE you buy it).
      // Every displayed stat is higher-is-better, so a lower preview is a
      // DOWNGRADE and renders red - a green arrow pointing down is how a
      // range-18 tower once previewed 8.5 without anyone flinching (1.7.1).
      const stat = (label: string, cur: number | string, pre: number | string | null, lowerIsBetter = false): void => {
        term.write(0, y, `${label} ${cur}`, role('ui.text'));
        if (pre !== null && `${pre}` !== `${cur}`) {
          const worse = lowerIsBetter ? parseFloat(`${pre}`) > parseFloat(`${cur}`) : parseFloat(`${pre}`) < parseFloat(`${cur}`);
          term.write(`${label} ${cur}`.length + 1, y, `-> ${pre}`, worse ? role('enemy.fast') : previewCol);
        }
        y++;
      };
      if (t.stats.prod !== null) {
        // Producers read as an economy card: yield, and the one thing that
        // can be wrong with one (off the vein = mining nothing).
        stat('ore  ', t.stats.prod, t.preview ? t.preview.prod : null);
        if (t.offVein) term.write(0, y++, 'OFF VEIN - idle', role('enemy.fast'));
      } else {
        stat('dmg  ', t.stats.dmg, t.preview ? t.preview.dmg : null);
        stat('dps  ', t.stats.dps, t.preview ? t.preview.dps : null);
        stat('range', t.stats.range, t.preview ? t.preview.range : null);
        // The dead zone (design round 1): printed only when it exists, and
        // a SMALLER one is the upgrade.
        if (t.stats.minRange > 0 || (t.preview && t.preview.minRange > 0)) {
          stat('dead ', t.stats.minRange, t.preview ? t.preview.minRange : null, true);
        }
        // The blast radius that deals the damage is the one printed here and
        // the one the effects layer draws - one number, three consumers (2.19).
        if (t.stats.blast > 0 || (t.preview && t.preview.blast > 0)) {
          stat('blast', t.stats.blast, t.preview ? t.preview.blast : null);
        }
        if (t.stats.shots > 1 || (t.preview && t.preview.shots > 1)) {
          stat('shots', t.stats.shots, t.preview ? t.preview.shots : null);
        }
        if (t.stats.pierce > 0 || (t.preview && t.preview.pierce > 0)) {
          stat('pierce', t.stats.pierce, t.preview ? t.preview.pierce : null);
        }
        if (t.stats.slow > 0 || (t.preview && t.preview.slow > 0)) {
          stat('slow ', `${t.stats.slow}t`, t.preview ? `${t.preview.slow}t` : null);
        }
      }
      y++;
      // Priorities are meaningless on a tower that never targets.
      if (t.stats.prod === null) {
        term.write(0, y++, 'priority', role('ui.dim'));
        // Two button rows of two - full words fit, no cryptic initials.
        PRIORITIES.forEach((p, i) => {
          const colW = Math.floor(W / 2);
          const x0 = (i % 2) * colW;
          const row = y + Math.floor(i / 2);
          const active = p === t.priority;
          this.button(x0, row, colW - 1, PRIORITY_LABEL[p], active ? role('ui.bg') : role('ui.dim'), active ? role('ui.accent') : role('ui.grid'));
          this.regions.push({ row, x0, x1: x0 + colW - 1, action: { kind: 'priority', value: p } });
        });
        y += 3;
      }
      // ---- the tree: tiers as rows, choices as two-line buttons -----------
      term.write(0, y++, 'UPGRADES', role('ui.dim'));
      const colW = Math.floor(W / 2);
      t.tiers.forEach((tier, ti) => {
        term.write(0, y, `T${ti + 1}`, role('ui.dim'));
        y++;
        // Side-by-side either/or buttons (Daniil): the fork reads as a fork,
        // names wrap instead of clipping, cost gets its own line.
        const boxH = 3;
        tier.choices.forEach((c, ci) => {
          const x0 = ci * colW;
          const bw = colW - 1;
          const [fg, bg] =
            c.state === 'chosen'
              ? [role('ui.bg'), role('ui.accent')]
              : c.state === 'available'
                ? [c.affordable ? role('ui.text') : role('ui.dim'), role('ui.grid')]
                : [role('ui.grid'), role('ui.bg')];
          const nameLines = this.wrap(c.name, bw - 2, 2);
          this.button(x0, y, bw, nameLines[0], fg, bg);
          this.button(x0, y + 1, bw, nameLines[1] ?? '', fg, bg);
          const tail = c.state === 'chosen' ? 'BUILT' : c.state === 'rejected' ? 'locked out' : c.state === 'locked' ? 'locked' : `$${c.cost}`;
          this.button(x0, y + 2, bw, tail, fg, bg);
          if (c.state === 'available') {
            for (let r = 0; r < boxH; r++) {
              this.regions.push({ row: y + r, x0, x1: x0 + bw, action: { kind: 'choose', tier: ti, option: ci } });
            }
          }
        });
        // No blank row between tiers: the T-label row and the plates'
        // contrast already separate them, and panel height is a budget.
        y += boxH;
      });
      // The hovered choice explains itself in WORDS before it is bought
      // (2.10, same card mechanic as relics) - stats preview the numbers,
      // this says what they mean.
      if (t.choiceDesc) {
        y++;
        // Five lines: the rework's sentences say what a fork DOES and what it
        // answers, and a cut-off sentence is a lie by omission.
        for (const line of this.wrap(t.choiceDesc, W, 5)) term.write(0, y++, line, role('ui.text'));
      }
      term.write(0, y + 1, 'X sells (70% back)', role('ui.dim'));
    } else {
      // Cell inspector, wrapped to panel width.
      const words = s.inspector.split(' ');
      let line = '';
      for (const w of words) {
        if ((line + ' ' + w).trim().length > W) {
          term.write(0, y++, line.trim(), role('ui.text'));
          line = w;
        } else {
          line = line + ' ' + w;
        }
      }
      if (line.trim()) term.write(0, y++, line.trim(), role('ui.text'));
    }

    // ---- help footer -------------------------------------------------------
    const help = ['space pause \u2802 1-4 speed', 'F/L/C/W priority \u2802 X sell', 'G seams \u2802 Esc menu'];
    help.forEach((h, i) => term.write(0, term.rows - help.length + i, h, role('ui.dim')));

    term.flush();
  }
}
