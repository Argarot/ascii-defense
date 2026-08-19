# Handover — state as of 2026-08-20 (end of day; session 20 + three playtest rounds)

> **Updated once per working day** (Daniil). State and seams only; sequencing
> lives in the roadmap ledger, the checklist in the WBS, requests in the WBS
> request index. Anything restated here is a drift surface.

**Read order for a fresh context:** [CONTRIBUTING.md](CONTRIBUTING.md) →
[docs/PRD.md](docs/PRD.md) → [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) —
**§12 is the generation spec, the day's central artifact** →
[docs/WBS.md](docs/WBS.md) → this file → the roadmap ledger's next open row.
The gitignored `POSTMORTEM.md` holds collaboration findings — **read its last
three sections before writing any code today.** End every working day with the
`wrap-session` skill (.claude/skills/wrap-session).

Live: <https://argarot.github.io/ascii-defense/> (verify cache-busted, always;
the run code `AD1-…` on the pause screen is the build marker).

## Where the project is

**Session 20 delivered WBS 2.27, the backbone reassessment** (PRs #88, #89,
#93 [3-in-1 after a stacked-squash orphaning], #94, #95, #96): the generator
specification is **ARCHITECTURE §12** — a rule HIERARCHY (definitional →
topology → terrain → dressing; lower tiers win, higher tiers satisfied by
rearrangement, never by knob relaxation) — with `verifyMap()` checking every
invariant inside every `generateMap` call. The carve was rebuilt
constraint-first in `engine/mapgen/carve.ts` (cell-denominated per-entry path
floor that binds anchor arms too; availability gated at tunnels, branch
starts, and joints; relaxation ladders deleted). The worker lifecycle is a
transactional state machine (`app/workerRuntime.ts`, testable in Node): init
yields exactly `ready | genError`, `playing` begins on `ready`, and **RunSave
v3 carries the generated map** — resume never re-generates. Decisions
**D11–D16** minted; the run code (`AD<genver>-<seed>-<threat>-<loadout>`)
shows on pause/summary.

**Three same-day playtest rounds hardened it** (his numbered reports, all
closed): the **strand-level exactly-one-route law** (loops now cannot leave
the generator — the slot-level tree check was provably not the law); in-tile
road cycles refused at the authoring surface; the **special-shape law**
(`tileIsSpecialShape`: touching OR twin-segment ⇒ chosen, never rolled — so
plain maps have zero touch/crossing moments and tunnels self-limit to zero);
loadout slots 3→5 with a **paged picker** and **minted-tile DELETE MODE**;
**mirror-canonical asset identity** (gen_ns_4 was gen_ns_3's exact mirror —
removed; tilegen and a CI law now dedup under rotation AND reflection).

**THE 2.27 GATE IS STILL OPEN AND IT IS DANIIL'S**: he generates and plays
loadout-heavy runs without producing a defect list. Three rounds each
produced one; each was fixed and deployed same-day. Do not declare it.

## Fresh-context warnings (beyond CONTRIBUTING)

- **A rule that cannot cite its decision is a suspect, not a law.** The
  no-enclosed-void pass carried "(Daniil, playtest 4)" in a comment for
  three sessions; he never made that rule. Settled design arguments get
  D-numbers at birth (D1–D16 in the WBS); spec rules cite provenance.
- **Identity is a chosen equivalence relation.** Gameplay identity is
  rotation-canonical (2.24); ASSET identity is rotation+reflection
  (`mirrorCanonicalKey`); a "no duplicates" claim is only as strong as its
  relation, and a perceptual report needs a perceptual relation.
- **The minted pool is Daniil's browser's content** (localStorage,
  per-browser by design). The repo cannot reach it; validity heals what the
  rules refuse, DELETE MODE handles what they accept. Never promise behavior
  about a minted tile you have not seen — `tile_yn7vhz` passed validity
  despite "having a loop" to his eye; if he reports one again, get the
  EXPORT SAVES file before claiming anything.
- **Engine tests are hermetic by invariant, so real-content behavior needs
  `harness/lab/mapgen-sweep.test.ts`** — the shipped library swept through
  the app's exact knob derivation. The playtest found what hermetic shapes
  never could; keep that suite growing.
- **Windows PowerShell writes UTF-8 BOMs** (`-Encoding utf8`); the content
  validator parses raw and CI fails on the BOM. Write JSON via node or
  `[IO.File]::WriteAllText` with `UTF8Encoding($false)`; keep library.json
  in tilegen's `JSON.stringify(…, null, 2)` format.
- **Never squash-merge the bottom of a stacked PR chain** — GitHub closes
  the stack unrecoverably (closed PRs cannot retarget). Merge top-down or
  rebase per merge (`rebase --onto main <merged-sha>`).
- **Multiline `git commit -m` breaks under PowerShell quoting** — always
  `git commit -F <file>` from the scratchpad, and never chain branch
  commands with the work they isolate (bit again this session).
- **`gh pr merge` needs the permission rule** now present in
  `.claude/settings.local.json`; the auto-mode classifier also refuses
  letting the agent edit that file itself (correct boundary).
- **A summary that invites a playtest must state, first and in bold, which
  build he will hit and what proves he is on it.** He playtested unmerged
  work once this session and re-found every reserved bug; two of three
  reports that day were the old build.

## Key seams for the next session

- **The 2.27 gate playtest is the only open thread of session 20.** If it
  produces a defect list, the fix pattern that worked three times: confirm
  the mechanism with a numbered evidence sweep BEFORE code (dist/lab scratch
  scripts via esbuild), pin it as a law-level test, fix, deploy, live-verify
  through `__ad`.
- **`engine/mapgen/verify.ts`** — the law. Strand-level route-uniqueness
  (`tier1/route-unique`) mirrors the flow field's own `stepAllowed`/
  `strandStep` (exported from `sim/flow.ts`); if routing semantics ever
  change, both move together or the law lies.
- **`engine/mapgen/carve.ts`** — the road plan. Tunnel machinery is live
  code but dormant content-wise (no two-group tile in any rolled pool since
  twin_bend went special); it fires only in hermetic tests. Deliberate, not
  dead — a future "tunnel basics" content decision re-arms it.
- **`app/workerRuntime.ts`** — the lifecycle. All state commits atomically
  in `newRun`; every code path posts `ready` or `genError`. simWorker.ts is
  a shell; tests inject hermetic content.
- **Session 21 (ledger): D8 naming mini-session first** — a conversation,
  not build work (printing-trade lexicon; dev's position recorded at D8) —
  then damage types (2.8) and attack shapes (4.10).

## Standing open items

- **2.27 gate** — Daniil's loadout-heavy playtest verdict (see above).
- `tile_yn7vhz` — a minted tile that LOOKS looped but passes validity. He
  can delete it now; if he wants the shape class understood (possible spec
  input for what validity should refuse), his save export is required.
- 4.12 — playtest-1 visual items V8, V9 remain **lost**; re-ask at a
  playtest, then write or retire the ID.
- Shore palette reads as ore (gold on gold) — art-pass note on 6.6.
- Relic rebalance for duplicate stacking (accepted as a later session).
- ASSETS.md not audited since D3 closed — audit in the art session.
- The REXPaint art pipeline is still **unproven**; both tools unwritten;
  6.1 opens the presentation block. Accepted risk, recorded on the item.
