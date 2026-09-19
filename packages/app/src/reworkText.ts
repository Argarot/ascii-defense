/**
 * THE REWORK'S PROTOTYPE - what the cards say (PRD sec 32.2). Digging re-reads
 * four things a player can hold or buy, and their shipped sentences describe
 * prospecting. With the switch on the rule changed, so the sentence changes
 * with it: nothing on screen lies, prototype or not. The content files are
 * untouched - the game as it is still says what it does - and when Rework IV
 * deletes the old path these sentences move into the content and this file
 * goes.
 *
 * Not built, and said here so nobody reads a promise into a card: the
 * Seismograph's legendary tier (the whole board), and the Work Gang relic.
 */
import type { RelicDef, TowerDef } from '@ascii-defense/engine';

const RELIC: Record<string, { name?: string; desc: string }> = {
  // Quarry was "rock breaks faster"; nothing hurries a dig. It is the Seismograph: sight, at every rarity.
  quarry: { name: 'Seismograph', desc: 'You see two layers into the ground: rock from bedrock, and what lies under it.' },
  prospectors_eye: { desc: 'A dig costs half.' },
  vein_tap: { desc: 'You may build on rock you can see - no dig needed.' },
};
const CHOICE: Record<string, { name?: string; desc: string }> = {
  surveySpeed: { desc: 'Reveals the ground within two cells of this Refinery: rock from bedrock, and what lies under it.' },
  surveyAuto: { name: 'Second Crew', desc: 'One more crew: one more dig at a time, for as long as this Refinery stands.' },
};

export function reworkRelicText(defs: readonly RelicDef[]): RelicDef[] {
  return defs.map((d) => {
    const t = RELIC[d.id];
    if (!t) return d;
    // Every tier says the same sentence: the rule is a boolean under the rework, the same at every rarity.
    const tiers = d.tiers ? Object.fromEntries(Object.entries(d.tiers).map(([k, v]) => [k, { ...v, desc: t.desc }])) : d.tiers;
    return { ...d, name: t.name ?? d.name, desc: t.desc, ...(tiers ? { tiers } : {}) } as RelicDef;
  });
}

export function reworkTowerText(defs: readonly TowerDef[]): TowerDef[] {
  return defs.map((d) => (!d.tiers ? d : {
    ...d,
    tiers: d.tiers.map((tier) => ({
      ...tier,
      choices: tier.choices.map((c) => { const t = c.unlocks ? CHOICE[c.unlocks] : undefined; return t ? { ...c, name: t.name ?? c.name, desc: t.desc } : c; }),
    })),
  }) as TowerDef);
}
