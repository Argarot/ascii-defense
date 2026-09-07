/**
 * The relic plate (session 30, PR 3): a ring in the rarity's colour,
 * corners by kind, the icon inside; empty and locked plates say so.
 */
import { describe, expect, it } from 'vitest';
import { TextTerm } from '@ascii-defense/render';
import { role } from '../palette';
import { RELIC_PLATE_H, RELIC_PLATE_W, drawRelicPlate } from './relicPlate';

describe('the relic plate', () => {
  it('rings the icon in the rarity colour with corners that say the kind', () => {
    const term = new TextTerm({ cols: 20, rows: 10 });
    drawRelicPlate(term, undefined, 2, 2, { rarity: 'epic', kind: 'active', plate: '#101010', fg: '#ffffff', label: 'AB' });
    const lines = term.toText().split('\n');
    expect(lines[2].slice(2, 2 + RELIC_PLATE_W)).toBe('◆────◆');
    expect(lines[2 + RELIC_PLATE_H - 1].slice(2, 2 + RELIC_PLATE_W)).toBe('◆────◆');
    expect(lines[3][2]).toBe('│');
    expect(lines[4].slice(4, 6)).toBe('AB');
    expect(term.fgAt(2, 2)).toBe(role('rarity.epic'));
    drawRelicPlate(term, undefined, 10, 2, { rarity: 'rare', kind: 'consumable', plate: '#101010', fg: '#ffffff', label: 'CD' });
    expect(term.toText().split('\n')[2].slice(10, 16)).toBe('+────+');
    expect(term.fgAt(10, 2)).toBe(role('rarity.rare'));
    drawRelicPlate(term, undefined, 2, 2, { rarity: 'common', kind: 'passive', plate: '#101010', fg: '#ffffff', label: 'EF', selected: true });
    expect(term.toText().split('\n')[2].slice(2, 8)).toBe('┌────┐');
    expect(term.fgAt(2, 2)).toBe(role('ui.accent')); // the opened one wears the accent
  });

  it('an empty slot is a dim ring; a locked slot is two crosses', () => {
    const term = new TextTerm({ cols: 20, rows: 10 });
    drawRelicPlate(term, undefined, 0, 0, { plate: '#101010', fg: '#ffffff', empty: true });
    drawRelicPlate(term, undefined, 8, 0, { plate: '#101010', fg: '#ffffff', locked: true });
    const lines = term.toText().split('\n');
    expect(lines[0].slice(0, 6)).toBe('┌────┐');
    expect(lines[2].slice(8, 14).trim()).toBe('xx');
    expect(lines[0].slice(8, 14).trim()).toBe('');
  });
});
