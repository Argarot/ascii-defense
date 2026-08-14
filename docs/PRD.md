# ASCII Defense — Product Requirements

Status: **draft, awaiting approval.** Nothing here is built yet.

---

## 1. What it is

A roguelite tower defense game that runs in a browser and draws every single
thing — terrain, towers, enemies, projectiles, explosions, menus — as coloured
ASCII characters on a monospace grid.

A **run** is a journey through a procedurally generated node map (Slay the
Spire's structure). Nodes are battles, elites, shops, forges, events and bosses.
Each battle is a procedurally generated defense map. You lose the run when the
Core falls; you keep permanent unlocks and start again.

The ASCII presentation is a stylistic constraint, not a mechanic. Every design
decision below is judged as tower defense design first.

## 2. Who it's for

Players who like **Bloons TD 6's tower upgrade depth** and **Slay the Spire's
run structure**, and don't need pretty art to enjoy either. Desktop, mouse-first.
Public repo, playable from a URL with no install.

## 3. Design pillars

| Pillar | What it means | What it rules out |
|---|---|---|
| **Every tower placement is a build decision** | Deep authored evolution trees with a hard crosspathing limit | "Buy the best tower, spam it" |
| **No two runs are the same** | Procedural maps + procedural waves + drafted run modifiers | Memorised optimal placements |
| **Never unwinnable, never trivial** | Difficulty derived from an explicit maths model, validated by a bot harness | Hand-tuned levels; RNG that can hand you a dead run |
| **Readable at a glance** | Glyph = identity, colour = specialisation, brightness = tier | Visual noise that needs a legend to parse |
| **Content is data, not code** | Towers/enemies/modifiers/biomes are typed data files | Adding a tower requiring engine surgery |

## 4. Core loop

```
Run start  ──►  Node map (3 acts)
                  │
                  ├─ Battle  ──► place & upgrade towers across N waves ──► gold + draft 1 of 3 modifiers
                  ├─ Elite   ──► harder battle, guaranteed rare modifier
                  ├─ Shop    ──► spend gold: towers, modifiers, path re-rolls, Core repair
                  ├─ Forge   ──► permanently upgrade one carried tower for the rest of the run
                  ├─ Event   ──► text choice with a risk/reward outcome
                  └─ Boss    ──► act finale; unique mechanic; run-defining Core modifier
                  │
                Core HP hits 0 ──► run ends ──► bank meta-currency ──► unlock content
```

Target run length: **30–50 minutes** at 2× speed. A battle is 6–10 waves.

## 5. The map: "hybrid path + bypass" — the central mechanic

This is the design decision that makes the whole thing balanceable. Three terrain
classes:

| Tile | Glyph | Pathable | Buildable | Role |
|---|---|---|---|---|
| **Road** | `.` `,` | yes (cost 1.0) | **no** | The guaranteed route. Always exists. |
| **Ground** | `"` `'` | yes (cost 1.4) | **yes** | Open terrain you build on. |
| **Rock** | `#` `%` | no | no | Procgen obstacle. Free walls. |

Enemies use a flow field to walk the **cheapest** route to the Core.

The generator deliberately carves **bypass zones** — stretches of open ground
that are cheaper than following the road. Enemies take them. You close them by
building towers or cheap Walls, forcing enemies onto the long road.

The consequences are exactly what we want:

- **Mazing is a real economic decision.** Spend on lengthening the path, or on
  raw damage? Every run you make that trade.
- **The game can never become unwinnable.** The road is never buildable, so a
  valid path always exists. No "you blocked yourself, restart" failure mode.
- **The balance surface is bounded.** Path length varies between a known
  minimum (all bypasses open) and a known maximum (all closed). The wave model
  gets to work with a range, not an unbounded variable.
- **Over-mazing has a counter.** Flyers ignore pathing entirely and fly straight
  at the Core. Burrowers ignore ground cost. Pure mazing loses.

## 6. Towers

Every tower has **three upgrade paths of five tiers**, and the BTD6 crosspathing
rule: **one path may reach tier 5, a second may reach tier 2, the third stays at
0.** This single restriction is what makes 8 towers behave like 60.

On top of that, **drafted run modifiers** (relics) overlay the authored trees, so
the same tower plays differently run to run.

Launch families (M1 ships 4 complete; the rest follow):

| Glyph | Tower | Role | Path A | Path B | Path C |
|---|---|---|---|---|---|
| `^` | Bolt Turret | cheap single target | Velocity | Caliber | Optics |
| `o` | Mortar | AoE, minimum range | Payload | Cadence | Ordnance |
| `~` | Frost Emitter | slow aura | Chill | Shatter | Field |
| `%` | Acid Sprayer | DoT / armour shred | Corrosion | Volatility | Saturation |
| `\` | Arc Coil | chain lightning | Conductivity | Overcharge | Capacitor |
| `$` | Refinery | economy, no damage | Yield | Interest | Salvage |
| `+` | Bastion | buff aura to neighbours | Command | Logistics | Fortify |
| `X` | Rail Lance | long-range line pierce | Focus | Penetration | Overwatch |
| `#` | Wall | no attack; closes bypasses | — | — | — |

The Wall exists so that mazing costs money rather than tower slots. Without it,
mazing and DPS aren't a real trade.

**Reading the board:** glyph = family (never changes), colour = the path you
committed to, brightness/case = tier. You can read a whole defense in one look.

## 7. Enemies

Composed from trait flags rather than authored one by one:

`armoured` (flat damage reduction) · `shielded` (regenerating overshield, needs
burst) · `fast` · `flying` (ignores pathing) · `camo` (needs detection) ·
`swarm` (many, cheap) · `burrower` (ignores ground cost) · `regenerator` ·
`splitter` (spawns children on death) · `leader` (buffs nearby) · `boss`

Each trait is a hard counter question. A wave is not "more HP", it's "does your
build answer *this*".

## 8. Difficulty: derived, not authored

Waves are generated against an explicit model rather than hand-tuned. Per wave `w`:

```
L      effective path length      (read from the flow field — knows your mazing)
T      seconds an enemy is in the field   = L / speed
C(w)   gold the player could have earned by wave w   (deterministic)
D(w)   achievable in-path DPS  = f(C(w)) × η         (η = play-efficiency factor)
k(w)   target pressure curve   (the ONLY hand-authored difficulty knob)

wave EHP budget  H(w) = D(w) × T × k(w)
```

`k(w)` is a sawtooth: pressure rises across an act, spikes at elites and bosses,
dips immediately after. Enemy composition then spends `H(w)` on trait-costed
enemies drawn from a wave archetype (swarm / armoured column / mixed / flyer
flight / elite escort).

Because `L` comes from the live flow field, **the game already knows how much
mazing you did** and prices the wave accordingly. That is the mechanism by which
procgen stays fair without hand-designed levels.

`η` and `k(w)` are config, not code. The harness (§9) measures the real numbers
and we tune those two curves.

## 9. Autopilot & balance validation

Three separate things, all requested:

1. **Self-balancing procgen** — §8. The generator is fair by construction.
2. **Headless balance harness** — a CLI that runs thousands of seeded runs with
   several bot policies (`greedy-dps`, `economy-first`, `mazer`, `balanced`) and
   emits win-rate curves, lives-lost-per-wave, gold curves, and tower pick rates.
   Runs in CI. A balance regression fails the build.
3. **In-game auto-play** — the same bot driving the real game, watchable at 4×.
   Free once (2) exists, and it's genuinely fun to watch in ASCII.

The bot is the same code in all three. It is a first-class part of the project,
not a test fixture.

## 10. Meta progression (roguelite)

Death is permanent for the run. You bank a meta-currency and spend it on
**unlocks, not stat boosts** — new tower families, new starting Cores, new
biomes, new difficulty tiers ("Threat Levels"). Content widens; the balance
model never has to account for permanent power creep.

Stored in `localStorage`. No account, no server, no data leaves the browser.

## 11. Out of scope

Mobile/touch · multiplayer · sound (maybe later) · accounts or cloud saves ·
non-ASCII graphics · a terminal build (the renderer is designed so one *could*
be added, but it is not a deliverable).

## 12. Acceptance criteria

**M1 — playable loop.** One battle map, procedurally generated, 4 towers with
complete trees, 8 enemy types, 10 waves, win and lose states, mouse control. It
is fun for ten minutes.

**M2 — full run.** 3 acts, node map, shops/forges/events/bosses, drafted
modifiers, save/resume. A run completes end to end.

**M3 — balanced.** Harness reports win rates inside target bands across ≥500
seeds per policy; the difficulty curve matches the intended `k(w)` shape; no
seed produces an unwinnable or trivial battle. Auto-play mode watchable in game.

**M4 — shipped.** Public repo, live URL, README a stranger can follow, CI green,
14 towers, 3 biomes, meta unlocks.
