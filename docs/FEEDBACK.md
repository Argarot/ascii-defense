# Feedback index

Every numbered item Daniil has raised, and where it went. Exists because a
session summary compressed 33 items into one-line bullets and left no way to
check whether any of them had been heard — a fair complaint, made 2026-08-16.

**This file is an index, not a spec.** It states the disposition and points at
the owner: [PRD](PRD.md) for what the game is, [WBS](WBS.md) for the work item,
[ROADMAP](ROADMAP.md) for which session. If they disagree with this table, the
other three are right and this one is stale — fix it.

Status: `planned` · `done` · `deferred` (with a trigger) · `declined` (with a
reason).

---

## Round 1 — 2026-08-16, the wave-14 playtest

### Mechanics

| # | Item | Where | Session | Status |
|---|---|---|---|---|
| 1 | Ore deposits finite, with richness shown as gold-speck density; refinery stops when spent | PRD §6, WBS 2.6 | 13 | planned |
| 2 | Prospecting upgrade wastes a tier slot | PRD §4.6, WBS 2.11 | 15 | planned — unlock **dropped entirely**, Survey becomes a real ability |
| 3 | Difficulty must scale non-linearly; death must be inevitable | PRD §9.1, WBS 1.7.3 + 2.1 | 12–13 | planned |
| 4 | Remove / upgrade / fuse relics; far more single-use | PRD §7.6, WBS 2.7 | 19 | planned |
| 5 | More relic slots | PRD §7.6, WBS 2.7 | 19 | planned — paired with fusion, or it makes the layer *more* trivial |
| 6 | Scrollable UI menus | WBS 2.13 | 20 | planned |
| 7 | No reroll option visible | WBS 1.7.2 | 12 | planned — **diagnosed**: the button renders; the 11-relic pool was exhausted so offers stopped entirely |
| 8 | Roads should touch tile edges / other roads without connecting | PRD §4.2.1, WBS 2.16 | 14 | planned — connectors stay centre-pegged; the *validity* rule is what changes |
| 9 | Bridges — roads cross without merging | PRD §4.2.2, WBS 4.9 | after 14 | planned — cheap once 2.16 lands, impossible before |
| 10 | Damage types and enemy types must matter | PRD §8, WBS 2.8 | 17 | planned |
| 11 | Attack shapes: electric chain, laser line, arc AoE | PRD §5.5, WBS 4.10 | 18 | planned — Arc Coil and Rail Lance already reserved two of these |
| 12 | Ground cells granting permanent tower bonuses | PRD §4.7, WBS 2.9 | 15 | planned |
| 13 | Projectile spread so rapid fire is visible | PRD §5.5, WBS 4.1 | 16 | planned |
| 14 | Higher speed multiplier (5×+) | WBS 1.7.4 | 12 | planned — 8×; the frame loop already tolerates ~96× |
| 15 | Refinery should show remaining deposit, not kills | WBS 1.7.5 | 12 | planned |
| 16 | Keep running when the tab is in the background | D7, WBS 2.13 | 20 | planned — sim moves to a Web Worker; PAUSED shown only for deliberate pauses |
| 17 | More tower stats | PRD §5.4, WBS 2.10 | 20 | planned |
| 18 | Upgrades need descriptions | PRD §5.4, WBS 2.10 | 20 | planned |
| 19 | Preview must fold live modifiers and colour downgrades red | PRD §5.4, WBS 1.7.1 | 12 | planned — **a bug**: the preview bypasses the relic fold entirely |
| 20 | Printing-trade names and puns throughout | PRD §13, D8, WBS 2.12 | 21 | planned — own session; first candidates rejected |

### Visuals

