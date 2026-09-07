/**
 * The tutorial's step machine (session 31): steps end on the player's own
 * action where there is one and on NEXT otherwise; NEXT ends one step, not
 * several; the ground and rock finders point near the Core.
 */
import { describe, expect, it } from 'vitest';
import { TUTORIAL_STEPS, goodGround, nearRock, nextStep, type TutorialCtx } from './tutorial';

const ctx = (over: Partial<TutorialCtx> = {}): TutorialCtx => ({ towers: 0, wave: 0, relics: 0, offerUp: false, selected: null, selectedBuildable: false, towerSelected: false, next: false, ...over });

describe('the tutorial', () => {
  it('walks the steps in order: NEXT ends one look-step; actions end the action steps', () => {
    expect(nextStep(0, ctx())).toBe(0);
    expect(nextStep(0, ctx({ next: true }))).toBe(1); // core -> entry, and no further on one NEXT
    expect(nextStep(1, ctx({ next: true }))).toBe(2);
    expect(nextStep(2, ctx({ next: true }))).toBe(2); // the ground step wants a selection, not NEXT
    expect(nextStep(2, ctx({ selectedBuildable: true }))).toBe(3);
    expect(nextStep(3, ctx({ towers: 1 }))).toBe(4);
    expect(nextStep(4, ctx({ towers: 1 }))).toBe(4);
    expect(nextStep(4, ctx({ towers: 1, next: true }))).toBe(5);
    expect(nextStep(5, ctx({ next: true }))).toBe(6);
    expect(nextStep(6, ctx({ wave: 1 }))).toBe(7);
    expect(nextStep(7, ctx({ wave: 2 }))).toBe(8); // watching ends on its own at wave 2
    expect(nextStep(8, ctx({ wave: 2, offerUp: true }))).toBe(8);
    expect(nextStep(8, ctx({ wave: 2, relics: 1 }))).toBe(9);
    // A player who skipped the offer is not stuck: wave 3 with no offer up moves on.
    expect(nextStep(8, ctx({ wave: 3 }))).toBe(9);
    expect(nextStep(9, ctx({ next: true }))).toBe(10);
    expect(nextStep(10, ctx({ next: true }))).toBe(11);
    expect(nextStep(11, ctx({ next: true }))).toBe(TUTORIAL_STEPS.length);
    // A late joiner: a player who already built and called catches up in one frame, stopping at the first look-step.
    expect(nextStep(2, ctx({ selectedBuildable: true, towers: 2, wave: 1 }))).toBe(4);
  });

  it('points at ground beside the road nearest the Core, and at a rock near the road', () => {
    const W = 6;
    const H = 3;
    // Row 1 is road; the Core face at the east end; ground and rock around it.
    const cells = [
      'G', 'R', 'G', 'G', 'G', 'G',
      'X', 'X', 'X', 'X', 'X', 'C',
      'G', 'G', 'G', 'R', 'G', 'G',
    ];
    const isRoad = (c: string) => c === 'X';
    const face = [{ x: 5, y: 1 }];
    expect(goodGround(cells, W, H, face, isRoad)).toEqual({ x: 4, y: 0 });
    expect(nearRock(cells, W, H, face, isRoad)).toEqual({ x: 3, y: 2 });
    expect(goodGround(['R', 'X', 'C'], 3, 1, [{ x: 2, y: 0 }], isRoad)).toBeNull();
  });
});
