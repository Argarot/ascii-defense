# Handoff

You are picking up ASCII Defense at the start of **M1**. Scoping is finished and
approved; M0 is shipped and live. This document exists so you do not have to
reconstruct anything from conversation.

---

## 1. Where things stand

| | |
|---|---|
| Repo | <https://github.com/Argarot/ascii-defense> (public, Apache-2.0) |
| Live | <https://argarot.github.io/ascii-defense/> |
| Owner | Daniil (GitHub: `Argarot`) — orchestrator, plays the game, makes product calls |
| Shipped | M0: `Term` renderer, Vite+TS build, Actions → Pages, docs |
| Next | M1, "the fun test" — see [ROADMAP.md](ROADMAP.md) |

`src/term/Term.ts` is real, tested-by-measurement code and should be **moved
into `packages/term`, not rewritten**. `src/main.ts` is a throwaway demo; delete
it when the real game screen exists.

**Read in this order:** [PRD.md](PRD.md) → [ARCHITECTURE.md](ARCHITECTURE.md) →
[ROADMAP.md](ROADMAP.md) → this file.

## 2. How Daniil wants to be worked with

From his standing instructions, in the form that matters here:

- **Plan first, then stop.** For anything beyond a trivial edit, produce a short
  plan and wait for approval. Do not start implementing on assumption.
- **Prove the path before building on it.** Smallest possible artifact through
  the real path first. M0 exists because of this rule.
- **Never state third-party facts from memory.** Prices, limits, free tiers,
  API behaviour — check the vendor's own docs and link them. If a URL appears
  in tool output, open it before passing it on.
- **Test what he operates**, cold, from a different directory, not just the
  internals.
- **After a fix, ask what else it changed.**
- **Report state honestly.** Written, deployed and verified are three different
  things. If a measured number looks implausible, suspect the measurement.
- **Ask as things come up.** A question mid-task is far cheaper than a wrong
  assumption baked into working code.

He is technical, reads diffs, and prefers being told a plan is wrong to being
handed a workaround.

## 3. Invariants — do not break these

These are load-bearing. Each one deletes a whole class of bug, and each is the
kind of thing a fresh context quietly violates.

1. **`Math.random` is banned.** Everything routes through the seeded PRNG with
   named streams. Determinism is what makes calibration, replays, regression
   tests and save/resume possible at all. Enforce with a lint rule.
2. **Road tiles are never buildable.** This is *why* the game can never become
   unwinnable. Never replace it with a "check if a path still exists" validation
   — that trades a structural guarantee for a runtime check.
3. **`engine` and `content` never import from `term` or `web`.** Lint rule, not
   discipline. The headless harness depends on it.
4. **The path-preview overlay computes its speculative flow field in the
   engine**, not the UI. Preview and reality must be the same code path.
5. **Fixed 20 Hz tick.** No frame delta ever reaches the simulation. Speed
   controls change ticks-per-frame, never tick size.
6. **Wave budgets are never reduced to compensate for mining.** See PRD §6.1–6.2.
   The model offsets choices that increase combat power and ignores choices that
   do not. Mazing is offset sub-linearly; mining is not offset at all.
7. **Ore is stored per-tier from day one** (`{ "1": 240 }`), even though only
   one tier ships. Ore tiers must arrive as content, not as a save migration.
8. **Tower footprints never change size.** Growth-on-upgrade was explicitly cut.
9. **Content is JSON validated against a schema.** Generated types are
   committed; CI fails if regenerating them produces a diff.

## 4. Environment traps, already paid for

Every one of these cost time to discover. Windows 10, PowerShell 5.1, Node
v22.23.2, npm 12.0.2, git 2.33.0.

- **`npm run <script> -- --flag` fails on npm 12** with `EUNKNOWNCONFIG`. Use
  `npx vite preview --port 5197` directly instead of passing through npm.
- **PowerShell treats native-tool stderr as an error stream.** `git push` and
  `npm run build` print to stderr on success, so the tool reports failure while
  the command worked. Read the actual output, not the exit status alone.
