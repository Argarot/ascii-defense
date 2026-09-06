# Handover — state as of 2026-09-06, late evening (the feedback round on Relics II shipped six PRs; the next theme is the meta tree, after Daniil describes it)

> **Updated once per working day** (Daniil). State and seams only; sequencing
> lives in the roadmap ledger, the checklist in the WBS, requests in the WBS
> request index. Anything restated here is a drift surface.

**Read order for a fresh context:** [CONTRIBUTING.md](CONTRIBUTING.md) →
[docs/PRD.md](docs/PRD.md) (§7.8 passives ARE relics; §11 meta progression —
the next theme; §4.9 the water finding) → [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
→ [docs/ASSETS.md](docs/ASSETS.md) → [docs/ART-AGENT.md](docs/ART-AGENT.md) →
[docs/CATALOGUE.md](docs/CATALOGUE.md) (52 relics, 18 sets, 5 recipes, 3 loot
tables) → [docs/lab/](docs/lab/) (the prices sweep last) → [docs/WBS.md](docs/WBS.md)
→ this file → the roadmap ledger's next open row. The gitignored
`POSTMORTEM.md` holds collaboration findings — **read its last two sections
before writing any code today.** End every working day with the
`wrap-session` skill.

Live: <https://argarot.github.io/ascii-defense/> (verify cache-busted, always).
**Since tonight there is no PASSIVES row, the relic offer comes every second
wave, the strip's Core card has a FORGE button, SETTINGS has SPRITE PACK,
and the HUD column reaches the strip's bottom** — a build without those is older.

## Where the project is

**2026-09-06, late evening — Daniil's feedback on the Relics II build
(#159–#163), in his order:**

1. **Passives are relics (#161).** The separate layer of session 28 PR 1
   was folded back the same day: eleven tower-mod relics (`effects.mods`,
   `waveScrap`, `bountyMul`) with tiers, one pool of 52, twelve slots, the
   relic offer every second wave (OFFER_EVERY_WAVES 2). The golden is back
   at 3921408197.
2. **The relic card follows the eye (#159)**: a board click or Escape closes it.
3. **The HUD column runs the whole left column** (board plus strip; #159).
4. **The Forge (#163)**: combining in its own window — held relics as icon
   plates, two slots, the result plate, one COMBINE button.
5. **Prices (#160)**: Laser 110 (90/180/320), Tesla 70, Missile 85, tiers at
   1.5×. The Laser line reads 21.5 (was 27.0); still the strongest by five.
6. **Copy the run code and the seed** from the pause page and the summary (#159).
7. **The reworked sprite pack (#163)**: SETTINGS → SPRITE PACK → REWORKED
   loads `packages/content/assets-reworked` at boot — 61 valid sprites, its
   510 palette roles, its ground/rock/ore terrain through the art agent's
   own renderer (adopted). Daniil renames the folders when he is satisfied;
   the globs tolerate either name being empty.

**Not built:** passive sprites are moot (they are relic icons now); full
keyboard operation; the Tile Smith as a page.

**Readings for Daniil, his calls:** the Laser at 21.5 (the pulse's damage is
the remaining knob); water or rock for the chests; the ramp; the strip's
text scale; Hailstorm.

**Gate:** his eye on the live build — one pool, the Forge as a window, the
reworked pack side by side with the shipped one.

## Fresh-context warnings (beyond CONTRIBUTING)

- **Two agents share this working tree.** The art agent is confined to
  `packages/content/assets-reworked` since tonight (its AGENTS.md says
  so); its earlier files in `packages/view` were adopted in #163. Still:
  `git add` by explicit path, `git diff <file>` before adding, never
  `stash`/`checkout .`/`reset --hard`.
- **Stacked PRs do not merge on this squash-merge repo** (#162 reported a
  conflict; #163 carried the merge). One PR per branch off main.
- **The gate is the exit code**: vitest to a log and `$?`; `gh pr checks
  --watch` exit 0, no `pending` line, the same SHA.
- **The dev server must restart after a content file is deleted** (a stale
  worker kept importing the passive pool and the console kept its errors
  across reloads).
- **Relic effects at the HELD rarity** (`heldEffects`, `relicEffectsAt`);
  the five held arrays only through `pushHeld`/`spliceHeld`; a rule that
  fires calls `noteRelicUse`. Relic `mods` fold through `refoldMods` with
  the lit sets.
- **The relic pool's size is a map knob** (boon cells): growing it moves
  every board; compare sweeps within a file.
- **A PRD section older than the last generator change** may describe a
  board that no longer exists (§4.9 did).
- **`__ad`** has hooks for everything tonight added: `forge`, `forgePick`,
  `forgeCombine`, `forgeState`, `spriteSet`, plus the relic, chest and
  frame hooks of the day.

## Next session, proposed — 29 (ledger row 29): The meta tree

*(Daniil, 2026-09-06 evening: "it's time to start working on the meta
upgrade tree. Before you build it though, let's discuss how I see it."
The plan below is the PRD's shape, offered as the starting point for that
discussion — not a "go" plan yet. His description comes first; the PR
list is written after it.)*

**Theme.** What a run leaves behind. Today banked Ore accumulates and buys
nothing ("banked ore will buy the workshop tree between runs (not built
yet)"); the tech tree turns it into the reason to play again.

**Daniil's answers (2026-09-06 late)**: a tree with branches; only Ore, in
tiers; about five runs to the towers, many more to everything; unlocks
in the run code; the Tile Smith after every tile is bought. On permanent
stat power the reply argued for capacity and access instead (PRD §19
carries the thought dump this came with). **The list:**

0. **The fix bundle** (WBS 9.7–9.12, 9.18, 9.24): Loadbearing ×1.5; the
   Bastion's reach takes no modifier but its own and previews as a plus
   (four or eight — his call); the build preview folds every modifier;
   the Frost pulse muted with radius; chests on water and ground; the
   offer only when the board is quiet; pierce within half a cell.

**The PRD's shape (§11, §7.5, §11.1), as the plan:**

1. **The workshop page** in the shell: banked Ore, the tree, run history
   (WBS 7.3). Stage 1 nodes (~5): a starting relic, a tower unlock or
   variant, Threat Level 2, +1 terrain tile unlock, +relic pool unlocks.
2. **The relic pool as the sink**: relics stay run-local; the tree decides
   which may appear (§7.5) — the layer that grows with content forever.
3. **The tile pool as the Ore economy** (§11.1): special tiles bought,
   owned as copies, loadout slots as an upgrade with locked slots shown.
4. **Meta identity in the sim**: `metaPowerIndex` and the unlocked sets
   ride the run code and the replay (§12); the lab sweeps at tree states
   (row 34's job, made possible now).
5. **The Tile Smith folded into the shell** — Daniil's next theme after
   this one; the workshop page is where it will open from (§11.1).
6. **The codex** (9.15): every entry, locked ones locked, from every
   menu and from pause, reading the unlock set; fusions discovered (9.23).
7. **Legendary, forging unlocks tiers, wins grant relics, endless as a
   node** (9.1, 9.2, 9.3, 9.22); one Refinery for every ore tier (9.4).

**Gate — his judgement:** finishing a run visibly changes the next one.

**His part:** the description he promised; then the node list and prices.

**Biggest risk:** the tree multiplies player power under the curves the lab
measures; every node is a `metaPowerIndex` lane and the sweeps re-baseline
per tree state (PRD §11 stage 3's warning). **Expensive if wrong:** the
save shape (what persists, versioned) and the run code (what identifies a
run) — both are migrations once players hold saves.

## Standing open items

- Daniil's playtest of tonight's build; his description of the meta tree.
- The Laser at 21.5, water or rock for the chests, the ramp, the strip's
  text scale, Hailstorm — his calls.
- Rename `assets-reworked` → `assets` when the pack satisfies him.
- Retire Loadbearing beside the Core gifts — his call.
- Repo settings: the homepage is empty and the token cannot set it.
- D25 multi-cell towers, D27 monetization — open.
- 2.27 gate — his.
- Technical-debt register: the Tile Smith as a page; 4.24's keyboard half;
  terminals once per session; 2× tile previews; the lab's analytic model;
  the offer modal without icons; relic offers weighted by applicability.
