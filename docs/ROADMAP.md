# ASCII Defense — Roadmap

A "session" is one focused working stretch, roughly a few hours.

Read [PRD.md](PRD.md) first, then [ARCHITECTURE.md](ARCHITECTURE.md), then
[CONTRIBUTING.md](../CONTRIBUTING.md). This file assumes all three.

---

## M0 — Foundation ✅ COMPLETE

- WebGL2 glyph renderer, chosen on measurement (canvas 2D fails at 6,000 cells).
- Bitmap font pipeline: `.hex` and `.bdf` parsed to 1-bit atlases at build time.
- GitHub Actions → Pages, live and verified by loading the deployed page.
- Apache-2.0, PRD, architecture, assets, contributing.
- **Presentation decided by measurement, not argument**: spleen 5×8, 5×3-glyph
  cells, 5×5-cell tiles, tile-laying core loop, shading-based depth.

Live: <https://argarot.github.io/ascii-defense/>

---

## M1 — The fun test

One board. Lay tiles, build towers, survive waves. Everything needed to answer
"is this fun?" and nothing else.

Sequenced so the risky, foundational parts come first.

### Phase 1 — harness before game code *(2 sessions)*

Nothing game-shaped. This is what makes the next twenty sessions cheap, and
building it afterwards is how projects end up untested.

- Workspaces: `engine content render view bot harness app` + `tools`.
- ESLint with the custom rules enforcing invariants 1–3 in CONTRIBUTING.
- Vitest + **Browser Mode + Playwright** (the renderer cannot be tested in Node).
- **`ci.yml`** — typecheck, lint, unit, golden, snapshot, content validation.
- `pure-rand` replacing the biased hand-rolled PRNG in the mocks.
- Text-snapshot infrastructure built on `GLTerm.toText()`.
- Content pipeline: schemas, `json-schema-to-typescript`, `ajv`, content linter.

**Gate:** CI green on an empty game.

### Phase 2 — art pipeline proof *(0.5 session, needs Daniil)*

- `tools/build-rexpaint-font.mjs` — spleen atlas as a 16-column PNG.
- Install the font into REXPaint, author **one** tower and **one** terrain tile.
- `tools/rexpaint-import.mjs` — `.xp` → runtime JSON.
- Render the imported art in the browser.

**Gate:** a sprite drawn in REXPaint appears in the game unchanged. Prove the
round trip before authoring a library against it.

### Phase 3 — the board *(2–3 sessions)*

- Seeded RNG with named streams; fixed 20 Hz tick; pause / 1× / 2× / 4×.
- Three-level grid; **subcell entity coordinates**; occupancy array.
- Tile library, connector matching, legality. *(Tile-laying flow superseded by
  the 2026-08-15 pivot: a **map generator** assembles the board at run start —
  Core tile center, `entries` carved paths, ore by road distance.)*
- Dijkstra flow field over cells; `L` in cells. *(One field: flyers are cut.)*
- Terrain rendering with background painting and shading.

**Gate:** connectivity property test — seeded boards across edge-biased sizes
plus an adversarial unit battery. (Originally "10,000 generated boards";
rescoped once connectors became derived-by-construction — mass-generating a
space where invalid states are unrepresentable tests the RNG, not the logic.)

### Phase 4 — the game *(3–4 sessions)*

- 4 towers with complete 3-tier either/or trees (Wall is cut — PRD §5.3).
- 6 enemies across 2 damage types and 4 traits; targeting; projectiles.
- Waves, Scrap, Core health and enemy `damage`, win/lose; Refinery and Ore.
- **HUD** — build palette, tower inspector with tier legality, wave state,
  speed controls. *This is a first-class item, not a line: it is the entire
  surface the player touches, and it was previously under-scoped.*
- Replay record/playback; golden state-hash test.

*(The Core's own branch tree was cut here on 2026-08-16 — PRD §14 — and
replaced by Phase 6 below.)*

### Phase 6 — the power layer *(2 sessions)* — **runs before Phase 5**

*(Added 2026-08-16. Numbered 6 because WBS IDs are stable once assigned;
sequenced third-from-last because the fun test cannot be run without it.)*

This is the layer that makes the game a roguelite instead of a tower defense
with a seed: relics acquired mid-run that break rules rather than move numbers
(PRD §7). It is placed before the harness because the harness calibrates
against the game, and calibrating against a game missing its power layer would
produce curves we would immediately throw away.

- Engine **hook layer** — the seams relics modify, applied in a fixed
  deterministic order. Relic schema, codegen, validation.
- Acquisition **B** (wave-clear pick-1-of-3), then **C** (Ore draw/reroll at
  the Core), then **A** (map caches claimed by selection).
- ~20 relics as content across passive / active / consumable.
- The **Core as vessel**: HP, relic inventory, active firing, cooldowns.
- **Prospecting**: rock contents dealt at generation, revealed for Scrap;
  gated behind the Refinery's Survey path.

**Gate:** a run in which two relics combine into something absurd, reproduced
from its seed and input log.

### Phase 5 — smoke harness *(0.5–1 session)*

- Crude bot; `harness calibrate` and `harness check`; per-wave margin table.
- The bot's policy includes relic picks — they are part of run power (PRD §9).

### Phase 7 — post-playtest triage *(0.5 session)*

Bugs and one shape error from the first real run, fixed before calibration
because they corrupt the evidence calibration would gather: the preview fold bug,
the relic pool draining silently, and the difficulty curve growing linearly
against compounding player power.

**M1 exit gate: PASSED 2026-08-16.** Daniil played to wave 14 and beyond:
*"the game is fun now, it’s just very unbalanced and with quite a few holes
still."* The milestone existed to obtain that judgement, and it has it. Phases 2
(art round-trip), 5 (harness) and 7 (triage) remain as M1 work, but the question
of whether to keep building is settled.

---

> **Milestones are interleaved, and the session ledger is authoritative for
> order.** As of 2026-08-17 the shell (M4) is split across sessions 16, 18 and
> 22 while M2 finishes at session 21 — deliberately, because the shell is what
> makes the game handable and the effects engine is what stops sprites being
> authored twice. Read a milestone below for *what it contains and why*; read
> the ledger for *when*.

## M2 — A complete run

Reshaped 2026-08-16 by the first playtest. The headline is not "more content"
but **making the existing systems demand decisions**: an economy that runs dry,
a relic layer that can be spent rather than only filled, damage types that make
one tower the wrong answer, and a difficulty curve that ends every run in death.

**Gate:** a full run, start to victory or death, that demands decisions
throughout.

## M4 — The shell

The game stops being a simulation with a URL parameter and becomes something a
stranger can be handed: title, run setup, pause, run summary, settings,
persistence with versioning and export, onboarding, accessibility (PRD §15).
The effects engine (4.1) lives here too, because "what the player sees" is one
milestone even when it ships across three sessions.

Sequenced **before** calibration and the art pass, because it is what makes
external playtesting possible — and strangers are the only feedback source we
have not yet used. **Pulled further forward on 2026-08-17** (Daniil) to reach a
semi-stable alpha before any new content: a worker retrofitted under a dozen
live screens is surgery it is not under one HUD, and a save schema is cheap to
version before content churn and expensive after.

**Gate:** a stranger opens the link, plays a run, loses, reads why, starts
another; progress survives a reload.

## M5 — Content completeness

8 towers, ~14 enemies, ~40 relics, ~100 tiles, threat levels as data.

**Gate:** two runs do not resemble each other.

## M3 — Trustworthy difficulty

Two passes, deliberately: calibration I (session 25) fixes the curves once
content is complete; calibration II (session 28) re-baselines them after meta
progression, because tech-tree multipliers and pool unlocks move player power
underneath whatever calibration I measured *(Daniil, 2026-08-17)*.

Bot policy, calibration across a seed corpus, curves committed as reviewable
data, human offset from Daniil’s replays, `balance.yml` CI gate, trivial and
unwinnable seed detection.

