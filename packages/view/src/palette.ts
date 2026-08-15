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

export function role(name: string): string {
  const c = ROLES[name];
  if (!c) throw new Error(`palette role missing: ${name}`);
  return c;
}
