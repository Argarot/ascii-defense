# Handover — state as of 2026-09-07 (session 29 shipped the meta tree in eight PRs; the next theme is the Tile Smith in the shell and the menus)

> **Updated once per working day** (Daniil). State and seams only; sequencing
> lives in the roadmap ledger, the checklist in the WBS, requests in the WBS
> request index. Anything restated here is a drift surface.

**Read order for a fresh context:** [CONTRIBUTING.md](CONTRIBUTING.md) →
[docs/PRD.md](docs/PRD.md) (§11 "Built" — the tree; §7.6 legendary; §4.5 the
Bastion's plus; §4.9 chests on ground; §19 the thought dump's status table)
→ [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) → [docs/ASSETS.md](docs/ASSETS.md)
→ [docs/ART-AGENT.md](docs/ART-AGENT.md) → [docs/CATALOGUE.md](docs/CATALOGUE.md)
(52 relics with a Legendary column, 18 sets, 5 recipes, 3 loot tables) →
[docs/lab/](docs/lab/) (the tree sweep last) → [docs/WBS.md](docs/WBS.md)
(§7.9 the tree's checklist; §9 the thought dump) → this file → the roadmap
ledger's next open row. The gitignored `POSTMORTEM.md` holds collaboration
findings — **read its last two sections before writing any code today.**
End every working day with the `wrap-session` skill.

Live: <https://argarot.github.io/ascii-defense/> (verify cache-busted, always).
**Since session 29 the title page has WORKSHOP, a fresh save's strip offers
four towers, the Core's strip shows locked slots as dim crosses, and the
codex marks locked entries** — a build without those is older.

## Where the project is

**2026-09-06 night into 2026-09-07 — session 29, the meta tree (PRs
#167–#173, all merged green):**

0. **The fix bundle (#167)** — Daniil's thought dump items 7–12, 18, 24:
   Loadbearing ×1.5; the Bastion's reach is a **plus** (four cells at base,
   eight with Reach; shipped as four, his "a plus" taken literally — eight
   is one constant), its range IS its reach; the build preview folds every
   modifier at the selected cell (`previewStats`); the pulse muted and
   fading with radius; chests on water and empty ground, never rock, and a
   chest holds its cell; the relic offer only at a quiet board; pierce
   within half a cell.
1. **The tree as content and identity (#168)** — `tree/nodes.json`: a base
   grant (Bolt, Mortar, Frost, Refinery; the sixteen original relics; six
   slots; Calm and Standard; one tile slot) and 24 nodes in five branches.
   `resolveUnlocks` is the one object the shell, the worker and the lab
   read. Meta save **v4** (Ore by tier, unlocks, earned, forged, owned,
   discovered); run save **v5** (the run's meta identity; a v4 save
   migrates with the everything sentinel); the run code's fifth segment.
   **Tiers unlock by forging** (relicCaps); **wins earn relics** (a rare at
   Standard, an epic at Grim, from open branches).
2. **The workshop (#169)** — the branches as pages, a node a row with its
   price or its reason, RUN HISTORY; the setup page shows locked Threats
   locked, the loadout's slots are the tree's, ENDLESS once bought.
3. **Ore by tier (#170)** — three purses, hashed (golden 3921408197 →
   4031597317, reason on the constant); a Refinery on a tiered vein pays that
   tier at a stretched cycle (×1.5, ×2); `rich_vein` and `mother_lode`.
4. **The tile shop and the Smith's door (#171)** — every shipped special
   priced; bought once; the loadout offers minted and OWNED tiles; the Tile
   Smith link appears only once every tile the workshop sells is owned.
5. **The lab at tree states (#172)** — `LabSpec.unlocks`, a producer at
   'vein', the purse in the report; BASE 13.5 / MID 11.3 / EVERYTHING 26.3;
   **a base run banks ~22 tier-1 Ore**, which priced the nodes (the arsenal
   105: about five base runs).
6. **The codex and legendary (#173)** — locked towers name their node,
   locked relics their branch or the win that earns them; a fused relic is
   "???" until fused once; legendary as a fourth lane reached only by
   forging two epics of a relic with a legendary tier (six today); Daniil's
   four rarity colours in the palette.

**Not built:** copies of a tile as a multiset (the generator places a chosen
id once); personal bests; the Tile Smith as a page of the shell; the menus
rework; the tree sweep with a loadout (no tier-2/3 Ore has been read yet).

**Readings for Daniil, his calls:** four or eight cells for the Bastion
(four shipped); the node prices after his first five runs (content, one
file); the relic-unlock split (tree = branches and capacity, wins = the
rarer relics, chests = §18's door) — built as written, his confirmation
still open; the Laser at 21.5; the ramp; Hailstorm.

**Gate:** his eye on the live build — a fresh save's first run, the
workshop after it, the codex's locked entries.

## Fresh-context warnings (beyond CONTRIBUTING)

- **Two agents share this working tree.** The art agent is confined to
  `packages/content/assets-reworked` (its AGENTS.md says so). Still: `git
  add` by explicit path, `git diff <file>` before adding, never `stash`/
  `checkout .`/`reset --hard`.
- **After a merge, never `gh pr merge --delete-branch`.** It checks local
  main out over locked files and leaves a mixed tree (old unlocked files,
  new locked ones) — twice in session 29. The recipe: merge without the
  flag, `git fetch`, `git reset -q origin/main` on the current branch, `git
  checkout -q -b <next>`, delete the remote branch by name.
- **A new export from a workspace package needs the dev server restarted**
  (Vite served a stale engine module across four reloads). A content JSON
  edit reloads the page under a running probe.
- **The gate is the exit code**: vitest to a log and `$?`; `gh pr checks
  --watch` exit 0, no `pending` line, the same SHA.
- **A run's world is the tree's.** The worker filters `towerDefs` and
  `relicDefs` by `resolveUnlocks`; `defIdx` is per run; `contentHash` and
  `relicPoolSize` stay over the FULL content. Tests and the lab without a
  `meta`/`unlocks` get everything.
- **Relic effects at the HELD rarity** (`heldEffects`, `relicEffectsAt` —
  legendary first); the five held arrays only through `pushHeld`/
  `spliceHeld`; a same-kind combine records `forgedThisRun`, a recipe
  `fusedThisRun`; the summary merges both into the meta save.
- **The wave scales hp** (`waveHpScale`) and a non-explosive shot damages
  every body inside `HIT_RADIUS`: a test that counts hits must measure
  damage against the spawned hp.
- **`__ad`** gained `pool`, `meta`, `buy`, `buyTile`, `unlocked`, `bank`,
  `smith`, `killAll`, `stripText`.

## Next session, proposed — 30 (ledger row 30): The Tile Smith in the shell, and the menus

**Theme.** Every essential piece is in the game now; what a new player
meets is a product with a workshop, a codex and a door to the Tile Smith —
and the door opens onto a separate page with a different face, from menus
that are plates of text. Session 30 makes the shell one thing: the Smith
inside it, and every page drawn to the standard Daniil named
(Stone-Story quality, item 30).

**PR list (a full day):**

1. **The menu language** — `MenuSpec` grows what the pages need (columns,
   a framed plate with ornament, an animated title, a hero row on every
   page, a footer with keys) and `MenuScreen` draws it; the title, setup,
   settings, summary and pause pages move onto it. Proof: a screenshot of
   each page beside its old one; `__ad.modalText()` unchanged in content.
2. **The workshop drawn as a tree** — branches as columns with lines from a
   node to what it requires, nodes as plates that read BOUGHT / BUY / the
   reason; the TILES page with the previews framed by rarity of vein. Proof:
   the pane, a node bought by click on the drawn plate.
3. **The Tile Smith as a page** — the editor (brushes, features, validity
   as it types) on the fullscreen terminal, opened from the workshop's
   TILES page once the door is open; MINT prices the tile by its features
   (the one pricing function the shop uses: road cells, a vein's tier, a
   boon's tier) and adds it to the owned pool. `tilesmith.html` stays as
   the authoring tool for the art agent and the docs. Proof: mint a tile in
   the shell, load it, see it on the map.
4. **The relic surfaces in the new language** — the offer, the Forge and
   the relic card as framed plates with the rarity ring (9.14 at 6×5), a
   plate shape per kind (9.19), the chest as a sprite kind coloured by
   rarity (9.13). Proof: the pane.
5. **Per-tower blasts and beam colours** (9.25, 9.27) — the Mortar's and the
   Missile's looks apart; a Laser path tints the beam. Proof: the effects
   tests and the pane.
6. **The tree sweep with a loadout** — `rich_vein` loaded at MID, the tier-2
   Ore reading, and the tier-2/3 node prices adjusted if the reading says
   so. Proof: the doc.

**Gate — his judgement:** the shell reads as a product; the Smith is part
of the game.

**His part:** the art brief's additions (the relic ring, the chest kind,
the active plate) — defaults: placeholders from the generator until the
agent delivers; a look at the workshop's prices after five runs (default:
they stand). "Go" is enough.

**Biggest risk:** the menu rework touches every page and the `MenuSpec`
shape every page authors against — a wrong shape is a rewrite of six
pages. **Expensive if wrong:** the pricing function (shop and Smith share
it; a change later reprices what players own) and the Smith's output
format (minted tiles persist in players' browsers).

## Standing open items

- Daniil's playtest of session 29: a fresh save's first run, the workshop,
  the codex's locked entries.
- His calls: four or eight cells for the Bastion; the unlock split; the
  node prices after five runs; the Laser at 21.5; the ramp; Hailstorm.
- Repo settings: the homepage is empty and the token cannot set it.
- D25 multi-cell towers, D27 monetization, D28 where the meta lives — open.
- 2.27 gate — his.
- Technical-debt register: the multiset of tile copies (the generator
  places a chosen id once); personal bests; 4.24's keyboard half;
  terminals once per session; 2× tile previews; the lab's analytic model;
  relic offers weighted by applicability.