Numbered 3 because milestone IDs are stable once assigned; **sequenced here**
because calibrating against content and a shell that are still moving produces
curves we would immediately throw away.

**Gate:** the harness catches an injected regression; no unwinnable or trivial
seed across ≥500 runs.

## M6 — Presentation at scale

Full art pass with per-upgrade tower identity, effects for every attack shape,
biomes. Sequenced after meta progression *(Daniil, 2026-08-17)*: visuals come
after **all** assets exist, and the meta layer adds tile pools, tree nodes and
their art surface. The round-trip **proof** (6.1) opens this block — the
pipeline's first real test, a stated and accepted risk until then.

**Gate:** the board reads as a place, not a diagram.

## M7 — Meta progression, full

Tech tree stage 2, pool unlocks, run history, dailies, replay sharing, Tile
Smith as an in-game feature.

**Gate:** finishing a run visibly changes the next one.

## M8 — Beta hardening and release

Performance and bundle budgets in CI, browser matrix, error-path audit, save
migration testing, **external playtest with strangers**, release process.

**Gate:** the stable-beta bar in PRD §17.

---

## ◆ Decision points

**After the alpha marker (~session 18):** the game is a product shell around a
working simulation. The check here is Daniil's own — does playing it with menus,
saves and readable numbers still hold up, before a single new tower is added.

**After M2 (~session 22):** the systems are complete and demand decisions. If it
is not fun *here*, more content will not fix it.

**After session 23:** the first external playtest is possible. Strangers are the
only evidence that has never been collected, and the answer changes what
sessions 24–34 should contain. This is the last decision point before the
expensive half of the project.

---
## Session ledger

Phases describe *what*; this describes *when*, session by session. Added
2026-08-16 at Daniil's request — the phase view had become hard to locate
oneself in. A "session" is one focused working stretch.

### Done

| # | Session | Shipped | Gate |
|---|---|---|---|
| 0 | Foundation (M0) | WebGL2 glyph renderer chosen by measurement, bitmap font pipeline, Actions → Pages, PRD/architecture/assets/contributing | Live page loads |
| 1 | Takeover + harness | npm workspaces, ESLint invariant rules, Vitest, `pure-rand` streams, content pipeline, WBS created | — |
| 2 | Phase 1 gate | Browser-mode tests on real Chromium, headless WebGL2 proven on CI, seeded demo | **CI green on an empty game** · `v0.1.0` |
| 3 | Tiles | Tile model, derived centre-or-nothing connectors, legality, Tile Smith authoring tool | Connectivity property test |
| 4 | The pivot | Player tile-laying and flyers **cut**; map generator, road trees, sim skeleton, 20 Hz tick | Cross-machine tick determinism |
| 5 | First blood | Towers, enemies, targeting, subcell projectiles, damage resolution | Defended road kills |
| 6 | Economy + HUD | Scrap, waves, Core health, build palette, range rings | — |
| 7 | Tuning | Mapgen fixes from a screenshot; useless-land rules | Daniil's own seed verified |
| 8 | Depth | Mortar AoE, Frost slow, shading, mapgen hardening | — |
| 9 | Tree redesign | Crosspathing **cut** for 3 either/or tiers (14 variants) | *(a red PR merged — gate was theatre; fixed)* |
| 10 | Side panel | Full-height HUD, visual tier tree, hover previews, select-then-build | Phase 3 complete · `v0.2.0` |
| 11 | Relics (long) | Design pivot for the Core; Refinery + Ore; replay + golden hash; **Phase 6 entire** — hook layer, offers, modal, Core vessel with slots, Ore sinks, caches, prospecting | **Phase 6 gate**: combos compose, relic runs replay bit-identically |

**M1 exit gate: PASSED 2026-08-16** — *"the game is fun now, it's just very
unbalanced and with quite a few holes still."*

