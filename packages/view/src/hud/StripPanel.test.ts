/**
 * The strip as diffable text (session 24, 4.27): the roster as buttons with
 * the towers' own sprites, the wave now and next with traits, the Core card
 * with its slots - rendered into a TextTerm at the live strip's size, plus
 * the click regions the text implies.
 */
import { describe, expect, it } from 'vitest';
import { TextTerm } from '@ascii-defense/render';
import { validateSprite } from '@ascii-defense/content';
import boltJson from '@ascii-defense/content/assets/sprites/bolt.json';
import mortarJson from '@ascii-defense/content/assets/sprites/mortar.json';
import orbitalJson from '@ascii-defense/content/assets/sprites/relic_orbital.json';
import { StripPanel, STRIP_ROWS } from './StripPanel';
import type { HudState } from './HudPanel';

function must<T>(r: { ok: true; value: T } | { ok: false; errors: unknown[] }): T {
  if (!r.ok) throw new Error('sprite invalid');
  return r.value;
}
const SPRITES = [must(validateSprite.check(boltJson)), must(validateSprite.check(mortarJson)), must(validateSprite.check(orbitalJson))];
/** A 7-tile board's strip: (7 * 5 + 1) * 8 glyphs / 2 = 144 columns. */
const STRIP = { cols: 144, rows: STRIP_ROWS };

function state(over: Partial<HudState> = {}): HudState {
  return {
    scrap: 45,
    ore: 12,
    nextWaveIn: 17,
    relicCount: 2,
    kills: 37,
    finalWave: 20,
    victory: false,
    coreHp: 41,
    coreHpMax: 50,
    wave: 4,
    nextFronts: 2,
    nextWave: { wave: 5, boss: true, kinds: [{ name: 'grunt', count: 9, traits: [] }, { name: 'brute', count: 2, traits: ['armoured'] }], canCall: true, callBonus: 23, waiting: false },
    gameOver: false,
    L: 122,
    seed: 12345,
    speedLabel: '1x',
    inspector: '',
    palette: [],
    selectedBuild: -1,
    buildTargetSelected: true,
    selectedTower: null,
    core: null,
    cache: null,
    loot: null,
    rock: null,
    phase: 0,
    roster: [
      { id: 'bolt', name: 'Bolt Turret', short: 'Bolt', cost: 20, affordable: true, buildable: true },
      { id: 'mortar', name: 'Mortar', cost: 35, affordable: true, buildable: true },
      { id: 'frost', name: 'Frost Emitter', short: 'Frost', cost: 25, affordable: true, buildable: true },
      { id: 'refinery', name: 'Refinery', cost: 60, affordable: false, buildable: false },
    ],
    waveNow: [{ name: 'skitter', count: 3, traits: ['fast'] }, { name: 'shellback', count: 1, traits: ['shielded'] }],
    coreCard: {
      hp: 41,
      hpMax: 50,
      slots: [
        { label: 'OR', name: 'Orbital', state: 'ready', cooldownSec: 0, id: 'orbital', targeted: true },
        { label: 'SW', name: 'Second Wind', state: 'passive', cooldownSec: 0 },
        { label: 'FB', name: 'Frostbite', state: 'cooling', cooldownSec: 12 },
        { label: '', name: '', state: 'empty', cooldownSec: 0 },
        { label: '', name: '', state: 'empty', cooldownSec: 0 },
      ],
      hoverDesc: null,
      drawCost: 50,
      canDraw: false,
    },
    selectedBuildId: 'mortar',
    ...over,
  };
}

describe('the strip as text', () => {
  it('renders the roster as sprite buttons, the wave now and next with traits, and the Core card', async () => {
    const term = new TextTerm(STRIP);
    const strip = new StripPanel(term, 10, 16, SPRITES);
    strip.render(state());
    await expect(term.toText()).toMatchFileSnapshot('__snapshots__/strip.golden.txt');
  });

  it('every button, active slot and the draw plate is a click region; greyed towers still click (the sim refuses)', () => {
    const term = new TextTerm(STRIP);
    const strip = new StripPanel(term, 10, 16, SPRITES);
    strip.render(state({ coreCard: { ...state().coreCard!, canDraw: true } }));
    // The second button (mortar): 10 columns per button, any row below the title.
    expect(strip.actionAt((1 + 10 + 3) * 10, 3 * 16)).toEqual({ kind: 'buildId', id: 'mortar' });
    // The greyed refinery is still a target - the click reaches the sim, which says no.
    expect(strip.actionAt((1 + 30 + 3) * 10, 3 * 16)).toEqual({ kind: 'buildId', id: 'refinery' });
    // A spare slot is room, not a button.
    expect(strip.actionAt((1 + 50 + 3) * 10, 3 * 16)).toBeNull();
    // A ready slot in the Core section is a relic action; an empty one is nothing.
    // The Orbital slot carries its sprite (session 25): the beam's '**' row.
    const text = term.toText().split('\n');
    const orRow = text.findIndex((l) => l.includes(' ** '));
    const orX = text[orRow].indexOf('**') - 1;
    expect(orX).toBeGreaterThan(0);
    expect(strip.actionAt(orX * 10, orRow * 16)).toEqual({ kind: 'relic', index: 0 });
    expect(strip.actionAt((orX + 5 * 3 + 1) * 10, orRow * 16)).toBeNull();
    // The draw plate, when affordable.
    const drawRow = text.findIndex((l) => l.includes('DRAW RELIC'));
    expect(drawRow).toBeGreaterThan(0);
    expect(strip.actionAt((text[drawRow].indexOf('DRAW') + 1) * 10, drawRow * 16 + 1)).toEqual({ kind: 'coreDraw' });
  });
});
