/**
 * Every glyph the UI writes exists in the shipped font, and draws something.
 *
 * GLTerm.put() draws NOTHING for a codepoint the atlas lacks, silently -
 * the threat marker U+00BB was invisible for a day that way. Worse, spleen
 * DECLARES all of Latin-1 with empty bitmaps, so before build-fonts.mjs
 * dropped blank glyphs `term.has()` said yes to U+00B7 and every HUD
 * separator rendered as a space for three sessions. This test scans the
 * source that writes to terminals, decodes \uXXXX escapes, and refuses any
 * codepoint the atlas does not carry. The atlas itself is asserted to hold
 * no blank glyph but the three blank-by-design ones.
 *
 * Lives in harness: it needs both content and the presentation sources.
 */
import { describe, expect, it } from 'vitest';

/**
 * The shipped atlas, read as text: harness may not IMPORT app (invariant 3),
 * and this test audits app's files as data rather than depending on them.
 */
const ATLAS_RAW = import.meta.glob(['../../app/public/assets/glyphset-spleen.json'], { query: '?raw', import: 'default', eager: true });
interface Atlas { codepoints: number[]; bits: string; cell: [number, number] }
const atlas = JSON.parse(Object.values(ATLAS_RAW)[0]) as Atlas;

/**
 * Terminal-writing source, as raw text. tilesmith.ts is excluded on
 * purpose: its non-ASCII literals are DOM button labels drawn by the
 * browser font, not by GLTerm.
 */
const SOURCES = import.meta.glob(
  [
    '../../view/src/**/*.ts',
    '!../../view/src/**/*.test.ts',
    '../../app/src/main.ts',
    '../../app/src/workerRuntime.ts',
    '../../content/assets/terrain/appearance.json',
  ],
  { query: '?raw', import: 'default', eager: true },
);

const BLANK_BY_DESIGN = new Set([0x20, 0xa0, 0x2800]);

function decodeEscapes(src: string): string {
  return src
    .replace(/\\u\{([0-9a-fA-F]+)\}/g, (_m, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/\\u([0-9a-fA-F]{4})/g, (_m, h: string) => String.fromCodePoint(parseInt(h, 16)));
}

/** base64 -> bytes without Buffer or atob (lib ES2022 has neither). */
function fromBase64(s: string): Uint8Array {
  const T = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const clean = s.replace(/=+$/, '');
  const out: number[] = [];
  let bits = 0;
  let acc = 0;
  for (const ch of clean) {
    acc = (acc << 6) | T.indexOf(ch);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out.push((acc >> bits) & 0xff);
    }
  }
  return Uint8Array.from(out);
}

describe('UI glyphs against the shipped spleen atlas', () => {
  const bytes = fromBase64(atlas.bits);
  const rows = atlas.cell[1];
  const present = new Set(atlas.codepoints);

  it('the source list actually resolved', () => {
    expect(Object.keys(SOURCES).length).toBeGreaterThan(5);
  });

  it('the atlas carries no blank glyph except space, no-break space and the empty braille cell', () => {
    const blank: string[] = [];
    atlas.codepoints.forEach((cp, i) => {
      let ink = false;
      for (let r = 0; r < rows; r++) if (bytes[i * rows + r] !== 0) ink = true;
      if (!ink && !BLANK_BY_DESIGN.has(cp)) blank.push('U+' + cp.toString(16));
    });
    expect(blank).toEqual([]);
  });

  it('every non-ASCII codepoint written by view/app source exists in the atlas', () => {
    const missing: string[] = [];
    for (const [file, raw] of Object.entries(SOURCES)) {
      const text = decodeEscapes(raw);
      let line = 1;
      const seen = new Set<string>();
      for (const ch of text) {
        if (ch === '\n') line++;
        const cp = ch.codePointAt(0)!;
        if (cp < 0x80 || present.has(cp)) continue;
        const key = `${file}:${line} U+${cp.toString(16)}`;
        if (!seen.has(key)) {
          seen.add(key);
          missing.push(key);
        }
      }
    }
    expect(missing).toEqual([]);
  });
});
