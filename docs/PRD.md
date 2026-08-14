# ASCII Defense — Product Requirements

Status: **scoping complete.** M0 (delivery path) is live at
<https://argarot.github.io/ascii-defense/>. No game code written yet.

---

## 1. What it is

A roguelite tower defense game in the browser, drawing everything — terrain,
towers, enemies, projectiles, menus — as coloured ASCII characters on a
monospace grid.

A **run** is a sequence of procedurally generated battles with a draft between
each. You lose when the Core falls; you keep mined Ore and spend it on a
permanent tech tree.

## 2. Design pillars

| Pillar | What it means | What it rules out |
|---|---|---|
| **Every placement is a build decision** | Deep evolution trees with a hard crosspathing limit; towers occupy real space | "Buy the best tower, spam it" |
| **Every run is reproducible** | A run is a seed plus an input log. Replays, daily challenges, bug reports and the regression corpus all fall out of this | Non-deterministic simulation |
| **Never unwinnable, never trivial** | Road is never buildable; wave budgets are calibrated from measured play | Hand-tuned levels; RNG that hands you a dead run |
| **Density over decoration** | ASCII's advantage is showing more state at once than a graphical game can. Use it | Prettiness that costs legibility |
| **Content is data, not code** | Towers, enemies, sprites and tech nodes are JSON validated against a schema | Adding a tower requiring engine changes |

## 3. Core loop

```
Run start ──► Battle 1 ──► draft 1 of 3 ──► Battle 2 ──► ... ──► Battle 8 ──► win
                 │
             Core falls ──► run ends ──► banked Ore ──► tech tree ──► next run starts wider
```

A battle is 8–12 waves. A run is ~30 minutes at 2× speed.

Branching node maps, shops, forges, events and bosses are **deliberately not in
the core loop** — see [ROADMAP.md](ROADMAP.md). They add nothing if the battles
are not fun, so they are gated behind proving that they are.

## 4. The map

| Tile | Pathable | Buildable | Role |
|---|---|---|---|
| **Road** | yes, cost 1.0 | **no** | The guaranteed route |
| **Ground** | yes, cost 1.4 | yes | Open terrain you build on |
| **Rock** | no | no | Procgen obstacle, free wall |
| **Ore node** | yes, cost 1.4 | yes (see §6) | Mining site |

*How any of this looks is not specified here. See [ASSETS.md](ASSETS.md).*

Enemies walk the **cheapest** route to the Core via a flow field. Because ground
costs more than road, shortcuts across open terrain exist naturally; building on
them closes them and pushes enemies back onto the long road.

There is no "bypass zone" system. Shortcuts are an emergent consequence of the
cost model, and the generator's only job is to ensure meaningful ones exist.

Two properties fall out, both deliberate:

- **The game can never become unwinnable.** Road is never buildable, so a valid
  route always exists. This invariant is load-bearing — never replace it with a
  "check if still passable" validation.
- **Mazing is an economic decision.** Walls (1×1) cost Scrap and space.

### 4.1 The path-preview overlay is a requirement, not polish

Flow-field pathing is unreadable without help. If you cannot see where enemies
will go *before* committing Scrap, mazing is guesswork and the mechanic dies.

The board must show, at all times, the current route; and on build-hover, the
route **as it would be** if that placement happened. This ships in M1.

## 5. Towers

### 5.1 Crosspathing

Three upgrade paths of five tiers. **One path may reach tier 5, a second may
reach tier 2, the third stays at 0.** One rule turns 8 towers into a large build
space.

### 5.2 Fixed footprint, growing intricacy

A tower is a **drawing**, not a character with decoration around it. Standard
towers occupy **7 × 4 cells**; heavies 9 × 5. **Footprints never change.**

Tiering up is expressed entirely through the artwork — detail density, frame
elaboration, path-coloured accents and brightness all climb, while the
silhouette stays recognisable. Identity comes from the whole shape, not from any
one character.

Nothing about *what those drawings contain* is specified in this document. Sizes
appear here only because footprint is a mechanical property: it determines
placement, buildable area and how many towers a board can hold. Appearance lives
in [ASSETS.md](ASSETS.md) and in `public/assets/`.

*Growth-on-upgrade was considered and cut: it bought one visual moment at the
cost of occupancy re-checking, a UI/engine contract, and a "cannot upgrade,
neighbour in the way" failure mode.*

**Consequence for the board:** 7 × 4 towers need room for 20–25 placements,
which is roughly a **160 × 50 cell** viewport. That is comfortable on a desktop
monitor and is a large part of why this game is desktop-only.

