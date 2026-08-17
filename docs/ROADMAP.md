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

## M1 — The fun test *(11–14 sessions)*

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

## M2 — A complete run *(sessions 12–21, interleaved)*

Reshaped 2026-08-16 by the first playtest. The headline is not "more content"
but **making the existing systems demand decisions**: an economy that runs dry,
a relic layer that can be spent rather than only filled, damage types that make
one tower the wrong answer, and a difficulty curve that ends every run in death.

**Gate:** a full run, start to victory or death, that demands decisions
throughout.

## M4 — The shell *(sessions 16, 18, 22)*

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

## M5 — Content completeness *(sessions 23–24)*

8 towers, ~14 enemies, ~40 relics, ~100 tiles, threat levels as data.

**Gate:** two runs do not resemble each other.

## M3 — Trustworthy difficulty *(sessions 25 and 28)*

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

## M6 — Presentation at scale *(sessions 29–31)*

Full art pass with per-upgrade tower identity, effects for every attack shape,
biomes. Sequenced after meta progression *(Daniil, 2026-08-17)*: visuals come
after **all** assets exist, and the meta layer adds tile pools, tree nodes and
their art surface. The round-trip **proof** (6.1) opens this block — the
pipeline's first real test, a stated and accepted risk until then.

**Gate:** the board reads as a place, not a diagram.

## M7 — Meta progression, full *(sessions 26–27)*

Tech tree stage 2, pool unlocks, run history, dailies, replay sharing, Tile
Smith as an in-game feature.

**Gate:** finishing a run visibly changes the next one.

## M8 — Beta hardening and release *(sessions 32–33)*

Performance and bundle budgets in CI, browser matrix, error-path audit, save
migration testing, **external playtest with strangers**, release process.

**Gate:** the stable-beta bar in PRD §17.

---

## ◆ Decision points

**After the alpha marker (~session 18):** the game is a product shell around a
working simulation. The check here is Daniil's own — does playing it with menus,
saves and readable numbers still hold up, before a single new tower is added.

**After M2 (~session 21):** the systems are complete and demand decisions. If it
is not fun *here*, more content will not fix it.

**After session 22:** the first external playtest is possible. Strangers are the
only evidence that has never been collected, and the answer changes what
sessions 23–33 should contain. This is the last decision point before the
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