- **`gh` lives at `C:\Program Files\GitHub CLI\gh.exe`** and may not be on PATH
  in a fresh session. Its token is fine-grained and scoped to this repo only —
  it deliberately cannot reach Daniil's corporate org, and must not be widened.
  It has no `Administration` permission.
- **Creating a Pages *site* cannot be automated.** Refused to both
  `GITHUB_TOKEN` and the PAT. Already enabled; a fork must do it by hand.
- **Vite's `base` is baked at build time.** `vite preview --base /` does not
  rewrite already-built HTML. Production uses `/ascii-defense/`, derived from
  Vite's `command`, not from `process.env` (which would need `@types/node`).
- **The browser pane throttles `requestAnimationFrame` when not displayed**, and
  screenshots fail with "pane is not displayed". Verify rendering by reading
  pixels via `getImageData` instead. `main.ts` paints frame 0 synchronously
  partly for this reason.
- **The browser pane forces localhost URLs to origin-only**, stripping paths.
  Serve at root when you need to verify a built bundle locally.
- **PowerShell joins string arrays with spaces.** `gh api ... --jq .body` piped
  into `WriteAllText` destroys newlines. Use `($lines -join "\`n")`.
- `core.autocrlf=true` globally; `.gitattributes` pins LF in the repo.

## 5. M1 build order

Dependency-ordered. The uncertain, foundational parts first.

1. **Workspace restructure.** `packages/{engine,content,term,web}`, TS project
   references, ESLint with the two custom rules (invariants 1 and 3), Vitest.
   Move `Term` into `packages/term` unchanged. CI must stay green throughout —
   Pages is live and should not break.
2. **RNG + tick loop.** Named streams, 20 Hz, speed controls. Golden state-hash
   test from the first commit that has state.
3. **Content pipeline.** Schemas, `tools/schema-to-types`, validation in CI,
   content linter skeleton. Build this *before* authoring content, or you will
   author it twice.
4. **Grid, occupancy, flow field.** Property test: 10,000 generated maps, a path
   always exists.
5. **Speculative field + preview overlay.** Early, because PRD §4.1 makes it a
   requirement and because it shapes the input layer.
6. **Sim core.** Towers, targeting, projectiles, enemies, damage types, traits.
7. **Content.** 5 towers × 3 paths × 5 tiers, 6 enemies, sprites.
8. **Waves, economy, win/lose.** Scrap, lives, Refinery paths, ore nodes.
9. **HUD.** Build palette, range preview, upgrade panel with crosspath legality.
10. **Smoke harness + replay.** Crude bot, margin numbers, replay record/playback.

Steps 1–5 are the risky half. If something invalidates the plan, it will be
there — **stop and re-plan rather than accumulating workarounds.**

## 6. What "done" means for M1

Not "it compiles". M1 is done when Daniil can open the live URL, play a full
battle with a mouse, and form an opinion about whether it is fun.

Concretely:
- CI green: typecheck, lint, unit, golden, replay, content validation.
- Deployed to Pages and **verified by loading the deployed page**, not by
  trusting the workflow badge.
- A run is reproducible from its seed.
- The smoke harness prints a per-wave margin table.

## 7. Conventions

- **Branch:** `main` is deployed. Work on feature branches, open PRs. Branch
  protection is *not* configured yet — Daniil deferred that decision until he
  had a real PR to look at. Raise it when you open the first one.
- **Commits:** Conventional Commits (`feat:`, `fix:`, `ci:`, `docs:`,
  `refactor:`). Body explains *why*. End with:
  `Co-Authored-By: <your model name> <noreply@anthropic.com>`
- **Comments** explain reasoning that isn't evident from the code, not what the
  line does. Match the density already in `Term.ts`.
- **Numbers in docs are measured, not estimated.** If you quote a benchmark,
  you ran it. If you quote a vendor limit, you linked it.

## 8. Open questions for Daniil

Not blocking M1, but worth raising at the right moment:

- **Name.** Still the working title `ASCII Defense`.
- **Branch protection**, once the first PR exists.
- **Sound**, currently out of scope.
- **Bundled font.** JetBrains Mono (OFL-1.1) is the intended choice but is not
  yet vendored; the game currently falls back to system monospace, so the grid
  is not yet identical across machines.