### 5.3 Families

M1 ships the first five. Full target is **8 towers + Wall** — not 14. Eight
well-tuned towers with crosspathing already yields more build space than can be
balanced in reasonable time.

| Tower | Sprite id | Size | Role | Path A | Path B | Path C | Milestone |
|---|---|---|---|---|---|---|---|
| Bolt Turret | `tower_bolt` | 7×4 | cheap single target | Velocity | Caliber | Optics | M1 |
| Mortar | `tower_mortar` | 7×4 | AoE, minimum range | Payload | Cadence | Ordnance | M1 |
| Frost Emitter | `tower_frost` | 7×4 | slow aura | Chill | Shatter | Field | M1 |
| Refinery | `tower_refinery` | 7×4 | economy (§6) | Yield | Extraction | Logistics | M1 |
| Wall | `wall` | 3×2 | no attack, closes shortcuts | — | — | — | M1 |
| Acid Sprayer | `tower_acid` | 7×4 | DoT, armour shred | Corrosion | Volatility | Saturation | M4 |
| Arc Coil | `tower_arc` | 7×4 | chain lightning | Conductivity | Overcharge | Capacitor | M4 |
| Bastion | `tower_bastion` | 7×4 | buff aura | Command | Logistics | Fortify | M4 |
| Rail Lance | `tower_rail` | 9×5 | long-range line pierce | Focus | Penetration | Overwatch | M4 |

## 6. Economy: one building, two futures

**Scrap** funds the run. **Ore** is meta-only, banks at run's end, and buys tech
tree nodes. Ore can never be spent during a run.

There is **one** economy building — the Refinery — and its upgrade tree *is* the
spend-now-or-invest-later decision:

| Path | Produces | Requires |
|---|---|---|
| **Yield** | Scrap per wave | anywhere |
| **Extraction** | Ore per wave | must be built **on an ore node** |
| **Logistics** | throughput, range, adjacency bonuses | anywhere |

Because the Extraction path requires an ore node, **site selection is a
pre-commitment**: you choose where to build already knowing which future you
intend. And because ore nodes sit far from the path, mining pulls your money and
your buildable space away from your defense.

### 6.1 Mining is balanced by opportunity cost alone

Scrap spent on Extraction is Scrap not spent on defense, and the waves do not
care. There is no enemy that hunts extractors, and **wave budgets are not
reduced to compensate for mining**.

This is deliberate. Compensating would refund the very cost that makes the
decision matter. It also keeps `C(w)` — Scrap earnable by wave `w` — a pure
function of waves cleared, independent of player choice, which removes a
feedback loop from the difficulty system.

### 6.2 The general principle

> The difficulty model offsets choices that **increase combat power**, and
> ignores choices that do not.

Mining buys no combat power, so it is not offset — you simply end up weaker.
Mazing *does* buy combat power (more time in range), so it is partially offset,
sub-linearly (§8.3). One rule, applied consistently.

### 6.3 Ore tiers — reserved, not built

Ore nodes carry a `tier` field, and each battle has a tier-weight table so that
deeper battles can roll richer nodes. **Stage one ships one tier and a weight
table of `[1.0]`.** The schema, the banking code and the tech-tree costs all
carry tier from day one, so adding tiers later is content, not surgery.

## 7. Enemies

Start narrow. **Two damage types** (Kinetic, Energy) and **five traits**:

`armoured` (flat reduction, wants Kinetic) · `shielded` (regenerating overshield,
wants burst) · `fast` · `flying` (ignores pathing, flies straight at the Core) ·
`swarm` (many, cheap, wants AoE)

M1 ships six enemies across that matrix. A 4×11 damage-type × trait matrix was
cut: it is 44 interactions, mostly unexercised, and it is precisely where
balance bugs breed. Traits expand only once the small matrix is proven.

Flyers are the structural counter to over-mazing and must exist from M1.

Enemies are drawn sprites too, and **size class carries threat**: 2×1 for swarm
units, 3×2 for line infantry and flyers, 5×3 for armoured, 11×6 for bosses. You
should be able to read what is coming from the silhouettes alone.

## 8. Difficulty: calibrated, not derived

### 8.1 What changed and why

An earlier draft computed achievable DPS analytically from Scrap earned. That
was dishonest: DPS is not a function of money. One maxed tower and ten cheap
ones represent the same spend and wildly different defense, and the difference
was being hidden inside a fudge factor.

**Wave budgets are measured, not derived.**

### 8.2 How budgets are produced

