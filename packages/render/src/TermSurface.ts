/**
 * The terminal surface the view draws on (session 22, PR 2).
 *
 * GLTerm is the real thing - WebGL2, browser only. TextTerm is the same
 * surface over plain arrays, so every view class can be rendered in Node and
 * its output asserted as diffable text: ARCHITECTURE sec 9's "text snapshots
 * are the backbone", finally holding for the view and not only for GLTerm's
 * own golden. The view types its terminal as TermSurface; nothing in it may
 * depend on which implementation it got.
 *
 * Colours are hex strings as the view passes them; TextTerm keeps them per
 * cell so a test can ask what colour a glyph wears (`fgAt`, `bgAt`) - a
 * golden text alone cannot tell a lit glyph from a dim one.
 */
export interface TermSurface {
  readonly cols: number;
  readonly rows: number;
  /** True if the glyph set contains this character. */
  has(ch: string): boolean;
  clear(bg?: string): void;
  put(x: number, y: number, ch: string, fg: string, bg?: string): void;
  write(x: number, y: number, text: string, fg: string, bg?: string): void;
  /** Change ONLY the background of a cell. */
  tint(x: number, y: number, bg: string): void;
  /** Multiply the existing background toward brighter (>1) or darker (<1). */
  shade(x: number, y: number, mul: number, add?: number): void;
  flush(): void;
  /** Screen state as plain text, trailing spaces trimmed per row. */
  toText(): string;
}

function rgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function hex(c: [number, number, number]): string {
  return '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
}

export interface TextTermOptions {
  cols: number;
  rows: number;
  background?: string;
  /** Glyphs `has()` reports present; absent = every glyph exists. Pass the
   *  shipped atlas's codepoints to reproduce GLTerm's silent drop. */
  glyphs?: Iterable<number>;
  /** Mirrors GLTerm's transparent overlay: unwritten cells stay parked. */
  transparent?: boolean;
}

export class TextTerm implements TermSurface {
  readonly cols: number;
  readonly rows: number;
  private readonly glyph: string[];
  private readonly fg: string[];
  private readonly bg: string[];
  private readonly written: Uint8Array;
  private readonly present: Set<number> | null;
  private readonly bgDefault: string;
  private readonly transparent: boolean;
  /** How many times flush() ran - a test can prove a surface was presented. */
  flushes = 0;

  constructor(opts: TextTermOptions) {
    this.cols = opts.cols;
    this.rows = opts.rows;
    this.bgDefault = opts.background ?? '#07090c';
    this.transparent = opts.transparent ?? false;
    this.present = opts.glyphs ? new Set(opts.glyphs) : null;
    const n = opts.cols * opts.rows;
    this.glyph = new Array<string>(n).fill(' ');
    this.fg = new Array<string>(n).fill(this.bgDefault);
    this.bg = new Array<string>(n).fill(this.bgDefault);
    this.written = new Uint8Array(n);
  }

  private idx(x: number, y: number): number {
    return x < 0 || y < 0 || x >= this.cols || y >= this.rows ? -1 : y * this.cols + x;
  }

  has(ch: string): boolean {
    return this.present === null || this.present.has(ch.codePointAt(0) ?? 32);
  }

  clear(bg?: string): void {
    const c = bg ?? this.bgDefault;
    this.glyph.fill(' ');
    this.fg.fill(c);
    this.bg.fill(c);
    this.written.fill(this.transparent && bg === undefined ? 0 : 1);
  }

  put(x: number, y: number, ch: string, fg: string, bg?: string): void {
    const i = this.idx(x, y);
    if (i === -1 || !this.has(ch)) return; // absent glyph: nothing, like GLTerm
    this.glyph[i] = ch;
    this.fg[i] = fg;
    if (bg !== undefined) this.bg[i] = bg;
    this.written[i] = 1;
  }

  write(x: number, y: number, text: string, fg: string, bg?: string): void {
    let i = 0;
    for (const ch of text) this.put(x + i++, y, ch, fg, bg);
  }

  tint(x: number, y: number, bg: string): void {
    const i = this.idx(x, y);
    if (i === -1) return;
    this.bg[i] = bg;
  }

  shade(x: number, y: number, mul: number, add = 0.05): void {
    const i = this.idx(x, y);
    if (i === -1) return;
    const c = rgb(this.bg[i]).map((v) => Math.min(255, (v / 255) * mul * 255 + add * 255)) as [number, number, number];
    this.bg[i] = hex(c);
  }

  flush(): void {
    this.flushes++;
  }

  toText(): string {
    const lines: string[] = [];
    for (let y = 0; y < this.rows; y++) {
      let line = '';
      for (let x = 0; x < this.cols; x++) line += this.glyph[y * this.cols + x];
      lines.push(line.replace(/\s+$/, ''));
    }
    return lines.join('\n');
  }

  /** Foreground colour at a cell, as the view passed it. */
  fgAt(x: number, y: number): string {
    const i = this.idx(x, y);
    return i === -1 ? '' : this.fg[i];
  }

  /** Background colour at a cell: as passed, or as shaded/tinted since. */
  bgAt(x: number, y: number): string {
    const i = this.idx(x, y);
    return i === -1 ? '' : this.bg[i];
  }

  /** The glyph at a cell (space when nothing was drawn). */
  glyphAt(x: number, y: number): string {
    const i = this.idx(x, y);
    return i === -1 ? '' : this.glyph[i];
  }

  /** Was anything drawn at this cell since the last clear (overlay semantics)? */
  writtenAt(x: number, y: number): boolean {
    const i = this.idx(x, y);
    return i !== -1 && this.written[i] === 1;
  }
}
