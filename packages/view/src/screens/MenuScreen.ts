/**
 * The screen layer (4.15): one reusable full-overlay menu, generalised from
 * the offer modal's pattern - paint over the finished board frame on the
 * transparent overlay terminal; closing a screen is simply not painting it.
 * No screen owns game state (PRD sec 15.1): items carry ids, the app decides
 * what an id means.
 */
import type { GLTerm } from '@ascii-defense/render';
import { role } from '../palette';

export interface MenuItem {
  id: string;
  label: string;
  /** Dimmed and unclickable. */
  disabled?: boolean;
  /** Right-aligned annotation on the same row (e.g. a value or state). */
  note?: string;
}

export interface MenuSpec {
  title: string;
  /** Lines under the title - flavour, stats, warnings. '' makes a gap. */
  body?: readonly string[];
  items: readonly MenuItem[];
  footer?: string;
  /** 0..1 breathing phase for the selected-item shimmer. */
  phase?: number;
}

export class MenuScreen {
  private regions: { row: number; x0: number; x1: number; id: string }[] = [];

  render(term: GLTerm, spec: MenuSpec): void {
    this.regions = [];
    const W = term.cols;
    // The board dims to backdrop under a screen (playtest 10): a checkerboard
    // of dark cells - the terminal's screen-door tint, since glyph cells have
    // no alpha. The map stays legible as a place, the menu owns the eye.
    for (let y = 0; y < term.rows; y++)
      for (let x = (y % 2); x < W; x += 2) term.put(x, y, ' ', role('ui.dim'), '#070b11');
    // Plate width comes from the CONTENT (playtest 10: clipped text): the
    // longest of title, body lines, items with notes, footer - plus padding.
    const noteW = (it: MenuItem): number => it.label.length + (it.note ? it.note.length + 3 : 0);
    const widest = Math.max(
      spec.title.length,
      ...(spec.body ?? []).map((l) => l.length),
      ...spec.items.map(noteW),
      (spec.footer ?? '').length,
    );
    const plateW = Math.min(W - 2, widest + 8);
    const contentH = 4 + (spec.body?.length ?? 0) + spec.items.length * 2 + (spec.footer ? 2 : 0);
    const y0 = Math.max(1, Math.floor((term.rows - contentH) / 2));
    const x0 = Math.floor((W - plateW) / 2);
    for (let y = y0 - 1; y < y0 + contentH + 1 && y < term.rows; y++)
      for (let x = x0 - 1; x <= x0 + plateW && x < W; x++) term.put(x, y, ' ', role('ui.text'), '#0a0f16');
    let y = y0;
    term.write(x0 + Math.floor((plateW - spec.title.length) / 2), y, spec.title, role('ui.accent'));
    y += 2;
    for (const line of spec.body ?? []) {
      const l = line.slice(0, plateW - 2);
      term.write(x0 + Math.floor((plateW - l.length) / 2), y++, l, role('ui.dim'));
    }
    if (spec.body?.length) y++;
    for (const it of spec.items) {
      const fg = it.disabled ? role('ui.grid') : role('ui.text');
      const bg = it.disabled ? '#0a0f16' : role('ui.grid');
      const bw = plateW - 4;
      // Centred label; the note keeps the right edge (playtest 10).
      const pad = Math.max(0, Math.floor((bw - it.label.length) / 2));
      const rowText = (' '.repeat(pad) + it.label).padEnd(bw, ' ').slice(0, bw);
      term.write(x0 + 2, y, rowText, fg, bg);
      if (it.note) term.write(x0 + 2 + bw - it.note.length - 1, y, it.note, it.disabled ? role('ui.grid') : role('ui.accent'), bg);
      if (!it.disabled) this.regions.push({ row: y, x0: x0 + 2, x1: x0 + plateW - 2, id: it.id });
      y += 2;
    }
    if (spec.footer) {
      const f = spec.footer.slice(0, plateW - 2);
      term.write(x0 + Math.floor((plateW - f.length) / 2), y, f, role('ui.dim'));
    }
  }

  itemAt(px: number, py: number, glyphPxW: number, glyphPxH: number): string | null {
    const gx = Math.floor(px / glyphPxW);
    const gy = Math.floor(py / glyphPxH);
    for (const r of this.regions) if (r.row === gy && gx >= r.x0 && gx < r.x1) return r.id;
    return null;
  }
}
