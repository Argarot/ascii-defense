import { describe, expect, it } from 'vitest';
import { ALL_UNLOCKS, EMPTY_META, buyNode, buyTile, everyShopTile, relicForWin, resolveUnlocks, smithOpen, whyNot, whyNotTile, type TreeDef } from './tree';

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

describe('the tile shop and the Smith\'s door (session 29, PR 5)', () => {
  const TWIN = { id: 'twin', price: { tier: 1, ore: 25 } };
  const RICH = { id: 'rich', price: { tier: 1, ore: 60 } };
  const FREE = { id: 'minted_thing' };

  it('a tile is bought once, in its tier, only once the tree opened it; the Smith opens when every tile is owned', () => {
    const base = resolveUnlocks(TREE, EMPTY_META, RELICS);
    expect(whyNotTile(base, {}, [10, 0, 0], TWIN)).toMatch(/needs 25 tier-1 ore/);
    expect(whyNotTile(base, {}, [100, 0, 0], RICH)).toBe('the tree has not opened it');
    expect(whyNotTile(base, {}, [100, 0, 0], FREE)).toBe('not for sale');
    const b = buyTile(base, {}, [30, 0, 0], TWIN);
    expect(b).toEqual({ owned: { twin: 1 }, ore: [5, 0, 0] });
    expect(whyNotTile(base, b!.owned, [100, 0, 0], TWIN)).toBe('owned');
    expect(buyTile(base, b!.owned, [100, 0, 0], TWIN)).toBeNull();
    expect(everyShopTile(TREE).sort()).toEqual(['rich', 'twin']);
    expect(smithOpen(TREE, b!.owned)).toEqual({ open: false, owned: 1, total: 2 });
    const opened = resolveUnlocks(TREE, { ...EMPTY_META, unlocks: ['ore2'] }, RELICS);
    const c = buyTile(opened, b!.owned, [60, 0, 0], RICH)!;
    expect(smithOpen(TREE, c.owned)).toEqual({ open: true, owned: 2, total: 2 });
  });
});
