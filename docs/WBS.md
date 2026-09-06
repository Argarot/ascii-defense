# ASCII Defense — Work Breakdown Structure

Status: **living document.** This decomposes [ROADMAP.md](ROADMAP.md) into
tracked work packages. The roadmap owns sequencing and rationale; this file owns
the checklist. If they disagree, fix whichever is wrong — never let them drift.

Conventions:

- IDs are `<milestone>.<phase>.<item>` and are stable once assigned.
- `[ ]` open · `[x]` done · `[~]` in progress · `[!]` blocked/decision needed.
- Distant milestones stay coarse on purpose (progressive elaboration). Each
  milestone is decomposed to this detail only when it becomes next.
- Every phase ends at its **gate** from the roadmap. A phase is not done until
  its gate passes.

---

## Open decisions (block future work — resolve by the deadline, not before)

| ID | Decision | Deadline | Owner |
|---|---|---|---|
| D25 | **Towers larger than one cell** — Daniil wants to brainstorm them (2026-09-05). PRD §5.1's one-cell footprint is load-bearing for occupancy, placement and upgrades; a multi-cell tower is either a footprint rule (which cells, which anchor, what blocks) or a visual-only size like 4.14. Decide before the new towers (25) are built | before session 25 | Daniil + dev |
| ~~D26~~ | **Decided 2026-09-06 (defaults accepted)**: passives are tower mods on every tower plus econ knobs, six slots, a pick every second wave from three; built in session 28 PR 1 (PRD §7.8) | — | Daniil |
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

## Request index

Daniil's numbered feedback → where it landed. Compact on purpose: the item
text lives in the WBS entry, declines in PRD §14, deferrals in the table above.
*(Replaced a separate FEEDBACK.md on 2026-08-16 — a third copy of the same facts
was a drift surface, not an aid.)*

**Round 1, mechanics:** 1→2.6 · 2→2.11 · 3→1.7.3+2.1 · 4→2.7 · 5→2.7 · 6→2.13 ·
7→1.7.2 *(diagnosed: pool exhaustion, not a missing button)* · 8→2.16 · 9→4.9 ·
10→2.8 · 11→4.10 · 12→2.9 · 13→4.1 · 14→1.7.4 · 15→1.7.5 · 16→2.13 (D7) ·
17→2.10 · 18→2.10 · 19→1.7.1 *(a bug)* · 20→2.12 (D8)

**Round 1, visuals:** V1→2.13+4.13 · V2→4.13 · V3→2.15 · V4→4.1 · V5→4.1 ·
V6→2.14 · V7→4.11 · V8→4.12 · V9→4.12 · V10→4.1 · V11→4.11 · V12→4.14
*(marked, not committed — visual size only)* · V13→2.14

⚠ **This index pointed at IDs 4.1 and 4.9–4.14, which had no entries** until
2026-08-17 — the numbers were assigned in PR #48 as FEEDBACK.md was deleted, and
the entries were never written, so seven of Daniil's items were tracked by
reference to nothing. Entries now exist under M4. **V8 and V9 (→4.12) could not
be recovered** and need restating. The lesson, logged: an index is not a
tracker — a mapping to an ID that does not exist is worse than no mapping,
because it reads as tracked.

**Round 12 (mock review, 2026-08-18 — session 19):** compact 4×4 brush matrix,
his layout (`FT7|`/`EX3-`/`LUJB`/`GKOC`), block labels only→2.23 · nomenclature
`R`→`X`, `K`→`R`, `r`→`B` "bridge", crawl all assets→2.23 · ground as default
brush→2.23 · actual sprites on the tile preview→2.23 · "make sure the validity
checker works properly"→2.26

**Round 21 (playtest 18 screenshot round, 2026-08-20):** "still duplicates
and borked tiles in the pool; tile_yn7vhz still there"→two separate facts:
(a) gen_ns_4 was gen_ns_3's exact MIRROR — rotation-canonical identity is
blind to reflection; gen_ns_4 removed, tilegen and the dedup law now key on
mirror-canonical form · (b) tile_yn7vhz is MINTED (his browser's pool, by
design per-browser) and passes validity, so auto-healing rightly keeps it —
the honest fix is authorship: the loadout screen gained DELETE MODE (armed
toggle; click a minted tile to remove it permanently; shipped tiles
untouchable), verified live end-to-end. If a tile the rules accept still
LOOKS like a loop to him, that is spec input — his export would show the
shape class.

**Round 22 (the 8×5 playtest, 2026-09-04 evening and 05 morning):** 1 "wrong
road sprites" → PR #112 (a defect: junction cells drew the crossing's art by
letter; now drawn by effective ports) · 2 the half-empty screen → 4.27 (the
bottom strip: wave composition with specialties, actives, build buttons with
the towers' sprites, grey when unaffordable) · 3 mapgen struggles with custom
tiles + balance lane lengths → 2.30 + D28 (measured: five specials fail 30/30
on every small board) · 4 dial the ramp down → PR #112 (a notch; re-measured
after 2.30) · 5 Bolt projectile → PR #112 (a gold dash) · 6 range as three
thin rings → PR #112 · untracked art tooling → PR #113 · **the thought dump**:
full-screen shell → 4.28 · animation pass 2 and attack animations → 6.9 ·
more towers (tesla, laser, AoE, support, missiles) → 5.1 amended · rotation
→ 2.34 · single-use nukes → 5.6 · ability graphics → 6.10 · passives vs
relics → D26 + 5.8 · rarity with power → 5.7 · relic sprites → 6.7 ·
replace/remove/combine → 5.7 · boon colours + corner glyphs → 4.29 · damage
types illegible → 2.8 (restated in PRD §8) · statuses visible + effect
sources + Splinter's second blast → 2.31 · multi-cell towers → D25 ·
monetization → D27 + 7.8.

