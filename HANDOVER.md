# Handover — state as of 2026-09-07, evening (session 30 shipped the shell's one face and the Tile Smith inside the game; Enemies II is next)

> **Updated once per working day** (Daniil). State and seams only; sequencing
> lives in the roadmap ledger, the checklist in the WBS, requests in the WBS
> request index. Anything restated here is a drift surface.

**Read order for a fresh context:** [CONTRIBUTING.md](CONTRIBUTING.md) →
[docs/PRD.md](docs/PRD.md) (§11 "Built" — the tree and the Smith; §7.6 the
rarity ring and legendary; §4.9 chests by rarity; §19 the thought dump's
status table) → [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) →
[docs/ASSETS.md](docs/ASSETS.md) (§3 the sprite kinds, `chest` included) →
[docs/ART-AGENT.md](docs/ART-AGENT.md) → [docs/CATALOGUE.md](docs/CATALOGUE.md)
→ [docs/lab/](docs/lab/) (the tree sweep, now with a loadout) →
[docs/WBS.md](docs/WBS.md) (§7.10 session 30's checklist; §9 the thought
dump) → this file → the roadmap ledger's next open row. The gitignored
`POSTMORTEM.md` holds collaboration findings — **read its last two sections
before writing any code today.** End every working day with the
`wrap-session` skill.

Live: <https://argarot.github.io/ascii-defense/> (verify cache-busted, always).
**Since session 30 every page is a framed plate with the title in a lit
band on its top edge, the workshop is drawn as columns of node plates, and
the strip's relic slots are ringed 6×5 plates** — a build without those is
older.

## Where the project is

