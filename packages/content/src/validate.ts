/**
 * Runtime content validation. Every content JSON is validated at load
 * (ARCHITECTURE §8) — a malformed asset is reported with its path and reason,
 * never silently half-loaded.
 *
 * The schema objects come from the generated modules, so runtime validation
 * and compile-time types cannot disagree: both are one codegen away from
 * packages/content/schema/.
 */
import { Ajv, type ValidateFunction } from 'ajv';
import { enemiesSchema, type EnemyRoster } from './generated/enemies';
import { paletteSchema, type Palette } from './generated/palette';
import { spriteSchema, type Sprite } from './generated/sprite';
import { relicsSchema, type RelicPool } from './generated/relics';
import { towersSchema, type TowerRoster } from './generated/towers';
import { terrainSchema, type TerrainAppearance } from './generated/terrain';
import { lootSchema, type LootTables } from './generated/loot';

export type { Palette, Sprite, EnemyRoster, TowerRoster, RelicPool, TerrainAppearance, LootTables };

export interface ContentError {
  /** JSON path into the document, e.g. "/roles/ui.bg". */
  path: string;
  message: string;
}

export interface Validator<T> {
  /** Returns the typed document, or the list of errors. Never throws. */
  check(doc: unknown): { ok: true; value: T } | { ok: false; errors: ContentError[] };
}

function wrap<T>(fn: ValidateFunction): Validator<T> {
  return {
    check(doc) {
      if (fn(doc)) return { ok: true, value: doc as T };
      const errors = (fn.errors ?? []).map((e) => ({
        path: e.instancePath || '/',
        message: e.message ?? 'invalid',
      }));
      return { ok: false, errors };
    },
  };
}

// One Ajv instance, schemas compiled once at module load. `$schema` keys in
// documents are data to ajv (draft-07 metaschema), not fetched.
const ajv = new Ajv({ allErrors: true, strictTypes: false });

export const validatePalette: Validator<Palette> = wrap<Palette>(ajv.compile(paletteSchema));
export const validateSprite: Validator<Sprite> = wrap<Sprite>(ajv.compile(spriteSchema));
export const validateEnemies: Validator<EnemyRoster> = wrap<EnemyRoster>(ajv.compile(enemiesSchema));
export const validateTowers: Validator<TowerRoster> = wrap<TowerRoster>(ajv.compile(towersSchema));
export const validateRelics: Validator<RelicPool> = wrap<RelicPool>(ajv.compile(relicsSchema));
export const validateTerrain: Validator<TerrainAppearance> = wrap<TerrainAppearance>(ajv.compile(terrainSchema));
export const validateLoot: Validator<LootTables> = wrap<LootTables>(ajv.compile(lootSchema));
