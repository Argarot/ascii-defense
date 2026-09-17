import { describe, expect, it } from 'vitest';
import { Sim } from '../sim/sim';
import { ALL_UNLOCKS, EMPTY_META, MAX_TILE_COPIES, buyNode, buyTile, copyPrice, everyShopTile, priceTile, priceLines, BOON_POWER_PCT, canPay, payCost, costText, shortfall, relicApplies, relicForWin, resolveUnlocks, smithOpen, whyNot, whyNotTile, type TreeDef } from './tree';

const TREE: TreeDef = {
  base: { towers: ['bolt'], relics: ['tithe'], relicSlots: 6, threat: 1, tileSlots: 1, oreTier: 1, tiles: ['twin'] },
  nodes: [
    { id: 'tesla', name: 'Tesla', branch: 'arsenal', desc: '', cost: { tier: 1, ore: 40 }, grants: { towers: ['tesla'] } },
    { id: 'laser', name: 'Laser', branch: 'arsenal', desc: '', cost: { tier: 1, ore: 80 }, requires: ['tesla'], grants: { towers: ['laser'] } },
    { id: 'cold', name: 'Cold', branch: 'reliquary', desc: '', cost: { tier: 1, ore: 30 }, grants: { relicTags: ['cold'] } },
    { id: 'slots', name: 'Slots', branch: 'capacity', desc: '', cost: { tier: 2, ore: 30 }, grants: { relicSlots: 2 } },
    { id: 'grim', name: 'Grim', branch: 'threat', desc: '', cost: { tier: 1, ore: 80 }, grants: { threat: 2, endless: true } },
    { id: 'ore2', name: 'Rich', branch: 'ore', desc: '', cost: { tier: 1, ore: 10 }, grants: { oreTier: 2, tiles: ['rich'] } },
  ],
};
const RELICS = [
  { id: 'tithe', rarity: 'common' as const, tags: ['economy'] },
  { id: 'frostbite', rarity: 'common' as const, tags: ['cold'] },
  { id: 'deep_cold', rarity: 'common' as const, tags: ['cold'] },
  { id: 'cold_snap', rarity: 'rare' as const, tags: ['cold'] },
  { id: 'doomsday', rarity: 'epic' as const, tags: ['cold', 'damage'], fusionOnly: true },
  { id: 'absolute', rarity: 'epic' as const, tags: ['cold'] },
  { id: 'kindling', rarity: 'rare' as const, tags: ['energy'] },
];

