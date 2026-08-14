/**
 * Sprite — multi-cell ASCII art loaded from the asset library.
 *
 * A sprite is a rectangle of glyphs plus a parallel rectangle of *ink* keys.
 * The ink grid is what makes one drawing serve every specialisation: an ink key
 * of "PATH" resolves to whichever upgrade path the instance took, so the same
 * art recolours itself rather than needing three copies.
 *
 * Identity is the whole silhouette. There is no "family glyph" — nothing in the
 * engine knows or cares which character sits in which cell. That is entirely
 * the asset library's business, which is why no glyph is named in the PRD.
 */
import type { Term } from '../term/Term';

export interface SpriteFrame {
  art: string[];
  ink: string[];
}

export interface SpriteDef {
  id: string;
  name?: string;
  size: [number, number];
  bg?: string | null;
  inkMap: Record<string, string | null>;
  tiers: Record<string, SpriteFrame>;
}

/** A file holding several sprites that share one ink map (e.g. all enemies). */
export interface SpriteSheet {
  id: string;
  bg?: string | null;
  inkMap: Record<string, string | null>;
  sprites: Record<string, { size: [number, number]; tiers: Record<string, SpriteFrame> }>;
}

export type Palette = Record<string, unknown>;

/** Resolve a dotted key such as "tower.frame" against the palette object. */
export function resolveInk(
  key: string | null | undefined,
  palette: Palette,
  pathColor: string,
): string | null {
  if (!key) return null;
  if (key === 'PATH') return pathColor;
  let node: unknown = palette;
  for (const part of key.split('.')) {
    if (typeof node !== 'object' || node === null) return null;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === 'string' ? node : null;
}

/**
 * Validate a sprite's geometry. Returns human-readable problems rather than
 * throwing, because a malformed asset should be reported and skipped, not
 * allowed to take the whole screen down. In M1 this moves into CI.
 */
export function validateSprite(id: string, size: [number, number], tiers: Record<string, SpriteFrame>): string[] {
  const [w, h] = size;
  const problems: string[] = [];
  for (const [tier, frame] of Object.entries(tiers)) {
    if (frame.art.length !== h) problems.push(`${id}#${tier}: art has ${frame.art.length} rows, expected ${h}`);
    if (frame.ink.length !== h) problems.push(`${id}#${tier}: ink has ${frame.ink.length} rows, expected ${h}`);
    frame.art.forEach((row, i) => {
      if (row.length !== w) problems.push(`${id}#${tier}: art row ${i} is ${row.length} wide, expected ${w}`);
    });
    frame.ink.forEach((row, i) => {
      if (row.length !== w) problems.push(`${id}#${tier}: ink row ${i} is ${row.length} wide, expected ${w}`);
    });
  }
  return problems;
}

/**
 * Blit a sprite. Cells whose ink key maps to null are transparent, so terrain
 * shows through the gaps in the drawing — that is what stops sprites reading as
 * rectangular stamps.
 */
export function drawSprite(
  term: Term,
  frame: SpriteFrame,
  inkMap: Record<string, string | null>,
  palette: Palette,
  x: number,
  y: number,
  pathColor: string,
  bgKey?: string | null,
): void {
  const bg = resolveInk(bgKey ?? null, palette, pathColor) ?? undefined;
  for (let row = 0; row < frame.art.length; row++) {
    const artRow = frame.art[row];
    const inkRow = frame.ink[row];
    for (let col = 0; col < artRow.length; col++) {
      const key = inkRow[col];
      const fg = resolveInk(inkMap[key], palette, pathColor);
      if (fg === null) continue; // transparent
      term.put(x + col, y + row, artRow[col], fg, bg);
    }
  }
}
