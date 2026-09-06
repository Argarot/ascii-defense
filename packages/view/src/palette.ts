/**
 * The palette, loaded once through the content pipeline. `role()` is the only
 * way anything in view gets a colour - sprites and code name roles, the
 * palette decides (ASSETS.md sec 4).
 */
import { validatePalette } from '@ascii-defense/content';
import paletteJson from '@ascii-defense/content/assets/palette.json';

const result = validatePalette.check(paletteJson);
if (!result.ok) {
  throw new Error(
    'palette.json failed validation: ' +
      result.errors.map((e) => `${e.path}: ${e.message}`).join('; '),
  );
}
const ROLES = result.value.roles;

/**
 * Role overrides (session 27, WBS 4.24): a named set swaps the colours the
 * game reads for meaning - the enemy kinds, the boon types, the hp pip's
 * bands - for a set that stays apart without red and green. Every other
 * role is untouched; sprites keep their art.
 */
const OVERRIDE_SETS: Record<string, Record<string, string>> = {
  default: {},
  colourblind: {
    'enemy.eye': '#e6e6e6',
    'enemy.fast': '#ff9f1c',
    'enemy.swarm': '#f2e94e',
    'enemy.brute': '#4c9be8',
    'enemy.shell': '#b48cff',
    'enemy.husk': '#9ad8ff',
    'enemy.boss': '#ff6a3d',
    'boon.range': '#4c9be8',
    'boon.damage': '#ff9f1c',
    'boon.rate': '#f2e94e',
    'ui.accent': '#5fb0ff',
    'terrain.ore.mid': '#f2e94e',
    // The three status grounds apart by hue AND luminance (2026-09-06, item 2).
    'status.slowed': '#1b3a5c',
    'status.burning': '#5c2e00',
    'status.frozen': '#5a5f8a',
  },
};
let overrides: Record<string, string> = {};

/** Choose a role override set by name; unknown names clear it. */
export function setPaletteSet(name: string): void {
  overrides = OVERRIDE_SETS[name] ?? {};
}

export function role(name: string): string {
  const o = overrides[name];
  if (o) return o;
  const c = ROLES[name];
  if (!c) throw new Error(`palette role missing: ${name}`);
  return c;
}