```
1. Analytic prior       — a rough starting curve, used only as an initial guess
                          and as an outlier alarm
2. Bot calibration      — the bot plays N seeds against candidate budgets;
                          record clear margin, lives lost, leak %, time-to-kill
3. Solve                — pick the budget curve putting the reference policy at
                          the target margin for each wave
4. Human offset         — a measured constant between bot performance and real
                          play, from Daniil's recorded runs
5. Freeze               — the resulting curve ships as data in content/balance/
6. Guard                — the harness re-runs on every change; drift beyond
                          tolerance fails CI
```

The harness therefore **produces the shipped numbers** rather than validating a
model. That is why it exists in M1, not M3.

### 8.3 The two live inputs that remain

- **`L`, effective path length** — read from the flow field. Wave EHP scales
  **sub-linearly** with it: `(L / L_base) ^ p`, with `p ≈ 0.5` as a calibrated
  knob. Doubling your path roughly doubles time-in-range but only raises wave
  EHP by ~40%, so mazing stays a real edge without becoming mandatory. `p = 0`
  makes mazing dominant; `p = 1` makes it pointless.
- **`M`, metaPowerIndex** — a scalar summarising permanent tech-tree power. Near
  1.0 while the tree grants only unlocks. Present in the model from day one so
  that adding stat nodes later moves a number the model already reads.

`k(w)`, the pressure curve — rising across a run, spiking at finales, dipping
after — remains the one hand-authored difficulty knob.

## 9. The bot: a regression detector, not an oracle

Writing a TD bot that plays *well* is plausibly harder than the game. A greedy
bot will be worse than a human, so calibrating difficulty to it alone produces a
game that is too easy.

**One** bot, honestly framed:

- **Primary job:** regression detection. "Did this change make wave 14 harder?"
  is answerable with high confidence and is most of the value.
- **Secondary job:** absolute difficulty, via a measured human offset that
  Daniil's real runs establish.
- **Free bonus:** an in-game autopilot to watch at 4×.

## 10. Meta progression

Ore buys a tech tree. Built in stages, gated behind the core loop being fun.

| Stage | Grants | When |
|---|---|---|
| **1** | ~5 nodes: unlock a tower, unlock a starting relic, +1 draft option, unlock Threat Level 2 | M2 |
| **2** | Full tree: 5 disciplines, alternate tier-5s, capped economy nodes | M4+ |
| **3** | Potency nodes (permanent stat increases) | only if wanted |

Stage 3 makes `metaPowerIndex` a real variable, at which point the harness must
validate `seeds × meta tiers` instead of `seeds`. That multiplies CI time for
every balance change afterwards, which is why it is last and optional.

## 11. Determinism and replays — a headline feature

The fixed 20 Hz tick and seeded RNG are already paid for. What they buy:

- **A run is a seed plus an input log** — on the order of kilobytes.
- **Shareable replays.** Watch anyone's run, at any speed.
- **Daily challenges.** A date-derived seed. Essentially free.
- **Bug reports as files.** "It broke" becomes a reproducible artifact.
- **A regression corpus of real play** — replays double as integration tests.

This is not an implementation detail. It is one of the most valuable things the
architecture gives us and should be surfaced in the UI.

## 12. Art direction

Specified separately, in [ASSETS.md](ASSETS.md), and implemented as a runtime
asset library under `public/assets/`. **This document names no glyphs and no
colours** — if it did, the library would not be the source of truth.

What is settled: sprites are parallel art/ink grids resolved through a role
palette; one drawing serves all three upgrade paths by recolouring; terrain is
sparse and edge-treated rather than randomly filled; all UI chrome draws through
the same `Term` as the board; and legibility beats spectacle in every tie.

The current library is a **direction proof, not a finished set**. Enemy art is
the weakest part, and animation, projectiles and UI chrome are unauthored. Full
art pass is scheduled in M4+.

## 13. Out of scope

Mobile/touch · multiplayer · sound · accounts or cloud saves · non-ASCII
graphics · a terminal build (the renderer permits one; not a deliverable).

## 14. Acceptance criteria

**M1 — the fun test.** One procedural battle, 5 towers with complete trees, 6
enemies, 10 waves, path-preview overlay, mouse control, smoke harness. Daniil
plays it and says whether it is fun.

**M2 — a complete game.** 8 battles in sequence, draft between each, Ore
banking, 5-node tech tree, save/resume. A run can be won or lost.

**M3 — trustworthy difficulty.** Calibrated budget curves; harness detects
injected regressions; no unwinnable or trivial seed across ≥500 runs.

**M4+ — expansion**, only past the decision point: node maps, shops, bosses,
towers 6–9, biomes, the full art pass.
