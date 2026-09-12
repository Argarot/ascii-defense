# Contributing

Read this before writing code or debugging anything. Everything here was learned
the expensive way.

This file owns the **code** invariants. How a session runs — how an incoming
item is bucketed, when Daniil is asked, what a repeated fix round means — is
[docs/WORKING-AGREEMENT.md](docs/WORKING-AGREEMENT.md). Read that too.

---

## 1. Invariants — do not break these

Each deletes a class of bug. Each is the kind of thing a fresh context quietly
violates.

1. **`Math.random` is banned.** Everything routes through the seeded PRNG
   (`pure-rand`) with named streams. Determinism is what makes calibration,
   replays and regression tests possible. Lint rule.
2. **The engine knows no glyphs, colours or pixels.** Nothing in `engine/` may
   branch on appearance. Lint rule.
3. **`engine` and `content` never import `render`, `view`, `app` or the DOM.**
   `render` never imports `engine`. Lint rule.
4. **Road cells are never buildable.** Structural guarantee, not a runtime check.
5. **Tile connectors guarantee connectivity.** There is no "is a path still
   available?" check anywhere. If you are writing one, something upstream is
   wrong.
6. **Fixed 20 Hz tick.** No frame delta reaches the simulation. Speed controls
   change ticks-per-frame, never tick size.
7. **A tower occupies exactly one cell, always.** Footprints never change.
8. **Wave budgets are never reduced to compensate for mining.** The model
   offsets choices that increase combat power and ignores those that do not.
9. **Ore is stored per tier** even with one tier active.
10. **Nothing branches on colour.** `pathId` is data; presentation is the view's
    business. This is what keeps accessibility a later view change.
11. **Content is JSON validated against a schema.** Generated types are
    committed; CI fails on drift.

## 2. Environment traps

Windows 10, PowerShell 5.1, Node v22.23.2, npm 12.0.2, git 2.33.0.

- **GitHub Pages caches `index.html` AND `public/` assets.** A green Actions
  check and a new bundle hash prove *nothing* about what a browser receives.
  Verify with a cache-busting query (`?cb=<sha>`), and confirm the loaded bundle
  filename before believing any result. This silently invalidated several
  rounds of visual review.
- **Bump `ASSET_V`** in the app whenever a file under `public/assets/` changes;
  those URLs are stable and will otherwise be served stale.
- **Never round-trip source through PowerShell.** `Get-Content -Raw` reads
  UTF-8 as ANSI and `Set-Content -Encoding utf8` re-encodes it, turning `·` into
  `В·` and `Ω` into `О©`. Use the editor tools. **Write non-ASCII in source as
  `\uXXXX` escapes** — most of this project's source is non-ASCII by nature, so
  this is not optional hygiene.
- **`npm run <script> -- --flag` fails on npm 12** (`EUNKNOWNCONFIG`). Call the
  binary directly: `npx vite preview --port 5197`.
- **PowerShell treats native-tool stderr as failure.** `git push` and
  `npm run build` write to stderr on success. Read the output, not the exit code.
- **`gh` lives at `C:\Program Files\GitHub CLI\gh.exe`** and may not be on PATH
  in a fresh session. Its token is fine-grained and scoped to this repo only —
  it deliberately cannot reach Daniil's corporate org, and must not be widened.
- **Creating a Pages *site* cannot be automated** — refused to both
  `GITHUB_TOKEN` and repo-scoped PATs. Already enabled; a fork does it by hand.
- **Vite's `base` is baked at build time.** `--base /` does not rewrite built
  HTML.
- **The browser pane throttles `requestAnimationFrame` when not displayed**, and
  screenshots fail there. Verify rendering by reading pixels via `readPixels`,
  or by `toText()`.
- **A bitmap font must be drawn at native size or an integer multiple.**
  Fractional scaling turns it to mush. Never set CSS `max-width` on the canvas.

## 3. Conventions

- **Branch:** `main` deploys. Work on feature branches, open PRs. Branch
  protection is not configured yet; it needs `Administration: write` added to
  the token, which is a deliberate widening to decide consciously.
- **Commits:** Conventional Commits. The body explains *why*. End with
  `Co-Authored-By: <model> <noreply@anthropic.com>`.
- **Comments** explain reasoning that is not evident from the code. Match the
  density in `render/GLTerm.ts`.
- **Numbers in docs are measured.** If you quote a benchmark you ran it; if you
  quote a vendor limit you linked it.
- **Verify claims at the right end.** "CI is green" is not "the user sees it".

## 4. Where things are

| | |
|---|---|
| What the game is | [docs/PRD.md](docs/PRD.md) |
| How it is built | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| How it looks, and the art pipeline | [docs/ASSETS.md](docs/ASSETS.md) |
| What happens next, session by session | [docs/ROADMAP.md](docs/ROADMAP.md) |
| The item tree, the decisions, the ledger | [docs/ROADMAP.md](docs/ROADMAP.md) |
| How a session is run | [docs/WORKING-AGREEMENT.md](docs/WORKING-AGREEMENT.md) |
| The live queue — requests, calls, debt | GitHub Issues (`gh issue list --label call`) |

Read the PRD before the architecture; read this file before touching anything.

## 5. Traps a fresh context falls into

- **The local gate is five things and EVERY exit code goes into the RED
  check, lint included** — a printed "LINT" line once passed a
  `prefer-const` that CI caught.
- **No backtick inside a bash-quoted `node -e` string, ever**; patch
  scratch scripts with the Edit tool, run them by path.
- **A generator that merges into the file it reads is tested by its
  second run** (tilegen accumulated 82 → 111 until its id filter matched
  every id it makes).
- **Vite's eager glob of sprite JSON needs a dev-server restart for NEW
  files**; a new export needs one too. `preview_start` by name when the
  pane's server is not running; the tab id changes.
- **A gate that reads the analytic model reads a fixed world** (the hand
  tiles); widening its tolerance a fourth time was the wrong fix.
- **After the last merge of a day: `git fetch` and `git checkout -B main
  origin/main`.** Between PRs: merge without `--delete-branch`, `git
  reset -q origin/main` on the branch, `checkout -q -b <next>`, delete
  the remote branch by name.
- **`git add` with one nonexistent path stages nothing.**
- **The pane at 1920×1080** (`resize_window`) is how the workshop's plates
  fit; the hidden pane's default is far smaller and clips tall pages.
- **Two agents share this working tree**: `git add` by explicit path,
  never `stash`/`checkout .`/`reset --hard`; the placeholder-sprite tool
  rewrites palette.json's key order — restore it by path.
- **The font decides the language**: spleen has `┌┐└┘─│├┤┬┴┼`, `◆`,
  braille — no double lines, no blocks.
