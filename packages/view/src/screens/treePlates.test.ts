import { describe, expect, it } from 'vitest';
import { TextTerm } from '@ascii-defense/render';
import { drawTree, treeSize, type TreeSpec } from './treePlates';

describe('the tree as plates (feedback 2026-09-08, item 5)', () => {
  const spec: TreeSpec = {
    rows: [
      { heading: 'ARSENAL 1/2', big: true, chains: [{ plates: [{ id: 'node:a', name: 'Tesla Coil', note: 'BOUGHT', state: 'bought', icon: ['/^\\\\', '|T|', '/_\\\\'] }, { id: 'node:b', name: 'Bastion', note: '20 ore t1', state: 'open' }] }] },
      { heading: 'RELIQUARY 0/3', chains: [{ plates: [{ id: 'node:c', name: 'Damage', note: '15 ore t1', state: 'open', icon: [' /\\\\ ', '<##>', ' \\\\/ '] }, { id: 'node:d', name: 'Kinetic', note: 'locked', state: 'locked' }] }, { plates: [{ id: 'node:e', name: 'Cold', note: '15 ore t1', state: 'open', selected: true }] }] },
    ],
  };
  it('sizes by its widest row and its rows, draws rings, rails and names, and reports a region per plate in draw order', () => {
    const size = treeSize(spec);
    expect(size.w).toBe(Math.max(2 * 13 - 3, 3 * 11 - 3 + 2));
    expect(size.h).toBe(1 + 7 + 2 + 1 + 1 + 5 + 2 + 1);
    const term = new TextTerm({ cols: 100, rows: 40 });
    const regions: { row: number; rowEnd: number; x0: number; x1: number; id: string }[] = [];
    const order: string[] = [];
    drawTree(term, spec, 2, 1, 0.25, 'node:e', regions, order);
    expect(order).toEqual(['node:a', 'node:b', 'node:c', 'node:d', 'node:e']);
    expect(regions).toHaveLength(5);
    const text = term.toText();
    expect(text).toContain('Tesla Coil');
    expect(text).toContain('BOUGHT');
    expect(text).toContain('Kinetic');
    // A rail links a chain's plates; the bought plate wears diamond corners.
    expect(text.split('\n').some((l) => /┘───+┌|◆───+┌|┘───+◆/.test(l) || /│\s*───+\s*│/.test(l))).toBe(true);
    expect(text).toContain('◆');
  });
});
