#!/usr/bin/env node
/**
 * Seed the tracker from tools/issues-seed.json.
 *
 * The queue lives in GitHub Issues, not in a doc (working agreement, rule 6).
 * This script performs the one-way migration off docs/WBS.md's technical-debt
 * register and HANDOVER's standing open items, and is **idempotent**: it skips
 * any issue whose exact title already exists in any state, so a re-run after a
 * partial failure costs nothing.
 *
 *   node tools/seed-issues.mjs --dry-run    # print what it would do
 *   node tools/seed-issues.mjs              # create labels and issues
 *   node tools/seed-issues.mjs <seed.json>  # a different seed file
 *
 * Needs a token with Issues: read and write. Without it every create returns
 * "Resource not accessible by personal access token" and the script stops on
 * the first failure rather than half-migrating.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dryRun = process.argv.includes('--dry-run');

const LABELS = [
  ['defect', 'd73a4a', 'It lies, breaks, or contradicts a written rule. The dev fixes it.'],
  ['call', 'd876e3', "Needs Daniil's taste; no written rule decides it. His queue."],
  ['scope', '0e8a16', 'New work. Waits for a session, not a fix.'],
  ['blocks-ship', 'b60205', 'Beta waits for this.'],
  ['later', 'c5def5', 'Beta does not wait for this.'],
];

const gh = (args) => execFileSync('gh', args, { cwd: root, encoding: 'utf8' });

function ensureLabels() {
  const raw = gh(['label', 'list', '--limit', '100', '--json', 'name']).trim();
  const existing = new Set(raw ? JSON.parse(raw).map((l) => l.name) : []);
  for (const [name, color, description] of LABELS) {
    if (existing.has(name)) {
      console.log(`  label ${name} — exists`);
      continue;
    }
    if (dryRun) {
      console.log(`  label ${name} — would create`);
      continue;
    }
    gh(['label', 'create', name, '--color', color, '--description', description]);
    console.log(`  label ${name} — created`);
  }
}

function existingTitles() {
  const raw = gh(['issue', 'list', '--state', 'all', '--limit', '500', '--json', 'title']).trim();
  return new Set(raw ? JSON.parse(raw).map((i) => i.title) : []);
}

const seedArg = process.argv.slice(2).find((a) => !a.startsWith('--'));
const seedPath = join(root, seedArg ?? 'tools/issues-seed.json');
const issues = JSON.parse(readFileSync(seedPath, 'utf8'));

console.log(`labels:`);
ensureLabels();

const have = existingTitles();
let made = 0;
let skipped = 0;

console.log(`\nissues (${issues.length} in the seed):`);
for (const issue of issues) {
  if (have.has(issue.title)) {
    skipped += 1;
    continue;
  }
  if (dryRun) {
    console.log(`  would create [${issue.labels.join(', ')}] ${issue.title}`);
    made += 1;
    continue;
  }
  const args = ['issue', 'create', '--title', issue.title, '--body', issue.body];
  for (const label of issue.labels) args.push('--label', label);
  const url = gh(args).trim().split('\n').pop();
  console.log(`  ${url}  [${issue.labels.join(', ')}] ${issue.title}`);
  made += 1;
}

console.log(
  `\n${dryRun ? 'would create' : 'created'} ${made}, skipped ${skipped} already present.`,
);
console.log(`\nHis queue is now:  gh issue list --label call --label blocks-ship`);
