/**
 * Schema → TypeScript codegen. Output is COMMITTED; CI regenerates and fails
 * on any diff, so the types in the repo can never drift from the schemas.
 *
 * Each generated module carries both the interface and the schema object
 * itself, so runtime validation (ajv) and compile-time types share a single
 * source of truth and nothing needs resolveJsonModule or cross-rootDir JSON
 * imports.
 *
 * Usage: node tools/build-content-types.mjs
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import { compile } from 'json-schema-to-typescript';

const SCHEMA_DIR = 'packages/content/schema';
const OUT_DIR = 'packages/content/src/generated';

mkdirSync(OUT_DIR, { recursive: true });

const files = readdirSync(SCHEMA_DIR)
  .filter((f) => f.endsWith('.schema.json'))
  .sort(); // deterministic order for the drift check

for (const file of files) {
  const name = basename(file, '.schema.json');
  const schema = JSON.parse(readFileSync(join(SCHEMA_DIR, file), 'utf8'));
  const banner = [
    `// AUTO-GENERATED from schema/${file} - do not edit.`,
    '// Regenerate: node tools/build-content-types.mjs',
  ].join('\n');
  const iface = await compile(schema, name, {
    bannerComment: banner,
    style: { singleQuote: true },
    additionalProperties: false,
  });
  const constName = `${name}Schema`;
  const body = `${iface}
/** The schema itself, for runtime validation. Same source as the type above. */
export const ${constName} = ${JSON.stringify(schema, null, 2)} as const;
`;
  writeFileSync(join(OUT_DIR, `${name}.ts`), body);
  console.log(`generated ${OUT_DIR}/${name}.ts`);
}