Session numbers are **positional and get renumbered when the order changes** —
unlike WBS IDs and milestone numbers, which are stable once assigned. A session
number answers "how far away is this", so a stale one is worse than a moved one.
Each row carries its previous identity so older commits and PRs stay findable.

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
| ★ | **SEMI-STABLE ALPHA — NOT YET REACHED** *(corrected 2026-08-17: the dev announced this on shipping session 18; the marker is **Daniil's judgement**, not a checklist of merged PRs. Machinery exists — menus, saves, worker, pause, summary — but the Tile Smith is broken and the shell has not survived a real play session)*. The marker sessions 17–19 exist to reach. Menus, saves, settings, pause, readable stats. Handable to someone who already plays the genre; onboarding for everyone else is session 22 | |
| 19 | **Map agency, and the smith grows up** *(NEXT)* *(Daniil 2026-08-17; grown by playtest 9)* | WBS 2.23 paint-inference authoring (junctions become mintable — T/X are `R` cells, no new types) and 2.24 rotation-canonical pools (dedup; selection already rotates) come FIRST, because 2.21's special pool is built out of what the smith can author. Then WBS 2.21: basics infinite and unslotted, specials finite and **guaranteed placement**, chosen into slots before the run; the loadout picker in run setup, tiles shown **drawn** through the renderer the board and smith already share; Tile Smith mints into the special pool; generation fails loudly rather than dropping a special. Plus **6.6 the shoreline** — the procedural beach band that finishes session 16's water. Slot *economy* (upgradable count, unlocks) waits for 26–27 | A run where Daniil names three tiles up front and all three are on the board; basics fill the rest and connectivity is still a construction guarantee |
| 20 | **Naming, then combat identity** *(long; was 19)* | Opens with D8, the printing-trade lexicon — a conversation, not build work, and it comes first because the content built after it inherits the names. Then WBS 2.8 damage types with real resistances and immunities, 4.10 attack shapes (chain, beam along a run of road, arc/wedge — built on 2.19's one-radius rule), and towers/enemies to answer them | A lexicon Daniil likes **before** the content that would inherit the old one; then **no single tower type clears a wave**, and each new tower answers a wave the others cannot — proven by a lab sweep, not by opinion |
| 21 | **Relic economy + loot tables** *(was 20)* | WBS 2.7 + 1.7.2: pool grown well past one run's drain, rarity weighting (D5), fusion, salvage, more consumables, more slots, an honest "pool exhausted" state. Plus **2.22 loot tables and void chests** — weighted outcome lists as content, rolled on a named stream; chests surface and sink on the water as the first consumer. Built together because rarity weighting and a weighted outcome list are the same machinery | Full slots is a decision, not a wall; the lab bounds the relic-driven power spread; every reward in the game comes from one table mechanism |
| 22 | **First contact** *(was 21)* | WBS 4.23 onboarding prompts and how-to-play, 4.24 colourblind palette, full keyboard operation, HUD text scale | **A stranger plays unaided** — then actually hand it to one, before the content push their feedback should shape |
| 23–24 | **Content completeness** *(was 22–23)* | Towers to 8 with distinct attack shapes; enemies to ~14 across the trait matrix; relics to ~40 with fusion recipes; tile pool to ~100 | Two runs do not resemble each other — the count is whatever that takes, not a quota |
| 25 | **Calibration I** *(was 24)* | WBS 1.5.1/1.5.2 + 3.1–3.4: bot policy, `calibrate`/`check`, human offset from Daniil's replays, `balance.yml` gate, seed-corpus sweeps | Injected regression caught; no trivial or unwinnable seed in ≥500 runs |
| 26–27 | **Meta progression, full** *(was 25–26)* | Tech tree stages 1–2, relic and tile pool unlocks, run history, dailies, replay sharing, in-game Tile Smith, **the tile-loadout slot economy** (7.5) | Finishing a run visibly changes the next one |
| 28 | **Calibration II** *(was 27)* | WBS 3.6: recalibrate with the meta layer live — tech-tree multipliers, pool unlocks and chosen tile loadouts all move player power underneath the curves calibration I fixed. Re-baseline `balance.yml`, re-sweep the seed corpus at several tree states | No trivial or unwinnable seed at any tech-tree state the player can actually hold |
| 29–31 | **Presentation at scale** *(was 28–30)* | Full art pass with per-upgrade tower identity (4.11), effects for every attack shape (6.3), enemy trait markers, UI art (4.13), **6.7 relic art at board-glyph scale**, **6.8 smoothness via spatial phase**, biomes, minimal SFX. The art round-trip proof (6.1) opens this block | The board reads as a place, not a diagram |
| 32–33 | **Beta hardening + release** *(was 31–32)* | Perf and bundle budgets in CI, browser matrix, error-path audit, save migration tests, external playtest with strangers, release process | PRD §17 stable beta |

**33 sessions to stable beta.** The arc: 36 → 32 by merging themes that had been
split into steps, then → 33 as playtest 8 added the tile-agency feature. Exactly
**one** new session was opened (19, map agency); every other request from that
round was absorbed into a session that was already going to touch the same code —
which is the test of whether a plan has slack or is just optimistic.

**The art round-trip proof (WBS 6.1) stays late — decided 2026-08-17.** The
proposal to open session 16 with it was declined: what session 16 needs is the
engine and a crude implementation, not prettiness — "pretty shit now" is
acceptable as long as the game is not confusing and works as intended. The
standing risk is unchanged and recorded on 6.1: the REXPaint tools do not exist
yet, so the art pipeline is unproven until session 29 opens with the proof. The
frame model in 4.1 must therefore stay **format-agnostic** — frames as plain
grids in the sprite JSON, nothing REXPaint-specific baked into the schema.

What remains genuinely late: the full art pass at scale, bridges as tile content
(WBS 4.9 — cheap now that 2.16 has shipped), towers 8–9, tech tree stage 3,
dailies and replay sharing. The effects engine, the shell and the balance harness
all moved earlier — each was mis-filed as "expansion" when it was really
"foundation something later depends on".

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

## Daniil's actions

**Done:** GitHub, scoped token, repo, Pages, REXPaint installed, and every
presentation decision.

**Phase 2, revised 2026-08-16.** Daniil: *"I think you put way too much faith on
my ability to REXPaint."* Fair, and the dependency was avoidable. `.xp` is a
documented, gzipped binary format, so **the tooling can author it directly** —
sprites get generated as `.xp` files, opened in REXPaint for review and taste
edits, and imported back. That inverts the bottleneck: Daniil judges and adjusts
art rather than producing it from scratch, and the round trip is still proven
end to end (the gate is unchanged).

A dedicated art session remains worthwhile — but as a pairing session over
generated candidates, not a drawing lesson.

**Before Phase 4:** define the material language jointly — which glyph
combinations mean metal, stone, energy. It is the highest-leverage art decision
and a taste call.

**At the M1 gate:** play it, and record a few runs — those replays become the
human offset in M3.

Running cost remains **$0**.