| # | Session | Shipped | Gate |
|---|---|---|---|
| 12 | The balance lab *(PRs #51–#52)* | Headless runner + analytic model (1.5.3/1.5.4), difficulty derived from a lab sweep (`hpGeometric 1.06`), triage: preview fold bug, consumables free their slot, `foundry` cut, 8× speed | The lab predicted a breach wave and a headless run matched it |
| 13 | Scarcity, and the run ends *(PR #54)* | Finite ore veins with visible richness, 10× slower mining, run ends at wave 20 with a victory, elite waves, Juggernaut | — |
| 14 | Roads that touch *(PR #55)* | In-tile lanes, directional connectors, route-as-a-graph (enemies cannot lane-hop), Tile Smith ADD TO POOL | Multi-lane tiles proven not to collide with routing tiles |
| 15 | Map variance (long) *(PRs #57–#63)* | Port segments, carve v3 edge partitions + turning tunnels, generated tile library (`tilegen.mjs`), boon ground tiers 1–4, threat bundles, transparent modal, timed/stacking prospecting, five playtest fix rounds | Twin bends proven dealt on real maps; every fix round verified live |

*(Sessions 12–15 all shipped on 2026-08-16 — the evidence that the planned
sessions below were chopped too finely.)*

### Planned

**Re-planned 2026-08-16** after Daniil pushed back on the first ordering, then
**re-planned again 2026-08-17**: the shell and legibility work moves ahead of all
new content, so the game reaches a **semi-stable alpha** early (Daniil), and the
themed sessions that had been split into chunks are merged back into one session
each. Sessions 12–15 all shipped in a single day, which is the evidence that the
chunking was too cautious.

**Planned rows are named, never numbered** ([the working
agreement](WORKING-AGREEMENT.md), rule 5). Numbers that move cost more than they
explain: the rule they replace — *"positional, renumbered when the order changes,
each row carrying its previous identity"* — produced two rows numbered 33 and
three numbered 34, and the bookkeeping to cope with it. A **done** row keeps the
number it shipped under, frozen forever, so commits and PRs stay findable; the
rows below have names because their order is still moving.

"How far away is this" is answered by the count of rows above a row, not by an
identifier.

The order is derived from *what causes rework if done late*:

| Do early because… | Item |
|---|---|
| every tuning number gets computed twice without it | the balance lab *(done, 12)* |
| it changes path length (→ difficulty) and what a legal tile is | roads that touch without connecting *(done, 14)* |
| every sprite gets authored twice without it | the effects & animation engine |
| retrofitting a worker under live screens is surgery; doing it under one HUD is not | the sim in a Web Worker |
| save-schema migrations are cheap to prove before content churn, expensive after | persistence |
| a screen built on unreadable stats gets built twice | legibility before screens |
| art illustrates names | the naming pass |
| a stranger's first session is only worth spending once | onboarding after the systems settle |
| calibrating a moving target is waste | the bot comes *last*, not first |

| # | Session | Contents | Gate |
|---|---|---|---|
| ~~16~~ | **DONE** *(PR #69)* — the effects & animation engine: `Sim.events`, the EffectsLayer, the sprite frame model, terrain drift, void-as-water, reduced motion. Gate held, golden hash unmoved | | |
| ~~17~~ | **DONE** *(PR #72)* — legibility & truth *(was 21)* | WBS 2.10 tower stat blocks and written upgrade descriptions, 2.14 enemy readouts, 2.13 scrollable panels and larger cards **+ square relic slots**, ~~sim in a Web Worker (D7)~~ *(cut line taken: → head of 18)*. Plus the playtest-8 truth items, which all serve the same gate: **2.19** explosion radius drives damage/visual/readout together, Mortar becomes ballistic, a fired shot always resolves; **4.25** world motion rides sim time while UI motion stays on the wall clock. Stat blocks built **data-driven over the stat set**, so damage types add data and not layout | **Nothing on screen lies** — now covering stat blocks, enemy readouts, blast extent, a projectile's fate, how fast the world appears to run. A hidden tab keeps simulating. **Cut line if it spills: the worker moves to the head of 18** (it must not slip past the screens), everything else is the gate |
| ~~18~~ | **DONE** *(PR #75)* — the shell *(was 22+23)* | **Opens with the Web Worker (D7)** — the pre-approved cut from 17, and it must land before the screens multiply — plus two playtest-9 visual fixes riding as triage: 4.26 (flash = full kill radius, shockwave beyond it) and 2.25 (health-pip colour ramp). Then WBS 4.15–4.22: screen stack (generalising the offer modal), title menu, run setup, pause overlay, run summary; meta save, run save as seed + input log, schema versioning, export/import, settings screen — which is where session 16's reduced-motion flag gets its switch | A run starts from a menu and ends on a summary screen; close the tab mid-run, come back, continue; a corrupt save says so |
| ★ | **SEMI-STABLE ALPHA — NOT YET REACHED** *(corrected 2026-08-17: the dev announced this on shipping session 18; the marker is **Daniil's judgement**, not a checklist of merged PRs. Machinery exists — menus, saves, worker, pause, summary — but the Tile Smith is broken and the shell has not survived a real play session)*. The marker sessions 17–19 exist to reach. Menus, saves, settings, pause, readable stats. Handable to someone who already plays the genre; onboarding for everyone else is session 23 | |
| ~~19~~ | **DONE** *(PRs #79–#86, one day)* — the smith done properly (2.23, gate passed on Daniil's verdict), 2.26 validity, 2.24 canonical pools, cell nomenclature X/R/B, **the bridge as real strand mechanics (4.9 pulled forward)**, 2.21+2.18 specials/loadout/overlay authoring, 6.6 shoreline, terrain-as-content, and four playtest fix rounds ending in the **anchor rework**: specials anchor first, one arm per road segment joins the tree, other arms become new entries — no loops, ever | | |
| 20 | **The backbone reassessment — BUILT, GATE OPEN** *(PRs #88, #89, #93 [3-in-1], #94, #95, #96; spec conversation held 2026-08-19, full constraint-first rebuild per Daniil's D16 call)* | Delivered: spec as ARCHITECTURE §12 with `verifyMap()` inside every generation (strand-level exactly-one-route since playtest 17); the carve rebuilt (cell-denominated per-entry path floor, no relaxation, availability gates everywhere); terrain to D11/D12/D14; worker lifecycle transactional with `RunSave` v3 carrying its map (D15); displayed run code; three playtest fix rounds same-arc (special-shape law + 5 loadout slots + picker paging + mirror-identity dedup + minted deletion). Decisions D11–D16 minted | **STILL OPEN — Daniil's verdict only**: he generates and plays loadout-heavy runs without producing a defect list. Three rounds so far each produced one; each was fixed and deployed same-day |
| ~~21~~ | **DONE** *(PRs #98–#103, 2026-09-03)* — **the audit, the hygiene round, design round 1** *(inserted; not in the plan)* | A fresh-eyes audit of every package and a design review of the game as a player; seven live defects fixed first (#98), then Daniil's eleven design items as five PRs with decisions D17–D23: the wave clock and the CALL button, boss waves, traits as rules, the L offset; stackable relics and escalating prices; caches from rock and bosses opening free onto loot tables; minimum range and the filled range drawing; every tower fork reworked into two roles. WBS 2.28 | **Gate open — Daniil's**: a Standard run with the eleven items gone; a 14-variant lab sweep with no dominant path |
| ~~22~~ | **DONE** *(PRs #105–#109, 2026-09-04)* — **the geometry migration** (WBS 2.29, D24) | 8×5-glyph cells (40×40 px, square), tiles stay 5×5, the board shrinks to the viewport (option 1). Commit the art pipeline, the sprite-cell lint, the constant flip and its three literals, viewport-derived board size, placeholder sprites then the importer, aspect retunes, a lab re-sweep for the smaller board | Live at 8×5 with Daniil's four tower trees and cobble roads glyph for glyph; the variant sweep measured the trees and found three losing forks (his retune call). His playtest of the deployed build is the last word |
| ~~23~~ | **DONE** *(PRs #111–#121, 2026-09-05, sessions 23–24)* — **toward alpha I: the board and the screen** | Retune 1; the four playtest fixes (junction cells by effective ports, three-ring range, the Bolt's shot, the ramp); the art tooling tracked; the thought dump sorted (D25–D28); then Daniil's Core-at-the-edge redesign (#116), the filled and balanced board with the permanent mapgen sweep (#117: zero failures on 32 board×loadout cells), the bottom strip with sprite build buttons and the Core's actives (#118), the build sweep with an economy (#119: the Standard ramp holds, no further retune; Hailstorm is a role problem, 2.37), boon colours and the contrast lint (#120), the full-screen shell with the title as a designed page (#121) | **Gate open — Daniil's playtest** of the deployed build: five-special loadouts generate every time, the Core face at the right with its actives below, the strip in use, a Standard run past wave 10 |
| ~~24~~ | **DONE** *(PRs #123–#127, 2026-09-05 evening, session 25 — Daniil's amended "Motion")* | Three strip fixes and the Core column as ground (#123); the catalogue (#124); sprite kinds + sequences and placeholder sprites for every enemy, relic and the Core face (#125); attack animations on the fire clock, the orbital beam, the freeze (#126); the Tesla Coil (chain) and the Missile Rack with trees and sprites (#127). **Interpolation deliberately not built** (Daniil: frames first) | **Gate open — Daniil's eye on the live build**: a Bolt that flashes and recoils, a Tesla arcing through a pack, walkers as sprites, six buttons, the catalogue readable |
| ~~25~~ | **DONE** *(PRs #129–#136, 2026-09-05 late night, session 26 — after six feedback fixes)* — **combat identity** | Feedback: the strip at board scale, the build preview card, the greying rule, subtle attack sequences in every sprite, the arc as one curving stroke, interpolation (#129–#131). Then damage types with resistances and the type sweep (#132), statuses with sources and one stacking rule (#133), tower facing and the Laser Lance (#134), the Bastion and the Core's gift for every tower — **eight towers** (#135), Hailstorm as a role and the eight-tower sweep (#136). D8 closed: keep the names | **Gate open — Daniil's eye on the live build**: the card says which tower answers which enemy; a Laser he can point; walkers that glide; the strip usable at board scale |
| ~~26~~ | **DONE** *(PRs #138–#143, 2026-09-06, session 27 — after five feedback items and the art agent's brief)* — **polish and the other menus** | The art seam (`docs/ART-AGENT.md`, painted studies, facing states), the Orbital click, the strip's hp, minted tiles with reasons (#138); the Laser reworked — a pulsing background beam to the road's turn, a control branch with burns (#139); motion v2 — the render clock (#140); the how-to as the codex (#141); settings that persist, the summary as a story, first-run prompts (#142); the lab's three instruments and the sweep rerun (#143). **Not built:** the Tile Smith as a page; full keyboard operation | **Gate open — Daniil's eye on the live build**: every page reachable and back; the how-to shows everything; the beam readable with walkers in it; the first run explains itself; the Orbital fires; the summary tells a story |
| ~~27~~ | **DONE** *(PRs #152–#157, 2026-09-06 evening, session 28 — after five feedback fixes #147–#151)* — **Relics II** | The passive layer (D26 decided: six slots, a pick every second wave, folded into every tower; #152); rarity with teeth, tags and 18 sets (#153); replace, salvage, combine, skip, five duo recipes, a slot that pulses when its rule fires (#154); twenty relics on nineteen knobs, 41 in all with icons (#155); void chests and every loot table in the codex — with the water finding (#156); the relic sweep bounding the layer at 16.5–19.3 and the inline distance term (#157). **Not built:** passive sprites; keyboard operation | **Gate open — Daniil's eye on the live build**: a full row is a decision; a rare card reads as rare; two runs of one seed differ for the relics; a chest is worth watching for |
| ~~28~~ | **First contact - DISSOLVED 2026-09-11.** Its halves outlived it: the stranger test is the ledger's next row (and `docs/STRANGER-TEST.md` is its protocol); full keyboard operation is a `scope` issue in the tracker. The row said "folded into 30" and 30 shipped without it - a ghost row is worse than no row | | |
| ~~29~~ | **DONE** *(session 29, PRs #167–#173, 2026-09-07)* **The meta tree**: the fix bundle; the tree as content (24 nodes, five branches) and as a run's identity (meta save v4, run save v5, the run code's fifth segment); the workshop page; Ore by tier; the tile shop and the Smith's door; the lab at tree states (a base run banks ~22 Ore; the arsenal costs 105); the codex with locked entries and undiscovered fusions; legendary | — | Gate met on the build: finishing a run visibly changes the next one (Ore banked by tier, a win's relic, the workshop's rows); five base runs reach the arsenal by the lab's reading; the codex shows what is still to find. His eye pending |
| ~~30~~ | **DONE** *(session 30, PRs #175–#179, 2026-09-07)* **The Tile Smith in the shell, and the menus**: the menu language (framed plates, a lit title band, columns, links, key hints) with the workshop drawn as a tree; the Tile Smith as a page behind its door, minting at the shared price; the relic plate (a rarity ring, corners by kind) in the strip, the Forge and the offer; chests by rarity, a Missile's blast unlike a Mortar's, the beam's colour by path; the tree sweep with a loadout | — | Gate met on the build: every essential piece is in place and the shell has one face. His eye pending |
| ~~31~~ | **DONE** *(session 31, PRs #181–#189, 2026-09-07 night into 2026-09-08 — Daniil's "make this session big": the tutorial, the early game, the comb)* **The tutorial and the comb**: a thirteen-step tutorial with a pulsing box on the thing to look at; the early game measured on the base world and re-curved (the armour floor, the boss multiplier by weight, Calm's own curve; the live board says placement and forks decide, so the tutorial names the Core's ground and asks for a fork); the keyboard on every page; the sim's edges; three comb passes over the pages and the HUD; applicable relics; the logic comb (fourteen audit findings verified, the hash's holes closed); personal bests | — | Gate met on the build: a stranger's first run is walked, and a plain-Bolt player who forks holds Calm. His eye pending |
| ~~32~~ | **DONE** *(session 32, PRs #190–#194, 2026-09-08 — Daniil's "go" on the plan)* **Enemies II**: seven bodies each a trait rule (courser, ram, blob, mender, mole, pavise, the Warden); waves composed from packs on one front in a column, a wedge or a wall, the boss on a beat; every rule on the body, in the strip and as the answer under the next wave; the balance pass (Standard 6 + 5 a wave at ×1.07, Grim ×1.09, the reference at 22–24) and the enemy sweep's counter table | — | Gate met on the build: wave 10 reads unlike wave 5 by shape, every body says its rule by standing there, no single line holds the heavies. His eye pending |
| ~~33~~ | **DONE** *(session 33, PRs #195–#203, 2026-09-08 — Daniil's ten items first, then the plan; bar the stranger's hands)* **Content completeness, the rest, and the feedback round**: the ten items (Esc and the purse, the clock deals the owed offer, encounter cards, animated title, the tree as plates, chests halved, boss chests, the Codex, the mender's field, the creative page); every legal routing shape enumerated (nine - the law's count) with sixty land tiles and the map sweep as the guard; the multiset of copies; mini previews; the stranger test protocol written, **not yet run** | — | Gate: the stranger test's scorecard (rows 5, 6, 10 at 2) — his or his friend's hands on the live build |
| **The stranger's round and the carve's variety** | *(NEXT; the PR list is HANDOVER's "Next session, proposed")* The stranger test run and filed as round 34; the carve's lane length and turn preference by Threat; Grim and relics against the seven; the art agent's studies for the seven and the chests; the register's rows (terminals once, the analytic model retired) | Two Standard runs do not resemble each other by the road's walk; the filed round's zeros are answered |
| **Calibration I** | WBS 1.5.1/1.5.2 + 3.1–3.4: bot policy, `calibrate`/`check`, human offset from Daniil's replays, `balance.yml` gate, seed-corpus sweeps | Injected regression caught; no trivial or unwinnable seed in ≥500 runs |
| **Meta progression, full** | *(plus 7.8, the monetization door — D27; the tree, run history with bests and the in-game Tile Smith landed in sessions 29–31)* | Tech tree stages 1–2 beyond the shipped tree, dailies, replay sharing, **the tile-loadout slot economy** (7.5) | Finishing a run visibly changes the next one |
| **Calibration II** | WBS 3.6: recalibrate with the meta layer live — tech-tree multipliers, pool unlocks and chosen tile loadouts all move player power underneath the curves calibration I fixed. Re-baseline `balance.yml`, re-sweep the seed corpus at several tree states | No trivial or unwinnable seed at any tech-tree state the player can actually hold |
| **Presentation at scale** | Full art pass with per-upgrade tower identity (4.11), effects for every attack shape (6.3), enemy trait markers, UI art (4.13), **6.7 relic art at board-glyph scale**, **6.8 smoothness via spatial phase**, biomes, minimal SFX. The art round-trip proof (6.1) opens this block | The board reads as a place, not a diagram |
| **Beta hardening + release** | Perf and bundle budgets in CI, browser matrix, error-path audit, save migration tests, external playtest with strangers, release process | PRD §17 stable beta |

**Six named rows stand between here and stable beta**, and under the content
freeze (2026-09-11) no more are added — only defects and calls enter. The
count is what to watch: it grew 32 → 40 by accretion, which is the growth the
freeze exists to stop. The arc: 36 → 32 by merging themes that had been
split into steps, → 33 as playtest 8 added the tile-agency feature, → 34 as
playtest 16 opened the backbone reassessment (session 20) — the first session
bought not by a feature but by accumulated patch debt, which is itself a
finding: three fix rounds on one subsystem in one day is the signal to stop
patching and respecify, and next time it should cost two rounds, not three —
→ 36 on 2026-09-03, when a fresh-eyes audit and a player's-eye design review
(session 21, unplanned) turned up eleven fundamentals worth a round of their
own, and the presentation decision (8×5 cells) earned the geometry migration
a session (22) before the naming pass.

**The art round-trip proof (WBS 6.1) stays late — decided 2026-08-17.** The
proposal to open session 16 with it was declined: what session 16 needs is the
engine and a crude implementation, not prettiness — "pretty shit now" is
acceptable as long as the game is not confusing and works as intended.

**Risk accepted by Daniil, same day, and re-framed by him:** *"REXPaint is just
a way to improve graphics. If this tool doesn't work, we'll find another one —
it will not make or break the project."* The project depends on **an** authoring
path, not on REXPaint; because 4.1's frame model is deliberately
**format-agnostic** (plain grids in sprite JSON, nothing importer-specific),
swapping tools costs one importer and touches no schema, content or engine
code. So this is a tool choice with alternatives, not an unverified foundation
— and art quality gets its own dedicated polish block either way.

What remains genuinely late: the full art pass at scale, bridges as tile content
(WBS 4.9 — cheap now that 2.16 has shipped), towers 8–9, tech tree stage 3,
dailies and replay sharing. The effects engine, the shell and the balance harness
all moved earlier — each was mis-filed as "expansion" when it was really
"foundation something later depends on".

---

## The item tree

Every work package, with a **stable id** that PRs and commits cite. This is
*scope*: what the project is made of, independent of when it is built — the
ledger above owns the order.

**No item's state is written here.** An id is **open** when a GitHub issue
titled `[<id>] …` is open, and **done** otherwise; the block below is
rendered from the tracker by `node tools/plan-state.mjs`. That replaces 144
checkboxes maintained by hand across 122 commits, which is where this
project's doc drift mostly came from.

```bash
gh issue list --search '[4.'          # one milestone's open items
gh issue view <n>                     # an item's full text
```

The verbatim pre-merge text of every item — including the 127 already done —
is frozen in [docs/history/wbs-2026-09-11.md](history/wbs-2026-09-11.md).

<!-- generated:state -->
*Rendered from open issues by `node tools/plan-state.mjs` — do not edit by hand.*

**144 of 216 items done; 72 open.**

| | done | open | the open ids |
|---|---:|---:|---|
| **M1** | 42 | 9 | 1.2.1 (#251) · 1.2.2 (#252) · 1.2.3 (#253) · 1.2.4 (#254) · 1.2.5 (#255) · 1.3.2 (#256) · 1.5.1 (#258) · 1.5.2 (#259) · 1.6.3 (#257) |
| **M2** | 29 | 8 | 2.1 (#260) · 2.2 (#261) · 2.3 (#262) · 2.4 (#263) · 2.5 (#264) · 2.12 (#265) · 2.13 (#266) · 2.27 (#267) |
| **M3** | 0 | 6 | 3.1 (#268) · 3.2 (#269) · 3.3 (#270) · 3.4 (#271) · 3.5 (#272) · 3.6 (#273) |
| **M4** | 38 | 7 | 4.10 (#274) · 4.11 (#275) · 4.12 (#276) · 4.13 (#277) · 4.14 (#278) · 4.22 (#279) · 4.24 (#227) |
| **M5** | 2 | 5 | 5.2 (#280) · 5.3 (#281) · 5.4 (#282) · 5.5 (#283) · 5.6 (#284) |
| **M6** | 3 | 8 | 6.1 (#285) · 6.2 (#286) · 6.3 (#287) · 6.4 (#288) · 6.5 (#289) · 6.7 (#290) · 6.8 (#291) · 6.11 (#292) |
| **M7** | 13 | 7 | 7.1 (#293) · 7.2 (#294) · 7.3 (#295) · 7.4 (#296) · 7.5 (#297) · 7.6 (#298) · 7.8 (#299) |
| **M8** | 0 | 7 | 8.1 (#300) · 8.2 (#301) · 8.3 (#302) · 8.4 (#303) · 8.5 (#304) · 8.6 (#305) · 8.7 (#306) |
| **Backlog** | 17 | 15 | 9.2 (#307) · 9.3 (#308) · 9.5 (#309) · 9.6 (#310) · 9.16 (#311) · 9.17 (#312) · 9.20 (#313) · 9.21 (#246) · 9.22 (#314) · 9.26 (#315) · 9.28 (#316) · 9.29 (#317) · 9.30 (#318) · 9.31 (#247) · 9.32 (#319) |

<!-- /generated:state -->

### M1 — The fun test

| id | item | shipped |
|---|---|---|
| `1.1.1` | Convert repo to npm workspaces: `packages/{engine,content,render,view,bot,harn… | #1 |
| `1.1.2` | TypeScript project references / per-package tsconfig; `typecheck` covers all… | #1 |
| `1.1.3` | invariant rules | #2 |
| `1.1.4` | Vitest 4 for Node-side unit tests; 11 RNG tests | #3 |
| `1.1.5` | `pure-rand` seeded PRNG with named streams (`map\|drafts\|waves\|combat` as a… | #3 |
| `1.1.6` | Vitest Browser Mode + Playwright provider; 5 GLTerm tests in real Chromium… | #5 |
| `1.1.7` | Text-snapshot infrastructure on `GLTerm.toText()`; `hud-frame.golden.txt`… | #5 |
| `1.1.8` | Content pipeline: palette + sprite schemas, codegen with embedded schema… | #6 |
| `1.1.9` | `ci.yml` complete: lint, typecheck, unit, browser (Playwright cached)… | #4-#6 |
| `1.2.1` | `tools/build-rexpaint-font.mjs` — spleen atlas as 16-column PNG, same index… |  |
| `1.2.2` | Install font into REXPaint (`data/fonts/_config.xt`); verify braille renders… |  |
| `1.2.3` | one |  |
| `1.2.4` | `tools/rexpaint-import.mjs` — `.xp` → sprite JSON per ASSETS §3; commit `.xp`… |  |
| `1.2.5` | Render the imported art in the browser; verify glyph-for-glyph fidelity on… |  |
| `1.3.1` | Fixed 20 Hz tick loop; pause / 1× / 2× / 4× as tick frequency in the app's… | #13 |
| `1.3.2` | subcell entity coordinates |  |
| `1.3.3` | derived center-or-nothing connectors | #8 |
| `1.3.4` | road-join rule | #8 |
| `1.3.5` | Starter library: 11 tiles authored native 5×5 in… | #8 |
| `1.3.6` | Flow field (uniform-cost BFS — Dijkstra unneeded at cost 1) toward Core… | #13 |
| `1.3.7` | Terrain rendering: weighted glyph pools, mixing hash, boundary shading (lit… | #14 |
| `1.3.8` | Connectivity tests: 35 seeded boards over sizes 2×1…14×7 + adversarial… | #8 |
| `1.3.9` | Tile Smith | #10 |
| `1.3.10` | Map generator | #12 |
| `1.3.11` | Sim skeleton: SoA walker enemies marching entries→Core, deterministic to the… | #13 |
| `1.4.1` | Tower framework complete: one-cell footprint, occupancy, build/sell, 3×5… | #17 |
| `1.4.2` | Bolt, Mortar (explosive AoE), Frost (slow) with full paths as content… | #16 |
| `1.4.3` | Six enemies across the trait matrix (armor blunts, shields burn first… | #16 |
| `1.4.4` | Targeting (first-on-path, deterministic ties) + subcell projectiles + damage… | #17 |
| `1.4.5` | Scrap economy + waves with telegraphed widening fronts + Core health and… | #19 |
| `1.4.6` | Refinery + Ore | #32 |
| `1.4.7` | HUD complete for M1: 2× panel, build palette, tower inspector w/… | #9 |
| `1.4.8` | Replay + golden hash | #33 |
| `1.5.1` | DEFERRED |  |
| `1.5.2` | DEFERRED |  |
| `1.5.3` | Balance lab — headless runner | #52 |
| `1.5.4` | Balance lab — analytic model | #52 |
| `1.6.1` | Hook layer | #36 |
| `1.6.2` | Acquisition B | #36 |
| `1.6.3` | Relic content | #36 |
| `1.6.4` | Core as vessel | #40 |
| `1.6.5` | Acquisition C then A | #41 |
| `1.6.6` | Prospecting | #42 |
| `1.7.1` | Preview fold bug | #51 |
| `1.7.2` | The pool runs dry silently | s28 |
| `1.7.3` | Difficulty shape, first pass | #52, s13 |
| `1.7.4` | Speed control gains 8× (the frame loop already tolerates it: 32 ticks/frame ≈… | #51 |
| `1.7.5` | Refinery card shows remaining deposit instead of kills. | #54 |
| `1.7.6` | A used consumable frees its slot. | #51 |
| `1.7.7` | Cut the `foundry` relic | #51 |
| `1.7.8` | Mining 10× slower, landed with finite deposits. | #54 |

### M2 — A complete run

| id | item | shipped |
|---|---|---|
| `2.1` | The difficulty arc | #54 |
| `2.2` | CUT 2026-08-16 |  |
| `2.3` | Save/resume (must serialise relic state + the input log); run summary screen… |  |
| `2.4` | Ore banking → persistent meta store; relic pool unlock set persisted… |  |
| `2.5` | +4 towers, +~8 enemies, +relics (content, on the proven pipeline). |  |
| `2.6` | Finite ore deposits | #54 |
| `2.7` | Relic economy | s28 |
| `2.8` | Damage types decide fights | #132, s26 |
| `2.9` | Boon ground | #61 |
| `2.10` | Tower legibility | s17 |
| `2.11` | Prospecting rework | #57 |
| `2.12` | The naming pass |  |
| `2.13` | UI infrastructure | s17 |
| `2.14` | Enemy readouts | s17 |
| `2.15` | Generated tile library | #60 |
| `2.16` | Roads that touch without connecting | #55 |
| `2.17` | Carve v3 — edge partitions + turning tunnels | #60 |
| `2.18` | Tile Smith overlay authoring | s19 |
| `2.19` | Combat truth | s17 |
| `2.20` | Tile Smith cannot mint an unplaceable tile — by construction | s17 |
| `2.21` | Basic and special tiles | s19 |
| `2.22` | Loot tables + void chests | s28 |
| `2.23` | Tile Smith: explicit segment brushes in a matrix | s19 |
| `2.24` | Rotation-canonical tiles | s19 |
| `2.25` | Health pips carry colour |  |
| `2.26` | Validity: no roads to nowhere | s19 |
| `2.27` | The backbone reassessment | s20 |
| `2.28` | Session 21 (2026-09-03): the audit, the hygiene round, design round 1 | #98–#103, s21 |
| `2.29` | Geometry migration: 8×5-glyph cells | #105–#109, s22 |
| `2.30` | The board fills | s24 |
| `2.31` | Statuses visible, every effect source tracked, every rule printed | #133, s26 |
| `2.32` | Sprite contrast lint | s24 |
| `2.34` | Tower facing | #134, s26 |
| `2.35` | Cells next to the Core are precious | #135, s26 |
| `2.36` | The build sweep | s24 |
| `2.37` | Hailstorm as a role | #136, s26 |
| `4.26` | A blast reads as a blast |  |

### M3 — Trustworthy difficulty

| id | item | shipped |
|---|---|---|
| `3.1` | Real bot policy; calibration runs across seed corpus. |  |
| `3.2` | Calibrated curves committed as data; `balance.yml` CI gate. |  |
| `3.3` | Human offset measured from Daniil's recorded replays. |  |
| `3.4` | Unwinnable/trivial seed detection across ≥500 runs, measured with the relic… |  |
| `3.5` | Tech tree stage 1 (~5 nodes); in-game autopilot. |  |
| `3.6` | Calibration II | s27 |

### M4 — The shell, and what the player sees

| id | item | shipped |
|---|---|---|
| `4.1` | Effects & animation engine | s16 |
| `4.9` | Bridges | s19 |
| `4.10` | Attack shapes | s19 |
| `4.11` | Per-upgrade tower visual identity | s28–30 |
| `4.12` | Unrecovered | #48 |
| `4.13` | UI art pass | s28–30 |
| `4.14` | Enemies drawn wider than one cell | s28–30 |
| `4.15` | Screen stack | s18 |
| `4.16` | Title / main menu | s18 |
| `4.17` | Run setup | s18 |
| `4.18` | Pause overlay | s18 |
| `4.19` | Run summary screen | s18 |
| `4.20` | Persistence | s18 |
| `4.21` | Save export / import | s18 |
| `4.22` | Settings screen | s18 |
| `4.23` | Onboarding | #142, s27 |
| `4.24` | Accessibility | #142, s27 |
| `4.25` | World motion rides sim time, UI motion rides the wall clock | s17 |
| `4.27` | The bottom strip | s24 |
| `4.28` | The shell owns the whole screen | s24 |
| `4.29` | Boon ground wears its colour | s24 |
| `4.30` | The tutorial | #181, s31 |
| `4.30` | The catalogue | #124, s25 |
| `4.31` | The early game | #182, s31 |
| `4.31` | Sprite kinds and placeholder art | #125, s25 |
| `4.32` | The keyboard on every page | #184, s31 |
| `4.32` | Three strip fixes | #123, s25 |
| `4.33` | The sim's edges | #185, s31 |
| `4.34` | Comb pass two | #186, s31 |
| `4.35` | Applicable relics | #187, s31 |
| `4.36` | The logic comb and comb pass three | #188, s31 |
| `4.37` | Enemies II, the bodies | #190, s32 |
| `4.38` | Packs and formations | #191, s32 |
| `4.39` | Counter legibility | #192, s32 |
| `4.40` | The balance pass and the enemy sweep | #193, s32 |
| `4.41` | Feedback 2026-09-08, the fix bundle | #195, s33 |
| `4.42` | Encounter cards and the Codex | #196, s33 |
| `4.43` | The creative page | #197, s33 |
| `4.44` | Boss chests | #198, s33 |
| `4.45` | The tree drawn as a tree | #199, s33 |
| `4.46` | The library's breadth | #200, s33 |
| `4.47` | The multiset of copies | #201, s33 |
| `4.48` | Mini tile previews | #202, s33 |
| `4.49` | The stranger test protocol | #203, s33 |
| `4.50` | The art brief for the seven | #203, s33 |

### M5 — Content completeness

| id | item | shipped |
|---|---|---|
| `5.1` | Laser Lance | #127, s25 |
| `5.2` | ~14 |  |
| `5.3` | ~40 |  |
| `5.4` | ~100+ |  |
| `5.5` | Threat levels as data — the generator knobs bound into named difficulties. |  |
| `5.6` | Single-use, high-damage relics |  |
| `5.7` | Rarity with power, and relics you can replace, remove and combine | s28 |

### M6 — Presentation at scale

| id | item | shipped |
|---|---|---|
| `6.1` | proof |  |
| `6.2` | Full art pass: towers with per-upgrade visual identity (V11), enemies with… |  |
| `6.3` | Effects at scale: every attack shape, impact and death authored against the… |  |
| `6.4` | Biomes — palette and tile-pool variants per threat level. |  |
| `6.5` | Minimal SFX |  |
| `6.6` | The shoreline | s19 |
| `6.7` | Relic art at board-glyph scale | #125, s25 |
| `6.8` | Smoothness via spatial phase |  |
| `6.9` | positional interpolation | #125–#126, s25 |
| `6.10` | Ability graphics | #126, s25 |
| `6.11` | Smoothness, the remaining levers |  |

### M7 — Meta progression, full

| id | item | shipped |
|---|---|---|
| `7.1` | Tech tree stage 2 — five disciplines, alternate tier-5s, capped economy nodes… |  |
| `7.2` | Relic pool and tile pool unlocks wired to the tree. |  |
| `7.3` | Run history and personal bests — the reason to open the game on day nine | #169, s29 |
| `7.4` | Daily challenges (a fixed seed per day) and replay sharing — both nearly free… |  |
| `7.5` | Features price the tile | s19 |
| `7.6` | optional |  |
| `7.7` | The tile shop | #171, s29 |
| `7.8` | Monetization — the door stays open | s29 |
| `7.9.1` | The tree as content and identity | #168 |
| `7.9.2` | The workshop page | #169 |
| `7.9.3` | Ore tiers in the sim | #170 |
| `7.9.4` | The tile shop and the Tile Smith gate | #171 |
| `7.9.5` | The lab at tree states | #172 |
| `7.9.6` | The codex with locked entries | #173 |
| `7.9.7` | Legendary | #173 |
| `7.10.1` | The menu language | #175, s30 |
| `7.10.2` | The Tile Smith as a page | #176, s30 |
| `7.10.3` | The relic surfaces in the language | #177, s30 |
| `7.10.4` | Chests by rarity, blasts by tower, beams by path | #178, s30 |
| `7.10.5` | The tree sweep with a loadout | #179, s30 |

### M8 — Beta hardening and release

| id | item | shipped |
|---|---|---|
| `8.1` | Performance budget enforced: 60 fps at full board, bundle and asset budgets… |  |
| `8.2` | Browser support matrix; WebGL2 absence handled with an honest message. |  |
| `8.3` | Error handling audit — every throw reachable from a player path gets a… |  |
| `8.4` | Save migration tested across versions, including the corrupt-save path. |  |
| `8.5` | External playtest |  |
| `8.6` | Release process: versioning, changelog, tagged beta, a way for players to… |  |
| `8.7` | Licences and attribution verified (Apache-2.0; spleen BSD-2-Clause). |  |

### Backlog — The thought dump of 2026-09-06 — Daniil's numbering

| id | item | shipped |
|---|---|---|
| `9.1` | Legendary rarity | #173, s29 |
| `9.2` | Higher tiers unlock by forging |  |
| `9.3` | Relics earned by wins |  |
| `9.4` | One Refinery, every ore tier | #170, s29 |
| `9.5` | Core gifts as global powerups |  |
| `9.6` | Ignore-armour reads too strong: a balance reading against armoured waves… | #182, s31 |
| `9.7` | Loadbearing ×3 → ×1.5. | #167, s29 |
| `9.8` | The Bastion's reach takes no modifier but its own: its range IS its reach. | #167, s29 |
| `9.9` | The Bastion's reach as a plus, previewed as one. | #167, s29 |
| `9.10` | The build preview folds every modifier at the selected cell. | #167, s29 |
| `9.11` | The pulse muted and fading with radius. | #167, s29 |
| `9.12` | Void chests surface on water and empty ground, not rock. | #167, s29 |
| `9.13` | A chest sprite kind, bigger, coloured by a rolled rarity. | #178, s30 |
| `9.14` | Relic sprites 6×5: the icon plus a rarity ring; strip and Forge plates follow. | #177, s30 |
| `9.15` | The codex | #173, s29 |
| `9.16` | Consumable: place boon ground on an empty ground cell. |  |
| `9.17` | Consumable: god mode for one tower (a timed +100% to everything) with an epic… |  |
| `9.18` | The relic offer only when the board is quiet; a call over living bodies… | #167, s29 |
| `9.19` | Actives and passives look different in the slot (a plate shape per kind). | #177, s30 |
| `9.20` | debated, open |  |
| `9.21` | debated, open |  |
| `9.22` | Endless mode as the tree's last unlock. |  |
| `9.23` | More recipes; fusions discovered are recorded in the meta save and listed in… | #173, s29 |
| `9.24` | Pierce continues into bodies within half a cell of the impact, never across… | #167, s29 |
| `9.25` | Per-tower projectile and blast looks (Mortar vs Missile). | #178, s30 |
| `9.26` | debated, open |  |
| `9.27` | A Laser path changes the beam's colour. | #178, s30 |
| `9.28` | The burn ignores armour and stacks per source: the Laser's control path… |  |
| `9.29` | Towers that exist only as relics (single-build). |  |
| `9.30` | The menus reworked |  |
| `9.31` | D28: where meta progression and money live (browser plus backend, a desktop… |  |
| `9.32` | Frames per sprite vs procedural animation: an experiment sprite at 4/8/16… |  |

## Decisions (block future work — resolve by the deadline, not before)

*Minted decisions stay here — they are the plan. The **open** ones (D25, D27)
are also `call` issues in the tracker, because an unanswered decision is a
queue item: `gh issue list --label call`. When one is answered, its row here
is the record and the issue closes. A call answered by silence is minted here
too, with the date and "by default, unanswered" ([the working
agreement](WORKING-AGREEMENT.md), rule 3).*

| ID | Decision | Deadline | Owner |
|---|---|---|---|
| D25 | **Towers larger than one cell** — Daniil wants to brainstorm them (2026-09-05). PRD §5.1's one-cell footprint is load-bearing for occupancy, placement and upgrades; a multi-cell tower is either a footprint rule (which cells, which anchor, what blocks) or a visual-only size like 4.14. Decide before the new towers (25) are built | before session 25 | Daniil + dev |
| ~~D26~~ | **Reversed 2026-09-06 evening (Daniil): passives are relics.** The separate layer built in session 28 PR 1 folded back into the relic pool the same day - tower-mod relics with tiers, one pool, twelve slots, the relic offer every second wave (PRD §7.8) | — | Daniil |
| D27 | **Monetization and accounts** — intent recorded (PRD §18): Stone Story's model, lighter; nothing pay-to-win. Needs an identity story that §16 rules out today. No build work depends on it; decide before beta hardening | before session 37 | Daniil |
| D28 | **The filled board's rules** (PRD §4.3.1): coverage target (~90%?), the leaf rule (every dead end is an entrance — forced by "no dead-end spurs" once the board fills), entries emergent within the threat's range, lane balance band (within what fraction of the longest?). **Daniil's amendment 2026-09-05: the Core moves to the EAST EDGE first** (a face past the border, one entrance, no spawns on that side — PRD §4.5, shipped as session 24 PR 1); the defaults he did not amend stand: 90% coverage, lanes ≥ 70% of the longest | ~~before 2.30 starts~~ resolved 2026-09-05 (go) | closed |
| D1 | ~~Buildable density~~ **RESOLVED 2026-08-15**: the map generator controls ground amount/placement directly; density is a generation knob tuned as data (PRD §4.4) | — | closed |
| D2 | ~~The Wall~~ **RESOLVED 2026-08-15**: cut. All three candidate jobs died with the pivot + flyer cut (PRD §5.3, §13) | — | closed |
| D3 | ~~Material language~~ **CLOSED 2026-08-16 as obsolete.** "Which glyphs mean metal vs stone" was a question from when we expected hand-authored art at volume. The live remnant is narrower — *what compositional rule makes 14 tower variants legible* (V11) — and it is not answerable in the abstract; it moves into the art session as a concrete question with sprites in front of us | — | closed |
| D4 | ~~Wave-clear offer cadence~~ **RESOLVED 2026-08-16**: every **3 waves**, pick 1 of 3. ~6 guaranteed picks in a 20-wave run, ~11 acquisitions once caches and Ore draws are counted — above the ~6–10 floor at which combinations start happening (PRD §7.1) | — | closed |
| D5 | ~~Relic rarity tiers~~ **RESOLVED 2026-08-16 (second pass)**: yes — rarity weights the pool so run-breaking relics are rare and filler is common. The flat pool was correct until play evidence existed; it now does. Weighting lands in 2.7 | — | closed |
| D6 | ~~Does a run end?~~ **RESOLVED 2026-08-16**: **finite** — a final wave and a victory. Simpler to playtest and to calibrate against; endless-scored-by-depth may return later as a separate mode | — | closed |
| D7 | ~~Hidden-tab behaviour~~ **RESOLVED 2026-08-16**: the **simulation keeps running** in a Web Worker; an explicit PAUSED indicator covers deliberate pauses only. Also buys in-browser bot runs without freezing the UI | — | closed |
| D8 | **The printing-trade lexicon** — own mini-session, **before more towers/enemies** (Daniil). Dev's position to argue there: theme the *flavour* layer hard (enemies, relics, tier names, currencies) but keep **tower** names functionally readable — "Frost Emitter" tells you it slows, "Quoin" does not, and towers are picked under pressure | closed 2026-09-05 (Daniil: "ok for all except the print trade stuff. Keep as is") | closed |
| D9 | ~~Ore tier driver~~ **RESOLVED 2026-08-16**: there is no generator driver — **ore tiers are tiles you buy** (PRD §11.1). Rarity is economic: expensive tiles, owned in finite copies, with tier-N nodes bought using tier-(N-1) ore. Appearance likelihood is a calibration knob. Engine keeps only the shape (tiered cells, per-tier costs); the economy lands in M7 |
| D10 | ~~Road-shape variance~~ **RESOLVED 2026-08-16**: the constraint was never tile size — it was the validity rule confining roads to the interior 3×3 (PRD §4.2.1). Drop that, add route-as-a-graph (2.16), then generate variants (2.15). 7×7 stays a fallback only if the widened vocabulary still reads samey | — | closed |
| D11 | ~~Enclosed void~~ **RESOLVED 2026-08-19 (Daniil)**: **legal** when it satisfies the void-distance and void-share rules. The no-enclosed-void repair pass was never his rule (its only provenance was a code comment); removed from the spec so it cannot creep back (ARCHITECTURE §12 Tier 2) | — | closed |
| D12 | ~~Ore floor~~ **RESOLVED 2026-08-19 (Daniil)**: **no guarantee** — heavy bias toward some ore, rare ore-less maps legal. The only guaranteed ore is authored ore on a chosen special. Existing fill odds already deliver ~1-in-thousands ore-less maps, so removal is behaviour-safe | — | closed |
| D13 | ~~Path-length denomination~~ **RESOLVED 2026-08-19**: the threat knob is in **road cells, per-entry minimum** (the shortest lane sets difficulty), converted at carve time via the minimum cells any pool tile expresses per shape — floor by construction, overshoot legal, **never relaxed by retries** (the relaxation ladders were a dev invention, removed) | — | closed |
| D14 | ~~Void share~~ **RESOLVED 2026-08-19 (Daniil)**: a **probability curve**, not a hard cap — target share drawn low-biased on the map stream, emergent void trimmed to it; >~22% vanishingly rare. The curve shapes an upper bound (actual share = min(emergent, drawn)) | — | closed |
| D15 | ~~Run/map identity~~ **RESOLVED 2026-08-19**: seed is law within a generator version; **the run save stores the generated map itself** (resume never re-generates, so saves survive generator changes); the shareable run code = seed+threat+loadout+generator-version stamp, stale codes refused loudly. Seed-from-map rejected: generation is one-way, no seed can be derived from an existing map | — | closed |
| D16 | ~~2.27 rebuild depth~~ **RESOLVED 2026-08-19 (Daniil)**: **full constraint-first rebuild** of `generateMapOnce` — the pile itself is the problem, not only its bugs. Tile validity layer, library and view stay. Caches: uniform over all ground, no distance shaping. `TILE_SIZE` must stay odd (center-or-nothing connectors need a center cell) — a design property, in the spec | — | closed |
| D17 | ~~Wave tempo~~ **RESOLVED 2026-09-03 (Daniil, design round 1)**: the wave clock runs **launch to launch** (Standard 40 s, Calm 55, Grim 30) and never waits for the last enemy — killing faster buys quiet, dawdling stacks waves. A **CALL NEXT WAVE** button banks the remaining clock as Scrap (1/s), allowed once the current wave has finished spawning. **Wave 1 waits for the call.** Boss waves are every 5th wave **and the final wave by rule** — the old elite surge landed on the victory wave by arithmetic coincidence. The next wave is composed one wave ahead and shown on the HUD by kind and count | — | closed |
| D18 | ~~Path length and difficulty~~ **RESOLVED 2026-09-03**: PRD §9's `L` offset is live — enemy hp scales by `sqrt(mean lane cells / the threat's floor)`, never below 1. `sqrt` because the PRD's exponent is 0.5 and `Math.pow` is banned | — | closed |
| D24 | ~~Cell geometry~~ **RESOLVED 2026-09-04 (Daniil, option 1)**: the cell is **8×5 glyphs** of the 5×8 font = **40×40 px, exactly square**; tiles stay 5×5 cells; **the board is sized to the viewport** at boot (`app/boardSize.ts`: 7×5 tiles at 1920×1080, clamped 6×4…12×7) and sent to the worker with every init; a saved run continues only on a screen that fits its map. The cell is declared once in `content/assets/grid.json`, read by the view and enforced on every sprite by the content linter. Sprite format v2 (states by choice path, frames, variations, bgInk) and the importer for Daniil's generator studies came with it | — | closed |
| D23 | ~~Tower trees~~ **RESOLVED 2026-09-03 (Daniil, design round 1)**: every fork is **two roles, never two numbers** (PRD §5.3 table). Daniil's amendments applied: Marksman is reach only (targeting is a setting); Hailstorm is 3 shots at 45% each; Mortar tier 1 = more damage in a smaller blast vs a bigger blast, Concussive at tier 3, no Incendiary; Frost = a slow path and a damage path; the Refinery mines slower overall (1 Ore / 40 s base) and its deep choices grow the vein at the price of a slower cycle. New engine knobs: `damageMul`, `shots`+`spread` (homing volleys spray across targets, ballistic volleys scatter), `pierceCount`, `shieldMul`, `slowedBonusMul`, `freezeEvery`, `slowMul` as a stat, `ignoreArmor` / `deepBore50` / `deepBore100` unlocks | — | closed |
| D22 | ~~Minimum range~~ **RESOLVED 2026-09-03 (Daniil, design round 1)**: `minRange` is a folded tower stat (schema, mods, `EffectiveStats`); targeting skips anything inside it; the Mortar ships with 2.5 cells. The range overlay draws the covered area as **concentric one-cell rings fading inward** and the dead zone **darker with a red rim**, for every tower | — | closed |
| D21 | ~~Caches~~ **RESOLVED 2026-09-03 (Daniil, design round 1)**: caches are **not generated** and **not paid for**. They come out of **prospected rock** (rare, at most 3 per map, dealt at generation) and **off every boss, where it dies** (on the road, usually). Opening is free — select, OPEN — and the contents come from a **loot table** (2.22 pulled forward): Scrap, Ore, a consumable, rarely a relic, or the cell becomes tier-2 **boon ground**. The old claim-for-Scrap caches were an auto-claim with pure upside | — | closed |
| D20 | ~~Relic duplicates and the Ore price~~ **RESOLVED 2026-09-03 (Daniil, design round 1)**: a relic is **stackable or not, per relic** (`stackable` in the schema): multipliers and charges stack, a boolean rule held twice was a dead card and now leaves the pool once held. Flat global numbers are not relics (Ballistics Lab cut, by PRD §7.1's own test); no flat "triple" effects. **Buying relics gets dearer non-linearly**: the first draw costs 50 Ore and each purchase multiplies the next by 1.5 (50, 75, 113, 169…); rerolls start at 15 and escalate the same way | — | closed |
| D19 | ~~Enemy traits~~ **RESOLVED 2026-09-03 (Daniil)**: traits are rules, one table (`engine/sim/traits.ts`): **armoured** ignores slows · **shielded** regrows its shield after 2 s unhit · **fast** halves slow duration · **swarm** spawns in packs of three. Damage types (2.8) extend the same table | — | closed |

---

## Risks

**1 — Calibration may not transfer from bot to human.** The bot will play worse
than Daniil, and the offset may vary by wave and by build.
*Mitigation:* harness ships in M1; curves are committed data, so retuning is a
diff. *Fallback:* bounded dynamic difficulty adjustment, clamped so it can
never trivialise or brick a run.

**2 — Generated maps may be samey.** *(Replaced the tile-laying risk after the
2026-08-15 pivot.)* If the generator's output blurs together, runs blur
together, and the roguelite dies.
*Mitigation:* map knobs are difficulty data and tunable per threat level; the
tile pool grows via meta progression, so variety is content, not code; the
generator is seeded, so a boring map is a reproducible bug report.

**3 — Art volume.** 8 towers × 14 variants + terrain + enemies + UI, all at 5×3 —
and the playtest added per-upgrade visual identity, tower animation frames and
living terrain on top.
*Mitigation:* generate `.xp` candidates programmatically and use REXPaint for
judgement rather than production; close the material language (D3) before the
pass, not during it; keep variants compositional (a second barrel is a glyph
swap, not a redraw) so 14 states cost far less than 14 drawings.

**4 — The tuning tail is the schedule risk, not the features.** Making 100+
upgrades feel good is open-ended. The linter and harness make "better or worse"
measurable rather than a matter of opinion.

**5 — Relics widen the difficulty distribution faster than calibration can
track it** *(added 2026-08-16)*. Combinations are the point, and combinations
are combinatorial: 20 relics is 190 pairs nobody play-tested.
*Mitigation:* relics are data behind a fixed hook layer, so an offender is a
one-line pool removal, not a code change; calibration targets a distribution
rather than a point (PRD §9); and a run trivialised *by relics* is the feature
working, so the harness must only alarm on maps, never on draws.
*Fallback:* rarity tiers on the pool, which the schema reserves from day one.

---

## What Daniil has to do

His queue is the tracker, never a section here — a list of open items in a
plan document is the thing [the working agreement](WORKING-AGREEMENT.md)
rule 6 forbids.

```bash
gh issue list --label call --label blocks-ship   # what beta waits on
gh issue list --label call                       # everything awaiting his taste
```

Every call carries a stated default and is minted as a decision above if it
goes unanswered past the next session (rule 3), so work never waits on him.
