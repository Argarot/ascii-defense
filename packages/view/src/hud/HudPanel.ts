/**
 * The HUD: a separate glyph surface below the board at 2x font size
 * (10x16 px per glyph - an integer multiple, so the bitmap font stays
 * crisp). This text is meant to be READ, unlike the board's texture
 * (Daniil, session B feedback).
 *
 * Mouse-first (agreed rule): everything actionable here is clickable.
 * render() records the glyph rectangle of every actionable label, and
 * actionAt() maps a canvas pixel back to the action - the words on screen
 * and the click targets cannot drift apart because they are the same data.
 *
 * Four rows: resources/status, inspector, actions (build palette or the
 * selected tower's priority selector), help.
 */
import type { GLTerm } from '@ascii-defense/render';
import { PRIORITIES, type Priority } from '@ascii-defense/engine';
import { role } from '../palette';

export interface HudTowerInfo {
  name: string;
  kills: number;
  dmg: number;
  dps: string;
  range: number;
  priority: Priority;
}

export interface HudState {
  scrap: number;
  kills: number;
  coreDamage: number;
  L: number;
  seed: number;
  /** "1x", "2x", "4x" or "PAUSED". */
  speedLabel: string;
  /** Cell or tower description for the inspector row. */
  inspector: string;
  /** The build palette; one entry per buildable tower def. */
  palette: readonly { name: string; cost: number; affordable: boolean }[];
  /** Which palette entry is the active build choice. */
  selectedBuild: number;
  /** Set when the selection is a tower - swaps the action row to priorities. */
  selectedTower: HudTowerInfo | null;
}

export type HudAction =
  | { kind: 'priority'; value: Priority }
  | { kind: 'build'; index: number };

interface Region {
  row: number;
  x0: number;
  x1: number; // exclusive
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

  /** Canvas pixel -> the action under it, or null. */
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

    // Row 0 - resources and run status. Scrap first: it is the number the
    // player's eyes return to before every decision.
    term.write(0, 0, `SCRAP ${s.scrap}`, role('ui.accent'));
    const status = `kills ${s.kills} \u00b7 core -${s.coreDamage} \u00b7 ${s.speedLabel} \u00b7 L=${s.L} \u00b7 seed ${s.seed}`;
    term.write(term.cols - status.length, 0, status, role('ui.dim'));

    // Row 1 - inspector.
    term.write(0, 1, s.inspector, role('ui.text'));

    // Row 2 - actions: priorities for a selected tower, else the palette.
    if (s.selectedTower) {
      const t = s.selectedTower;
      const lead = `${t.name} \u00b7 ${t.dmg} dmg \u00b7 ${t.dps}/s \u00b7 range ${t.range} \u00b7 kills ${t.kills} \u00b7 priority: `;
      term.write(0, 2, lead, role('ui.text'));
      let x = lead.length;
      for (const p of PRIORITIES) {
        const label = PRIORITY_LABEL[p];
        term.write(x, 2, label, p === t.priority ? role('ui.accent') : role('ui.dim'));
        this.regions.push({ row: 2, x0: x, x1: x + label.length, action: { kind: 'priority', value: p } });
        x += label.length + 2;
      }
    } else {
      let x = 0;
      term.write(x, 2, 'build: ', role('ui.dim'));
      x += 7;
      s.palette.forEach((item, index) => {
        const marker = index === s.selectedBuild ? '>' : ' ';
        const label = `${marker}${item.name} $${item.cost}`;
        term.write(
          x,
          2,
          label,
          index === s.selectedBuild ? role('ui.accent') : item.affordable ? role('ui.text') : role('ui.dim'),
        );
        this.regions.push({ row: 2, x0: x, x1: x + label.length, action: { kind: 'build', index } });
        x += label.length + 3;
      });
      term.write(x, 2, '(click green ground to place)', role('ui.dim'));
    }

    // Row 3 - help.
    term.write(
      0,
      3,
      'space pause \u00b7 1/2/3 speed \u00b7 click build/select \u00b7 F/L/C/W or click priority \u00b7 X sell \u00b7 G seams \u00b7 R new map \u00b7 Esc deselect',
      role('ui.dim'),
    );

    term.flush();
  }
}
