#!/usr/bin/env node
/**
 * The catalogue (session 25, Daniil: "a table of all relics and what they
 * do, all enemies and their abilities, so I can see what we have without
 * playing"):
 *
 *   node tools/codex.mjs          rewrite the generated sections of docs/CATALOGUE.md
 *   node tools/codex.mjs --check  exit 1 if they are stale (CI)
 *
 * Everything between a `<!-- generated:NAME -->` / `<!-- /generated -->`
 * pair is rendered from content (towers, enemies, relics, the trait rules);
 * everything outside the pairs is his - the PROPOSED tables in particular
 * are the request queue: a row there is a thing to build, and when it
 * ships it appears above by itself. The generator never touches text
 * outside the markers.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const ASSETS = join(ROOT, 'packages', 'content', 'assets');
const DOC = join(ROOT, 'docs', 'CATALOGUE.md');
const TICK_HZ = 20;

const read = (p) => JSON.parse(readFileSync(join(ASSETS, p), 'utf8'));
const towers = read('towers/roster.json').towers;
const enemies = read('enemies/roster.json').enemies;
const relics = read('relics/pool.json').relics;

/** Mirror of engine/sim/traits.ts TRAIT_RULES, in words. */
const TRAITS = {
  armoured: 'immune to slows; armour is subtracted from every hit (Railbore ignores it)',
  shielded: 'a shield pool burns before hp and REGENERATES after 2 s unhit - focus fire',
  fast: 'slows last half as long',
  swarm: 'spawns in packs of three - one queue entry, three bodies',
};

const n = (v, d = 1) => (v === undefined ? '' : Number.isInteger(v) ? String(v) : v.toFixed(d));
const esc = (s) => String(s ?? '').replace(/\|/g, '\\|');
const table = (head, rows) =>
  [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${r.map(esc).join(' | ')} |`)].join('\n');

function towerShape(t) {
  if (t.attack === 'none') return 'producer (no attack)';
  if (t.attack === 'pulse') return 'pulse: hits everything in range at once';
  if (t.attack === 'chain') return `chain: arcs to ${t.chain?.count ?? 1} bodies within ${n(t.chain?.reach ?? 1)} cells of each other, ${Math.round((t.chain?.falloff ?? 1) * 100)}% per hop`;
  const p = t.projectile ?? {};
  const bits = [];
  bits.push(p.homing ? 'homing shot' : 'ballistic shell (aim committed at fire time)');
  if (p.explosive) bits.push(`blast r${n(p.explodeRadius)}`);
  if (t.minRange) bits.push(`dead zone r${n(t.minRange)}`);
  if (p.applyEffect === 'slow') bits.push(`slows to ${Math.round(p.slowMul * 100)}% for ${n(p.slowTicks / TICK_HZ)} s`);
  return bits.join(', ');
}
function towerRows() {
  return towers.map((t) => {
    const dmg = t.projectile?.damage ?? 0;
    const rate = t.attack === 'none' ? '' : n(TICK_HZ / t.fireEveryTicks, 2);
    const dps = t.attack === 'none' ? '' : n((dmg * TICK_HZ) / t.fireEveryTicks, 1);
    const prod = t.production ? `${t.production.ore} Ore / ${n(t.production.everyTicks / TICK_HZ)} s` : '';
    return [`**${t.name ?? t.id}**`, t.id, t.cost, n(t.range), rate, dmg || '', dps, prod || towerShape(t)];
  });
}
function tierRows(t) {
  const rows = [];
  t.tiers.forEach((tier, i) => {
    tier.choices.forEach((c) => {
      const mods = Object.entries(c.mods ?? {}).map(([k, v]) => `${k} ${v > 0 ? '+' : ''}${v}`);
      if (c.unlocks) mods.push(`unlocks ${c.unlocks}`);
      rows.push([`T${i + 1}`, `**${c.name}**`, c.cost, c.desc ?? '', mods.join(', ')]);
    });
  });
  return rows;
}
function enemyRows() {
  return enemies.map((e) => [
    `**${e.name ?? e.id}**`, e.id, e.hp, n(e.speed * TICK_HZ, 2), e.damage, e.bounty, e.minWave ?? 1, e.armor ?? '', e.shield ?? '',
    (e.traits ?? []).join(', '),
  ]);
}
function relicRows() {
  return relics.map((r) => [
    `**${r.name}**`, r.id, r.kind, r.stackable ? 'yes' : '', r.cooldownTicks ? `${n(r.cooldownTicks / TICK_HZ)} s` : '', r.desc ?? '',
    Object.entries(r.effects ?? {}).map(([k, v]) => `${k} ${v}`).join(', '),
  ]);
}

const SECTIONS = {
  towers: () =>
    [
      `${towers.length} towers in \`packages/content/assets/towers/roster.json\`. Rate is shots per second; DPS is base damage times rate; range is in cells (a cell is one tower's footprint).`,
      '',
      table(['Tower', 'id', 'Cost', 'Range', 'Rate', 'Damage', 'DPS', 'Shape / production'], towerRows()),
      '',
      ...towers.flatMap((t) => [`#### ${t.name ?? t.id} - the tree`, '', table(['Tier', 'Choice', 'Cost', 'What it does', 'Data'], tierRows(t)), '']),
    ].join('\n'),
  enemies: () =>
    [
      `${enemies.length} enemies in \`packages/content/assets/enemies/roster.json\`. Speed is cells per second; breach is the Core health lost when one arrives; "from wave" is the first wave that may roll it. Every enemy walks the road; there are no flyers (PRD §8).`,
      '',
      table(['Enemy', 'id', 'HP', 'Speed', 'Breach', 'Bounty', 'From wave', 'Armour', 'Shield', 'Traits'], enemyRows()),
      '',
      '**Traits are rules** (`packages/engine/src/sim/traits.ts`):',
      '',
      table(['Trait', 'Rule'], Object.entries(TRAITS)),
    ].join('\n'),
  relics: () =>
    [
      `${relics.length} relics in \`packages/content/assets/relics/pool.json\`. Passives work while held; actives are clicked in the strip and recharge; consumables are one use. "Stacks" means a second copy adds (a second charge for actives).`,
      '',
      table(['Relic', 'id', 'Kind', 'Stacks', 'Recharge', 'What it does', 'Data'], relicRows()),
    ].join('\n'),
};

