# ASCII Defense — Roadmap & Estimates

A "session" = one focused working stretch, roughly a few hours. Ranges are wide
where content authoring dominates.

These docs are written to be **handed off** — the build phase may run under a
different model than the one that scoped it. Anything load-bearing is stated
explicitly rather than left as shared context.

---

## M0 — Foundation & delivery path ✅ **COMPLETE**

- Vite 7 + TypeScript strict, zero runtime dependencies.
- `src/term/Term.ts` — glyph atlas + dirty-cell renderer. 0.93 ms/frame at
  120×50 with 400 entities, against 17.22 ms/frame for naive `fillText`.
- GitHub Actions building and deploying to Pages.
- Apache-2.0, PRD, architecture, roadmap.

**Live: <https://argarot.github.io/ascii-defense/>** — verified by loading the
deployed page and confirming it renders, not by trusting a green check.

## M1 — Playable battle *(~4–5 sessions)*

The vertical slice. One battle, no run structure.

- Seeded RNG with named streams; fixed 20 Hz tick; pause / 1× / 2× / 4×.
- Map procgen: terrain, road carving, bypass zones (including narrow
  wall-only ones), ore node scattering weighted by distance from path.
- Dijkstra flow field (ground / burrow / fly), recomputed on build and upgrade.
- **Occupancy grid and multi-cell footprints** — placement, click targeting,
  and tier growth (3×2 → 5×3 → 7×4) with hover preview of the expansion.
- **Sprite system** — per-cell (glyph, colour) art with idle/fire frames.
- 4 complete towers + 1×1 Wall, full 3×5 trees, crosspathing enforced.
- 8 enemy types across the trait matrix; projectiles; damage types; armour.
- Wave budget solver against the `H(w)` model; 10 waves; Scrap; lives; win/lose.
- Mouse-first HUD: range preview, build palette, upgrade panel showing all three
  paths and which remain legal.

*+1 session vs. the original estimate, entirely from footprints and sprites.*

**Exit gate:** you play it and say whether it is fun. The checkpoint that matters
most and the one I cannot fake.

## M2 — The run and the mines *(~3–4 sessions)*

- Node-map procgen (3 acts, branching routes, node-type distribution).
- Shops, Forges, Events, Elites, Act bosses with unique mechanics.
- Drafted modifiers: Cores, Mods, Curses, and the stat pipeline they plug into.
- **Ore economy** — Extractors, finite node yield with depletion, rising
  per-extractor cost, banking scaled by Threat and depth.
- **`C(w)` net of extractor spending**, so mining is priced into difficulty
  automatically rather than bolted on.
- Run state machine; save/resume; versioned persistence with migration tests.
- 4 more towers, ~8 more enemies.

*+1 session vs. original, from the ore economy.*

**Exit gate:** a complete run, start to finish, resumable, with Ore banked.

## M3 — Balance & autopilot *(~2–3 sessions)*

- `packages/bot`: 4 policies (`greedy-dps`, `economy-first`, `mazer`, `miner`).
- `packages/harness`: headless CLI — N seeds × policies → win rates, leak
  curves, Scrap/Ore curves, tower pick rates, unwinnable/trivial seed detection.
- Tune `eta` and the `k(w)` pressure curve from measured data.
- `balance.yml` CI gate: win rates must stay inside their bands.
- In-game autopilot toggle — the same bot, watchable at 4×.

**Exit gate:** ≥500 seeds per policy inside target bands, zero unwinnable seeds.

## M4 — Tech Tree, content & art *(~4–6 sessions)*

- **Tech Tree stage 1** — Unlock / Option / Utility / Threat nodes, plus a
  capped Economy band. Rendered as an ASCII screen through the same Term.
- Towers 9–14; enemies to ~24; 3 biomes as distinct palettes.
- **Full sprite pass**, particles, damage numbers, screen nudge, UI chrome.
- README with animated capture, contributing and content-authoring guides.
- Seeded / daily-challenge runs (free, given determinism).

*Widest range on the board: sprite art for 14 families × 3 footprints is the
single largest content item. Mitigation in §Risks.*

**Exit gate:** a stranger clones it, follows the README, and plays.

## M5 — Tech Tree stage 2 *(optional, ~2–3 sessions)*

- **Potency nodes** — permanent stat increases.
- Harness matrix extended to `seeds × policies × meta tiers`.

Deliberately last. `metaPowerIndex` exists in the model from M1, so this is a
scaling exercise rather than a redesign — but it multiplies CI time for every
balance change afterwards, which is why it waits until the curve is trusted.

---

## Totals

| Scope | Sessions |
|---|---|
| M1–M4 (the game) | **13–18** |
| M5 (optional) | +2–3 |
| *Previous estimate, before your three additions* | *11–15* |

The additions cost roughly **+3 sessions net**: +1 footprints/sprites, +1 ore
economy, +1.5 tech tree, less overlap.

M1 alone (~4–5 sessions) is the natural decision point — it is the first build
you can judge on feel rather than description.

---

## Your actions

**Done:** GitHub account, `gh` installed and authenticated with a fine-grained
token scoped to this repo only, repo created, Pages enabled.

**Nothing is blocking right now.** The next thing needed from you is at the M1
gate: play it and report whether placing and upgrading a tower feels good, the
board reads clearly, and mazing is a decision you actually think about.

Optional, whenever: pick a real name (still `ASCII Defense`), and say whether
sound is wanted later.

Running cost remains **$0** — [GitHub Free](https://github.com/pricing) includes
Pages, and Actions minutes are free for public repositories.

---

## Risks

**1 — The balance model doesn't survive contact.** `H(w)` assumes players
convert Scrap into in-path DPS at efficiency `eta`. If bot and human play
diverge, the harness certifies a curve that feels wrong.
*Mitigations:* `eta` and `k(w)` are config, not code; a smoke harness lands in
M1 rather than M3; `L`, `C(w)` and `M` are all read live so they cannot desync.
*Fallback:* bounded dynamic difficulty adjustment — a clamped correction on
`k(w)` that can never trivialise or brick a run. A documented retreat, not an
improvisation.

**2 — Sprite art volume.** 14 families × 3 footprints × path variants is the
largest single content item, and hand-drawing all of it is where this stalls.
*Mitigation:* sprites are **composed, not drawn** — a generator wraps a frame
vocabulary around the family glyph with a path-coloured accent, producing a
consistent default for every tower/tier/path. Hand-authored art then overrides
only where a tower deserves a signature silhouette (tier 5s, bosses). This
turns an O(families × tiers × paths) drawing job into an O(families) one.

**3 — Mining may feel consequence-free.** You chose separate currencies with
opportunity cost only, so nothing actively threatens extractors. The economy
caps in PRD §7.3 bound the upside, but "safe and boring" is still possible.
*Mitigation:* Raiders are designed-in — the wave generator supports per-wave
objective splits from the start, so adding them later is content, not
architecture.

**4 — Footprint growth may annoy more than it rewards.** Being unable to
upgrade because a neighbour is in the way can read as punishment.
*Mitigation:* hover previews the expansion outline before purchase, and the
engine and UI share one function so they cannot disagree. If it still grates,
"grow once at tier 3" is a one-line content change, not a rewrite.
