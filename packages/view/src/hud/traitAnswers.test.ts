import { describe, expect, it } from 'vitest';
import { TRAIT_ANSWER, waveAnswer } from './traitAnswers';

describe('the answer under the next wave (session 32, PR 3)', () => {
  it('names the first kind with a trait the table knows, and every trait has one', () => {
    expect(waveAnswer([{ name: 'grunt' }, { name: 'pavise', traits: ['frontshield'] }, { name: 'mole', traits: ['burrow'] }])).toBe('pavise: ' + TRAIT_ANSWER.frontshield);
    expect(waveAnswer([{ name: 'grunt', traits: ['resists-kinetic'] }])).toBeNull();
    for (const t of ['armoured', 'shielded', 'fast', 'swarm', 'split', 'heal', 'burrow', 'charge', 'frontshield', 'sprint', 'bulwark']) expect(TRAIT_ANSWER[t]).toBeTruthy();
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
  });
});
