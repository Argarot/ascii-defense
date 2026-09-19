/**
 * The HUD as diffable text (session 22, PR 2): a full state - a selected
 * tower with a preview, the next wave and its CALL button, a loot line -
 * rendered into a TextTerm at the live panel's size, plus the click regions
 * the text implies. The golden file is the panel.
 */
import { describe, expect, it } from 'vitest';
import { TextTerm } from '@ascii-defense/render';
import relicsJson from '@ascii-defense/content/assets/relics/pool.json';
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
      stats: { type: 'kinetic', dmg: 8, dps: '11.4', range: 6, reach: null, minRange: 0, shots: 1, pierce: 0, chain: 0, blast: 0, slow: 0, prod: null },
      preview: { type: 'kinetic', dmg: 8, dps: '11.4', range: 8.5, reach: null, minRange: 0, shots: 1, pierce: 0, chain: 0, blast: 0, slow: 0, prod: null },
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

  it('shows a first-run prompt in the column when one is set (session 27, WBS 4.23)', () => {
    const term = new TextTerm({ cols: 32, rows: 60 });
    const hud = new HudPanel(term, 10, 16);
    hud.render(state({ selectedTower: null, prompt: 'HINT 1/3: select a ground tile, then click a tower button in the strip under the board.' }));
    expect(term.toText()).toContain('HINT 1/3');
  });

  it('shows the hovered build button\'s card before anything is bought (feedback item 1)', () => {
    const term = new TextTerm({ cols: 32, rows: 60 });
    const hud = new HudPanel(term, 10, 16);
    hud.render(state({ selectedTower: null, buildPreview: { name: 'Tesla Coil', cost: 40, desc: 'An arc that jumps body to body.', stats: { type: 'energy', dmg: 9, dps: '9.0', range: 4, reach: null, minRange: 0, shots: 1, pierce: 0, chain: 3, blast: 0, slow: 0, prod: null } } }));
    const text = term.toText();
    expect(text).toContain('Tesla Coil');
    expect(text).toContain('$40');
    expect(text).toContain('chain  3');
    expect(text).toContain('An arc that jumps');
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

  // D41 (2026-09-18): a first meeting no longer stops the game - it is a banner here, and a click opens the card.
  it('a first meeting is a banner under the next wave: whole, clickable on every row, gone when the state drops it', () => {
    const term = new TextTerm(PANEL);
    const hud = new HudPanel(term, 10, 16);
    // The longest title and the longest answer the game can produce today.
    const notice = { title: 'YOUR FIRST MISSILE RACK', line: 'energy slides off; hit big, or use kinetic', left01: 0.5, more: 2 };
    hud.render(state({ notice }));
    const lines = term.toText().split('\n');
    const head = lines.findIndex((l) => l.includes('YOUR FIRST MISSILE RACK'));
    const call = lines.findIndex((l) => l.includes('CALL WAVE 5'));
    expect(head).toBeGreaterThan(call); // under the next wave, where the eye already is
    expect(lines[head]).toContain('(+2)'); // how many wait behind it, not cut by the panel's width
    // The answer is whole: its words, re-joined across the wrapped rows, are the sentence.
    const hint = lines.findIndex((l) => l.includes('click: the full card'));
    expect(lines.slice(head + 1, hint).map((l) => l.trim()).join(' ')).toBe(notice.line);
    // The bar runs down: half of the panel's width at left01 0.5.
    expect([...lines[hint + 1].trim()].length).toBe(Math.round(PANEL.cols / 2));
    for (let r = head; r <= hint + 1; r++) expect(hud.actionAt(2 * 10, r * 16 + 1)).toEqual({ kind: 'openNotice' });
    hud.render(state());
    expect(term.toText()).not.toContain('click: the full card');
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

  it('a held relic\'s card never writes over its own icon plate, and says its whole sentence - every relic of the pool (#375)', () => {
    const PLATE_W = 6;
    const PLATE_H = 5;
    const relics = (relicsJson as unknown as { relics: unknown }).relics as { id: string; name: string; kind: string; rarity: string; tags?: string[]; desc: string; tiers?: Record<string, { desc?: string }> }[];
    expect(relics.length).toBeGreaterThan(50);
    for (const r of relics) {
      // The base sentence and every tier's: a rare copy carries its own card text.
      for (const desc of [r.desc, ...Object.values(r.tiers ?? {}).map((t) => t.desc ?? '')].filter(Boolean)) {
        const term = new TextTerm(PANEL);
        const hud = new HudPanel(term, 10, 16);
        hud.render(state({ selectedTower: null, relicCard: { index: 0, name: r.name, rarity: r.rarity, kind: r.kind, tags: r.tags ?? [], desc, uses: 0, salvageOre: 10, combine: [] } }));
        const lines = term.toText().split('\n').map((l) => l.padEnd(PANEL.cols));
        const top = lines.findIndex((l) => l.startsWith(r.name.toUpperCase().slice(0, PANEL.cols - PLATE_W - 1)));
        expect(top, `${r.id}: the name row`).toBeGreaterThanOrEqual(0);
        // The column left of the plate stays empty for the plate's height: nothing ran into it.
        for (let k = 0; k < PLATE_H; k++) expect(lines[top + k][PANEL.cols - PLATE_W - 1], `${r.id}: row ${k} beside the plate`).toBe(' ');
        // And the sentence is all there, in order, with no word cut.
        const end = lines.findIndex((l, i) => i > top && l.startsWith('its rule'));
        const body = lines.slice(top + 1, end).map((l, i) => (i + 1 < PLATE_H ? l.slice(0, PANEL.cols - PLATE_W - 1) : l).trim()).join(' ');
        expect(body, `${r.id}: the whole sentence`).toContain(desc.split(' ').filter(Boolean).join(' '));
      }
    }
  });
});
