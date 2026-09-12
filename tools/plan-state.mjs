#!/usr/bin/env node
/**
 * Render the plan's item state from GitHub Issues into docs/ROADMAP.md.
 *
 * The item TREE is scope and lives in the document, hand-written, with stable
 * IDs. An item's STATE is never hand-written: an ID is **open** if an issue
 * titled `[<id>] …` is open, and **done** otherwise. That makes done-vs-left
 * correct by construction — closing a PR closes the issue and the next render
 * tells the truth — instead of 144 checkboxes maintained across 122 commits,
 * which is what this replaces.
 *
 *   node tools/plan-state.mjs            rewrite the generated block
 *   node tools/plan-state.mjs --check    exit 1 if the block is stale
 *
 * Needs `gh` and a token that can read issues, so it runs at the wrap and is
 * SKIPPED IN CI (like doc-drift's GitHub half). The block can therefore lag
 * reality between wraps — by a day at most, and never by a hand-edit.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DOC = join(ROOT, 'docs', 'ROADMAP.md');
const START = '<!-- generated:state -->';
const END = '<!-- /generated:state -->';

const doc = readFileSync(DOC, 'utf8');

// Every id the tree declares, in order, with its milestone heading.
const ids = [];
let milestone = null;
for (const line of doc.split('\n')) {
  const h = /^### (M\d+|Backlog)\b\s*[—-]?\s*(.*)$/.exec(line);
  if (h) milestone = h[1];
  const m = /^\| `(\d+(?:\.\d+)+)` \|/.exec(line);
  if (m && milestone) ids.push({ id: m[1], milestone });
}
if (!ids.length) {
  console.error('plan-state: no item rows found in docs/ROADMAP.md');
  process.exit(1);
}

const raw = execFileSync('gh', ['issue', 'list', '--state', 'open', '--limit', '500', '--json', 'number,title'], {
  cwd: ROOT,
  encoding: 'utf8',
}).trim();
const openIssues = raw ? JSON.parse(raw) : [];
const byId = new Map();
for (const issue of openIssues) {
  const m = /^\[(\d+(?:\.\d+)+)\]/.exec(issue.title);
  if (m) byId.set(m[1], issue.number);
}

const groups = new Map();
for (const { id, milestone: ms } of ids) {
  if (!groups.has(ms)) groups.set(ms, { done: 0, open: [] });
  const g = groups.get(ms);
  if (byId.has(id)) g.open.push(`${id} (#${byId.get(id)})`);
  else g.done += 1;
}

const totalOpen = [...groups.values()].reduce((n, g) => n + g.open.length, 0);
const totalDone = [...groups.values()].reduce((n, g) => n + g.done, 0);

const lines = [
  START,
  `*Rendered from open issues by \`node tools/plan-state.mjs\` — do not edit by hand.*`,
  '',
  `**${totalDone} of ${totalDone + totalOpen} items done; ${totalOpen} open.**`,
  '',
  '| | done | open | the open ids |',
  '|---|---:|---:|---|',
];
for (const [ms, g] of groups) {
  lines.push(`| **${ms}** | ${g.done} | ${g.open.length} | ${g.open.join(' · ') || '—'} |`);
}
lines.push('', END);
const block = lines.join('\n');

const s = doc.indexOf(START);
const e = doc.indexOf(END);
if (s === -1 || e === -1) {
  console.error(`plan-state: docs/ROADMAP.md has no ${START} … ${END} block`);
  process.exit(1);
}
const next = doc.slice(0, s) + block + doc.slice(e + END.length);

if (process.argv.includes('--check')) {
  if (next !== doc) {
    console.error("docs/ROADMAP.md's item state is stale: run `node tools/plan-state.mjs`");
    process.exit(1);
  }
  console.log(`plan state current: ${totalDone} done, ${totalOpen} open`);
} else {
  writeFileSync(DOC, next);
  console.log(`plan state written: ${totalDone} done, ${totalOpen} open across ${groups.size} groups`);
}
