import { describe, expect, it } from 'vitest';
import { TRAIT_ANSWER, waveAnswer } from './traitAnswers';

describe('the answer under the next wave (session 32, PR 3)', () => {
  it('names the first kind with a trait the table knows, and every trait has one', () => {
    expect(waveAnswer([{ name: 'grunt' }, { name: 'pavise', traits: ['frontshield'] }, { name: 'mole', traits: ['burrow'] }])).toBe('pavise: ' + TRAIT_ANSWER.frontshield);
    expect(waveAnswer([{ name: 'grunt', traits: ['resists-kinetic'] }])).toBeNull();
    for (const t of ['armoured', 'shielded', 'fast', 'swarm', 'split', 'heal', 'burrow', 'charge', 'frontshield', 'sprint', 'bulwark']) expect(TRAIT_ANSWER[t]).toBeTruthy();
  });
});
