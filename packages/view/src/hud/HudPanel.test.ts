/**
 * The HUD as diffable text (session 22, PR 2): a full state - a selected
 * tower with a preview, the next wave and its CALL button, a loot line -
 * rendered into a TextTerm at the live panel's size, plus the click regions
 * the text implies. The golden file is the panel.
 */
import { describe, expect, it } from 'vitest';
import { TextTerm } from '@ascii-defense/render';
import { HudPanel, type HudState } from './HudPanel';

const PANEL = { cols: 30, rows: 52 };

function state(over: Partial<HudState> = {}): HudState {
  return {
    scrap: 145,
    ore: 12,
    nextWaveIn: 23,
    relicCount: 2,
    kills: 37,
    finalWave: 20,
    victory: false,
    coreHp: 41,
    coreHpMax: 50,
    wave: 4,
    nextFronts: 2,
    nextWave: { wave: 5, boss: true, kinds: [{ name: 'grunt', count: 9 }, { name: 'brute', count: 2 }], canCall: true, callBonus: 23, waiting: false },
    gameOver: false,
    L: 122,
    seed: 12345,
    speedLabel: '1x',
    inspector: 'cell 5,5 ⠂ ground ⠂ buildable',
    palette: [],
    selectedBuild: -1,
    buildTargetSelected: false,
    selectedTower: {
      name: 'Bolt Turret',
      kills: 12,
      deposit: null,
      stats: { dmg: 8, dps: '11.4', range: 6, minRange: 0, shots: 1, pierce: 0, blast: 0, slow: 0, prod: null },
      preview: { dmg: 8, dps: '11.4', range: 8.5, minRange: 0, shots: 1, pierce: 0, blast: 0, slow: 0, prod: null },
      offVein: false,
      priority: 'first',
      tiers: [
        { choices: [{ name: 'Marksman', cost: 25, state: 'available', affordable: true }, { name: 'Gatling', cost: 25, state: 'available', affordable: true }] },
        { choices: [{ name: 'Piercing', cost: 55, state: 'locked', affordable: false }, { name: 'Shatter', cost: 55, state: 'locked', affordable: false }] },
        { choices: [{ name: 'Railbore', cost: 120, state: 'locked', affordable: false }, { name: 'Hailstorm', cost: 120, state: 'locked', affordable: false }] },
      ],
      choiceDesc: 'Reach: +2.5 range. Covers more road from the same cell.',
    },
    core: null,
    cache: null,
    loot: '+80 scrap',
    rock: null,
    phase: 0,
    ...over,
  };
}

describe('the HUD as text', () => {
  it('renders a selected tower with a preview, the next wave, the call button and a loot line', async () => {
    const term = new TextTerm(PANEL);
    const hud = new HudPanel(term, 10, 16);
    hud.render(state());
    await expect(term.toText()).toMatchFileSnapshot('__snapshots__/hud-tower.golden.txt');
  });

  it('the CALL button is a click region only while calling is allowed', () => {
    const term = new TextTerm(PANEL);
    const hud = new HudPanel(term, 10, 16);
    hud.render(state());
    const text = term.toText().split('\n');
    const row = text.findIndex((l) => l.includes('CALL WAVE 5'));
    expect(row).toBeGreaterThan(0);
    expect(hud.actionAt(2 * 10, row * 16 + 1)).toEqual({ kind: 'callWave' });
    hud.render(state({ nextWave: { ...state().nextWave!, canCall: false } }));
    const row2 = term.toText().split('\n').findIndex((l) => l.includes('wave still arriving'));
    expect(row2).toBeGreaterThan(0);
    expect(hud.actionAt(2 * 10, row2 * 16 + 1)).toBeNull();
  });

  it('the cache card offers OPEN, and the build palette lists towers as buttons', () => {
    const term = new TextTerm(PANEL);
    const hud = new HudPanel(term, 10, 16);
    hud.render(state({ selectedTower: null, cache: { source: 'boss_drop' }, loot: null }));
    const lines = term.toText().split('\n');
    const open = lines.findIndex((l) => l.includes('OPEN'));
    expect(lines.some((l) => l.includes('BOSS CACHE'))).toBe(true);
    expect(hud.actionAt(1 * 10, open * 16 + 1)).toEqual({ kind: 'openCache' });

    hud.render(state({ selectedTower: null, palette: [{ name: 'Bolt Turret', cost: 20, affordable: true, id: 'bolt' }, { name: 'Mortar', cost: 35, affordable: false, id: 'mortar' }], buildTargetSelected: true }));
    const l2 = term.toText().split('\n');
    const bolt = l2.findIndex((l) => l.includes('Bolt Turret $20'));
    expect(hud.actionAt(1 * 10, bolt * 16 + 1)).toEqual({ kind: 'build', index: 0 });
  });
});
