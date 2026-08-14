# ASCII Defense — Roadmap, Estimates & Your Actions

Status: **draft, awaiting approval.** No implementation has started.

A "session" below = one focused working stretch of mine, roughly a few hours of
wall time. Estimates are ranges because content authoring is the variable.

---

## M0 — Foundation & delivery path *(~1 session)*

Prove the boring path completely before any game code exists.

- Monorepo: npm workspaces, TS project references, ESLint (incl. the
  `no-Math.random` and `engine-must-not-import-DOM` rules), Vitest, Prettier.
- `packages/term`: the glyph-atlas dirty-cell renderer, ported from the proven
  spike, with a `term.put()` API and its own unit tests.
- `packages/web`: a screen showing an animated ASCII grid + FPS counter.
- GitHub repo created, CI green, **deployed and reachable at a public URL.**

**Exit gate:** you open the URL on your machine and see the grid moving.
Nothing further gets built until that is true.

## M1 — Playable battle *(~3–4 sessions)*

The vertical slice. One battle, no run structure.

- Seeded RNG with named streams; fixed 20 Hz tick; pause / 1× / 2× / 4×.
- Battle map procgen: terrain, road carving, bypass zones, spawn + Core
  placement. Property test: 10,000 maps, path always exists.
- Dijkstra flow field (ground / burrow / fly), recomputed on build.
- 4 complete towers (`^` Bolt, `o` Mortar, `~` Frost, `$` Refinery) + `#` Wall,
  full 3×5 trees with crosspathing enforced.
- 8 enemy types across the trait matrix; projectiles; damage types; armour.
- Wave budget solver against the `H(w)` model; 10 waves; gold; lives; win/lose.
- Mouse-first HUD: hover range preview, build palette, upgrade panel showing all
  three paths and which are still legal.

**Exit gate:** you play it and tell me whether it is fun. This is the checkpoint
that matters most and the one I cannot fake.

## M2 — The run *(~2–3 sessions)*

- Node-map procgen (3 acts, branching routes, node-type distribution).
- Shops, Forges, Events, Elites, Act bosses with unique mechanics.
- Drafted modifiers: Cores, Mods, Curses; the stat pipeline they plug into.
- Run state machine; save/resume to `localStorage`; run summary screen.
- 4 more towers, ~8 more enemies.

**Exit gate:** a complete run, start to Core-death or victory, resumable.

## M3 — Balance & autopilot *(~2–3 sessions)*

- `packages/bot`: 4 policies (`greedy-dps`, `economy-first`, `mazer`, `balanced`).
- `packages/harness`: headless CLI — N seeds × policies → win rates, leak curves,
  gold curves, tower pick rates, unwinnable/trivial seed detection.
- Tune `η` and the `k(w)` pressure curve from measured data. This is the actual
  "balanced on autopilot" deliverable.
- `balance.yml` CI gate: win rates must stay inside their bands.
- In-game autopilot toggle — the same bot, watchable at 4×.

**Exit gate:** balance report across ≥500 seeds per policy inside target bands,
zero unwinnable seeds.

## M4 — Content & ship *(~3–4 sessions)*

- Towers 9–14; enemies to ~24; 3 biomes with distinct terrain and enemy pools.
- Meta unlocks + Threat Levels (difficulty tiers).
- README with animated capture, CONTRIBUTING, content-authoring guide, licence.
- Seeded/daily-challenge runs (free given determinism).
- Release polish pass.

**Exit gate:** a stranger clones it, follows the README, and plays.

---

## Total

**~11–15 sessions.** M0+M1 (~4–5) gets you something genuinely playable; that is
the natural point to decide whether this becomes a long-term project or stops.

Everything is sequenced so the riskiest, most externally-dependent work happens
first: delivery path → determinism → balance model → content volume.

---

## What you need to do, concretely

### Before M0 can finish — required

1. **Install the GitHub CLI** (it is not on this machine; I checked):

```bash
winget install --id GitHub.cli --source winget
```

Then open a **new** terminal and authenticate:

```bash
gh auth login
```

Choose: GitHub.com → HTTPS → *Login with a web browser* → paste the code.
When it finishes, `gh auth status` should show you as logged in.

2. **Tell me the repo name and owner.** Default proposal: public repo
   `ascii-defense` under your account. Say the word and I create it, push, and
   wire up Pages.

3. **Enable Pages, if the API won't let me.** I will try
   `gh api -X POST .../pages` with `build_type: workflow`. If your token scope
   blocks it, you click: repo → Settings → Pages → Source: **GitHub Actions**.
   One dropdown.

If you would rather not install `gh` at all: create the empty public repo in the
browser yourself and give me the URL. I will push over HTTPS with `git`, which
is already installed. `gh` just makes everything after that smoother.

### At the M1 gate — required

4. **Play it and tell me if it's fun.** Specifically: does placing a tower feel
   good, is the upgrade panel legible, is the pace right, and is mazing a
   decision you actually think about? Automated tests cannot answer any of this.

### Optional, whenever

5. **Pick a name.** `ASCII Defense` is the working title. If you want something
   with more personality, now is the cheap moment to change it.
6. **Decide on sound.** Currently out of scope. Say if you want it later.

### What you do NOT need to do

No accounts beyond GitHub. No credit card — [GitHub Free](https://github.com/pricing)
includes Pages, and Actions minutes are free for public repositories. No hosting
bill, no domain, no build machine. Total verified running cost: **$0.**

---

## Biggest risk, and what would invalidate this plan

**The risk: the balance model does not survive contact with real play.**

The `H(w)` model assumes players convert gold into in-path DPS at some
efficiency `η`. If bot play and human play diverge badly, the harness will
happily certify a curve that feels wrong to you — waves that are trivial or
walls that are impossible.

*Mitigations already designed in:* `η` and `k(w)` are config, not code, so
retuning is a data edit. A smoke version of the harness lands during M1, not M3,
so we find the divergence early. Path length `L` is read live from the flow
field, so mazing can never desync from the wave budget.

*What would invalidate the plan:* if, after M1, your subjective read of the
difficulty consistently disagrees with the harness across several tuning passes.
The fallback is bounded dynamic difficulty adjustment — a small live correction
term on `k(w)` driven by recent player performance, clamped so it can never
trivialise or brick a run. That is a documented retreat, not an improvisation,
and I would stop and re-plan rather than bolt it on quietly.

**Second risk: content volume.** 14 towers × 3 paths × 5 tiers is 210 authored
upgrades. Mitigation: schema + CI validator so bad content fails the build, and
M1 ships 4 towers *complete* rather than 14 half-finished.