**2026-09-07 — session 30 (PRs #175–#179, all merged green):**

1. **The menu language (#175)** — `MenuScreen` draws every page as a framed
   plate: a box-drawn frame with diamond corners (spleen has the single-line
   set, the diamond and braille; nothing double or block-shaped), the title
   in a band on the top edge lit by a glow travelling with the phase, a hero
   row, body lines, tile previews with a tone, COLUMNS that wrap into rows
   on a narrow screen, a LINK that hangs an item from the one above, diamond
   markers on a selected plate, a footer, key hints in the bottom band.
   `drawFrame` is exported for other screens. **The workshop is drawn as a
   tree** with it: a column per branch, a node hanging from the one it
   requires, bought nodes in gold; a first click reads the node into the
   body, a second buys it.
2. **The Tile Smith as a page (#176)** — `SmithScreen` behind the door on
   the workshop's TILES page (or `?dev`): the brush matrix, the tile at the
   board's own scale (click and drag to paint; OVERLAYS click veins at a
   tier the tree allows, or boons), the connectors, the verdict, the id,
   the price, MINT, BACK; Esc and Ctrl+Z. `priceTile` in the engine is the
   one function the Smith mints with (road cells, veins by Ore, boons by
   tier; the price's tier is one below the richest vein); shipped specials
   keep their authored price. MINT pays the purse and puts the tile in the
   minted pool and the owned list. `tilesmith.html` stays for library work.
3. **The relic plate (#177)** — `drawRelicPlate`: the 4×3 icon in a ring of
   the rarity's colour with corners by kind (plain passive, diamond active,
   cross consumable), 6×5; empty and locked slots say so. The strip's
   slots, the Forge's row and slots, the offer's cards (framed in the rarity
   colour with a band and the icon) use it. A fix found in the pane: the
   Forge's row drew locked slots as empty plates.
4. **Chests, blasts, beams (#178)** — a chest rolls a rarity at surface
   (hashed; ×1/×1.5/×2 on Scrap and Ore; a 4×3 box in the rarity's colour;
   a `chest` sprite kind in the schema); the impact event names its tower
   and a Missile's blast is a hard core with eight spokes; the beam event
   carries the lens's tier-1 path (Chill cold, Capacitor hot).
5. **The tree sweep with a loadout (#179)** — `LabSpec.loadout`; a MID run
   on a rich vein banks ~13 tier-2 Ore, an EVERYTHING run on a mother lode
   ~31 tier-3 (docs/lab/build-sweep-2026-09-06-tree.md).

**Not built:** full keyboard operation; the art agent's 6×5 relic sprites
and the chest sprite (the view draws its ring and box until then); the
plan's ornament beyond the font (double lines, blocks) is not drawable.

**Readings for Daniil, his calls:** the tier-2 purse at ~13 a run (ten
runs to the tier-2 nodes); the Smith's prices (`priceTile`) against the
shipped ones; four or eight cells for the Bastion; the unlock split; the
Laser at 21.5; the ramp; Hailstorm.

**Gate:** his eye on the live build — the title, the workshop as a tree,
the Smith page (`?dev` opens the door without owning every tile), the
strip's plates, an offer, the Forge.

## Fresh-context warnings (beyond CONTRIBUTING)

- **The local gate is five things, every time:** typecheck, lint, vitest
  to a log with `$?`, `node tools/doc-drift.mjs`, `node tools/codex.mjs
  --check`. Session 30 skipped the drift check twice and CI caught it (a
  new sprite kind must be named in ASSETS §3).
- **After a merge, never `gh pr merge --delete-branch`**; the recipe: merge
  without the flag, `git fetch`, `git reset -q origin/main` on the current
  branch, `git checkout -q -b <next>`, delete the remote branch by name.
- **`git add` with one nonexistent path stages nothing** — check `git
  status --short` before the commit; never guess a path into an add.
- **Restart the dev server after a new export or a new cross-module import
  in a workspace package** (the Forge served stale after `drawFrame`).
- **Never `location.reload()` inside a javascript_tool call** — the
  navigate tool first, then the probe.
- **Two agents share this working tree**: `git add` by explicit path, `git
  diff <file>` before adding, never `stash`/`checkout .`/`reset --hard`.
- **The font decides the language**: probe `glyphset-spleen.json` before
  drawing a glyph; spleen has `┌┐└┘─│├┤┬┴┼`, `◆`, braille - no double lines,
  no blocks.
- **`__ad`** gained `smithPage`, `smithDo`, `smithState`, `stripText`,
  `buy`, `buyTile`, `unlocked`, `bank`, `smith`, `killAll`; `surfaceChest`
  takes a rarity.

## Next session, proposed — 31 (ledger row 31): Enemies II

*(Deferred on 2026-09-06 as "bells and whistles while the game itself is
not finished". The game is finished in its pieces since session 30 — the
tree, the shell in one language, the Smith inside — so the enemy half of
content completeness is the next theme, and the one the towers' identity
has been waiting for: seven bodies fight eight towers today.)*

**Theme.** What walks in. Seven bodies across the trait matrix with traits
that make the towers' roles matter (a Laser that ramps wants a column to
hold; a Bastion wants a front to widen), waves composed in packs and
formations so wave 10 reads unlike wave 5, and the counters legible on the
body and in the strip.

**PR list (a full day):**

1. **Seven bodies** in the roster with placeholder sprites from the
   generator: splitter (dies into two), healer (mends neighbours), burrower
   (surfaces past the first towers), charger (a sprint when hurt),
   shieldbearer (a shield that faces the front), a runner, and a second
   boss with a rule. Traits as engine rules in `traits.ts`, each with a
   test; the codex entries generated. Proof: the sim tests, the catalogue.
2. **The wave composer's packs and formations** — a pack is a body and its
   escort; a formation is a spacing (a column, a wedge, a wall); waves
   compose from packs with the boss behind. Proof: the composition test
   and a look at wave 5 vs wave 10 in the pane.
3. **Counter legibility** — every trait shows on the body (a healer's
   glow, a shield facing) and in the strip's NOW/NEXT with the answer
   named; the codex says what counters what. Proof: the pane.
4. **The balance pass against a stated target** — the Laser at 21.5 and
   the ramp; the reference build lands between 16 and 24 with the new
   bodies; retune the matrix, not the bodies. Proof: the sweep doc.
5. **The enemy sweep** — every body against every tower line; the counter
   table in the doc. Proof: `docs/lab/enemy-sweep-<date>.md`.

**Gate — his judgement:** wave 10 looks different from wave 5 for what
walks in; every new body says what it does by standing there; no build
clears every wave alone.

**His part:** the seven bodies' names and looks if he has them (default:
the names above and generator placeholders in the study style); a target
for the ramp (default: the reference build dies between 16 and 24 on
Standard). "Go" is enough.

**Biggest risk:** the wave composer rework re-baselines every sweep in
docs/lab, and a trait that the towers cannot answer is a wall, not a
counter. **Expensive if wrong:** the trait rules (every enemy sprite,
sweep and codex entry hangs on them) and the composer's shape (the
replay hashes every queue).

## Standing open items

- Daniil's playtest of sessions 29–30: a fresh save, the workshop as a
  tree, the Smith, the plates, an offer, the Forge.
- His calls: the tier-2 purse; the Smith's prices; four or eight cells;
  the unlock split; the Laser at 21.5; the ramp; Hailstorm.
- The art brief's additions for the agent: 6×5 relic sprites with a ring,
  the chest kind, a plate shape per kind if drawn, the splash.
- Repo settings: the homepage is empty and the token cannot set it.
- D25 multi-cell towers, D27 monetization, D28 where the meta lives — open.
- 2.27 gate — his.
- Technical-debt register: the multiset of tile copies; personal bests;
  4.24's keyboard half; terminals once per session; 2× tile previews; the
  lab's analytic model; relic offers weighted by applicability.
