/**
 * Runs in real Chromium via Vitest Browser Mode — GLTerm needs WebGL2, which
 * does not exist in Node. In CI this is SwiftShader software rendering; these
 * tests are also the canary proving that path works at all.
 */
import { describe, expect, it } from 'vitest';
import { GLTerm } from './GLTerm';
import { makeFixtureGlyphs } from './glyphFixture';

function makeTerm(cols = 16, rows = 8): GLTerm {
  return new GLTerm(makeFixtureGlyphs(), { cols, rows, cellPx: 8, background: '#000000' });
}

/** Read one glyph cell's pixels back from the framebuffer. */
function readCell(term: GLTerm, x: number, y: number): Uint8Array {
  const gl = term.canvas.getContext('webgl2')!;
  const px = new Uint8Array(8 * 8 * 4);
  // readPixels is bottom-left origin; cell (x, y) is top-left origin.
  gl.readPixels(x * 8, term.canvas.height - (y + 1) * 8, 8, 8, gl.RGBA, gl.UNSIGNED_BYTE, px);
  return px;
}

describe('GLTerm in a real browser', () => {
  it('creates a WebGL2 context at the exact pixel size', () => {
    const term = makeTerm();
    expect(term.canvas.width).toBe(16 * 8);
    expect(term.canvas.height).toBe(8 * 8);
    expect(term.canvas.getContext('webgl2')).not.toBeNull();
  });

  it('draws a solid glyph fully lit and leaves empty cells at background', () => {
    const term = makeTerm();
    term.put(0, 0, '#', '#ffffff');
    term.flush();

    const solid = readCell(term, 0, 0);
    for (let i = 0; i < solid.length; i += 4) {
      expect([solid[i], solid[i + 1], solid[i + 2]]).toEqual([255, 255, 255]);
    }
    const empty = readCell(term, 1, 0);
    for (let i = 0; i < empty.length; i += 4) {
      expect([empty[i], empty[i + 1], empty[i + 2]]).toEqual([0, 0, 0]);
    }
  });

  it('carries distinct per-cell colour', () => {
    const term = makeTerm();
    term.put(0, 0, '#', '#ff0000');
    term.put(1, 0, '#', '#00ff00');
    term.flush();
    expect(readCell(term, 0, 0).slice(0, 3)).toEqual(new Uint8Array([255, 0, 0]));
    expect(readCell(term, 1, 0).slice(0, 3)).toEqual(new Uint8Array([0, 255, 0]));
  });

  it('toText mirrors what was written', () => {
    const term = makeTerm();
    term.write(0, 0, 'HELLO', '#ffffff');
    term.write(2, 3, 'defense', '#888888');
    expect(term.toText().split('\n')[0]).toBe('HELLO');
    expect(term.toText().split('\n')[3]).toBe('  defense');
  });

  it('text snapshot: a composed screen matches its committed golden file', async () => {
    // The QA backbone (ARCHITECTURE §9): the golden file is plain text in the
    // repo, so a regression shows the actual screen in the PR diff.
    const term = makeTerm(24, 7);
    term.write(0, 0, '+----------------------+', '#888888');
    term.write(0, 1, '| ASCII DEFENSE        |', '#888888');
    term.write(0, 2, '| wave 3   $120   #4   |', '#cccccc');
    term.write(0, 3, '| [T]ower  [U]pgrade   |', '#cccccc');
    term.write(0, 4, '| speed 2x   lives 18  |', '#cccccc');
    term.write(0, 5, '+----------------------+', '#888888');
    await expect(term.toText()).toMatchFileSnapshot('__snapshots__/hud-frame.golden.txt');
  });
});
