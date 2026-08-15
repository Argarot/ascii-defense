/**
 * Synthetic glyph set for tests. Hermetic on purpose: render tests may not
 * reach into app's public assets (that would cross the layer boundary), and a
 * generated fixture keeps them independent of any real font's contents.
 *
 * Layout mirrors the real format: 8 bytes per glyph, one byte per row, MSB
 * leftmost. Space is blank and '#' is solid so pixel tests have a known
 * fully-lit and fully-dark glyph; everything else gets an arbitrary but
 * deterministic pattern (only its identity matters for toText tests).
 */
import type { GlyphSet } from './GLTerm';

export function makeFixtureGlyphs(): GlyphSet {
  const codepoints: number[] = [];
  let bin = '';
  for (let cp = 0x20; cp <= 0x7e; cp++) {
    codepoints.push(cp);
    for (let row = 0; row < 8; row++) {
      let byte: number;
      if (cp === 0x20) byte = 0x00;
      else if (cp === 0x23) byte = 0xff; // '#'
      else byte = (cp * 31 + row * 7) & 0xff;
      bin += String.fromCharCode(byte);
    }
  }
  return { cell: [8, 8], codepoints, bits: btoa(bin) };
}
