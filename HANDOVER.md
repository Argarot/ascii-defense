# Handover — state as of 2026-08-18 (end of day; session 19 + four playtest rounds)

> **Updated once per working day** (Daniil). State and seams only; sequencing
> lives in the roadmap ledger, the checklist in the WBS, requests in the WBS
> request index. Anything restated here is a drift surface.

**Read order for a fresh context:** [CONTRIBUTING.md](CONTRIBUTING.md) →
[docs/PRD.md](docs/PRD.md) → [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) →
[docs/WBS.md](docs/WBS.md) → this file → the roadmap ledger's next open row.
The gitignored `POSTMORTEM.md` holds collaboration findings — **read its last
two entries before writing any code today.** End every working day with the
`wrap-session` skill (.claude/skills/wrap-session).

Live: <https://argarot.github.io/ascii-defense/> (verify cache-busted, always).

## Where the project is

Session 19 shipped in one day across PRs #79–#86: the **Tile Smith done
properly** (explicit brush matrix in Daniil's 4×4 layout — his verdict given:
"this is good"), 2.26 validity (no roads to nowhere), 2.24 rotation-canonical
pools, the **cell nomenclature migration** (`X` crossroads, `R` rock, `B`
bridge), the **bridge as a real mechanic** (strand nodes end to end — 4.9
pulled forward), **2.21 + 2.18 map agency** (minted tiles are the special
pool; visual loadout picker; guaranteed placement; overlay authoring), the
**shoreline**, **terrain-as-content** (glyph pools live in
`content/assets/terrain/appearance.json` — a graphics pack is content files
only), and four playtest fix rounds that ended in the **anchor rework**: road
specials place first as anchors, ONE arm per road segment joins the tree,
every other arm exits the board as a NEW entry. **No loops, ever** — the road
is a tree on every map, property-tested with anchors woven in.

**The day ended on Daniil's structural verdict (playtest 16):** *"we seem to
be drifting into 'pile of patches that becomes pile of garbage' territory."*
Three fix rounds on mapgen in one day is the tell from CLAUDE.md — the fix
was never the problem. **Patching is STOPPED by agreement.** Three fresh bugs
are deliberately UNFIXED and reserved as regression fixtures (WBS 2.27):
boon ground on void; a loadout case generating without its bridge specials
(no error surfaced); quit-mid-game → NEW RUN returns the paused game.

**NEXT: session 20 — the backbone reassessment (WBS 2.27).** It OPENS WITH A
CONVERSATION, not code: the generator specification first. Daniil chose a
fresh-context session over same-day triage. The gate is his: he generates and
plays loadout-heavy runs without producing a defect list.

## Fresh-context warnings (beyond CONTRIBUTING)

- **Do not fix the three reserved bugs piecemeal.** They are the
  reassessment's acceptance material; a quick patch destroys the evidence
  and repeats the exact failure mode that forced the pause.
- **The phantom-resume bug may explain the missing-bridges bug.** Suspicion
  (UNPROVEN, recorded as such): a worker crash mid-`init` leaves the main
  thread rendering the old sim with no error — "new game" then shows an old
  map, which reads as "my specials are missing". One candidate: `new
  TileLibrary()` throws on duplicate ids outside `newRun`'s try. Verify
  before believing; triage first, in the spec's terms.
- **Daniil's generator rules are the spec's core, verbatim from playtest 15:**
  one core near center; selected specials placed; all roads form paths
  entry→core; exactly one way per entry (no loops — "bloat the enemies
  ignore"); entries may move/appear/disappear during generation; basics,
  specials and the core may all be rearranged to satisfy the rules; void
  only >3 slots from road. He wrote these unprompted — ask him for missing
  constraints rather than guessing; he has them.
- **Run identity is a design question, not a URL.** Daniil rejected `?seed=`
  as the deterministic-map mechanism (a roguelite always has modifiers).
  The honest object is the run record (seed + loadout + threat + inputs),
  already in `RunSave` v2. Design the shareable form in the spec session.
- **A pushback and a chosen design are both claims — verify against the
  requirement before building.** Today's win: the handshake-lemma check
  between Daniil's option pick and the build reversed an insufficient
  design (anchor-first alone cannot host junctions on a tree). Today's
  loss, twice: fixing a bug other than the reported one because the
  reproduction used my artifacts, not the reporter's class (segment-built
  vs omni-built tiles). Reproduce with the REPORTER's artifact class.
- **Glyphs in UI strings are content against the font.** `»` does not exist
  in spleen and GLTerm silently draws nothing — that was an entire
  "selection has no visible effect" bug. CONTRIBUTING lists the missing
  Latin-1 set; check it before shipping any new UI marker.
- **readPixels without a synchronous draw reads a cleared buffer** — zero
  pixels, no error, and it nearly diagnosed a working feature as missing.
  `toText()` first, always.
- The golden replay hash moved once today with its reason recorded
  (`2003059284 → 185380119`, outer fill ring always places terrain —
  playtest 12). It is currently stable; it moves only with a stated reason
  in the same commit.

## Key seams for session 20 (the reassessment)

- **`packages/engine/src/mapgen/mapgen.ts`** — the whole file is the
  subject. Current shape: ~nine sequential passes (core jitter → tree carve
  with tunnels/availability gates → anchor placement with join/entry arms →
  slot-dist BFS → enclosed-void fill → void cap → ore floor → filler rolls →
  overlay/cache/boon deals). Each pass is a playtest response; pass ORDER
  carries unstated invariants — that coupling is what Daniil called the
  pile. The spec goes in front of it; a final single `verifyMap()` checking
  every invariant is the likely first artifact, run in tests AND at the end
  of generation.
- **`packages/app/src/simWorker.ts`** — `newRun` + the `onmessage` switch is
  the lifecycle to respecify: what may throw, where, and what the main
  thread hears in every case. Note `lib`/`loadout` are module-`let`s
  mutated per init — state that survives a failed init is exactly the
  phantom-resume shape.
- **`packages/app/src/main.ts`** — mode transitions live in `menuAction` +
  `worker.onmessage`; `'start'`/`'again'`/`'continue'`/genError are the
  paths the state machine must cover. `__ad.menu()/modalText()/setupState()`
  drive screens headlessly for verification.
- **Property tests to build on**: `mapgen.test.ts` already asserts the tree
  (`roadGraph` helper, |E|=|V|−1) with anchors, entry-count growth, void
  rules (far/outside/bounded), specials exactly-once, bridge anchoring.
  The three reserved bugs become new named tests beside these.
- **`packages/engine/src/tiles/tile.ts`** — `nodeStep`/strand graph, the
  validity floods and `canonicalCells/canonicalizeTile`; stable, tested,
  and NOT the reassessment's subject. Same for the view.

## Standing open items

- 4.12 — Daniil's playtest-1 visual items V8, V9 are **lost**; ask him to
  restate at a playtest, then write or retire the ID.
- Shore palette reads as ore (gold on gold) — art-pass note on 6.6.
- Relic rebalance for duplicate stacking (accepted as a later session).
- D8 naming mini-session (printing-trade lexicon) — now session 21.
- ASSETS.md not audited since D3 closed — audit in the art session.
- The REXPaint art pipeline is still **unproven**; both tools unwritten;
  6.1 opens the presentation block. Accepted risk, recorded on the item.