describe('the meta tree (session 29, PR 1)', () => {
  it('resolves the base alone, then what was bought: towers, a branch of commons, slots, threat', () => {
    const base = resolveUnlocks(TREE, EMPTY_META, RELICS);
    expect([...base.towers]).toEqual(['bolt']);
    expect([...base.relics].sort()).toEqual(['doomsday', 'tithe']); // fusion-only needs no unlock
    expect(base.relicSlots).toBe(6);
    expect(base.threatMax).toBe(1);
    expect(base.endless).toBe(false);
    expect(base.everything).toBe(false);
    const some = resolveUnlocks(TREE, { ...EMPTY_META, unlocks: ['tesla', 'cold', 'slots', 'grim'] }, RELICS);
    expect([...some.towers].sort()).toEqual(['bolt', 'tesla']);
    // The cold branch: its commons, not its rare or its epic.
    expect([...some.relics].sort()).toEqual(['deep_cold', 'doomsday', 'frostbite', 'tithe']);
    expect(some.relicSlots).toBe(8);
    expect(some.threatMax).toBe(2);
    expect(some.endless).toBe(true);
    expect(some.everything).toBe(false);
    // An earned relic joins the pool whatever its rarity.
    const earned = resolveUnlocks(TREE, { ...EMPTY_META, unlocks: ['cold'], earned: ['cold_snap'] }, RELICS);
    expect(earned.relics.has('cold_snap')).toBe(true);
    // A retired node id is ignored, never a crash.
    expect(resolveUnlocks(TREE, { ...EMPTY_META, unlocks: ['gone'] }, RELICS).towers.size).toBe(1);
  });

  it('the sentinel from before the tree keeps everything', () => {
    const all = resolveUnlocks(TREE, { ...EMPTY_META, unlocks: [ALL_UNLOCKS] }, RELICS);
    expect([...all.towers].sort()).toEqual(['bolt', 'laser', 'tesla']);
    expect(all.relics.size).toBe(RELICS.length);
    expect(all.relicSlots).toBe(8);
    expect(all.threatMax).toBe(2);
    expect(all.everything).toBe(true);
  });

  it('whyNot and buyNode: the price in the right tier, the requirement by name, once only', () => {
    expect(whyNot(TREE, EMPTY_META, [10, 0, 0], 'tesla')).toMatch(/needs 40 tier-1 ore \(have 10\)/);
    expect(whyNot(TREE, EMPTY_META, [100, 0, 0], 'laser')).toBe('needs Tesla');
    expect(whyNot(TREE, EMPTY_META, [100, 0, 0], 'slots')).toMatch(/tier-2/);
    expect(whyNot(TREE, EMPTY_META, [100, 0, 0], 'nope')).toBe('no such node');
    const b = buyNode(TREE, EMPTY_META, [100, 0, 0], 'tesla');
    expect(b).not.toBeNull();
    expect(b!.ore).toEqual([60, 0, 0]);
    expect(b!.meta.unlocks).toEqual(['tesla']);
    expect(whyNot(TREE, b!.meta, b!.ore, 'tesla')).toBe('already bought');
    expect(buyNode(TREE, b!.meta, b!.ore, 'laser')).toBeNull(); // 60 < 80
    expect(buyNode(TREE, b!.meta, [80, 0, 0], 'laser')!.meta.unlocks).toEqual(['tesla', 'laser']);
    expect(buyNode(TREE, EMPTY_META, [0, 40, 0], 'slots')!.ore).toEqual([0, 10, 0]);
  });

  it('a win earns a relic of the Threat\'s rarity from the unlocked branches, deterministically, and never twice', () => {
    const meta = { ...EMPTY_META, unlocks: ['cold'] };
    expect(relicForWin(TREE, meta, RELICS, 0, 5)).toBeNull(); // Calm earns Ore only
    expect(relicForWin(TREE, meta, RELICS, 1, 5)).toBe('cold_snap'); // the one rare of the cold branch
    expect(relicForWin(TREE, meta, RELICS, 1, 5)).toBe(relicForWin(TREE, meta, RELICS, 1, 5));
    expect(relicForWin(TREE, meta, RELICS, 2, 5)).toBe('absolute'); // Grim: the epic (fusion-only never)
    // Earned already: nothing rare is left; Grim still finds the epic; then nothing.
    const won = { ...meta, earned: ['cold_snap', 'absolute'] };
    expect(relicForWin(TREE, won, RELICS, 1, 5)).toBeNull();
    expect(relicForWin(TREE, won, RELICS, 2, 5)).toBeNull();
    // A locked branch earns nothing (kindling is energy).
    expect(relicForWin(TREE, { ...EMPTY_META, unlocks: [] }, RELICS, 1, 5)).toBeNull();
  });
});

const g = (...rows: string[]): string[] => rows;
/** The shipped twin bend and rich vein, cell for cell: the shop's anchors (their authored prices were 25 and 60 tier-1 Ore). */
const TWIN = { id: 'twin', cells: g('GG|GG', 'GGL7G', '-7GL-', 'GL7GG', 'GG|GG') };
const RICH = { id: 'rich', cells: g('GGGGG', 'GRRGG', 'GOOGG', 'GRRGG', 'GGGGG'), deposits: [{ amount: 60, tier: 2 }, { amount: 60, tier: 2 }] };
const MEADOW = g('GGGGG', 'GGGGG', 'GGGGG', 'GGGGG', 'GGGGG');

