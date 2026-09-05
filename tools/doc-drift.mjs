#!/usr/bin/env node
/**
 * Doc drift check (2026-09-06, Daniil: "make sure the docs don't drift from
 * each other"). The docs each own one job and REFERENCE each other; this
 * holds the seams where a wrap has drifted before:
 *
 *   1. HANDOVER's "Next session, proposed" names the same theme as the
 *      roadmap ledger's NEXT row, and cites that row's number.
 *   2. README's newest "Session N" paragraph is the session the ledger's
 *      newest DONE row says it was.
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

const handover = read('HANDOVER.md');
const roadmap = read('docs/ROADMAP.md');
const readme = read('README.md');
const assets = read('docs/ASSETS.md');
const spriteSchema = JSON.parse(read('packages/content/schema/sprite.schema.json'));

// 1. HANDOVER's next session vs the ledger's NEXT row.
const nextRow = roadmap.split('\n').find((l) => /^\| \d+ \| \*\*[^*]+\*\* \*\([^)]*NEXT/.test(l));
const proposed = /^## Next session, proposed — (\d+)(?: \(ledger row (\d+)\))?: (.+)$/m.exec(handover);
if (!nextRow) problems.push('ROADMAP: no ledger row is marked NEXT');
if (!proposed) problems.push('HANDOVER: no "## Next session, proposed — N (ledger row M): Title" heading');
if (nextRow && proposed) {
  const rowNum = /^\| (\d+) \|/.exec(nextRow)[1];
  const rowTitle = /\*\*([^*]+)\*\*/.exec(nextRow)[1].trim();
  const [, , citedRow, title] = proposed;
  if (title.trim() !== rowTitle) problems.push(`HANDOVER proposes "${title.trim()}" but the ledger's NEXT row ${rowNum} is "${rowTitle}"`);
  if (citedRow !== rowNum) problems.push(`HANDOVER's proposed session cites ledger row ${citedRow ?? '(none)'}; the NEXT row is ${rowNum} - write "— N (ledger row ${rowNum}): ${rowTitle}"`);
}

// 2. README's newest session paragraph vs the ledger's newest DONE row.
const readmeSession = /^\*\*Session (\d+) \(/m.exec(readme);
const doneSessions = [...roadmap.matchAll(/^\| ~~\d+~~ \| \*\*DONE\*\* \*\([^)]*session (\d+)/gm)].map((m) => Number(m[1]));
const doneSessionsRange = [...roadmap.matchAll(/^\| ~~\d+~~ \| \*\*DONE\*\* \*\([^)]*sessions \d+–(\d+)/gm)].map((m) => Number(m[1]));
const newestDone = Math.max(0, ...doneSessions, ...doneSessionsRange);
if (!readmeSession) problems.push('README: no "**Session N (" paragraph');
else if (Number(readmeSession[1]) !== newestDone) problems.push(`README's newest paragraph is session ${readmeSession[1]}; the ledger's newest DONE row is session ${newestDone}`);

// 3. README's top paragraph vs the map the game makes.
const top = readme.split('\n## ')[0];
if (/Core at the middle of the map/i.test(top) || /Core in the middle/i.test(top)) problems.push('README top: the Core has been at the east edge since session 24 (PRD sec 4.5)');
if (!/east edge/i.test(top)) problems.push('README top: say where the Core is (the east edge) - a reader builds a picture from the first paragraph');

// 4. ASSETS sec 3 names every sprite kind.
const kinds = spriteSchema.properties.kind.enum;
const sec3 = assets.slice(assets.indexOf('## 3.'), assets.indexOf('## 4.'));
for (const k of kinds) if (!new RegExp(`[\`"']${k}[\`"']`).test(sec3)) problems.push(`ASSETS sec 3 does not name sprite kind \`${k}\``);

// 5. The catalogue and the codex twin.
const codex = spawnSync(process.execPath, ['tools/codex.mjs', '--check'], { cwd: ROOT, encoding: 'utf8' });
if (codex.status !== 0) problems.push('the catalogue or the codex twin is stale: node tools/codex.mjs');

// 6. The GitHub description and homepage (local only: needs gh). A WARNING,
//    not a failure: the repo-scoped token cannot edit them (403 on
//    2026-09-06), so the fix is Daniil's hand in the repo settings.
const warnings = [];
if (!process.env.CI) {
  const gh = spawnSync('gh', ['repo', 'view', '--json', 'description,homepageUrl'], { cwd: ROOT, encoding: 'utf8', shell: true });
  if (gh.status === 0) {
    try {
      const { description, homepageUrl } = JSON.parse(gh.stdout);
      const firstSentence = /^A (.+?)\./m.exec(readme.replace(/\n/g, ' '))?.[1] ?? '';
      if (!description || !description.toLowerCase().includes('tower defense')) warnings.push(`GitHub description "${description}" does not describe the game; README's first sentence: "A ${firstSentence}."`);
      if (!/argarot\.github\.io\/ascii-defense/.test(homepageUrl ?? '')) warnings.push(`GitHub homepage is "${homepageUrl || '(empty)'}"; set it to https://argarot.github.io/ascii-defense/ in the repo settings (the token cannot)`);
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
console.log('docs agree: HANDOVER/ROADMAP/README/ASSETS/CATALOGUE' + (process.env.CI ? '' : warnings.length ? ' (GitHub warnings above)' : ' and the GitHub description'));