| # | Item | Where | Session | Status |
|---|---|---|---|---|
| V1 | Relic cards bigger, bordered, more elaborate | WBS 2.13 + 4.13 | 20, 22 | planned |
| V2 | Relics and slots get images, not two bracketed letters | WBS 4.13 | 22 | planned |
| V3 | Roads less straight, jagged edges | WBS 2.15 | 15 | planned — falls out of the widened shape vocabulary |
| V4 | Animated background and towers (2–3 cycling frames) | PRD §13, WBS 4.1 | 16 | planned — **engine work**, not an art chore |
| V5 | Explosion visuals | WBS 4.1 | 16 | planned |
| V6 | Shields as a blue bracket around any enemy, destroyed separately | PRD §8, WBS 2.14 | 17 | planned |
| V7 | Distinct colours / symbols / animations per tower | WBS 4.11 + art pass | 22 | planned |
| V8 | Void should look better — water, or something | PRD §13, WBS 4.12 | 16 | planned |
| V9 | Organic blending where tiles border void | PRD §13, WBS 4.12 | 16 | planned — safe because border cells can never carry road |
| V10 | Use background colour far more | PRD §13 | 16, 22 | planned |
| V11 | Tower art changes visibly with each upgrade | PRD §5.2, WBS 4.11, D3 | 22 | planned — this is what D3 (material language) has to answer |
| V12 | Enemies larger than one glyph | WBS 4.14 | 22 | **marked, not committed** — visual size only; mechanical multi-cell declined (PRD §14) |
| V13 | Enemy health and status effects shown beside the glyph (braille?) | PRD §8, WBS 2.14 | 17 | planned |

## Round 2 — 2026-08-16, after the wave-48 run

| Item | Where | Session | Status |
|---|---|---|---|
| A used consumable must free its slot | WBS 1.7.6 | 12 | planned — a bug; it currently blocks a slot forever |
| The `foundry` relic is bad — cut it | WBS 1.7.7 | 12 | planned — cut, with its now-dead engine knob |
| Mining ~10× slower | WBS 1.7.8 | 13 | planned — lands with finite deposits so scarcity arrives on both sides |
| Multiple Ore tiers with rising rarity | D9 | M3+ | **deferred with a trigger** — activate when the tech tree needs gating; richness tiers deliver the same "reach further" pull meanwhile |
| Tile Smith needs an "add to pool" button | WBS 2.16 | 14 | planned |
| A math engine for balancing, no rendering, no playing to death | WBS 1.5.3 + 1.5.4 | **12** | planned — the next session is this |
| Phase 5 is too early | ROADMAP | — | **accepted** — split; measurement now, bot deferred to 24+ |
| "Session 21+" content is too late | ROADMAP | 22–23 | **accepted** — art and the meta loop moved up; save/resume is nearly free (a save IS seed + input log) |
| No plan for animation; it is engine mechanics | WBS 4.1 | 16 | **accepted** — pulled out of M4 into its own session, ahead of art |

## Standing asks, carried across sessions

| Item | Where | Status |
|---|---|---|
| Sub-glyph shading | — | parked at Daniil's own suggestion; the effects render pass (16) is where it belongs |
| Tile Smith as an in-game meta feature | PRD §11 | planned, M4 |
| REXPaint session | ROADMAP Phase 2 | session 22 — **inverted**: tooling generates `.xp` candidates, REXPaint is for judgement, not production |
| Material language (D3) | ASSETS §5, D3 | open — must close before session 22 |

---

## Declined, with reasons

Recorded so they are not silently re-litigated. All are in PRD §14 with the
full argument.

| Item | Why |
|---|---|
| Relics that unlock both options of a tier | No possible artwork: 14 defined tower states, and this invents a 15th (Daniil's own call) |
| Mechanically multi-cell enemies | Costs SoA layout, collision, shields, targeting and pathing to buy nothing visible; a wide-drawn boss on a one-cell footprint looks identical |
| Offset (non-centre) connectors | **My proposal, withdrawn.** Larger change than the problem needs; centre-pegging keeps edge matching trivial |
| Claiming a cache by building on it | Sell the tower back and the relic was free |
| Mid-run tech tree at the Core | Permanent power bought mid-run moves `M` under the calibration model and removes run tension |
| Mutating the road mid-run | Forces the runtime "is a path still available?" check that pillar 2 exists to forbid |
| Silently simulating while the tab is hidden | Returning to a Core that died while you were away is hostile |
