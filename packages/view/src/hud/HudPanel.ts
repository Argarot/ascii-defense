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
import type { GLTerm } from '@ascii-defense/render';
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
  slow: number;
}

export interface HudTowerInfo {
  name: string;
  kills: number;
  stats: HudStats;
  /** Post-purchase stats while hovering an available choice; else null. */
  preview: HudStats | null;
  priority: Priority;
  tiers: readonly HudTierInfo[];
}

export interface HudState {
  scrap: number;
  kills: number;
  coreHp: number;
  coreHpMax: number;
  wave: number;
  nextFronts: number;
  gameOver: boolean;
  L: number;
  seed: number;
  speedLabel: string;
  inspector: string;
  palette: readonly { name: string; cost: number; affordable: boolean }[];
  selectedBuild: number;
  buildTargetSelected: boolean;
  selectedTower: HudTowerInfo | null;
  /** Animation phase 0..1 - preview numbers pulse on it. */
  phase: number;
}

export type HudAction =
  | { kind: 'priority'; value: Priority }
  | { kind: 'build'; index: number }
  | { kind: 'choose'; tier: number; option: number };

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

  constructor(
    private term: GLTerm,
    private glyphPxW: number,
    private glyphPxH: number,
  ) {}

  actionAt(px: number, py: number): HudAction | null {
    const gx = Math.floor(px / this.glyphPxW);
    const gy = Math.floor(py / this.glyphPxH);
    for (const r of this.regions) {
      if (r.row === gy && gx >= r.x0 && gx < r.x1) return r.action;
    }
    return null;
  }

  render(s: HudState): void {
    const term = this.term;
    this.regions = [];
    term.clear(role('ui.bg'));
    const W = term.cols;
    const blink = s.phase % 1 < 0.5;
    const previewCol = blink ? role('path.4') : role('ui.accent');

    // ---- header + vitals ---------------------------------------------------
    term.write(0, 0, 'ASCII DEFENSE', role('ui.accent'));
    term.write(0, 1, `seed ${s.seed} \u00b7 ${s.speedLabel}`, role('ui.dim'));
    term.write(0, 3, `SCRAP ${s.scrap}`, role('ui.accent'));
    const hpFrac = s.coreHpMax > 0 ? s.coreHp / s.coreHpMax : 0;
    const barLen = Math.round(hpFrac * (W - 2));
    const coreCol = hpFrac <= 0.25 ? role('enemy.fast') : role('terrain.core.mid');
    term.write(0, 4, `CORE ${s.coreHp}/${s.coreHpMax}`, coreCol);
    term.write(0, 5, '='.repeat(Math.max(0, barLen)), coreCol);
    term.write(0, 7, `WAVE ${s.wave}`, role('ui.text'));
    term.write(0, 8, `next: ${s.nextFronts} front${s.nextFronts === 1 ? '' : 's'} \u00b7 kills ${s.kills}`, role('ui.dim'));
    term.write(0, 9, `road L=${s.L}`, role('ui.dim'));

    // ---- build palette (vertical, hover previews radius on the board) ------
    term.write(0, 11, 'BUILD', role('ui.dim'));
    s.palette.forEach((p, i) => {
      const row = 12 + i;
      const marker = i === s.selectedBuild ? '>' : ' ';
      const label = `${marker}${p.name} $${p.cost}`;
      term.write(0, row, label, i === s.selectedBuild ? role('ui.accent') : p.affordable ? role('ui.text') : role('ui.dim'));
      this.regions.push({ row, x0: 0, x1: Math.max(label.length, 20), action: { kind: 'build', index: i } });
    });
    term.write(
      0,
      12 + s.palette.length + 1,
      s.buildTargetSelected ? 'click a tower: builds on' : 'select a tile on the map,',
      s.buildTargetSelected ? role('ui.accent') : role('ui.dim'),
    );
    term.write(
      0,
      13 + s.palette.length + 1,
      s.buildTargetSelected ? 'the selected tile' : 'then pick a tower here',
      s.buildTargetSelected ? role('ui.accent') : role('ui.dim'),
    );

    // ---- selection ---------------------------------------------------------
    let y = 18;
    term.write(0, y++, '-'.repeat(W), role('ui.grid'));
    if (s.gameOver) {
      term.write(0, y + 1, 'THE CORE HAS FALLEN', role('enemy.fast'));
      term.write(0, y + 3, 'press R for a new run', role('ui.text'));
    } else if (s.selectedTower) {
      const t = s.selectedTower;
      term.write(0, y++, t.name, role('ui.accent'));
      term.write(0, y++, `kills ${t.kills}`, role('ui.dim'));
      y++;
      // Stats, with hover-preview deltas pulsing green (Daniil: see what
      // you are buying BEFORE you buy it).
      const stat = (label: string, cur: number | string, pre: number | string | null): void => {
        term.write(0, y, `${label} ${cur}`, role('ui.text'));
        if (pre !== null && `${pre}` !== `${cur}`) {
          term.write(`${label} ${cur}`.length + 1, y, `-> ${pre}`, previewCol);
        }
        y++;
      };
      stat('dmg  ', t.stats.dmg, t.preview ? t.preview.dmg : null);
      stat('dps  ', t.stats.dps, t.preview ? t.preview.dps : null);
      stat('range', t.stats.range, t.preview ? t.preview.range : null);
      if (t.stats.slow > 0 || (t.preview && t.preview.slow > 0)) {
        stat('slow ', `${t.stats.slow}t`, t.preview ? `${t.preview.slow}t` : null);
      }
      y++;
      term.write(0, y++, 'priority', role('ui.dim'));
      let px = 0;
      let prow = y;
      for (const p of PRIORITIES) {
        const label = PRIORITY_LABEL[p];
        if (px + label.length > W) {
          px = 0;
          prow++;
        }
        term.write(px, prow, label, p === t.priority ? role('ui.accent') : role('ui.dim'));
        this.regions.push({ row: prow, x0: px, x1: px + label.length, action: { kind: 'priority', value: p } });
        px += label.length + 1;
      }
      y = prow + 2;
      // ---- the tree: tiers as rows, choices as boxes ----------------------
      term.write(0, y++, 'UPGRADES', role('ui.dim'));
      t.tiers.forEach((tier, ti) => {
        term.write(0, y, `T${ti + 1}`, role('ui.dim'));
        y++;
        // Side-by-side either/or boxes (Daniil): the fork reads as a fork.
        const colW = Math.floor(W / 2);
        tier.choices.forEach((c, ci) => {
          const x0 = ci * colW;
          const short = c.name.length > colW - 7 ? c.name.slice(0, colW - 8) : c.name;
          const label = c.state === 'chosen' ? `[${short}]*` : `[${short} $${c.cost}]`;
          const colour =
            c.state === 'chosen'
              ? role('ui.accent')
              : c.state === 'available'
                ? c.affordable
                  ? role('ui.text')
                  : role('ui.dim')
                : role('ui.grid');
          term.write(x0, y, label, colour);
          if (c.state === 'available') {
            this.regions.push({ row: y, x0, x1: x0 + colW, action: { kind: 'choose', tier: ti, option: ci } });
          }
        });
        y += 2;
      });
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
    const help = ['space pause \u00b7 1/2/3 speed', 'F/L/C/W priority \u00b7 X sell', 'G seams \u00b7 R new map', 'Esc deselect'];
    help.forEach((h, i) => term.write(0, term.rows - help.length + i, h, role('ui.dim')));

    term.flush();
  }
}
