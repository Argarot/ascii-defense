#!/usr/bin/env node
/**
 * The catalogue (session 25, Daniil: "a table of all relics and what they
 * do, all enemies and their abilities, so I can see what we have without
 * playing"):
 *
 *   node tools/codex.mjs          rewrite the generated sections of docs/CATALOGUE.md
 *                                 AND packages/app/src/generated/codex.ts (the shell's how-to pages)
 *   node tools/codex.mjs --check  exit 1 if either is stale (CI)
 *
 * Everything between a `<!-- generated:NAME -->` / `<!-- /generated -->`
 * pair is rendered from content (towers, enemies, relics, the trait rules);
 * everything outside the pairs is his - the PROPOSED tables in particular
 * are the request queue: a row there is a thing to build, and when it
 * ships it appears above by itself. The generator never touches text
 * outside the markers.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const ASSETS = join(ROOT, 'packages', 'content', 'assets');
const DOC = join(ROOT, 'docs', 'CATALOGUE.md');
const TS = join(ROOT, 'packages', 'app', 'src', 'generated', 'codex.ts');
const TICK_HZ = 20;

const read = (p) => JSON.parse(readFileSync(join(ASSETS, p), 'utf8'));
const towers = read('towers/roster.json').towers;
const enemies = read('enemies/roster.json').enemies;
const relics = read('relics/pool.json').relics;
const sets = read('sets/pool.json').sets;
const recipes = read('recipes/pool.json').recipes;
const lootTables = read('loot/tables.json').tables;
const relicName = (id) => relics.find((r) => r.id === id)?.name ?? id;

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
  if (t.attack === 'none' && t.aura) return `aura: a plus, ${t.aura.reach} each way, hit x${n(t.aura.damageMul, 2)}`;
  if (t.attack === 'none') return 'producer (no attack)';
  if (t.attack === 'pulse') return 'pulse: hits everything in range at once';
  if (t.attack === 'beam') return `beam: down its facing to where the road turns, however far, every body on it, heat to x${n(t.beam?.rampMax ?? 1)} on a held target (R rotates)`;
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
    return [`**${t.name ?? t.id}**`, t.id, t.cost, t.damageType ?? '', t.attack === 'beam' ? 'the road' : n(t.range), rate, dmg || '', dps, prod || towerShape(t), t.desc ?? '', (t.coreBoon?.text ?? '').replace(/^Next to the Core: /, '')];
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
  const mul = (v) => (v === undefined || v === 1 ? '' : v === 0 ? 'immune' : `x${v}`);
  return enemies.map((e) => [
    `**${e.name ?? e.id}**`, e.id, e.hp, n(e.speed * TICK_HZ, 2), e.damage, e.bounty, e.minWave ?? 1, e.armor ?? '', e.shield ?? '',
    mul(e.resist?.kinetic), mul(e.resist?.energy), (e.traits ?? []).join(', '),
  ]);
}
const fx = (e) => Object.entries(e ?? {}).map(([k, v]) => `${k} ${v}`).join(', ');
function relicRows() {
  return relics.map((r) => [
    `**${r.name}**`, r.id, r.fusionOnly ? `${r.kind} (fusion only)` : r.kind, r.rarity, (r.tags ?? []).join(' '), r.stackable ? 'yes' : '', r.cooldownTicks ? `${n(r.cooldownTicks / TICK_HZ)} s` : '', r.desc ?? '',
    fx(r.effects),
    r.tiers?.rare ? `${r.tiers.rare.desc ?? ''} [${fx(r.tiers.rare.effects)}]` : 'same',
    r.tiers?.epic ? `${r.tiers.epic.desc ?? ''} [${fx(r.tiers.epic.effects)}]` : 'same',
  ]);
}

const SECTIONS = {
  towers: () =>
    [
      `${towers.length} towers in \`packages/content/assets/towers/roster.json\`. Rate is shots per second; DPS is base damage times rate; range is in cells (a cell is one tower's footprint); a beam's range is the road in front of it, to its turn.`,
      '',
      table(['Tower', 'id', 'Cost', 'Type', 'Range', 'Rate', 'Damage', 'DPS', 'Shape / production', 'What it is', 'Next to the Core'], towerRows()),
      '',
      'The two ground cells touching the Core face (and the border cells beside it) are the precious ground of PRD §4.5: a tower there gets the gift in the last column, folded like a tier.',
      '',
      ...towers.flatMap((t) => [`#### ${t.name ?? t.id} - the tree`, '', table(['Tier', 'Choice', 'Cost', 'What it does', 'Data'], tierRows(t)), '']),
    ].join('\n'),
  enemies: () =>
    [
      `${enemies.length} enemies in \`packages/content/assets/enemies/roster.json\`. Speed is cells per second; breach is the Core health lost when one arrives; "from wave" is the first wave that may roll it. Every enemy walks the road; there are no flyers (PRD §8).`,
      '',
      table(['Enemy', 'id', 'HP', 'Speed', 'Breach', 'Bounty', 'From wave', 'Armour', 'Shield', 'vs kinetic', 'vs energy', 'Traits'], enemyRows()),
    '',
    'Damage types decide fights (PRD §8): a tower hits with its type, an enemy multiplies the hit by its entry - x0.5 resists, x1.5 weak, immune takes nothing. Kinetic: Bolt, Mortar, Missiles. Energy: Frost, Tesla.',
      '',
      'Statuses show on the body (PRD §8) as the ground under the walker: cold when slowed, ember when burning, ice when frozen, ember over cold when both hold; brackets for a live shield. Slows from different sources stack by one rule: the coldest multiplier wins, the longest duration lasts.',
    '',
    '**Traits are rules** (`packages/engine/src/sim/traits.ts`):',
      '',
      table(['Trait', 'Rule'], Object.entries(TRAITS)),
    ].join('\n'),
  relics: () =>
    [
      `${relics.length} relics in \`packages/content/assets/relics/pool.json\`. Passives work while held (some are tower mods on every tower - the former passive layer, one pool since 2026-09-06 evening); actives are clicked in the strip and recharge; consumables are one use. "Stacks" means a second copy adds (a second charge for actives).`,
      '',
      table(['Relic', 'id', 'Kind', 'Base rarity', 'Tags', 'Stacks', 'Recharge', 'What it does (common)', 'Data', 'Rare', 'Epic'], relicRows()),
      '',
      'Rarity with teeth (PRD §7.6; session 28, PR 2): every draw rolls a rarity by wave - common 60 minus the wave (floor 30), rare 30, epic 10 plus half the wave - never below the relic\'s base rarity. A rare or epic copy has the numbers in its column; "same" means the rule does not scale (a boolean).',
    ].join('\n'),
  loot: () =>
    [
      `${lootTables.length} loot tables in \`packages/content/assets/loot/tables.json\` (PRD §7.7). Every reward that is not a bounty or a wave's clock comes from one of these: a prospected rock's cache rolls \`rock_cache\`, a boss drops \`boss_drop\` where it dies, a void chest (PRD §4.9; session 28, PR 5) pays \`void_chest\`. A table is a weighted list rolled on the loot stream at claim time, so it rides the input log. "boon" turns the cell into boon ground (ground cells only; elsewhere it pays Scrap); "consumable" and "relic" draw from the unheld pool at a rolled rarity.`,
      '',
      ...lootTables.flatMap((t) => {
        const total = t.outcomes.reduce((a, o) => a + o.weight, 0);
        return [`#### ${t.id}`, '', table(['Outcome', 'Chance', 'Amount'], t.outcomes.map((o) => [o.kind, `${Math.round((o.weight / total) * 100)}%`, o.min !== undefined ? `${o.min}-${o.max}` : o.tier !== undefined ? `tier ${o.tier}` : ''])), ''];
      }),
    ].join('\n'),
  recipes: () =>
    [
      `${recipes.length} duo recipes in \`packages/content/assets/recipes/pool.json\` (session 28, PR 3; PRD §7.6 fusion). Two held relics, in either order, combine into the result at the higher of their rarities; the result is a relic marked "fusion only" above and never appears in an offer. Two of a KIND at the same rarity combine into the next rarity without a recipe. A held relic salvages for Ore: 10 common, 20 rare, 35 epic.`,
      '',
      table(['Recipe', 'A', 'B', 'Result', 'What it does'], recipes.map((x) => [`**${relicName(x.result)}**`, relicName(x.a), relicName(x.b), x.result, x.desc])),
    ].join('\n'),
  sets: () =>
    [
      `${sets.length} set effects in \`packages/content/assets/sets/pool.json\` (session 28, PR 2). Held relics count per tag; at two and at three of a tag the set lights and folds into every tower like a passive (econ knobs into the run). The strip's PASSIVES line names the lit sets.`,
      '',
      table(['Set', 'Tag', 'At', 'What it does', 'Mods', 'Econ'], sets.map((s) => [`**${s.name}**`, s.tag, s.at, s.desc, fx(s.mods), fx(s.econ)])),
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

## Sets *(generated)*

<!-- generated:sets -->
<!-- /generated -->

## Recipes *(generated)*

<!-- generated:recipes -->
<!-- /generated -->

## Loot *(generated)*

<!-- generated:loot -->
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
| *(add rows)* | | | |
`;

function render(doc) {
  return doc.replace(/<!-- generated:([a-z]+) -->[\s\S]*?<!-- \/generated -->/g, (m, name) => {
    const body = SECTIONS[name];
    if (!body) throw new Error(`no generator for section '${name}'`);
    return `<!-- generated:${name} -->\n${body()}\n<!-- /generated -->`;
  });
}

/**
 * The shell's twin (session 27): the same facts as compact data the how-to
 * pages render - one source, two consumers, so the page and the doc cannot
 * drift. Plain JSON in a TypeScript module; the app imports it.
 */
