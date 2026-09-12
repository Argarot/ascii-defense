#!/usr/bin/env node
/**
 * Doc drift check (2026-09-06, Daniil: "make sure the docs don't drift from
 * each other"). The docs each own one job and REFERENCE each other; this
 * holds the seams where a wrap has drifted before:
 *
 *   1. The roadmap names exactly one NEXT ledger row, has a plan section for
 *      it, cites no "ledger row N", and uses no row identity twice.
 *   2. README has not grown a session changelog back (the ledger is the record).
 *   3. README's top paragraph does not describe a map the game no longer
 *      makes (the Core is at the east edge since session 24).
 *   4. ASSETS.md sec 3 names every sprite kind the schema allows.
 *   5. The catalogue and its codex twin are current (tools/codex.mjs --check).
 *   6. The GitHub description and homepage match README's first sentence
 *      and the live URL - checked when `gh` is available (skipped in CI).
 *
 *   node tools/doc-drift.mjs        report and exit 1 on drift
 */
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const problems = [];

const roadmap = read('docs/ROADMAP.md');
const readme = read('README.md');
const assets = read('docs/ASSETS.md');
const spriteSchema = JSON.parse(read('packages/content/schema/sprite.schema.json'));

// 1. The ledger names exactly one NEXT row, and the plan for it exists.
//    This used to compare HANDOVER's proposed session with the ledger's NEXT
//    row across two files; HANDOVER was folded into the roadmap on 2026-09-12
//    precisely so that the two could not disagree. The NEXT row owns the name
//    and "## The next session" owns the plan - neither repeats the other, so
//    there is nothing left to keep in sync, only to exist.
const nextRows = roadmap.split('\n').filter((l) => /^\| \*\*[^*]+\*\* \|.*\(NEXT/.test(l));
if (nextRows.length !== 1) problems.push(`ROADMAP: ${nextRows.length} ledger rows marked NEXT, expected exactly 1`);
if (!/^## The next session$/m.test(roadmap)) problems.push('ROADMAP: no "## The next session" section - Daniil\'s next input must be able to be "go"');
if (/ledger row \d+/.test(roadmap)) problems.push('ROADMAP cites a "ledger row N": planned rows are named, not numbered (CONTRIBUTING sec 6, rule 5)');

// 1b. No ledger row identity is used twice. This is the check that was missing
//     when the ledger grew a second row 33 and a third row 34.
const rowIds = [...roadmap.matchAll(/^\| (?:~~)?(\d+(?:–\d+)?)(?:~~)? \|/gm)].map((m) => m[1]);
const dupeIds = [...new Set(rowIds.filter((id, i) => rowIds.indexOf(id) !== i))];
if (dupeIds.length) problems.push(`ROADMAP ledger: row identity used twice - ${dupeIds.join(', ')}. Done rows keep the number they shipped under; planned rows are named`);

// 2. README must not grow a session changelog back. It carried one until
//    2026-09-12 and this check used to hold it against the ledger's newest
//    DONE row - a second copy of the record, kept in agreement by hand. The
//    README links to the ledger now, so the only thing left to check is that
//    the copy has not returned.
if (/^\*\*Sessions? \d+/m.test(readme)) problems.push("README carries a session changelog again: the ledger in docs/ROADMAP.md is the record - link it, do not copy it");

// 3. README's top paragraph vs the map the game makes. This one STAYS: it
//    holds a document against the DESIGN, not against another document.
const top = readme.split('\n## ')[0];
if (/Core at the middle of the map/i.test(top) || /Core in the middle/i.test(top)) problems.push('README top: the Core has been at the east edge since session 24 (PRD sec 4.5)');
if (!/east edge/i.test(top)) problems.push('README top: say where the Core is (the east edge) - a reader builds a picture from the first paragraph');

// 4. ASSETS sec 3 names every sprite kind.
const kinds = spriteSchema.properties.kind.enum;
const sec3 = assets.slice(assets.indexOf('## 3.'), assets.indexOf('## 4.'));
for (const k of kinds) if (!new RegExp(`\\b${k}s?\\b`, 'i').test(sec3)) problems.push(`ASSETS sec 3 does not name sprite kind \`${k}\``);

// 5. The catalogue and the codex twin.
const codex = spawnSync(process.execPath, ['tools/codex.mjs', '--check'], { cwd: ROOT, encoding: 'utf8' });
if (codex.status !== 0) problems.push('the catalogue or the codex twin is stale: node tools/codex.mjs');

// 6. The GitHub description and homepage (local only: needs gh). A WARNING,
//    not a failure: CI has no token. Since 2026-09-11 the project's token
//    carries Administration write, so the wrap can fix it with `gh repo edit`.
const warnings = [];
if (!process.env.CI) {
  const gh = spawnSync('gh', ['repo', 'view', '--json', 'description,homepageUrl'], { cwd: ROOT, encoding: 'utf8', shell: true });
  if (gh.status === 0) {
    try {
      const { description, homepageUrl } = JSON.parse(gh.stdout);
      const firstSentence = /^A (.+?)\./m.exec(readme.replace(/\n/g, ' '))?.[1] ?? '';
      if (!description || !description.toLowerCase().includes('tower defense')) warnings.push(`GitHub description "${description}" does not describe the game; README's first sentence: "A ${firstSentence}."`);
      if (!/argarot\.github\.io\/ascii-defense/.test(homepageUrl ?? '')) warnings.push(`GitHub homepage is "${homepageUrl || '(empty)'}"; run: gh repo edit --homepage https://argarot.github.io/ascii-defense/`);
    } catch {
      /* gh answered something unparseable: not a drift */
    }
  }
}

for (const w of warnings) console.warn('warning: ' + w);
if (problems.length) {
  console.error(`doc drift: ${problems.length} problem(s)`);
  for (const p of problems) console.error('  - ' + p);
  process.exit(1);
}
console.log('docs agree: ROADMAP/README/ASSETS/CATALOGUE' + (process.env.CI ? '' : warnings.length ? ' (GitHub warnings above)' : ' and the GitHub description'));
