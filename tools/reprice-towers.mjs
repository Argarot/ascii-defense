/**
 * Every tower's price by ONE rule (session 39, D37): the chassis times BASE,
 * each tier choice times TIERS, rounded to fives. Run once on 2026-09-18 with
 * 3 and 0.6; kept because the split between a tower and its upgrades is the
 * number that decides whether width or depth is the better buy, and the next
 * person to move it should move all fifty-six prices together, not by hand.
 *
 * It rewrites `"cost": N` in file order, line by line, so the file's layout
 * and every other byte survive; it refuses if the count of prices it finds is
 * not the count the parsed roster holds.
 *
 *   node tools/reprice-towers.mjs <base> <tiers>      e.g. 3 0.6
 */
import { readFileSync, writeFileSync } from 'node:fs';

const [base, tiers] = process.argv.slice(2).map(Number);
if (!(base > 0) || !(tiers > 0)) throw new Error('usage: node tools/reprice-towers.mjs <base> <tiers>');
const file = 'packages/content/assets/towers/roster.json';
const text = readFileSync(file, 'utf8');
const roster = JSON.parse(text);

const five = (n) => Math.max(5, Math.round(n / 5) * 5);
const next = [];
for (const t of roster.towers) {
  next.push(five(t.cost * base));
  for (const tier of t.tiers ?? []) for (const c of tier.choices) next.push(five(c.cost * tiers));
}
let i = 0;
const out = text.replace(/"cost": (\d+)/g, () => `"cost": ${next[i++]}`);
if (i !== next.length) throw new Error(`found ${i} prices in the file, the roster holds ${next.length} - the file's order is not the roster's`);
// The same traversal on the rewritten text must give the prices asked for, or the order assumption was wrong.
const check = JSON.parse(out);
let k = 0;
for (const t of check.towers) {
  if (t.cost !== next[k++]) throw new Error(`price out of order at ${t.id}`);
  for (const tier of t.tiers ?? []) for (const c of tier.choices) if (c.cost !== next[k++]) throw new Error(`price out of order in ${t.id}`);
}
writeFileSync(file, out);
for (const t of check.towers) console.log(t.id.padEnd(10), String(t.cost).padEnd(5), (t.tiers ?? []).map((tier) => tier.choices.map((c) => c.cost).join('/')).join('  '));