describe('the tile shop and the Smith\'s door (session 29, PR 5; priced by contents since D31)', () => {
  it('a tile is bought at what its contents cost, only once the tree opened it; the Smith opens when every tile is owned', () => {
    const base = resolveUnlocks(TREE, EMPTY_META, RELICS);
    expect(copyPrice(TWIN, {})).toEqual([29, 0, 0]);
    expect(whyNotTile(base, {}, [10, 0, 0], TWIN)).toMatch(/needs 29 tier-1 ore/);
    expect(whyNotTile(base, {}, [100, 100, 0], RICH)).toBe('the tree has not opened it');
    const b = buyTile(base, {}, [30, 0, 0], TWIN);
    expect(b).toEqual({ owned: { twin: 1 }, ore: [1, 0, 0] });
    // A second copy is for sale at the first price plus half (session 33, PR 7); the purse decides.
    expect(whyNotTile(base, b!.owned, [100, 0, 0], TWIN)).toBeNull();
    expect(whyNotTile(base, b!.owned, [30, 0, 0], TWIN)).toMatch(/needs 44 tier-1 ore/);
    expect(buyTile(base, b!.owned, [30, 0, 0], TWIN)).toBeNull();
    expect(everyShopTile(TREE).sort()).toEqual(['rich', 'twin']);
    expect(smithOpen(TREE, b!.owned)).toEqual({ open: false, owned: 1, total: 2 });
    // The vein tile costs the tier it carries, on top (PRD sec 26): tier-1 Ore alone no longer buys it.
    const opened = resolveUnlocks(TREE, { ...EMPTY_META, unlocks: ['ore2'] }, RELICS);
    expect(copyPrice(RICH, {})).toEqual([47, 46, 0]);
    expect(whyNotTile(opened, b!.owned, [60, 0, 0], RICH)).toBe('needs 46 tier-2 ore (have 0)');
    const c = buyTile(opened, b!.owned, [60, 50, 0], RICH)!;
    expect(c.ore).toEqual([13, 4, 0]);
    expect(smithOpen(TREE, c.owned)).toEqual({ open: true, owned: 2, total: 2 });
  });
});

describe('priceTile: one function, the shop\'s and the Smith\'s (PRD sec 27, D31)', () => {
  it('is FLAT for plain authoring: a plain straight costs no more than the cheapest tile the shop ever sold', () => {
    expect(priceTile({ cells: MEADOW })).toEqual([20, 0, 0]);
    expect(priceTile({ cells: g('GGGGG', 'GGGGG', '-----', 'GGGGG', 'GGGGG') })[0]).toBeLessThanOrEqual(25);
  });

  it('prices the five shipped road specials within 5 Ore of what they were sold at', () => {
    const shipped: [string[], number][] = [
      [g('GG|GG', 'GGL7G', '-7GL-', 'GL7GG', 'GG|GG'), 25],
      [g('F--7G', 'L-7|G', '--JL-', 'GGGGG', 'GGGGG'), 30],
      [g('GGGGG', 'GGF7G', '--JL-', 'GGGGG', 'GGGGG'), 25],
      [g('GGGGG', 'GGF7G', 'GG|L-', 'GG|GG', 'GG|GG'), 30],
      [g('F--7G', 'L7G|G', '-JFJG', 'GG|GG', 'GG|GG'), 35],
    ];
    for (const [cells, was] of shipped) expect(Math.abs(priceTile({ cells })[0] - was), cells.join(' ')).toBeLessThanOrEqual(5);
  });

  it('charges a vein in the purse below it, and its own tier on top; an ore cell with no authored vein is not free', () => {
    const one = g('GGGGG', 'GGOGG', 'GGGGG', 'GGGGG', 'GGGGG');
    expect(priceTile({ cells: one })).toEqual([30, 0, 0]); // the dice deal it 30-90: priced as 60
    expect(priceTile({ cells: one, deposits: [{ amount: 60, tier: 2 }] })).toEqual([30, 20, 0]);
    const t3 = priceTile({ cells: one, deposits: [{ amount: 90, tier: 3 }] });
    expect(t3[0]).toBe(0); // a tier-3 vein is bought with tier-2 Ore...
    expect(t3[1]).toBe(35);
    expect(t3[2]).toBe(30); // ...and tier-3 Ore on top
  });

  it('prices boon ground by POWER, and the ladder it climbs is the sim\'s', () => {
    BOON_POWER_PCT.forEach((pct, i) => expect(Math.round((Sim.boonEffect('damage', i + 1).damageMul - 1) * 100)).toBe(pct));
    const boon = (tier: number): number => priceTile({ cells: MEADOW, boons: [{ tier }] })[0] - 20;
    expect([boon(1), boon(2), boon(3), boon(4)]).toEqual([11, 30, 69, 118]);
    // Five times the effect, eleven times the price.
    expect(boon(4) / boon(1)).toBeGreaterThan(10);
  });

  it('is STEEP for a loaded tile: every further feature costs more than the last, and the ceiling is prohibitive', () => {
    const withBoons = (n: number): number => priceTile({ cells: MEADOW, boons: Array.from({ length: n }, () => ({ tier: 4 })) })[0];
    const steps = [1, 2, 3, 4, 5].map((n) => withBoons(n) - withBoons(n - 1));
    for (let i = 1; i < steps.length; i++) expect(steps[i], `boon ${i + 1}`).toBeGreaterThan(steps[i - 1]);
    // "All high-tier veins and the strongest boon ground everywhere" (sec 27): more than a hundred good runs of Ore (a run banks about fifty).
    const loaded = priceTile({
      cells: g('GGGGG', 'GOOOG', 'GOOOG', 'GOOOG', 'GGGGG'),
      deposits: Array.from({ length: 9 }, () => ({ amount: 90, tier: 3 })),
      boons: Array.from({ length: 16 }, () => ({ tier: 4 })),
    });
    expect(loaded[1]).toBeGreaterThan(5000);
    expect(loaded[2]).toBeGreaterThan(1000);
  });

  it('itemises what it charges: the lines sum to the price', () => {
    const tile = { cells: g('GGGGG', 'GROGG', '-----', 'GGGGG', 'GGGGG'), deposits: [{ amount: 30, tier: 2 }], boons: [{ tier: 1 }, { tier: 3 }] };
    const lines = priceLines(tile);
    const sum = [0, 0, 0];
    for (const l of lines) sum[l.purse] += l.ore;
    expect(sum.map((c) => Math.round(c))).toEqual([...priceTile(tile)]);
    expect(lines.map((l) => l.label)).toEqual(['a tile', '5 road cells', '1 rock', '1 vein, 30 Ore', '1 tier-1 boon', '1 tier-3 boon', 'tier-2 veins, on top', '3 features: x1.30 on each']);
  });
});