function codexTs() {
  const mul = (v) => (v === undefined || v === 1 ? '' : v === 0 ? 'immune' : `x${v}`);
  const data = {
    towers: towers.map((t) => ({
      id: t.id,
      name: t.name ?? t.id,
      type: t.damageType ?? '',
      cost: t.cost,
      range: t.attack === 'beam' ? 'the road, to its turn' : t.range,
      rate: t.attack === 'none' ? '' : n(TICK_HZ / t.fireEveryTicks, 2),
      dmg: t.projectile?.damage ?? 0,
      dps: t.attack === 'none' ? '' : n(((t.projectile?.damage ?? 0) * TICK_HZ) / t.fireEveryTicks, 1),
      shape: t.production ? `${t.production.ore} Ore / ${n(t.production.everyTicks / TICK_HZ)} s` : towerShape(t),
      desc: t.desc ?? '',
      coreBoon: (t.coreBoon?.text ?? '').replace(/^Next to the Core: /, ''),
      tiers: t.tiers.map((tier) => tier.choices.map((c) => ({ name: c.name, cost: c.cost, desc: c.desc ?? '' }))),
    })),
    enemies: enemies.map((e) => ({
      id: e.id,
      name: e.name ?? e.id,
      hp: e.hp,
      speed: n(e.speed * TICK_HZ, 2),
      breach: e.damage,
      bounty: e.bounty ?? 0,
      fromWave: e.minWave ?? 1,
      armour: e.armor ?? 0,
      shield: e.shield ?? 0,
      kinetic: mul(e.resist?.kinetic),
      energy: mul(e.resist?.energy),
      traits: (e.traits ?? []).map((t) => `${t}: ${TRAITS[t] ?? ''}`),
    })),
    relics: relics.map((r) => ({
      id: r.id,
      name: r.name,
      kind: r.kind,
      rarity: r.rarity,
      tags: r.tags ?? [],
      stacks: r.stackable === true,
      recharge: r.cooldownTicks ? `${n(r.cooldownTicks / TICK_HZ)} s` : '',
      desc: r.desc ?? '',
      rare: r.tiers?.rare?.desc ?? '',
      epic: r.tiers?.epic?.desc ?? '',
    })),
    sets: sets.map((s) => ({ name: s.name, tag: s.tag, at: s.at, desc: s.desc })),
    recipes: recipes.map((x) => ({ a: x.a, b: x.b, result: x.result, aName: relicName(x.a), bName: relicName(x.b), resultName: relicName(x.result), desc: x.desc })),
    loot: lootTables.map((t) => { const total = t.outcomes.reduce((a, o) => a + o.weight, 0); return { id: t.id, outcomes: t.outcomes.map((o) => ({ kind: o.kind, pct: Math.round((o.weight / total) * 100), min: o.min ?? null, max: o.max ?? null })) }; }),
    rules: [
      'Damage types decide fights: a tower hits with its type, an enemy multiplies the hit by its entry - x0.6 resists, x1.4-1.6 weak, immune takes nothing.',
      'Kinetic: Bolt, Mortar, Missiles. Energy: Frost, Tesla, Laser.',
      'Slows from different sources stack by one rule: the coldest wins, the longest lasts. The ground under a walker says its status: cold slowed, ember burning, ice frozen, ember over cold for both; ( ) a live shield.',
      'The two ground cells touching the Core face are precious: every tower has a unique gift there, printed on its card.',
    ],
  };
  return `// AUTO-GENERATED by tools/codex.mjs from the content rosters - do not edit.
// The how-to pages read this; docs/CATALOGUE.md is the same facts for people.
export const CODEX = ${JSON.stringify(data, null, 2)} as const;
`;
}

let current;
try {
  current = readFileSync(DOC, 'utf8');
} catch {
  current = TEMPLATE;
}
const next = render(current);
const nextTs = codexTs();
let currentTs = '';
try {
  currentTs = readFileSync(TS, 'utf8');
} catch {
  currentTs = '';
}
if (process.argv.includes('--check')) {
  if (next !== current) {
    console.error('docs/CATALOGUE.md is stale: run `node tools/codex.mjs`');
    process.exit(1);
  }
  if (nextTs !== currentTs) {
    console.error('packages/app/src/generated/codex.ts is stale: run `node tools/codex.mjs`');
    process.exit(1);
  }
  console.log('docs/CATALOGUE.md and the codex twin are current');
} else {
  writeFileSync(DOC, next);
  mkdirSync(join(ROOT, 'packages', 'app', 'src', 'generated'), { recursive: true });
  writeFileSync(TS, nextTs);
  console.log(`wrote docs/CATALOGUE.md and packages/app/src/generated/codex.ts (${towers.length} towers, ${enemies.length} enemies, ${relics.length} relics)`);
}
