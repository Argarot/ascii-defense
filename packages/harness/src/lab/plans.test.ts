/**
 * The lab's one table of plans (2026-09-18): every plan names things that
 * exist, and the tools that play named players take them from the table and
 * nowhere else. fit.ts and balanceCheck.ts once held hand copies of the same
 * plans under different names; this is what stops a third copy.
 */
import { describe, expect, it } from 'vitest';
import { validateRelics, validateTowers } from '@ascii-defense/content';
import towersJson from '@ascii-defense/content/assets/towers/roster.json';
import relicsJson from '@ascii-defense/content/assets/relics/pool.json';
import targets from '../../balance/targets.json';
import { PLANS, THREAT_KEYS, planOf, type Plan } from './plans';

function must<T>(r: { ok: true; value: T } | { ok: false; errors: unknown[] }): T {
  if (!r.ok) throw new Error('content invalid');
  return r.value;
}
const towers = must(validateTowers.check(towersJson)).towers;
const relics = must(validateRelics.check(relicsJson)).relics;
const entries = Object.entries(PLANS) as [string, Plan][];
/** The tools that play named players, as text (the harness's idiom for reading a source: glyphs.test.ts). */
const SOURCES = import.meta.glob(['./fit.ts', './balanceCheck.ts', './seedCorpus.ts'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

describe('the one table of plans', () => {
  it.each(entries)('%s: every tower exists and every tier choice is one the tower has', (_name, plan) => {
    for (const p of [...plan.towers, ...(plan.tail ?? [])]) {
      const def = towers.find((t) => t.id === p.towerId);
      expect(def, `tower '${p.towerId}'`).toBeDefined();
      p.choices.forEach((c, tier) => {
        if (c < 0) return; // -1: the tier is never bought
        expect(def!.tiers?.[tier]?.choices[c], `${p.towerId} tier ${tier + 1} choice ${c}`).toBeDefined();
      });
    }
  });

  it.each(entries)('%s: every relic held exists, and the base world holds commons alone (D29)', (_name, plan) => {
    for (const r of plan.relics ?? []) {
      expect(relics.find((x) => x.id === r.id), `relic '${r.id}'`).toBeDefined();
      // A base-world set that names a rare or an epic is REFUSED on every seed - it read as "-" silently once.
      if (plan.unlocks.length === 0) expect(r.rarity, `${r.id} in a base-world plan`).toBe(0);
    }
  });

  it('a plan that goes on buying says what it buys; only an instrument has a horizon', () => {
    for (const [name, plan] of entries) {
      if (plan.tail) expect(plan.tail.length, name).toBeGreaterThan(0);
      if (plan.horizon !== undefined) expect(plan.tail, `${name} is an instrument and must stop buying`).toBeUndefined();
    }
  });

  it('every band of the balance gate names a threat and a plan of this table', () => {
    for (const band of targets.bands) {
      const [threat, plan] = band.run.split(':');
      expect(THREAT_KEYS as readonly string[]).toContain(threat);
      expect(() => planOf(plan), band.id).not.toThrow();
    }
  });

  it('an unknown plan is a loud error that lists the table, never an empty read', () => {
    expect(() => planOf('mixed')).toThrow(/unknown plan 'mixed' - plans: .*mixedDeep/);
  });

  it('the tools that play named players hold no plans of their own', () => {
    const sources = Object.entries(SOURCES);
    expect(sources.map(([file]) => file).sort()).toEqual(['./balanceCheck.ts', './fit.ts', './seedCorpus.ts']);
    for (const [file, src] of sources) {
      expect(src, file).toContain("from './plans'");
      // A placement literal is what a hand copy is made of.
      expect(src, `${file} builds a TowerPlacement by hand`).not.toMatch(/towerId\s*:/);
      expect(src, `${file} builds a TowerPlacement by hand`).not.toMatch(/\bP\('/);
    }
  });
});