describe('applicable relics (session 31, PR 7)', () => {
  it('a relic that only touches a tower kind is out of a run without that tower', () => {
    expect(relicApplies({ needsTower: ['tesla'] }, ['bolt', 'mortar'])).toBe(false);
    expect(relicApplies({ needsTower: ['tesla'] }, ['bolt', 'tesla'])).toBe(true);
    expect(relicApplies({ needsTower: ['laser', 'missile'] }, ['missile'])).toBe(true); // any one of them
    expect(relicApplies({}, [])).toBe(true); // a relic for every world
  });
});

describe('the multiset of copies (session 33, PR 7; D33)', () => {
  it('a second copy costs the first price plus half, a third plus a whole - in every purse; the fourth is refused', () => {
    const u = resolveUnlocks(TREE, { ...EMPTY_META, unlocks: ['tiles_all'] }, RELICS);
    const tile = { id: 'twin', cells: MEADOW }; // the bare tile: 20 / 30 / 40, the numbers D33 confirmed
    const uu = { ...u, tiles: new Set(['twin']) };
    expect(copyPrice(tile, {})).toEqual([20, 0, 0]);
    expect(copyPrice(tile, { twin: 1 })).toEqual([30, 0, 0]);
    expect(copyPrice(tile, { twin: 2 })).toEqual([40, 0, 0]);
    expect(copyPrice(RICH, { rich: 1 })).toEqual([71, 69, 0]);
    let owned: Record<string, number> = {};
    let ore = [100, 0, 0];
    for (let i = 0; i < MAX_TILE_COPIES; i++) { const b = buyTile(uu, owned, ore, tile); expect(b).not.toBeNull(); owned = b!.owned; ore = b!.ore; }
    expect(owned.twin).toBe(MAX_TILE_COPIES);
    expect(ore[0]).toBe(100 - 20 - 30 - 40);
    expect(whyNotTile(uu, owned, ore, tile)).toContain('the most a tile may be held');
    expect(buyTile(uu, owned, ore, tile)).toBeNull();
  });
});

describe('an Ore cost by tier (the ore ladder, PRD sec 26)', () => {
  it('pays every tier or none, and says the first tier it is short in', () => {
    expect(canPay([50, 0, 0], [20, 0, 0])).toBe(true);
    expect(canPay([50, 0, 0], [20, 15, 0])).toBe(false);
    expect(shortfall([50, 3, 0], [20, 15, 0])).toBe('needs 15 tier-2 ore (have 3)');
    expect(shortfall([50, 15, 0], [20, 15, 0])).toBeNull();
    expect(payCost([50, 15, 2], [20, 15, 0])).toEqual([30, 0, 2]);
    expect(costText([20, 0, 0])).toBe('20 ore');
    expect(costText([20, 15, 0])).toBe('20 ore + 15 tier-2 ore');
  });
});
