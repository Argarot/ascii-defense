/**
 * What answers a trait, in a phrase (Enemies II, session 32, PR 3): the rule
 * lives in engine/sim/traits.ts; the column names the answer under the next
 * wave's composition, so "which tower answers this" is a decision made with
 * the information it needs (PRD sec 9.2).
 */
export const TRAIT_ANSWER: Record<string, string> = {
  armoured: 'Frost is wasted; Bolts and Mortars, or Railbore',
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

/** The answer for a wave: the first kind with a trait the table names, in the composition's order. */
export function waveAnswer(kinds: readonly { name: string; traits?: readonly string[] }[]): string | null {
  for (const k of kinds) for (const t of k.traits ?? []) { const a = TRAIT_ANSWER[t]; if (a) return `${k.name}: ${a}`; }
  return null;
}
