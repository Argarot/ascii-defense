import { describe, expect, it } from 'vitest';
import { TRAIT_ANSWER, platingWords, waveAnswer } from './traitAnswers';

describe('the answer under the next wave (session 32, PR 3)', () => {
  it('names the first kind with a trait the table knows, and every trait has one', () => {
    expect(waveAnswer([{ name: 'grunt' }, { name: 'pavise', traits: ['frontshield'] }, { name: 'mole', traits: ['burrow'] }])).toBe('pavise: ' + TRAIT_ANSWER.frontshield);
    expect(waveAnswer([{ name: 'grunt', traits: ['resists-kinetic'] }])).toBeNull();
    for (const t of ['armoured', 'insulated', 'shielded', 'fast', 'swarm', 'split', 'heal', 'burrow', 'charge', 'frontshield', 'sprint', 'bulwark']) expect(TRAIT_ANSWER[t]).toBeTruthy();
  });

  it('every answer FITS: two lines of the side panel behind the longest enemy name, or the panel cuts the sentence', () => {
    // The panel is 30 glyphs wide and gives the answer two lines; a wrap can lose most of a word at each line's end.
    // "brute: slows slide off; one big hit or energy - small +" shipped for an hour on 2026-09-18 and was caught only
    // by looking at the running game. The longest name a player meets is ten glyphs ("juggernaut"); ": " makes twelve.
    const linesAt = (text: string, cols: number): number => {
      let lines = 1;
      let used = 0;
      for (const word of text.split(' ')) {
        if (used > 0 && used + 1 + word.length > cols) { lines++; used = word.length; } else used += (used > 0 ? 1 : 0) + word.length;
      }
      return lines;
    };
    for (const [trait, answer] of Object.entries(TRAIT_ANSWER)) expect(linesAt(`juggernaut: ${answer}`, 30), `${trait}: "${answer}"`).toBeLessThanOrEqual(2);
    // The plating sentence gets three lines of the same panel, in every form and at two digits.
    for (const [k, e] of [[2, 2], [12, 12], [12, 0], [0, 12], [12, 10]]) expect(linesAt(platingWords(k, e)!.line, 30), platingWords(k, e)!.line).toBeLessThanOrEqual(3);
  });

  it('plating is said once when both types meet the same ramp (D38), by type when they do not, and not at all before it begins', () => {
    expect(platingWords(0, 0)).toBeNull();
    expect(platingWords(2, 2)).toEqual({ tag: 'PLATED +2', line: 'PLATED +2: every hit loses 2 more - hit big' });
    expect(platingWords(2, 0)!.line).toContain('every kinetic hit loses 2 more - hit big, or use energy');
    expect(platingWords(0, 3)!.line).toContain('every energy hit loses 3 more - hit big, or use kinetic');
    expect(platingWords(2, 1)).toEqual({ tag: 'PLATED +2/+1', line: 'PLATED: kinetic hits lose 2 more, energy hits 1 - hit big' });
  });
});
