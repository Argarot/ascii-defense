/**
 * What answers a trait, in a phrase (Enemies II, session 32, PR 3): the rule
 * lives in engine/sim/traits.ts; the column names the answer under the next
 * wave's composition, so "which tower answers this" is a decision made with
 * the information it needs (PRD sec 9.2).
 */
export const TRAIT_ANSWER: Record<string, string> = {
  armoured: 'slows slide off; hit big, or use energy', // short on purpose: the panel gives an answer two lines, and the longer wording was cut at "small +" the first time it was looked at
  insulated: 'energy slides off; hit big, or use kinetic', // D38: armour's mirror, and the mirror of its answer (the word is derived from the def's number by the app, not an engine trait)
  shielded: 'focus fire - the shield regrows unhit',
  fast: 'slows last half as long; hit hard',
  swarm: 'blasts and pierce - three bodies a pack',
  split: 'kill it early, or blast the halves together',
  heal: 'kill the mender first (priority WEAKEST)',
  burrow: 'it surfaces past the entry: towers deeper in',
  charge: 'finish it, or slow it before the sprint',
  frontshield: 'flank it from beside the road',
  sprint: 'keep it under fire - arcs, a beam',
  bulwark: 'kill the Warden first, not last',
};

/**
 * Plating in words a player can act on (D37, D38): what the wave's ramp takes off a hit, by type. One place, because
 * the side panel says the sentence and the strip's header says the tag, and the two once had to agree by hand.
 * The shipped rules ramp kinetic and energy alike, so a player only ever reads the first form; the others are for a
 * run whose rules differ (the lab's), and are said rather than hidden.
 */
export function platingWords(plating: number, insulating: number): { tag: string; line: string } | null {
  if (plating <= 0 && insulating <= 0) return null;
  if (plating === insulating) return { tag: `PLATED +${plating}`, line: `PLATED +${plating}: every hit loses ${plating} more - hit big` };
  if (insulating <= 0) return { tag: `PLATED +${plating}`, line: `PLATED +${plating}: every kinetic hit loses ${plating} more - hit big, or use energy` };
  if (plating <= 0) return { tag: `INSULATED +${insulating}`, line: `INSULATED +${insulating}: every energy hit loses ${insulating} more - hit big, or use kinetic` };
  return { tag: `PLATED +${plating}/+${insulating}`, line: `PLATED: kinetic hits lose ${plating} more, energy hits ${insulating} - hit big` };
}

/** The answer for a wave: the first kind with a trait the table names, in the composition's order. */
export function waveAnswer(kinds: readonly { name: string; traits?: readonly string[] }[]): string | null {
  for (const k of kinds) for (const t of k.traits ?? []) { const a = TRAIT_ANSWER[t]; if (a) return `${k.name}: ${a}`; }
  return null;
}
