/**
 * The reduced-motion switch (PRD sec 15.4), shipped WITH the effects engine
 * rather than retrofitted - the named failure mode of WBS 4.1.
 *
 * One module-level flag every effect consults. It defaults from the OS
 * preference (prefers-reduced-motion) the moment the view loads; the settings
 * screen that overrides it per-player is M4 (WBS 4.22) and will call
 * setReducedMotion. Under reduced motion: ambient animation (terrain drift,
 * water, tower idles, breathing UI) stops entirely, and gameplay feedback
 * (explosions, deaths, pulses) degrades to short-lived STATIC marks - the
 * information survives, the motion does not.
 */
let reduced =
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export function isReducedMotion(): boolean {
  return reduced;
}

export function setReducedMotion(v: boolean): void {
  reduced = v;
}