**Round 23 (after the 2026-09-05 afternoon build, evening):** sprites for
everything missing, relics included → 4.31 + 6.7 (placeholders, the art
agent's replace them) · a table of every relic and enemy he can extend →
4.30 (the catalogue, PROPOSED tables as the request queue) · "not sure
interpolation is the best idea... more animation frames first, but make
animation smooth" → 6.9 sequences and attack animations shipped,
**interpolation deferred to his word** (the difference is spelled out in
HANDOVER) · 1 green build button → 4.32 · 2 room for more towers, and
towers this session → 4.32 + 5.1 (Tesla, Missiles) · 3 the Core column as
buildable ground → 4.32 + 2.35 (the two precious cells exist now).

**Round 26 (the 2026-09-06 build, 2026-09-06 evening; his order 1 >>> 3,4,5 > 2):** 1 "a lot of the animations broke - sometimes no projectiles/explosions/AOE/laser rendered at all, game speed seemed to matter" → PR #147 (motion v2 pruned every effect born behind the render clock; prune by expiry only, and every effect is painted at least once) · 2 statuses as background colour, not a glyph → PR #150 (the walker's ground: cold, ember, ice, split when two hold) · 3 the Laser fires much slower and its pulse is more than one flat colour → PR #148 (a pulse a second at the same dps; a front, a hold with shimmer, a decay) · 4 "it doesn't have a fixed range - to the bend regardless of length" → PR #148 (no range on a beam, held by the linter; the card says "reach the road, to its turn"; the build preview draws the corridor) · 5 the Orbital like the laser but two cells wide, near-white cyan, an explosion at the site → PR #149 · 6 "tesla attack animation is great" → kept. Readings for him: the aimed Laser line went 13.8 → 18.5 (`docs/lab/build-sweep-2026-09-06-laser-cadence.md`), not retuned.

**Round 25 (the 2026-09-05 late build, 2026-09-06):** 1 the Laser
overwrites the walkers, must be a 3-wide background beam that pulses and
reaches the road's turn, the tree reworked (control vs damage, Sweep
gone) → PR #139 · 2 the Orbital Lance does nothing on click → PR #138
(the strip read the column's card) · 3 the Core's hp in the strip is
redundant → PR #138 · 4 "still choppy; Stone Story or Cogmind is the
bar" → PR #140 (the render clock) + the brainstorm in the 2026-09-06
report → 6.11 · 5 minted tiles from another device not selectable → PR
#138 (listed with the reason, never hidden) · "first a manual for the
sprite editor agent" → `docs/ART-AGENT.md` + the painted-study importer
(PR #138).

**Round 24 (the 2026-09-05 evening build, late night):** 1 hovering a
build button shows the tower's stats → PR #129 (the build preview card) ·
2 the shooting animation "jumps" → PR #130 (placeholder sequences in every
sprite, a spark-and-smoke fallback; the art agent owns the real ones) · 3
"more fluid, far from what I imagine — implement the interpolation" → PR
#131 (6.9) · 4 lightning as a continuous curving line → PR #130
(`arcPath`) · 5 grey only for scrap or a tile unbuildable for that tower →
PR #129 · 6 the 2× strip unusable, back to board scale → PR #129 (288×16;
text at board scale too, his call) · session 26 approved minus the
lexicon (D8 closed: keep the names) · session 27 = polish + the other
menus (HANDOVER's plan).


**Round 20 (playtest 18, 2026-08-19):** "special assets used more than once
and unselected — double bends everywhere"→CONFIRMED with numbers: twin_bend,
the one tile round 19 left basic, dealt unchosen on 45/60 plain threat-0
maps in all four rotations (his "two versions 90° apart"); the special law
is now touching OR twin-segment (`tileIsSpecialShape`, one predicate for
tilegen + labels + pools), twin_bend flipped special, tunnels therefore
self-limit to zero on plain maps — the old 2.17 sweep is INVERTED (plain
maps must contain no special shapes) · "remove the borked tile from the
pool"→the minted pool re-validates on every read, so the round-19 cycle
rule drops his loop tile from the picker automatically; pinned by test ·
dedup/label sweep of shipped assets→no canonical twins, no invalid tiles,
one label mismatch (twin_bend) — the label law and the dedup law are now
permanent tests · "picker shows only two rows"→correct: the modal fits
exactly 2×5 tiles; the pool now PAGES at 10 with PREV/NEXT, geometry pinned
by a MenuScreen fit test (12 unpaged overflow, 10+pager fit)

**Round 19 (playtest 17, 2026-08-19 — first playtest of the rebuilt backbone):**
mapgen doesn't place bridge specials + quit-then-NEW-RUN resumes old game +
boon on road cell→ALL THREE were the old build (PRs 2–5 were unmerged; the
boon-on-road is the phantom composite seen live, confirming the PR 4
diagnosis); merged as #93, deployed, re-verified→closed · his own minted
loop tile broke generation→validity now refuses in-tile road cycles at the
authoring surface, naming the cells · generated map still shows loops (seed
633440)→strand-level exactly-one-route check added to verifyMap, runs inside
every generation; 480+ swept maps clean; exact-map confirmation needs his
save export (requested) · touch-not-merge basics→flagged `special` (5 gen_*
tiles): chosen, never rolled; loadout slots 3→5; twin_bend stays basic (it
does not touch — flagging it would kill 2.17's tunnels, caught by the test)

**Round 18 (playtest 16, 2026-08-18 — end of day, the reassessment call):**
boon ground on VOID→2.27 regression fixture · map generated WITHOUT selected
bridge specials, no error→2.27 regression fixture (suspected worker-lifecycle
crash masking as mapgen; unproven) · quit mid-game then NEW RUN returns the
paused game→2.27 (worker init/resume lifecycle) · URL seeds are not viable
run identity for a roguelite (modifiers always exist)→2.27 design item:
deterministic map/run identity · **Daniil's verdict: "we seem to be drifting
into pile-of-patches territory" — patching STOPPED by agreement**; session 20
is the backbone reassessment, chosen over same-day triage, on a fresh context

**Round 17 (playtest 15, 2026-08-18):** old minted tiles render with no road
edges in previews (while correct on the board)→the REAL #2, found by
reproducing with the reporter's artifact class: pre-segment mints are built
of omni `X` cells and `segmentRimMask(X)`=0 — previews of complete tiles now
derive edges from actual connectivity (`tileRimMask`), the board's own rule;
`segmentRimMask` stays authoring-only · anchor-mesh loops violate the
standing no-loops rule→arms reworked to Daniil's stated rule set: one arm
per road segment joins the tree, every other arm exits the board as a NEW
entry (entry count may grow — his explicit allowance), so the road is a
tree on every map, property-tested with anchors woven in; a bridge's two
segments each get their own joining arm (caught by the bridge test) ·
golden shore reads as ore (same gold palette)→art-pass note on 6.6/6.2

**Round 16 (playtest 14, 2026-08-18):** run setup shoves back in after
start→two fixes, the second on Daniil's design call. First pass (host
seeding) made the failure honest and fast — and honesty was not the ask:
*any* loadout must generate. The tree model caps junction arms at
(entries−2) by the handshake lemma, no carve order escapes it, so Daniil
chose the **anchor-mesh rework**: road specials are placed FIRST as anchors
(slot + rotation), every connector arm walks a short path and JOINS the
network, joints growing into T/X through the partition machinery. The joins
are the map's only loops — special-free carving stays a tree bit-for-bit
(golden hash untouched), entries stay exactly the threat's roll, and
bridges/twin-bends anchor uniformly. Proven: 3 heavy junctions on a
2-entry map across 10 seeds, and live in 533ms where the tree model spun
14s and refused · pool previews show wrong sprites→canonicalisation leaked
into DISPLAY: the heal pass stored the canonical rotation, silently rotating
tiles away from how they were authored. Canonical form is IDENTITY only —
pools store and show the authored orientation, keys alone are canonical.
Daniil's standing principle recorded: visuals derive live from data like
clothing on the backend; the one code-vs-architecture gap is CLOSED — terrain
glyph pools now live in `content/assets/terrain/appearance.json` (schema,
codegen, validation, load-or-explain like the palette), so a graphics pack is
that file plus the palette, zero code ·
threat markers→confirmed working (was the unrenderable-glyph fix + a stale
Pages bundle)

**Round 15 (playtest 13, 2026-08-18):** threat click has no visible effect→
MenuItem gains a real selected state (`[ GRIM ]` in accent) — the original
marker was `»`, which spleen does not have, so GLTerm silently drew nothing:
the state was always updating, its only indicator was an unrenderable glyph.

**Round 14 (playtest 12, 2026-08-18):** loadout picker as its own screen, not
a strip→2.21 fixed · tile previews clipped→MenuScreen rows, never clipped ·
rotation-twins offered→pool canonical-dedup on load + tilegen drops hand-twins
(the library itself had `straight`≡`gen_ns_1`) · "specials appear unchosen"→a
minted shape equal to a basic IS the basic, rolled normally; minting library
twins now refused by name, existing ones dropped on load · huge voids + void
near road + enclosed holes→one bug: the outer fill ring's stay-void roll;
ring now always fills, property test locks it, golden hash moved with reason
(2003059284→185380119) · smith layout shift→fixed two-column grid · menus
hide the HUD · blast visual extent = kill radius exactly, shockwave dies AT r
· duplicate actives fire the first READY copy (was: first copy always, its
cooldown blocking the rest) · Core brush and core tiles dev-only (`?dev`) ·
GO AGAIN keeps the loadout

**Round 13 (smith playtest, 2026-08-18):** buttons are buttons — schematic
glyphs, not sprite renders (the dev misread round 12's "sprites on the
preview" as the palette)→2.23 · **the bridge is a MECHANIC, not a rename** —
two roads crossing in one cell, never merging, with its own sprite (the dev
misread "we call the lane B cell bridge" as nomenclature)→**4.9 pulled
forward, shipped** · push what you make to GitHub main — the playable build
must be findable→process

**Round 11 (playtest 11, 2026-08-17 — end of day):** smith still broken,
inference guesses instead of obeying and **cannot express touching-not-merging
roads**→**2.23 REVERSED to explicit brushes in a matrix** · valid tiles with
roads leading nowhere→2.26 · **the alpha marker is NOT crossed** (dev claimed
it; the marker is Daniil's judgement, not a checklist)→ledger corrected ·
"last couple of sessions underwhelming — the ratio of what's done to bugs
surfaced"→POSTMORTEM, the headline finding of the day

**Round 10 (playtest 10):** smith has no T/X buttons and paints with an
invisible default→2.23 · menu text clipped, labels not centred, no distinct
background→fixed same day · health pips missing on some enemies (off-board
clipping)→fixed · shield sub-bar→**declined by Daniil's own condition**: one
foreground per glyph, sub-glyph colour impossible

**Round 9 (playtest 9, 2026-08-17 — session 17 live; "it is better")**: smith
cannot mint junctions → **2.23 (paint-first authoring; Ts become first-class
3-port types — the dev's "T is just `R`" was a logic error Daniil caught,
since 4-port `R` merges with adjacent `R`; X-as-intersection stays `R`,
crossing-without-merge is the 4.9 bridge)** · rotation identity → 2.24 *(selection already rotates;
the fix is pool-level dedup)* · denser health bar via colour → 2.25 · blast
should include the shockwave → 4.26 · no session proposal before building →
process, POSTMORTEM'd (plan-first violated by momentum)

**Round 8 (playtest 8, 2026-08-17 — the effects engine landed; "animation looks
great, game is indeed much more fun now"):** explosion radius must drive damage,
visual and readout→2.19 · mortar should be ballistic, not homing→2.19 ·
projectiles must not vanish when their target dies→2.19 · Tile Smith mints
unplaceable tiles→**2.20 (fixed by construction, not patched)** · basic vs
special tiles + pre-run loadout→2.21 (+7.5 for the slot economy) · relic sprites
at board scale→6.7, square slots→2.13 · background animation ignores tick
speed→4.25 *(diagnosed: session 16 put world motion on the wall clock while
arguing the opposite for effects — both halves cannot be right)* · shoreline
blending→6.6 *(already promised in PRD §13; had no WBS item — asked twice)* ·
void chests→2.22/PRD §4.9 · loot tables→2.22/PRD §7.7 · smoother animation→6.8
*(mechanism corrected: spatial phase, not partial redraw)*

**Round 5 (playtest 5, all PR #63):** 1 rim-as-shade · 2 library re-encoded to
segments · 3 segment-only brushes · 4 auto tile ids · 5 paint-on-preview ·
6 tile weights · 7 **partial: ore paintable; richness/boon authoring → 2.18** ·
8 boon tiers 1–4 (corner marks) · 9 exact boon text · 10 boons near road ·
11 duplicate relics equippable (rebalance later, agreed) · 12 void share cap

**Round 4 (playtest 4, PRs #59–#61):** ports model · transparent modal ·
enclosed-void fill · prospect stacking/parallel-auto

**Round 3 (playtest 3):** difficulty ✓ · reroll visibility→#57 · 2× cards→#57 ·
richness density+bg→#57 · timed/auto prospecting→#57 (2.11) · ore readout on
select→#57 · directional roads replacing lane letters→#57 · Tile Smith add
UX→#57 · two-turn tiles unused by carve→**2.17 (the fix is the carve, stated
openly)** · "bigger sessions"→ledger rescoped

**Round 2:** consumables free slots→1.7.6 · cut `foundry`→1.7.7 · 10× slower
mining→1.7.8 · ore tiers→D9 · Tile Smith "add"→2.16 · balance maths→1.5.3/1.5.4 ·
Phase 5 too early→split · content too late→ledger reordered · animation is
engine work→4.1 pulled forward

**Declined** (reasons in PRD §14): both-tier relics · mechanically multi-cell
enemies · offset connectors *(my proposal, withdrawn)* · build-to-claim caches ·
mid-run tech tree · road mutation · silent hidden-tab simulation.

---

**2026-08-15 pivot** (PRD §1, §14): player tile-laying cut; maps are generated
at run start (Core tile center, `entries` carved paths, ore by road distance).
Flyers cut. Tile machinery and Tile Smith survive as generator input and meta
progression.

**2026-08-16 — the relic layer** (PRD §7, new Phase 6 below). The Core's own
branch tree is **cut before implementation**; the Core becomes the vessel that
holds run-local relics. Rationale: a handful of symmetric balanced purchases
cannot produce a build-breaking run, which is what a roguelite is for. Also
settled: the Refinery mines Ore only (its Scrap path becomes a relic), caches
are claimed by paying not by building, prospecting reveals rock contents dealt
at generation, and no relic may ever combine both options of a tier (art
budget — PRD §5.2, §14). M1 grew by ~2 sessions; the relic layer is inside the
fun-test gate, not after it.

---

## M1 — The fun test

### 1.1 Phase 1 — harness before game code *(~2 sessions)*

**Gate: CI green on an empty game.**

- [x] 1.1.1 Convert repo to npm workspaces: `packages/{engine,content,render,view,bot,harness,app}` + `tools/`. Move `GLTerm.ts` → `render`, demo bootstrap → `app`. Site still builds and deploys identically. *(PR #1; also fixed `vite preview` never serving the Pages base)*
- [x] 1.1.2 TypeScript project references / per-package tsconfig; `typecheck` covers all packages. Headless packages get `lib: [ES2022]`, no DOM — invariant 2 at compile level. *(PR #1)*
- [x] 1.1.3 ESLint 9 flat config with **invariant rules**: `Math.random` ban (inv 1); DOM-global ban in headless packages (inv 2); layer-import boundaries via `eslint-plugin-boundaries` v7 (inv 3); `node:` builtins banned outside harness/tools. All rules proven to fire on planted violations. *(PR #2)*
- [x] 1.1.4 Vitest 4 for Node-side unit tests; 11 RNG tests. *(PR #3)*
- [x] 1.1.5 `pure-rand` seeded PRNG with named streams (`map|drafts|waves|combat` as a union type) in `engine/rng`; golden values frozen against dependency drift; state round-trip tested for M2 save/resume. The mock xorshift survives only as `main.ts` demo layout hashing, replaced wholesale in Phase 3. *(PR #3)*
- [x] 1.1.6 Vitest Browser Mode + Playwright provider; 5 GLTerm tests in real Chromium incl. pixel-exact readback; headless WebGL2 proven on the CI runner (SwiftShader). *(PR #5)*
- [x] 1.1.7 Text-snapshot infrastructure on `GLTerm.toText()`; `hud-frame.golden.txt` committed and diffable. *(PR #5)*
- [x] 1.1.8 Content pipeline: palette + sprite schemas, codegen with embedded schema objects (committed, CI fails on drift), `ajv` validation at load, content linter with honest idle reporting. First asset: `palette.json`. *(PR #6)*
- [x] 1.1.9 `ci.yml` complete: lint, typecheck, unit, browser (Playwright cached), content validation, drift check, build — on every PR. *(PRs #4-#6)*

**Phase 1 gate: PASSED — CI green on an empty game. Tagged `v0.1.0`.**
Bonus: demo rebuilt as a seeded board through the real pipeline (PR #7); live page verified pixel-identical to local build for a pinned seed.

### 1.2 Phase 2 — art pipeline proof *(~0.5 session, needs Daniil)*

**Parked until Daniil is at the laptop** — Phase 3 backend pulled forward
instead (no dependency between them; resequenced 2026-08-15).

**Gate: a sprite drawn in REXPaint appears in the game unchanged.**

- [ ] 1.2.1 `tools/build-rexpaint-font.mjs` — spleen atlas as 16-column PNG, same index order as runtime glyphset.
- [ ] 1.2.2 Install font into REXPaint (`data/fonts/_config.xt`); verify braille renders in the editor.
- [ ] 1.2.3 Author **one** tower sprite and **one** terrain tile in REXPaint (Daniil, hands-on).
- [ ] 1.2.4 `tools/rexpaint-import.mjs` — `.xp` → sprite JSON per ASSETS §3; commit `.xp` sources.
- [ ] 1.2.5 Render the imported art in the browser; verify glyph-for-glyph fidelity on the deployed page (cache-busted).

### 1.3 Phase 3 — the board *(~2–3 sessions)*

**Gate: connectivity property test — seeded edge-biased boards + adversarial
unit battery, always holds.** *(Rescoped from "10,000 boards": with derived
connectors, invalid states are unrepresentable; mass generation tests the RNG,
not the logic. Decision: Daniil, 2026-08-15.)*

- [x] 1.3.1 Fixed 20 Hz tick loop; pause / 1× / 2× / 4× as tick frequency in the app's frame loop; clamped dt. *(PR #13)*
- [~] 1.3.2 Three-level grid model ✓; **subcell entity coordinates** ✓ (continuous cell units in SoA arrays). Occupancy `Uint16Array` arrives with towers (Phase 4).
- [x] 1.3.3 Tile model: native 5×5 grids, **derived center-or-nothing connectors** (PRD §4.2), rotation, single validity function. *(PR #8)*
- [x] 1.3.4 Placement legality: edge agreement, no road off-board, contact + **road-join rule** (road tiles must extend the network — found by the property test catching disconnected networks). Draft→place flow itself lands with the run loop (M2). *(PR #8)*
- [x] 1.3.5 Starter library: 11 tiles authored native 5×5 in `content/assets/tiles/library.json`; 7×7 `tiledefs.json` + `to5()` downsampling hack removed. Semantic validation via engine in harness CI test. *(PR #8)*
- [x] 1.3.6 Flow field (uniform-cost BFS — Dijkstra unneeded at cost 1) toward Core cells; yields `L`, shown live in HUD. *(PR #13)*
- [x] 1.3.10 **Map generator**: carve-then-tile, entries exact and unique, ore by road distance. *(PR #12)* **v2 (Daniil's rules, PR #14):** road network is a tree (unique route per entry, no loops — tested as |E|=|V|−1), walks exit promptly after earning `targetPathLength`, roadless slots >3 from road stay void, sector-assigned walks spread the tree across all board halves.

**Phase 3: COMPLETE** *(2026-08-15)* — every item shipped except the occupancy
array, which deliberately arrives with towers (1.4.1). Gate held: connectivity
(now tree-uniqueness) proven across edge-biased seeded boards + adversarial
battery; sim deterministic cross-machine against the live deploy.
- [x] 1.3.11 Sim skeleton: SoA walker enemies marching entries→Core, deterministic to the tick cross-machine (verified against the live deploy); animated demo with pause/1×/2×/4×. *(PR #13)*
- [x] 1.3.7 Terrain rendering: weighted glyph pools, mixing hash, boundary shading (lit tops, shadowed bottoms per ASSETS light rules); faint tile-seam markers on G. *(PR #14)*
- [x] 1.3.8 Connectivity tests: 35 seeded boards over sizes 2×1…14×7 + adversarial battery (off-center roads, corner roads, split routes, roads-to-nowhere, edge spawns, boundary violations, rotation identities, road-join). *(PR #8)*
- [x] 1.3.9 **Tile Smith** authoring tool: paint a 5×5 grid at `/tilesmith.html`, live derived connectors, verdict + export gated by engine `validateTileCells`, shared terrain styling with the game view. *(new item, Daniil 2026-08-15; PR #10)*

### 1.4 Phase 4 — the game *(~3–4 sessions)* — **blocked by D1, D2, D3**

- [x] 1.4.1 Tower framework complete: one-cell footprint, occupancy, build/sell, 3×5 trees, crosspath 5/2/0 enforced (pure canUpgrade shared with HUD), effective-stat folding, sell refunds tiers. *(PRs #17, #23)*
- [x] 1.4.2 Bolt, Mortar (explosive AoE), Frost (slow) with full paths as content; Refinery: session D. *(PRs #16, #23)*
- [x] 1.4.3 Six enemies across the trait matrix (armor blunts, shields burn first, fast/swarm stats), minWave gating. Damage types (Kinetic/Energy): deferred to D with the Core branches. *(PRs #16, #23)*
- [x] 1.4.4 Targeting (first-on-path, deterministic ties) + subcell projectiles + damage resolution + kill credit. Cross-content CI rule: projectiles must outrun enemies. *(PR #17)*
- [x] 1.4.5 Scrap economy + waves with telegraphed widening fronts + Core health and defeat. Budget curves from analytic prior: M3 calibration. *(PRs #19, #23)*
- [x] 1.4.6 **Refinery + Ore** *(PR #32, 2026-08-16)*: Ore-only production on `O` cells (off-vein the cycle timer holds, ready for prospecting to resume it); Ore per tier in `Sim`; 3-reroll carry then wipe in the app; HUD ORE readout + producer card (yield/s, OFF VEIN warning); mapgen ore floor **by construction** (pre-committed slots, no repair pass — `ORE_FLOOR`). *Rescoped 2026-08-16: the Core's type-choice-and-tier-tree half is **cut, not deferred** (PRD §14) and replaced by 1.6; the Refinery's Yield/Scrap path is cut and becomes relic `foundry` (1.6.3). The Survey tier path arrives with 1.6.6 — deliberately not sold as a no-op today.*
- [x] 1.4.7 HUD complete for M1: 2× panel, build palette, tower inspector w/ crosspath-aware upgrade buttons, priority selector, range circle, telegraphs, Core vitals, defeat banner. Mouse-first. *(PRs #9, #18-#20, #23)*
- [x] 1.4.8 **Replay + golden hash** *(PR #33, 2026-08-16)*: recording inside the Sim's four mutation methods; `applyAction` playback + `playReplay` driver; `hashState()` FNV-1a over all state; golden 2,000-tick hash frozen (`2829733585` in `replay.test.ts`); round-trip proven bit-identical. All seven Phase 6 action shapes reserved in the union; Sim rejects them until built. `__ad.replay()` serialises a run (~119 bytes played).

**Phase 4: COMPLETE** *(2026-08-16)* — every item shipped or explicitly
replaced by Phase 6 (the Core tree → relics, PRD §14).

### 1.6 Phase 6 — the power layer *(~2 sessions)* — **runs before 1.5**

Relics: rule-breakers acquired mid-run (PRD §7). Numbered 6 because IDs are
stable once assigned; sequenced before Phase 5 because calibrating a game that
is missing its power layer produces curves we would throw away.

- [x] 1.6.1 **Hook layer** *(PR #36, 2026-08-16)*: named knobs at fixed seams - stats fold (damageMul/fireRateMul/rangeAdd/coreAdjacentRangeMul), damage resolution (slowedDamageMul/killRefundScrap/overkillCarry), impact (explodeTwice), build legality (buildOnRock/offVeinScrap), production (offVeinScrap yield, productionMul window), movement (freezeTicks), targeted actives (orbital). Passives fold immediately, consumables once USED, actives cooldown per relic; fold is order-free. Schema + codegen + validateRelics shipped, `rarity` reserved (D5).
- [x] 1.6.2 **Acquisition B** *(PRs #36 engine + #37 modal, 2026-08-16)*: offers every 3 completed waves (D4), pick 1 of 3, no duplicates vs held, `relics` RNG stream (map/waves/combat draws untouched). The offer modal is the project's first pop-up and the reusable pattern (painted over the finished frame; no state to save). Auto-pause on offer, app-level. A dead run stops offering.
- [~] 1.6.3 **Relic content** *(PR #36)*: the eleven-relic starter pool shipped and effect-tested (`overflow`, `frostbite`, `tithe`, `splinter`, `vein_tap`, `loadbearing`, `ballistics`, `foundry`, `orbital`, `stasis`, `deep_vein`). Grows toward ~20 with 1.6.6 (prospecting-adjacent relics land with their mechanics).
- [x] 1.6.4 **Core as vessel** *(PR #40, 2026-08-16)*: Core card with HP bar and a Stone Story-style slot grid (12 slots always drawn, empty included - Daniil); slots are stateful buttons (passive/ready/cooling-with-countdown/consumable/used); targeted actives arm a board-click aim mode with blast-radius preview, Esc cancels.
- [x] 1.6.5 **Acquisition C then A** *(PRs #41, #42, 2026-08-16)*: DRAW RELIC (15 ore) on the Core card, REROLL OFFER (8 ore) on the modal - both draw at action time on the relics stream, riding the replay log. Caches dealt at generation ([?] plates, far ground), claim card replaces the palette (40 scrap), building on unclaimed caches blocked outright.
- [x] 1.6.6 **Prospecting** *(PR #42, 2026-08-16)*: rock contents dealt at generation (30% ore / 12% cache / rest nothing); rocks are clickable with their own card, PROSPECT (25 scrap) gated behind the Refinery's Survey tier choice (`unlocks: 'prospect'` - a new ChoiceDef capability field, replacing Twin Shaft); the Sim owns a mutable cell map with an ordered change log the view consumes. Off-route only, flow field untouched by construction.

**Phase 6 gate: PASSED** *(2026-08-16)* — frostbite+overflow proven composing in one damage resolution, and relic runs (offers, draws, claims, prospects) replay bit-identically from seed + input log.

**Phase 6 gate: a run where two relics combine into something absurd,
reproduced exactly from its seed + input log.**

### 1.5 Phase 5 — smoke harness *(~0.5–1 session)*

**Split 2026-08-16.** A bot calibrating against systems that are still changing
is wasted work, but *measurement* is needed immediately. 1.5.3/1.5.4 come first;
1.5.1/1.5.2 wait until damage types, relics and the difficulty shape have settled.

- [x] 1.5.3 **Balance lab — headless runner** *(PR #52, 2026-08-16)*. The real `Sim`, no renderer, at full speed: place a loadout from a spec, run N waves, report leak %, margin, time-to-kill, breach wave, economy curves. Exact by construction because it IS the game. The engine is already DOM-free and deterministic, so this is a measurement layer, not a new simulator.
- [x] 1.5.4 **Balance lab — analytic model** *(PR #52)*. Closed form: coverage × exposure time × effective DPS against a wave HP pool, with armor/shield/slow folded in. Answers "what threatens this build at wave 30" instantly and sweeps thousands of configurations. The analytic model proposes, the headless runner verifies, and the **gap between them is itself a bug detector** (PRD §9 always specified this two-layer shape; only the order was wrong).
- [ ] 1.5.1 ~~Crude bot policy~~ **DEFERRED** until systems settle — build/upgrade heuristic plus relic picks.
- [ ] 1.5.2 ~~`harness calibrate` / `check` CLI~~ **DEFERRED** with 1.5.1. Calibration targets a distribution over relic draws, not a point (PRD §9).

### 1.7 Phase 7 — post-playtest triage *(~0.5 session, next)*

The wave-14 run produced both bugs and one shape error worth fixing before any
calibration work, because they corrupt the evidence calibration would gather.

- [x] 1.7.1 *(PR #51)* **Preview fold bug** — the tower upgrade preview calls `effectiveStats()` directly, bypassing the relic fold, so with Loadbearing live a tower shows range 18 and previews 8.5. Route previews through `sim.stats()`; colour a change for the worse red (PRD §5.4).
- [ ] 1.7.2 **The pool runs dry silently** — 11 relics, caches deal duplicates, `unheldPool()` empties, `maybeOffer` returns early and the acquisition layer switches off with no message. Short term: more relics + an honest "pool exhausted" state. Real fix is 2.7.
- [x] 1.7.3 *(PR #52)* **Difficulty shape, first pass**: difficulty is data (`DifficultySpec`); `hpGeometric 1.06` chosen from the lab sweep — naked ~10, competent ~23, god build ~26. Composition escalation is session 13; calibration M3.
- [x] 1.7.4 *(PR #51)* Speed control gains 8× (the frame loop already tolerates it: 32 ticks/frame ≈ 96×).
- [x] 1.7.5 *(PR #54)* Refinery card shows remaining deposit instead of kills.
- [x] 1.7.6 *(PR #51)* **A used consumable frees its slot.** It currently occupies one forever as `[--]` — a bug, not a design. Touches the held-relic arrays, so replay indices and `hashState` move with it.
- [x] 1.7.7 *(PR #51)* **Cut the `foundry` relic** and its now-dead `offVeinScrap` engine knob (Daniil: a relic that deletes the Refinery's siting decision). Dead knobs mislead the next context — see the `isPathable` correction.
- [x] 1.7.8 *(PR #54)* Mining 10× slower, landed with finite deposits.

**M1 exit gate: PASSED 2026-08-16.** *"The game is fun now, it’s just very
unbalanced and with quite a few holes still."* Phases 5 and 7 remain as M1 work,
but the question the milestone existed to answer is answered.

---

## M2 — A complete run *(decomposed 2026-08-16 when M1 exited)*

**Remaining M2 work by session** *(2026-08-17, revised after playtest 8)*:
2.10, 2.13, 2.14, **2.19, 2.20** → session 17 (legibility, truth, worker) ·
2.3, 2.4 absorbed by 4.19–4.21 in session 18 · **2.21** → session 19 (map
agency) · 2.12 (D8), 2.8 → session 20 (naming, then combat identity) ·
2.7, **2.22** → session 21 (relic economy + loot tables) · 2.5 spills into
sessions 20 and 23–24 · 2.1's remainder (board scale, front escalation, threat
levels as data) rides with 5.5 · **2.18 (Tile Smith overlay authoring) is now
scheduled** — it joins 2.21 in session 19, since both rework the tile format.

- [~] 2.1 *(PR #54, first shaped pass)* **The difficulty arc**: the run ENDS — finalWave 20 (lab-chosen), THE CORE STANDS victory, WAVE X/20; composition escalates in kind (weighted picks), every 5th wave carries an elite surge, Juggernaut anchors the late game. Remaining for M2: full board scale, front escalation, threat levels as data.
- [ ] 2.2 ~~Draft flow between tiles~~ **CUT 2026-08-16** — a survivor of the pre-pivot design that should have died with player tile-laying on 2026-08-15. Replaced by relic pool expansion on the Phase 6 machinery.
- [ ] 2.3 Save/resume (must serialise relic state + the input log); run summary screen listing the relics the run was built on.
- [ ] 2.4 Ore banking → persistent meta store; relic pool unlock set persisted alongside it.
- [ ] 2.5 +4 towers, +~8 enemies, +relics (content, on the proven pipeline).
- [x] 2.6 *(PR #54)* **Finite ore deposits**: veins dealt at generation (30–90, tier field live-but-tier-1), refineries draw down and stop, spent cells revert to ground, gold-speck density tracks remaining richness, deposit readout replaces refinery kills. Mining 10× slower (1.7.8). Prospected rocks carry hidden vein sizes. richness + quantity per ore cell set at generation, Refineries draw down and stop when exhausted, spent veins revert to ground. Gold-speck density on the cell tracks remaining richness, so "where is the money" is answered by looking.
- [ ] 2.7 **Relic economy** (PRD §7.6): pool grown well beyond what one run can drain; **fusion** (several relics into one stronger) and **salvage** (trade back for Ore); a much larger share single-use; rarity weighting (D5). This is what makes more slots safe to add rather than trivialising.
- [x] 2.8 *(session 26, PR #132: kinetic/energy on every attacking tower, a resist entry per enemy applied before armour; card, strip and catalogue print it; `docs/lab/build-sweep-2026-09-05-types.md` — the first matrix was a nerf and was replaced; the ramp is ~3 waves harder than before, Daniil's knob)* **Damage types decide fights** (PRD §8): Kinetic/Energy become real via resistance and immunity, so no single tower answers every wave. The direct answer to "2-3 mortars demolish everything". *(2026-09-03: the trait table in `engine/sim/traits.ts` (D19) is where resistances slot in; the Mortar's dead zone (D22) and the reworked trees (D23) already take the edge off the mortar complaint.)*
- [x] 2.9 *(PR #61)* **Boon ground**: overlay cells (+range/+damage/+rate), folded after tiers+relics, corner-tint telegraph survives a standing tower, inspector names it. Threat bundles (Calm/Standard/Grim, `?threat=N`) shipped alongside.
- [x] 2.10 *(session 17)* **Tower legibility** (PRD §5.4): full stat block, written descriptions on every upgrade choice (same card mechanic as relics), previews folding all live modifiers.
- [x] 2.11 *(PR #57)* **Prospecting rework**: unlock dropped, 25 scrap + 600 ticks for everyone, PROSPECTING n% bar; Survey refineries accelerate nearby jobs (to 4×) and start free jobs autonomously.
- [ ] 2.12 **The naming pass** (PRD §13, D8): printing-trade vocabulary across towers, enemies, upgrades, currencies. Before any art.
- [~] 2.13 **UI infrastructure** *(session 17: scrollable panel (wheel, click-safe regions) and square relic slots shipped)*. Remaining: illustrated relic cards ride the art pass (6.7); hidden-tab behaviour (D7, the worker) took the pre-approved cut line to the head of session 18.
- [x] 2.18 *(session 19)* **Tile Smith overlay authoring** (playtest 5, item 7): `TileDef` gains optional `deposits` (x, y, amount, tier) and `boons` (x, y, boon, tier) beside `cells`, in the schema with regenerated types. The smith gains an **OVERLAYS mode**: clicking an ore cell cycles its vein (30/60/90/none), clicking ground cycles its boon (range/damage/rate/none, tier 1) — the preview shows richness as gold-speck density and boons as the board's own corner tints. Overlays are valid **by construction**: repainting the cell under one removes it. `canonicalizeTile` rotates overlays with the grid (proven live: a minted tile's vein followed its ore cell through canonicalisation); `validateTile` rejects a deposit off ore or a boon off ground. Mapgen honours authored overlays over its dice for those cells — the tile's word is law on the tile's land.
- [x] 2.14 *(session 17)* **Enemy readouts** (PRD §8): shields as a bracket around the glyph, destroyed separately from the body so any enemy may carry one; health and status effects as marks beside the glyph (braille is a candidate). No tooltips.
- [x] 2.15 *(PR #60)* **Generated tile library**: `tools/tilegen.mjs` emits port-encoded wiggly paths + junction tiles through the shared validator; 15 authored + 24 generated, regenerable deterministically; `gen_*` replaced wholesale.
- [x] 2.17 *(PR #60)* **Carve v3 — edge partitions + turning tunnels**: road pools keyed by partition; walks tunnel through occupied slots perpendicular (only when a partition tile exists — no tile, no move); shipped `twin_bend` proven dealt on real maps.
- [x] 2.16 *(PR #55, 2026-08-16)* **Roads that touch without connecting** — the full in-tile lane model (Daniil's call): 'r' as a second lane in the cell alphabet; connectors derive **directionally** (centre + inward continuation); border roads legal, orphan lanes rejected; the route is a **graph** (per-cell allowed-direction mask shared by BFS and the walk phase — enemies never lane-hop); Tile Smith lane brush + **ADD TO POOL** (localStorage pool, engine-revalidated on load, joins the generator). Found live: multi-lane tiles share boolean signatures with routing tiles, so the library index now demands a road-slot tile's crossings interconnect — connectivity stays by construction.

- [x] 2.19 *(session 17)* **Combat truth** *(playtest 8; session 17)*. Three related lies, all confirmed in the source 2026-08-17:
  - **Explosion radius drives everything.** `explodeRadius` already folds correctly through `effectiveStats` (base + tier mods), and AoE damage already uses it — but it is printed **nowhere** in the inspector, and the blast *visual* does not match it: the ring expands from 0.4 to r, and the ground-zero flash is a hard-coded ±2×±1 glyph box regardless of radius. So a Mortar upgraded from 1.2 to 2.5 cells kills wider and looks identical. Fix: one folded number consumed by damage, drawing, and the stat block, with the visual's peak extent equal to the true radius (PRD §5.5).
  - **Mortar is ballistic, not homing.** `roster.json` sets `homing: true` on the Mortar; it should commit an aim *point* at fire time and detonate there regardless of who is standing on it. Needs an "impact at a point" path — `impact()` currently requires an enemy — which is the same code the next item needs.
  - **A fired shot always resolves.** `projectilePhase` despawns a homing projectile outright when its target dies (`sim.ts`, the `!alive[t] || gen mismatch` branch). Unguided shots land where aimed; homing shots re-acquire. Today the damage is silently deleted.
- [x] 2.20 **Tile Smith cannot mint an unplaceable tile — by construction** *(playtest 8; shipped ahead of session 17)*. Daniil minted a "valid" tile the generator could never deal. Root cause: two predicates — `validateTileCells` accepted any lane deriving ≥1 crossing while the generator demanded through-routing at index time, so a one-entry stub passed the first and failed the second. **Fixed with Daniil's entry-point rule, which superseded the dev's crossings framing:** an *entry point* is road touching an edge centre with the appropriate inward orientation (exactly what `deriveConnectors` computes); every road cell must have continuous road to some entry point, and **every entry point must have continuous road to at least one other entry point** — the Core being the licensed terminus. Valid entry counts fall out as 0/2/3/4; a one-entry tile is unrepresentable. Stated over road reachability rather than lane components, so it survives bridges and future road kinds. One function, consumed by the smith's verdict, the mint gate, the pool loader (stale invalid mints silently drop), the content linter and the loader. All 39 shipped tiles pass; the session-14 twin-stub boot-breaker and the screenshot stub are now impossible, proven by test and live in the smith ("✗ invalid — export disabled").
- [x] 2.23 *(session 19)* **Tile Smith: explicit segment brushes in a matrix** *(Daniil, playtests 9-11; REVERSED after the inference attempt failed)*. **Inference is abandoned and deleted.** The dev proposed neighbourhood-inference over Daniil's gesture idea and shipped it; it is structurally incapable of the one thing the road model exists for: **explicit segment types encode PORTS, while inference derives ports from adjacency - so any two adjacent lane-A cells necessarily merge.** Touch-without-merge (`|` beside `|`: no E/W ports, touching and separate) is unrepresentable by ANY adjacency rule. Daniil raised this at pushback time; the dev did not test the proposal against the requirement. It also guesses rather than obeys, which is the opposite of an authoring tool's job.
  **Shipped as Daniil's 4×4 matrix** (from his mock review, 2026-08-18): rows `F T 7 |` / `E X 3 -` / `L U J B` / `G R O C` — the road block composes into a box figure with straights and the bridge in the fourth column, terrain beneath; two gutter labels ("roads", "terrain"), no per-type descriptions. Brushes are **plain buttons with schematic box-drawing glyphs** (`┌ ┬ ┐ │ …`, `╫` for the bridge); the actual sprites live in the tile preview, which renders through the shared `drawTerrainCell` *(a first pass made the palette itself a sprite render — reversed on Daniil's correction: buttons are buttons)*. **Ground is the default brush**, drag-paint with the held brush, per-change undo (button + Ctrl+Z), hover names each brush. **Cell nomenclature migrated in the same change** (Daniil): crossroads `R`→`X`, rock `K`→`R`, `r`→`B` the *bridge* — which is a real mechanic, not a rename: see 4.9. All assets crawled (engine, library, tilegen, schema, view, tests), and the localStorage minted pool letter-migrates v1→v2 on load, because under the new alphabet an old road `R` would silently reinterpret as rock. Golden hash unmoved through the rename.
- [x] 2.26 *(session 19)* **Validity: no roads to nowhere** *(Daniil, playtest 11)*. The entry-point rule (2.20) admits a **dead-end spur**: a stub hanging off a through-road reaches an entry *via that road*, so it passes while visibly leading nowhere - the tile in Daniil's screenshot was declared valid. Tightened to: **every road cell must lie on a route between two distinct entries** (or between an entry and the Core), implemented as iterated leaf-pruning — strip road cells that are neither terminal nor linked to two surviving road cells; cycles survive (a loop is drivable), stubs cannot. Verified against every shipped tile before adopting (all pass, `twin_bend` included); the spur from Daniil's screenshot is a committed rejection fixture, and the smith names the exact dead-end cell.
- [x] 2.24 *(session 19)* **Rotation-canonical tiles** *(Daniil, playtest 9)*. A tile and its 90° rotations are ONE tile. The generator's index already resolves and deals all four rotations; the missing dedup shipped at pool level: `canonicalCells` (lexicographically smallest rotation) in the engine, tilegen collapsed from eleven per-signature families to **four shape classes** (24 generated → 8 canonical), the minted pool canonicalises on add (a rotation-twin replaces, never joins), and the index skips rotations whose resolved cells repeat, so a symmetric shape is no longer weighted twice. Behaviour-invariant for the golden replay: its fixture pools deduped only true duplicates.
- [x] 4.26 *(fixed same day)* **A blast reads as a blast** *(Daniil, playtest 9)*: flash disc = full kill radius decaying as the wave leaves; shockwave ring travels to 1.5·r, smoke-only beyond the kill line. Nothing inside the flash survives the lie test, nothing outside it dies.
- [x] 2.25 *(fixed same day)* **Health pips carry colour** *(Daniil, playtest 9)*: 4 glyph steps × 3 colour bands (green/amber/red) = 12 readable states; colour presents, nothing branches on it (invariant 10).
- [x] 2.21 *(session 19)* **Basic and special tiles** (PRD §4.8) *(Daniil, 2026-08-17)*: basics (the shipped library) stay infinite; **minted tiles are the special pool** — finite, chosen, and **guaranteed**: road specials claim a carved slot whose partition they express, roadless specials claim a fill slot, and specials are excluded from the random pools (they appear because chosen, exactly once). Run setup gained the **visual loadout picker** — minted tiles drawn through the shared `drawTerrainCell`, framed in accent when loaded, 3 slots (the economy is 7.5) — plus threat selection and START as separate acts. **Failing loudly**: generation rerolls seeds for a fresh carve (bounded), then surfaces the tile by name on the setup screen; a special is never silently dropped, and a special carrying the Core is refused outright. **The loadout is generation input, so it rides the save** (defs, not ids — the pool can change between save and resume): `RunSave` v2 with v1 migration for both run and meta saves; proven live — save, reload, continue, and the special is at the same cells. The worker builds each run's library as basics + loadout; the main thread's view library mirrors it.
- [~] 2.22 **Loot tables + void chests** (PRD §7.7, §4.9) *(Daniil, 2026-08-17)*: weighted outcome lists as content, rolled on a named stream at claim time so they ride the input log; sources reference a table by id instead of carrying payout code. **Loot tables shipped 2026-09-03 (design round 1, PR 3)** — `loot.schema.json`, `content/assets/loot/tables.json`, the `loot` RNG stream, `Sim.openCache` rolling `rock_cache` / `boss_drop`; caches (D21) are the first consumer. **Remaining:** void chests surfacing and sinking on a timer as the second consumer.
- [ ] 2.27 **The backbone reassessment** *(Daniil, playtest 16 — "pile of patches" verdict; session 20, agreed as a fresh-context session)*. The map generator is ~nine sequential passes, each a playtest response, none written against a shared specification — playtest 16's bugs are all pass-interaction failures. Scope, in order: **(a)** a written generator SPECIFICATION — Daniil's six rules (one core near center; specials guaranteed; all roads entry→core; exactly one route per entry, no loops; entries may move/appear/disappear during generation; void only >3 from road) plus the deal-phase guarantees (authored overlays, boons on ground only, ore floor, caches) — with every invariant **checked in one place at the end**, not implied by pass order; rebuild constraint-first where the pipeline cannot satisfy the spec cleanly. **(b)** the worker lifecycle (init/resume/save/genError) as an explicit state machine — "new run" provably yields a fresh sim or a surfaced error, never a silent fallback to the old one. **(c)** deterministic run/map identity designed (seed+loadout+modifiers → a shareable code; URL seeds rejected by Daniil as non-viable for a roguelite). **(d)** playtest 16's three bugs (boon-on-void, dropped bridge specials, phantom resume) written as named regression tests against the spec BEFORE the rebuild, so the redesign provably kills them. Gate: spec committed as a doc; all invariant checks and the three regression tests green; Daniil generates and plays loadout-heavy runs without a defect list.
  **Session 20 (2026-08-19) progress:** spec conversation held; rules re-examined against the code, corrected by Daniil (D11–D16), and committed as **ARCHITECTURE §12** with `verifyMap()` checking every invariant in one place (PR 1). Amended plan, approved: **(1)** spec + verifyMap + measured baseline ✓, **(2)** road-half rebuild (carve/anchors/cell-denominated paths), **(3)** terrain+deal-half rebuild (void curve, ore bias, caches, authored-boon enforcement), **(4)** worker lifecycle + map-in-save + phantom-resume/dropped-specials regressions, **(5)** run code. Baseline measured: the old generator's *output* passes every checkable invariant across 145-map sweeps (tunnels included); the violations live in the authored-boon hole (pinned as an `it.fails` regression), the process rules (relaxation ladders, joint availability), and the slot-denominated knob.
  **PRs 2–5 built and verified the same session:** **(2)** carve rebuilt constraint-first in `engine/mapgen/carve.ts` — cells-per-entry floor by construction (binds anchor arms too, per Daniil), relaxation ladders deleted, availability gated at tunnels/branch-starts/joints; **(3)** terrain+deal to spec — D14 drawn void curve (`voidShareTarget` rides the map), D11 enclosure pass deleted, D12 floor deleted, caches uniform, authored overlays refused loudly, `verifyMap` wired into every generation; **(4)** worker lifecycle as a transactional state machine (`workerRuntime.ts`, testable in Node) — init yields exactly ready|genError, `playing` begins on ready, RunSave v3 carries the map (resume never regenerates), the three playtest-16 bugs are named green regression tests; **(5)** displayed run code (`AD<genver>-<seed>-<threat>-<loadout hash>`) on pause and summary, copyable. Golden hash moved twice with reasons (carve, terrain). **All merged 2026-08-19/20: #88 (spec+verifyMap), #89 (carve), #93 (terrain+lifecycle+run code, 3-in-1 after the stacked-squash orphaning), #94/#95/#96 (playtest rounds 19–21: route-uniqueness law, special-shape law, 5 slots, paging, mirror dedup, minted deletion).** 167 tests green. **Gate remains open: Daniil generates and plays loadout-heavy runs without a defect list — his verdict.**

- [x] 2.28 **Session 21 (2026-09-03): the audit, the hygiene round, design round 1** *(PRs #98–#103)*. A fresh-eyes audit of every package (engine; view/render/app; content/harness/tools/CI) and a design review of the game as a player. **Hygiene (#98):** seven live defects — blank Latin-1 glyphs in the atlas made every HUD separator invisible (atlas fixed at the root, a harness test scans UI source against the font); stale snapshot across `ready` (double-banked ore); meta saves versioned by the run format (banked ore reset on v2→v3); `?threat=abc` crash; `sellTower` unbounded; empty-wave-1 roster crash; "press R" lie. **Design round 1** — Daniil's eleven items with his amendments, decisions **D17–D23**: (1) pacing — launch-to-launch wave clock, CALL NEXT WAVE with a Scrap bonus, wave 1 waits for the call, next-wave preview, boss waves every 5th and final, the `L` offset live, traits as rules (#99); (2) relics — `stackable` per relic, escalating draw/reroll prices from 50 Ore, pool 10→16 with the first consumables (#100); (3) caches from prospected rock and bosses, opened free, contents from **loot tables** as content (#101, 2.22 half-shipped); (4) minimum range and the range drawn as a filled disc with its hole (#102); (5) every tower fork reworked into two roles, nine new engine knobs (#103). **Gate (open, Daniil's):** a Standard run with the eleven items gone; a 14-variant lab sweep with no path winning every wave (the sweep is not yet written).
- [x] 2.29 **Geometry migration: 8×5-glyph cells** *(approved 2026-09-03, option 1; SHIPPED 2026-09-04, session 22, PRs #105–#109, D24)*. Sprite format v2 (states by choice path or cell letter, frames, variations, bgInk) and `tools/import-sprites.mjs` for Daniil's generator studies (four tower colour rules ported; roads mapped by `ROAD_ORDER`) → the view net (`TermSurface`/`TextTerm`, golden-text tests for terrain, board, HUD) → the flip (cell from `grid.json`, board from the viewport, three literals gone, `tileCapacity` paging) → roads from sprites (variation by position hash, graph kerbs over art) → the variant sweep (`tools/sweep.mjs`, `docs/lab/sweep-2026-09-04.md`). **Not done:** ground/rock/ore/Core/water sprites (his art), enemy sprites, terminals rebuilt per run, the retune the sweep proposes. Original plan text follows. Cells become 8×5 glyphs = 40×40 px (spleen 5×8), square. Tiles stay 5×5 cells; the board shrinks to fit the viewport (≈8×5 tiles beside the HUD at 1920 wide), `BOARD_SLOTS` becomes viewport-derived. Order: commit `tools/art` (ignore `out/`, `__pycache__`; `*.xp binary`; decide `vendor/fonts`); a lint that a sprite's `cell` equals the view's cell (today a mismatch crashes); flip `CELL_W/H` and fix the three row/column literals (bridge deck rows, cache/entry markers, fallback art); name the 2× HUD scale once; board size; expanded placeholder sprites until Daniil's JSON sprites arrive, then the importer; retune the glyph-aspect constants (ring bands, blast band, beach depth, terrain mark density); lab re-sweep and threat retune for the smaller board. `SAVE_VERSION` and the golden hash move.

- [x] 2.30 *(session 24, PR 2 — carve v4; `docs/lab/mapgen-sweep-2026-09-05.md`: zero failures and zero rerolls on every board × loadout, coverage 0.8–0.9, lanes balanced without specials and honestly reported with them)* **The board fills** *(Daniil, 2026-09-04/05; PRD §4.3.1; decision D28)*. The carve rewritten for the viewport-sized board: specials placed first as fixed nodes; the tree grows from the Core to a coverage target drawn on the map stream (~90% of land slots); every dead end is an entrance (leaves only on the border; entry count emergent within the threat's range; the per-entry floor still binds); **lane lengths balanced** to within a band of the longest where the board allows; void near zero. The spec moves in ARCHITECTURE §12 with the code, `verifyMap` gains the coverage, leaf and balance rules, and the 2026-09-04 mapgen probe (boards × loadouts × seeds: fails and rerolls) becomes a permanent sweep under `tools/`. **Measured before**: one special always fits; five fail 30/30 on 7×5, 7×4 and 6×4; three shipped specials need up to 46 rerolls at 6×4. **What it makes expensive if wrong**: lane lengths roughly double, and the D18 offset scales enemy health with them — difficulty must be re-measured on the new boards after, never before (a mixed-build lab, not the solo sweep).
- [x] 2.36 *(session 24, PR 4)* **The build sweep** — `tools/build-sweep.mjs`: mixed builds with an economy at the choke or spread, on the boards the game generates now; `docs/lab/build-sweep-2026-09-05.md`. Readings: the Standard ramp holds (a five-tower choke build reaches wave 19–23 on the 1080p boards; no further retune); choke beats spread by 4–7 waves; Hailstorm is a role problem, not a percentage (→ 2.37).
- [x] 2.37 *(session 26, PR #136: point-blank saturation — three full-damage shots at close quarters. The sweep cannot see a crowd role — survival is decided by brutes — so this is a design decision, not a measured win; `docs/lab/build-sweep-2026-09-05-eight.md`)* **Hailstorm as a role** *(from the build sweep, 2026-09-05)*: three homing shots at 60–75% trail Railbore by six to eight waves in a mixed build behind a Frost. The second branch of Bolt tier 3 needs a different job — full-damage volleys at short range, pierce, or a stacking slow — decided with the combat-identity pass (25), not tuned.
- [x] 2.31 *(session 26, PR #133: slows as entries with a source, one stacking rule — coldest wins, longest lasts — resolved into the hashed values; a cold mark per source and a frozen mark on the walker; Splinter's second blast drawn a beat later; the Frost's card states the rule. 2026-09-06, Daniil's item 2: the marks became the walker's GROUND - cold, ember, ice, split when two hold)* **Statuses visible, every effect source tracked, every rule printed** *(Daniil, 2026-09-05; PRD §8)*. Per-enemy status marks (slowed, burning, frozen…) beside the glyph; the sim keeps each effect with its source and a stacking rule per pair (Frost slow + Concussive slow is the named case); the Splinter relic's second blast is drawn and its damage explained on the card. Rides with 2.8 damage types in session 25.
- [x] 2.32 *(session 24, PR 6: `validate-content` warns per frame whose every glyph sits within 30 luminance points of its own background - today that is the cobble study's X tier and nothing else; promote to a finding once Daniil regenerates the study)* **Sprite contrast lint** *(session 23, from the road-sprite investigation)*. A sprite state whose glyphs sit under a luminance floor against their own backgrounds fails `validate-content`. The cobble study's X and B tiers shipped at ~6% contrast and read as flat cells; the lint would have said so at import.
- [x] 2.35 *(session 26, PR #135: every tower has a `coreBoon` folded like a tier on the cells touching the face and printed on its card — the eight gifts are in PRD §4.5; the Refinery may stand on plain ground there; Loadbearing still exists beside them, retiring it is Daniil's call)* **Cells next to the Core are precious** *(Daniil, 2026-09-05; PRD §4.5 — design intent, own session)*. With the Core a face at the east edge, at most four buildable cells touch it. The rules and the towers will make those cells the most valuable ground on the map: **every tower gets a unique boon when placed next to the Core**, not one shared multiplier. Replaces the Loadbearing relic's flat triple range once designed. Exact details are a design conversation before the new towers (25).
- [x] 2.34 *(session 26, PR #134: facing as replayed, hashed tower state; chosen on build toward the most road; ROTATE on the card and the R key; the corridor drawn instead of rings; the golden moved 1486502285 → 3921408197 for the two new hashed numbers)* **Tower facing** *(Daniil, 2026-09-05; PRD §5.5)*. A direction as tower state for line-shaped attacks (the laser): set on build, rotated on demand, saved and replayed as a choice. Radial towers show none. Prerequisite for 5.1's laser; built with 4.10 in session 25.

### Technical-debt register *(fresh-eyes audit, 2026-09-03 — "everything else later", Daniil)*

Verified findings not yet fixed, most material first. Each is a candidate for a hygiene round; none is a rule change.

- **Docs drift.** ARCHITECTURE §2 lists a repository layout that mostly does not exist (`engine/{enemies,difficulty,economy,meta,replay,run}`, `content/balance`, `render/config.ts`…); §10 says `ci.yml` is not built; §11 says the REXPaint pipeline is verified while `tools/art/README.md` says it is unproven. ASSETS.md describes a glyph-existence linter and a sprite-reference check that were never written, says no frames are authored (bolt.json has one), and carries 5×3/15×9 numbers. `PATH` ink resolves to plain white (`BoardView.ts`).
- **No view tests.** BoardView, HudPanel, OfferModal, effects, style have zero coverage; ARCHITECTURE §9's text-snapshot backbone has one golden (GLTerm's own). A ~40-line array-backed terminal double would let all of them run as Node golden tests — the net the geometry migration needs.
- **Engine sim tests never walk a directional road**: all fixture libraries are omni-`X` worlds; the shipped library is bends and straights; the golden hash pins a world the game never plays; the bridge walk has no sim-level test.
- **Pages deploys `main` without running tests** (`pages.yml` is not gated on `ci.yml`); no branch protection.
- **Three BDF parsers** for one glyph order (`build-fonts.mjs`, `glyphs.py`, `fonts.py`); two dead atlases (`glyphset.json`, `glyphset-cp437.json`) and `vendor/unscii` ship for nothing; `ASSET_V` is duplicated in `main.ts` and `tilesmith.ts`.
- **A schema-valid sprite can crash the view**: tier keys other than `"0"` (`tiers['0']` is the only one read) and a `cell` that differs from the view's. Two one-line linter rules.
- **God files**: `sim.ts` ~1,700 lines / six subsystems; `main.ts` five modules' worth; `tilesmith.ts` duplicates the view's glyph scale, asset version, boon tints and cell vocabulary; `HudPanel.render` is one 300-line method.
- **Duplicated primitives**: `CENTER` defined five times, direction tables four ways, the slot-distance BFS three times, the strand-edge rule twice (`tile.ts nodeStep` / `flow.ts strandStep` — a divergence would make validity and routing disagree).
- **`verifyMap` runs inside a 25-attempt retry**; nothing measures attempt count, so a generator failing 24 in 25 passes every sweep.
- **Two placement predicates disagree** (`canBuildAt` vs `canBuildDefAt`): hover says buildable on ore for a Bolt, the build silently returns false.
- **Game rules in `app`**: `THREAT_LEVELS` with `hpGeometric`/`waveSeconds` in `protocol.ts`, `coreHp` and the difficulty literals in `workerRuntime.ts`; ARCHITECTURE puts those in content.
- **`hashState` truncates fractional lanes** (`u32` on scrap/coreHp) — safe only while content keeps them integral (Bounty Board rounds for this reason).
- **Terminals are created once per session** (`main.ts`): a save made for another board size is refused instead of the board being rebuilt on `ready`.
- **The loadout picker draws tile previews at the 2× UI scale** (400×400 px each at 8×5): about three fit a page. A 1× preview surface inside the modal is the fix.
- **The lab's analytic model** knows nothing of volleys, pierce, min range or the wave clock; only the headless runner and the sweep are trusted.
- **The lab's gate tolerance sits at 8 waves** after two geometry changes; the build sweep (2.36) is the ruler now and the analytic gate should be retired or re-derived.
- **Entries are many on a filled board** (8–12 on 7×5): a knob question (`COVERAGE_TARGET`, `MAX_LANE_SHARE`, `EXTRA_WALKS`) for Daniil's playtest, not a defect.
- **The strip is cramped below seven tiles wide**: at 6×4 the wave columns truncate; a second row or a narrower button would fix it.
- **The 'inline' lab placement has no distance term**: the cell with the most road under a Laser's corridor can be far from the choke, so the first laser watches an empty run (`docs/lab/build-sweep-2026-09-06-instruments.md`). Session 28's sweep PR.
- **The Tile Smith is still its own page**, not a spec on the shell's terminal (session 27 had no room).
- **Full keyboard operation** (4.24's second half): the menus take clicks; the board takes keys for speed, sell, rotate, grid, the wave.
- **The Loadbearing relic's flat triple range** stands beside the Core gifts (2.35); retiring it is Daniil's call.
- **The Laser wears an arrow** for its facing; a per-facing art slot in the sprite format waits for the art agent's need.
- **The offer modal shows relics as text** while their icons exist (6.7); the card should draw the icon.
- **The derived attack placeholder paints the whole tower** in the flash colour for 60 ms; loud on a Gatling. The art agent's sequences replace it; until then a per-role brighten would be kinder.
- **Misc**: `role()` bypassed by ~16 colour literals in view; `loadRun()` parses the whole save every frame from `menuSpec()`; `pagehide` autosave cannot complete its worker round-trip; `towers[]` never recycles sold slots; `HudPanel.scroll` not re-clamped on render; Tile Smith Ctrl+Z hijacks text inputs; WIPE DATA leaves the minted pool; `clearMintedTiles`, `lanesJoin`, `streamFromState`, `FILL_RADIUS` dead; stale comments in `replay.ts`, `verify.ts`, `mapgen.ts` header; the lab's analytic model knows nothing of volleys, pierce, min range or the wave clock.

## M3 — Trustworthy difficulty *(sequenced after M4/M5: calibrating before the
content and the shell settle would produce curves we throw away)*

- [ ] 3.1 Real bot policy; calibration runs across seed corpus.
- [ ] 3.2 Calibrated curves committed as data; `balance.yml` CI gate.
- [ ] 3.3 Human offset measured from Daniil's recorded replays.
- [ ] 3.4 Unwinnable/trivial seed detection across ≥500 runs, measured with the relic layer held fixed — trivial-by-relic is the feature, trivial-by-map is the defect (PRD §9).
- [ ] 3.5 Tech tree stage 1 (~5 nodes); in-game autopilot.
- [ ] 3.6 **Calibration II** *(Daniil, 2026-08-17; session 27)*: re-baseline after meta progression — tech-tree multipliers and pool unlocks move player power underneath the calibrated curves, so `balance.yml` is re-fixed and the seed corpus re-swept at several tree states. Gate: no trivial or unwinnable seed at any tree state the player can actually hold.

## M4 — The shell, and what the player sees *(it becomes a product)*

*(Was "M4+ Expansion", a bucket rather than a plan — Daniil, 2026-08-16. The
shell is sequenced BEFORE calibration and art because it is what makes external
playtesting possible at all: today a stranger handed the URL gets a debug
harness with no context.)*

**Split across sessions 16, 18 and 21** *(2026-08-17)*: 4.1 opens session 16,
4.15–4.22 are session 18 (the semi-stable alpha marker), 4.23–4.24 are session
21. 4.9–4.14 are presentation items that ride with the art pass, sessions 28–30.

**IDs 4.1 and 4.9–4.14 were referenced by the request index above but never
written as entries** — found 2026-08-17. The text below is recovered from the
sources that cite each ID (PR bodies #44/#46, PRD §13/§14, WBS 6.2/6.3 and the
roadmap's own "what remains late" paragraph) and is marked where recovery was
partial. IDs 4.2–4.8 were never assigned; 4.8 was the offset-connector proposal,
withdrawn before it got an entry (PRD §14). Do not reuse any of these numbers.

- [x] 4.1 **Effects & animation engine** *(session 16; requests 13, V4, V5, V10)*. The sim→view event pipeline generalised from `Sim.pulses` — `Sim.events`, a typed capped list (pulse/impact/death/breach/build/sell/waveStart/reveal) with monotonic seq, never read back, never hashed. View-side `EffectsLayer` with tick-anchored lifetimes: mortar blasts (flash→debris→smoke), hit sparks, death puffs, breach flashes, construction dust, the pulse ring migrated from BoardView. **Frame model in the sprite schema** (`frames` + `frameMs`, format-agnostic plain grids; codegen rerun, linter checks every frame's dims) with the four shipped towers as first sprites — idle cycles on the wall clock, phase-offset by board position. Projectile trails from exposed `projVX/VY`. Terrain drift (hash-selected ~18% of ground/Core glyphs re-roll per slow step) and **void-as-water** (sparse drifting ripples, `terrain.water.*` roles). **Reduced motion shipped with it** (PRD §15.4): module flag defaulting from `prefers-reduced-motion`, ambient stops entirely, gameplay feedback degrades to static marks; settings toggle remains 4.22. Golden replay hash byte-identical — the proof none of it touches the simulation.
- [x] 4.9 *(session 19 — pulled forward by Daniil at the smith review)* **Bridges** — road crossing road without connecting *(request 9)*. The `B` cell is a true bridge: **two independent strands in one cell** (east-west deck, north-south underpass) that cross and never merge. "Tile content plus a draw rule" was wrong — it took engine work: the route graph gained **strand nodes** (validity floods, dead-end pruning and `tilePartition` judge each strand separately; the flow field carries `nodeDist` per strand; the walk crosses straight, never turning off the deck — direction of travel IS the strand, since both strands are straight). The carve now accepts **straight tunnels** gated on a bridge-partition tile existing in the pool — no bridge tile, no straight tunnel, so bridge-free pools behave exactly as before and minted bridge tiles genuinely appear. Distinct sprite: a plank deck with rail hairlines, unmistakable next to the omni crossroads. Bridge partition key `e.w|n.s` proven distinct from a crossroads' `e.n.s.w`.
- [ ] 4.10 **Attack shapes** (PRD §5.5) *(session 19; request 11)*: chain, beam along a run of road, arc/wedge AoE. Needs the effects engine (4.1) to be legible, which is why 4.1 comes first.
- [ ] 4.11 **Per-upgrade tower visual identity** *(sessions 28–30; requests V7, V11)*: the 14 defined tower forms read as distinct. Cited by 6.2. The open question D3 was closed as unanswerable in the abstract — it is answered here, with sprites in front of us, as "what compositional rule makes 14 variants legible".
- [ ] 4.12 **Unrecovered** — requests V8 and V9 mapped here, and the item text was lost when FEEDBACK.md was deleted (PR #48) without the numbered items being copied into the WBS entries. Visual, from playtest round 1. **Ask Daniil to restate V8/V9 at the next playtest, then write this entry or retire the ID.** Recorded rather than silently dropped: an untracked request is how scope quietly shrinks.
- [ ] 4.13 **UI art pass** *(sessions 28–30; requests V1, V2)*: illustrated relic and upgrade cards, panel chrome. The structural half (scrollable panels, larger card geometry) is 2.13 in session 17; this is the art that fills it. *Reconstructed from the V1→2.13+4.13 split — confirm against V1/V2 when they are restated.*
- [ ] 4.14 **Enemies drawn wider than one cell** *(sessions 28–30; request V12)*: a boss drawn three glyphs wide keeps a one-cell footprint. Visual size yes, mechanical size no — the mechanical version is rejected in PRD §14, and this entry is the half that was accepted.

- [x] 4.15 *(session 18)* **Screen stack** in the view — screens push/pop, board renders beneath where it should. Generalises the relic-offer modal rather than duplicating it. No screen owns game state.
- [x] 4.16 *(session 18)* **Title / main menu**: new run · continue · workshop · settings · how to play.
- [x] 4.17 *(session 18; threat pick + seed pin via URL; loadout arrives with 2.21)* **Run setup**: threat level, optional pinned seed, chosen starting loadout later.
- [x] 4.18 *(session 18)* **Pause overlay** and an explicit paused state (pairs with the Worker, 2.13).
- [x] 4.19 *(session 18)* **Run summary screen** — what killed you, which wave, what you built, relics taken, Ore banked. A designed screen: it is the moment that produces another run or ends the session.
- [x] 4.20 *(session 18)* **Persistence** (PRD §15.2): meta state (Ore, unlocks, history, settings) in localStorage; run state as seed + input log (**a save IS a replay**). Schema versioned, migrate-or-say-so, never wipe silently.
- [x] 4.21 *(session 18)* **Save export / import** — a file. Cheap, moves progress between machines, and gives us reproducible bug reports for free.
- [~] 4.22 *(session 18: reduced motion, export/import, two-click wipe)* **Settings screen**. Remaining for session 22: colourblind palette, text scale, keybinds.
- [x] 4.23 *(session 27, PR #142: three first-run prompts in the column - build, call the wave, relics and prospecting - until the third wave is out; the meta save remembers; settings show them again. PR #141: HOW TO PLAY is the codex - every tower, enemy and relic on pages from the catalogue's source)* **Onboarding** (PRD §15.3): contextual first-encounter prompts, a How-to-play screen, gentle opening waves. No forced tutorial.
- [~] 4.24 *(session 27, PR #142: the colourblind palette as a role override set - enemy kinds, boon types, the hp pip apart without red and green; HUD text scale 1x/2x; the key list on the settings page. Full keyboard operation of the menus and the board remains)* **Accessibility** (PRD §15.4): colourblind palette values, full keyboard operation, reduced motion honoured by the effects engine, HUD text scale.
- [x] 4.25 *(session 17)* **World motion rides sim time, UI motion rides the wall clock** *(Daniil, playtest 8; session 17)*. Session 16 put terrain drift, water and tower idles on raw wall-clock `performance.now()`, so the world keeps ambling at 8× and keeps moving while paused — while the effects layer, in the same session, was deliberately tick-anchored on the argument that "an honest pause shows a stopped world". Both halves cannot be right. Fix: world ambient advances on a speed-scaled accumulator (freezes at pause, 8× at 8×); telegraph breathing and preview pulses stay on the wall clock, because the interface is not part of the world (PRD §13).

- [x] 4.30 *(session 25, PR #124)* **The catalogue** *(Daniil, 2026-09-05: "a table of all relics and what they do, all enemies and their abilities, so I can see what we have without playing")*: `docs/CATALOGUE.md` rendered from content by `tools/codex.mjs` between markers (towers with trees and DPS, enemies with traits as rules, relics), CI fails on a stale copy; the PROPOSED tables outside the markers are his request queue.
- [x] 4.31 *(session 25, PR #125)* **Sprite kinds and placeholder art** *(Daniil, 2026-09-05: "you generate the sprites that are not there yet... what you make will be reworked by another agent")*: `kind` (tower, terrain, enemy ≤5×3, relic 4×3, face) with a cell rule per kind; `tools/placeholder-sprites.mjs` writes the seven walkers, sixteen relic icons, the Core face and (#127) the two new towers' fifteen states from art in the script; the view draws walkers centred on their position, icons in slots, the face from its sprite.
- [x] 4.32 *(session 25, PR #123)* **Three strip fixes** *(Daniil, 2026-09-05)*: the selected button keeps its plate (a `>` and the name in accent); eight button slots with `short` names, spare slots as empty frames; the Core column is buildable ground around the face.
- [x] 4.27 *(session 24, PR 3: `view/hud/StripPanel.ts`, a third terminal under the board at the HUD scale - the roster as sprite buttons, grey when unaffordable; this wave and the next with traits; the Core card with its slots and actives, always; golden text test)* **The bottom strip** *(Daniil, 2026-09-04/05; PRD §13)*. The band under the board becomes the second panel: this wave and the next by enemy type with each type's specialty in a phrase; the active abilities; **build buttons drawn with the towers' own sprites** — full colour when affordable, grey when not, and shaped like buttons. The HUD column keeps vitals, the selection card and upgrades. Layout derived from the viewport like the board (`boardSize.ts` grows a strip height).
- [x] 4.28 *(session 24, PR 5: a viewport-sized terminal over everything carries the title, setup, loadout, how-to, settings and summary pages; the title is a designed page with the four towers as its hero row and a caption; the pause overlay and the relic offer stay on the board; the Tile Smith is still its own page)* **The shell owns the whole screen** *(Daniil, 2026-09-05; PRD §15.1)*. A full-screen title/loading page with the menu, sized to the viewport, not a plate over the board; the screen stack (4.15) becomes a screen SYSTEM whose pages — smith, tech tree, settings, summary, the board itself — share sizing, chrome and input. The Tile Smith moves in from its own HTML page.
- [x] 4.29 *(session 24, PR 6: `boon.range` / `boon.damage` / `boon.rate` palette roles; an empty boon cell shows corner glyphs in that colour, a built-over one keeps the background only; mixed boon ground still undecided)* **Boon ground wears its colour** *(Daniil, 2026-09-05; PRD §4.7)*. One background per boon type; corner glyphs on an EMPTY boon cell so the eye finds it; background only once built over. Mixed boon ground (two effects, one cell) wanted, rule undecided — propose one with the sprite in front of us.

**M4 gate: a stranger opens the link, starts a run from a menu, loses, reads why,
and starts another — with progress surviving a reload.**

## M5 — Content completeness

- [x] 5.1 *(session 25 PR #127 the Tesla Coil and the Missile Rack; session 26 PR #134 the **Laser Lance** (a fourth shape, `beam`, with facing) and PR #135 the **Bastion** (a support aura) — **eight towers**, each with a tree, a gift next to the Core and a generated sprite. The short-range area tower is not built: the Tesla and the Mortar cover the shape. Balance: the lab cannot yet place a Bastion or aim a Laser — see the debt register)* Towers to **8+**, each with a full tier tree and a distinct attack shape. *(Amended 2026-09-05 from Daniil's list, PRD §5.3: a **tesla** tower with electric arcs; a **laser** through every enemy on a line of road, which needs facing (2.34); a **short-range area** tower; a **support** tower buffing its neighbours; a **missile battery** — several homing projectiles, very expensive. The earlier names are superseded; the real names wait for D8.)*
- [ ] 5.2 Enemies to **~14**, covering the trait matrix and both damage types with real resistances.
- [ ] 5.3 Relics to **~40**, weighted by rarity, with fusion recipes that make sense.
- [ ] 5.4 Tile pool to **~100+** via generation (2.15) plus authored specials.
- [ ] 5.5 Threat levels as data — the generator knobs bound into named difficulties.

- [ ] 5.6 **Single-use, high-damage relics** *(Daniil, 2026-09-05; PRD §7.8)*: a nuke or its kin in the consumable tier — one moment that turns a wave; loot-table weighted so it is a find, not a plan.
- [ ] 5.7 **Rarity with power, and relics you can replace, remove and combine** *(Daniil, 2026-09-05; PRD §7.6, §7.8)*: rare means stronger; a held relic can be dropped or swapped; combining makes §7.6's fusion concrete (recipes as content).
- [~] 5.8 *(session 28, PR 1: the passive pool and schema, six slots, a pick every second wave from three, folded into every tower like a tier plus econ knobs; the offer modal shows both offers in turn; the strip's passive row; the codex section and how-to pages; the golden moved for the hashed passive state. Sprites, set effects and replacing a held passive follow in PR 2-3)* **The passive layer** *(D26; PRD §7.8)*: permanent modifiers separated from relics, with many more slots. Built after D26 is decided.

**M5 gate: two runs do not resemble each other.**

## M6 — Presentation at scale

*(Deliberately after M5: authoring art for four towers and then again for eight
is the same mistake as authoring sprites before the animation engine.)*

- [ ] 6.1 Art round-trip **proof** (Phase 2 gate) — opens the art-polish block. Neither REXPaint tool exists yet (`tools/build-rexpaint-font.mjs`, `tools/rexpaint-import.mjs` — confirmed absent 2026-08-17). **RISK FORMALLY ACCEPTED by Daniil, 2026-08-17**, and his reasoning reframes it: *"REXPaint is just a way to improve graphics. If this tool doesn't work, we'll find another one — it will not make or break the project."* The dependency is on **some** authoring path, not on REXPaint, and 4.1's frame model is deliberately format-agnostic (plain grids in sprite JSON, nothing importer-specific), so swapping tools costs an importer and touches no schema, no content and no engine code. This is therefore a tool choice with alternatives, **not** an unverified foundation — the dev's "prove the path first" instinct misapplied a rule meant for load-bearing infrastructure (hosting, runtime, API). Art quality gets its own dedicated polish block regardless of which tool wins.
- [ ] 6.2 Full art pass: towers with per-upgrade visual identity (V11), enemies with trait markers, terrain, UI.
- [ ] 6.3 Effects at scale: every attack shape, impact and death authored against the engine from 4.1.
- [ ] 6.4 Biomes — palette and tile-pool variants per threat level.
- [ ] 6.5 **Minimal SFX** (Daniil, 2026-08-16 — PRD §16): impacts, builds, wave start, UI. Not music, not a mix. Includes sourcing and licence clearance, which is the part that is not free.
- [x] 6.6 *(session 19)* **The shoreline** (PRD §13) *(Daniil, asked twice — 2026-08-16 and 2026-08-17)*: a procedural beach band on every water cell's land-facing edges — sand grains dense at the waterline thinning seaward, an occasional surf ripple riding the drift, on a warm sand-dark band (`terrain.shore.*` palette roles, so a biome re-tint stays a palette swap). The mask comes from live neighbours per frame (land never becomes water mid-run). Safe by construction — border cells can never carry road. First-pass look; tuning is a taste call at the next playtest. **Art-pass follow-up (playtest 15)**: the gold sand palette reads as ORE — recolour the shore away from vein gold when the art pass tunes palettes (rides 6.2/6.4).
- [~] 6.7 *(session 25, PR #125: every relic has a 4×3 placeholder icon drawn in its slot in the strip and the column, from `tools/placeholder-sprites.mjs`; the art agent's replace them; the offer modal still shows text)* **Relic art at board-glyph scale** (PRD §13) *(Daniil, 2026-08-17)*: relics drawn as sprites in the *board's* 5×8 font rather than the HUD's 2× font — the smaller cell buys the detail that makes a relic read as an object. Needs the HUD to host a board-scale sub-surface. *(The **square slots** half is cheap and rides 2.13 in session 17; only the art waits for the pass.)*
- [ ] 6.8 **Smoothness via spatial phase** (PRD §13) *(Daniil, 2026-08-17)*: waves that travel across ground and water — each glyph's phase offset by its position — plus finer effect interpolation. **Explicitly not** "redraw less": the full board redraw is already well under a millisecond, so partial redraw optimises the wrong quantity. Recorded so a future session does not spend itself on the intuitive-but-wrong mechanism.

- [x] 6.9 *(session 25 PRs #125–#126 sequences and the attack look; session 26 PR #130 placeholder sequences in every sprite and a subtle fallback; PR #131 **positional interpolation** between snapshots on the world clock, never ahead of the sim — Daniil's go after the feedback)* **Animation engine, second pass** *(Daniil, 2026-09-05; PRD §13)*: enemies and projectiles interpolated between ticks (20 Hz sim, 60 Hz picture); idle cycles of many frames; **per-tower attack animations** — charge, shot, cooldown — as named sequences in the sprite format keyed to `Sim.events`, authored in the sprite editor. The frame model from 4.1 grows sequences; nothing in the sim changes.
- [ ] 6.11 **Smoothness, the remaining levers** *(from Daniil's round 25, item 4; the render clock is in)*. What Stone Story and Cogmind have that this does not, in order of cost: (a) **many-frame sprites at a fast cadence** — every placeholder has two frames at 360–900 ms; four to eight at 120–200 ms is the art agent's job (the brief says so); (b) **a particle layer on the world clock** — sparks, motes and trails as many small glyphs each moving one cell per frame at 60 Hz, instead of tick-anchored effects with a few glyphs; (c) **sub-glyph movement is impossible** in a glyph grid, so a walker steps a glyph at a time — at 0.06 cells/tick that is one step every two ticks horizontally and every four vertically; a faster world (more cells per second) or larger walkers reads smoother, and the vertical step (8 px) is the coarser of the two; (d) **the wall-clock idle cycle phase-offset** is right; the strip and HUD redraw every frame already. A session's worth, mostly (a) and (b).
- [x] 6.10 *(session 25, PR #126: the orbital as a column of light from the top edge then its blast (`strike` event); a freeze frosts the board's edges (`freeze` event); the Tesla's arcs (`arc`, #127))* **Ability graphics** *(Daniil, 2026-09-05)*: actives drawn as what they are — the orbital laser a wide bright beam from the top of the screen — through the effects layer.

**M6 gate: the board reads as a place, not a diagram.**

## M7 — Meta progression, full

- [ ] 7.1 Tech tree stage 2 — five disciplines, alternate tier-5s, capped economy nodes (PRD §11).
- [ ] 7.2 Relic pool and tile pool unlocks wired to the tree.
- [ ] 7.3 Run history and personal bests — the reason to open the game on day nine.
- [ ] 7.4 Daily challenges (a fixed seed per day) and replay sharing — both nearly free given determinism.
- [ ] 7.5 Tile Smith as an in-game meta feature (PRD §11) — the authorship endgame. **Features price the tile** (richer nodes cost more to mint), so the tool and the shop share one pricing function. Now also owns the **loadout slot economy** *(Daniil, 2026-08-17)*: the number of special-tile slots a run may carry is a tree upgrade, locked slots render as locked rather than hidden, and the minted-tile collection persists. The slot *mechanic* ships in session 19 (2.21) with a fixed count and everything unlocked; this is the economy on top.
- [ ] 7.7 **The tile shop** (PRD §11.1, resolves D9): special tiles bought with meta-currency; the pool becomes a **multiset of owned copies** rather than a set, so generation may place at most what you own; tier-N ore nodes purchased with tier-(N-1) ore. Appearance likelihood is a calibration knob, not a constant.
- [ ] 7.6 Tech tree stage 3, Potency — **optional**, and the trigger for `seeds × meta tiers` in CI.

- [ ] 7.8 **Monetization — the door stays open** *(D27; PRD §18)*: no build work; a checklist that nothing in persistence, identity or content licensing forecloses a Stone-Story-style paid layer later.

**M7 gate: finishing a run visibly changes the next one.**

## M8 — Beta hardening and release

- [ ] 8.1 Performance budget enforced: 60 fps at full board, bundle and asset budgets tracked in CI.
- [ ] 8.2 Browser support matrix; WebGL2 absence handled with an honest message.
- [ ] 8.3 Error handling audit — every throw reachable from a player path gets a recovery story.
- [ ] 8.4 Save migration tested across versions, including the corrupt-save path.
- [ ] 8.5 **External playtest** — strangers, no explanation offered, observed. The first evidence that is not Daniil.
- [ ] 8.6 Release process: versioning, changelog, tagged beta, a way for players to send a replay file back.
- [ ] 8.7 Licences and attribution verified (Apache-2.0; spleen BSD-2-Clause).

**M8 gate: the stable-beta bar in PRD §17.**