const TEMPLATE = `# Catalogue - what is in the game

> **Daniil's reading table** (session 25, 2026-09-05). The sections marked
> *generated* are rendered from content by \`node tools/codex.mjs\` and CI
> refuses a stale copy; edit the JSON, not the table. The **PROPOSED**
> tables at the end are yours: add a row with a name and what it does, and
> it is a request - when it ships, it appears above by itself.

## Towers *(generated)*

<!-- generated:towers -->
<!-- /generated -->

## Enemies *(generated)*

<!-- generated:enemies -->
<!-- /generated -->

## Relics *(generated)*

<!-- generated:relics -->
<!-- /generated -->

## PROPOSED - the request queue *(hand-edited, never touched by the generator)*

One row per thing. "What it does" in a sentence; the numbers can come later.
Status is yours to keep or ignore.

### Towers

| Name | Role / shape | What it does | Status |
|---|---|---|---|
| Laser | line, faces a direction (WBS 2.34) | a beam down a straight run of road, damage ramps while it holds one target | proposed (PRD §5.3) |
| Area tower | short-range area | hits everything in a small ring around itself, no projectile | proposed (PRD §5.3) |
| Support tower | aura | improves the towers around it | proposed (PRD §5.3) |
| Acid Sprayer | DoT, armour shred | Corrosion / Volatility / Saturation | PRD §5.3 (M4) |
| Bastion | buff aura | Command / Logistics / Fortify | PRD §5.3 (M4) |
| Rail Lance | long-range line pierce | Focus / Penetration / Overwatch | PRD §5.3 (M4) |

### Enemies

| Name | What it does | Counter | Status |
|---|---|---|---|
| *(add rows)* | | | |

### Relics

| Name | Kind | What it does | Status |
|---|---|---|---|
| Foundry | consumable | a Refinery off the vein produces Scrap | PRD §7.4, not in the pool |
`;

function render(doc) {
  return doc.replace(/<!-- generated:([a-z]+) -->[\s\S]*?<!-- \/generated -->/g, (m, name) => {
    const body = SECTIONS[name];
    if (!body) throw new Error(`no generator for section '${name}'`);
    return `<!-- generated:${name} -->\n${body()}\n<!-- /generated -->`;
  });
}

let current;
try {
  current = readFileSync(DOC, 'utf8');
} catch {
  current = TEMPLATE;
}
const next = render(current);
if (process.argv.includes('--check')) {
  if (next !== current) {
    console.error('docs/CATALOGUE.md is stale: run `node tools/codex.mjs`');
    process.exit(1);
  }
  console.log('docs/CATALOGUE.md is current');
} else {
  writeFileSync(DOC, next);
  console.log(`wrote docs/CATALOGUE.md (${towers.length} towers, ${enemies.length} enemies, ${relics.length} relics)`);
}
