# ASCII Defense — Product Requirements

Status: **draft.** M0 (delivery path) is complete and live at
<https://argarot.github.io/ascii-defense/>. No game code is written yet.

---

## 1. What it is

A roguelite tower defense game that runs in a browser and draws every single
thing — terrain, towers, enemies, projectiles, explosions, menus — as coloured
ASCII characters on a monospace grid.

A **run** is a journey through a procedurally generated node map (Slay the
Spire's structure). Nodes are battles, elites, shops, forges, events and bosses.
Each battle is a procedurally generated defense map. You lose the run when the
Core falls; you keep mined Ore and spend it on a permanent Tech Tree.

The ASCII presentation is a stylistic constraint, not a mechanic. Every design
decision below is judged as tower defense design first — but the game should be
*good looking*, not merely functional. See §9.

## 2. Who it's for

Players who like **Bloons TD 6's tower upgrade depth** and **Slay the Spire's
run structure**, and don't need rendered art to enjoy either. Desktop,
mouse-first, playable from a URL with no install.

## 3. Design pillars

| Pillar | What it means | What it rules out |
|---|---|---|
| **Every placement is a build decision** | Deep evolution trees, a hard crosspathing limit, and towers that physically grow into their space | "Buy the best tower, spam it" |
| **No two runs are the same** | Procedural maps, waves, node routes and drafted modifiers | Memorised optimal layouts |
| **Never unwinnable, never trivial** | Difficulty derived from an explicit maths model, validated by a bot harness | Hand-tuned levels; RNG that hands you a dead run |
| **Every tile has a purpose** | Land far from the path is mining territory, not wasted space | Empty margins that never matter |
| **Readable at a glance** | Sprite silhouette = tier, colour = specialisation, glyph = family | Visual noise needing a legend |
| **Content is data, not code** | Towers, enemies, sprites, modifiers, biomes and tech nodes are typed data | Adding a tower requiring engine surgery |

## 4. Core loop

```
Run start  ──►  Node map (3 acts)
                  │
                  ├─ Battle  ──► place & upgrade towers, mine ore ──► Scrap + draft 1 of 3
                  ├─ Elite   ──► harder battle, guaranteed rare modifier
                  ├─ Shop    ──► spend Scrap: towers, modifiers, re-rolls, Core repair
                  ├─ Forge   ──► permanently upgrade one carried tower for the rest of the run
                  ├─ Event   ──► text choice, risk/reward
                  └─ Boss    ──► act finale, unique mechanic, run-defining Core modifier
                  │
                Run ends ──► banked Ore ──► Tech Tree ──► next run starts wider
```

Target run length: **30–50 minutes** at 2× speed. A battle is 6–10 waves.

## 5. The map: "hybrid path + bypass"

Three terrain classes:

| Tile | Glyph | Pathable | Buildable | Role |
|---|---|---|---|---|
| **Road** | `.` `,` | yes (cost 1.0) | **no** | The guaranteed route. Always exists. |
| **Ground** | `"` `'` | yes (cost 1.4) | **yes** | Open terrain you build on. |
| **Rock** | `#` `%` | no | no | Procgen obstacle. Free walls. |

Enemies use a flow field to walk the **cheapest** route to the Core. The
generator deliberately carves **bypass zones** — open ground cheaper than
following the road. You close them by building, forcing the long route.

Consequences, all deliberate:

- **Mazing is an economic decision**, not a puzzle. Spend on lengthening the
  path, or on raw damage?
- **The game can never become unwinnable.** Road is never buildable, so a valid
  route always exists.
- **The balance surface is bounded.** Path length varies between a known minimum
  and maximum, and the wave model reads it live.
- **Over-mazing has a counter.** Flyers ignore pathing; burrowers ignore ground
  cost.

Because towers now occupy multiple tiles (§6), **Walls remain 1×1** — they are
the precision instrument for closing narrow bypasses that no tower fits into.
Some bypass zones are generated deliberately narrow for exactly this reason.

## 6. Towers: footprint, growth, and evolution

### 6.1 Crosspathing

Every tower has **three upgrade paths of five tiers**, with the BTD6 rule:
**one path may reach tier 5, a second may reach tier 2, the third stays at 0.**
One restriction makes 8 towers behave like 60 builds.

Drafted run modifiers overlay the authored trees, so the same tower plays
differently run to run.

### 6.2 Towers occupy space, and grow

Character cells are roughly 1:1.7 (taller than wide), so a **3-wide × 2-tall**
footprint reads as square on screen. Towers grow as they specialise:

| Tiers | Footprint | Reads as |
|---|---|---|
| 0–2 | **3 × 2** | a compact emplacement |
| 3–4 | **5 × 3** | a serious installation |
| 5 | **7 × 4** | a landmark |

This is not decoration. It creates three real mechanics:

- **Placement must anticipate growth.** Upgrading requires the larger footprint
  to be free. Hovering an upgrade shows the expansion outline in advance, so
  this is a planning problem, never a gotcha.
- **The board is self-documenting.** You can see which tower took the tier-5
  from across the map, because it is physically the biggest thing there.
- **Density is a resource.** Fewer, larger towers means each placement carries
  more weight — reinforcing pillar one.

### 6.3 Sprites

Towers are authored as small ASCII sprites: per-cell (glyph, colour) pairs, with
2–3 animation frames for idle and firing. The family glyph always sits at the
sprite's centre so identity never changes as the thing grows.

```
Bolt Turret — kinetic, cyan

  T0-2 (3x2)     T3-4 (5x3)       T5 (7x4)

     .^.           .-^-.          ..-^-..
     [=]           |=#=|          /|=#=|\
                   '---'          |[###]|
                                  \-----/

Mortar — explosive, amber

     (o)           .(o).          ..(o)..
     [_]           |=_=|          /|=___|\
                   '---'          |[#####]|
                                  \------/
```

Frame vocabulary is strictly printable ASCII: `. ' - = | / \ [ ] ( ) _ # ^ ~ o`.

### 6.4 Families

Launch families (M1 ships 4 complete; the rest follow):

| Glyph | Tower | Role | Path A | Path B | Path C |
|---|---|---|---|---|---|
| `^` | Bolt Turret | cheap single target | Velocity | Caliber | Optics |
| `o` | Mortar | AoE, minimum range | Payload | Cadence | Ordnance |
| `~` | Frost Emitter | slow aura | Chill | Shatter | Field |
| `%` | Acid Sprayer | DoT / armour shred | Corrosion | Volatility | Saturation |
| `\` | Arc Coil | chain lightning | Conductivity | Overcharge | Capacitor |
| `$` | Refinery | Scrap economy | Yield | Interest | Salvage |
| `+` | Bastion | buff aura to neighbours | Command | Logistics | Fortify |
| `X` | Rail Lance | long-range line pierce | Focus | Penetration | Overwatch |
| `&` | Extractor | mines Ore (§7) | Throughput | Depth | Automation |
| `#` | Wall | 1×1, no attack, closes bypasses | — | — | — |

## 7. Mining and the Ore economy

The problem this solves: without it, ground far from the path is dead space.

### 7.1 How it works

- Procgen scatters **Ore Nodes** (`*`, coloured by richness) on buildable
  ground, weighted **toward tiles far from the path** — measured by the same
  flow field that drives enemy movement.
- Building an **Extractor** (`&`, 3×2, grows like any tower) on or adjacent to a
  node extracts **Ore** each wave.
- **Ore is never spendable during a run.** It banks automatically at run's end
  and is the sole currency of the Tech Tree (§8).

### 7.2 Two currencies, and why

| Currency | Earned from | Spent on | Persists? |
|---|---|---|---|
| **Scrap** | kills, wave clears, Refineries | towers, upgrades, shops, repairs — everything in-run | no |
| **Ore** | Extractors only | the Tech Tree | **yes** |

Because Ore cannot help you survive, **every extractor is a bet against your own
run**: Scrap spent on mining is Scrap not spent on defense. That is the
decision, and it is present from the first extractor rather than only late.

### 7.3 Keeping it from becoming free money

Once a run is comfortably won, surplus Scrap would otherwise convert into
unlimited Ore. Three economy-side caps, deliberately chosen over adding a new
enemy type:

1. **Nodes are finite.** Each has a total yield; a worked node depletes and the
   extractor idles. A map contains a bounded amount of Ore.
2. **Extractors get more expensive.** Each additional extractor in a run costs
   more than the last.
3. **Banking scales with difficulty, not grinding.** Ore banked is multiplied by
   Threat Level and run depth, so farming easy runs is strictly worse than
   pushing hard ones.

*Designed-in extension point:* if playtesting shows mining still feels
consequence-free, **Raiders** — enemies that break from the path to attack
extractors, in proportion to how many you own — drop in without reworking the
economy. The wave generator already supports per-wave objective splits. Not
built in stage 1.

## 8. Tech Tree (meta progression)

Spent with Ore. Persisted in `localStorage`. Built in **two stages**, with the
infrastructure for stage 2 present from the start.

### 8.1 Structure

Five disciplines, each a branch:

**Ballistics** · **Thermals** · **Arcana** · **Logistics** (economy and mining) ·
**Command** (auras, run modifiers)

Node types:

| Type | Grants | Stage |
|---|---|---|
| **Unlock** | new tower family, extractor type, starting relic, biome | 1 |
| **Option** | alternate tier-5s and path variants for existing towers | 1 |
| **Utility** | extra reroll, +1 draft pick, see next wave's composition | 1 |
| **Threat** | harder difficulty tiers — which multiply Ore income | 1 |
| **Economy** | small, explicitly capped starting-Scrap and yield bonuses | 1 (capped) |
| **Potency** | permanent stat increases: damage, range, rate | **2** |

### 8.2 Why staged, and what stage 1 must build anyway

Stage 1 is mostly content unlocks plus a tightly capped economy band, so the
difficulty model stays honest while the game is still being tuned. Stage 2 adds
genuine permanent power.

That upgrade only stays safe if the difficulty model treats permanent power as
an **input it already reads**. So from day one, the balance model carries a
`metaPowerIndex` term (§10) — a scalar summarising all permanent bonuses. In
stage 1 it is pinned near 1.0 by the caps. In stage 2 it widens. Nothing in the
model changes; a number it already consumes simply moves.

**The honest cost:** once `metaPowerIndex` varies, the balance harness must
validate across meta tiers as well as seeds and policies. That multiplies the
validation matrix, and it is the main reason stage 2 comes later.

### 8.3 Anti-grind

Ore income scales with Threat Level and run depth (§7.3), so progress comes from
playing harder, not longer.

## 9. Art direction

"Somewhat aesthetically pleasing" is a requirement, not a nice-to-have.

- **Colour carries meaning.** Family = glyph, specialisation = hue, tier =
  brightness and silhouette size. Damage types have fixed hues used consistently
  across towers, projectiles and status effects.
- **Motion sells impact.** Projectiles are directional glyphs (`- \ | /`),
  impacts bloom (`. + * X`), deaths decay (`X → x → . → ` `). Big hits nudge the
  viewport by one cell.
- **UI is drawn, not styled.** Panels, borders and the tech tree are ASCII
  chrome built from `+ - | . '`, rendered by the same Term as the game board.
- **Biomes are palettes.** Each biome re-tints terrain, so acts feel distinct
  without new mechanics.
- **Legibility beats spectacle.** Any effect that makes enemy count or tower
  state harder to read gets cut. This is the tie-breaker rule.

## 10. Difficulty: derived, not authored

Waves are generated against an explicit model rather than hand-tuned. Per wave `w`:

```
L      effective path length        (read live from the flow field)
T      seconds in the field         = L / speed
C(w)   Scrap earnable by wave w     (deterministic, net of extractor spending)
M      metaPowerIndex               (permanent Tech Tree power; ~1.0 in stage 1)
D(w)   achievable in-path DPS       = f(C(w)) x eta x M
k(w)   target pressure curve        (the one hand-authored difficulty knob)

wave EHP budget  H(w) = D(w) x T x k(w)
```

Three live inputs make this self-correcting rather than guesswork:

- **`L`** knows how much you mazed.
- **`C(w)`** is net of extractor spending — so a player who invests heavily in
  mining faces proportionally easier waves, because they genuinely have less
  defense. Mining is priced into difficulty automatically.
- **`M`** knows how much permanent power you carry.

`k(w)` is a sawtooth: pressure rises across an act, spikes at elites and bosses,
dips after. Composition then spends `H(w)` on trait-costed enemies drawn from a
wave archetype. `eta` and `k(w)` are config, not code.

## 11. Enemies

Composed from trait flags rather than authored individually:

`armoured` · `shielded` · `fast` · `flying` · `camo` · `swarm` · `burrower` ·
`regenerator` · `splitter` · `leader` · `boss`

Each trait poses a counter question. A wave is not "more HP", it is "does your
build answer *this*".

## 12. Out of scope

Mobile/touch · multiplayer · sound (maybe later) · accounts or cloud saves ·
non-ASCII graphics · a terminal build (the renderer permits one; it is not a
deliverable).

## 13. Acceptance criteria

**M1 — playable battle.** Procedural map, 4 towers with complete trees and
growth footprints, 8 enemy types, 10 waves, win/lose, mouse control. Fun for ten
minutes.

**M2 — full run.** 3 acts, node map, shops/forges/events/bosses, drafted
modifiers, mining and Ore banking, save/resume.

**M3 — balanced.** Harness reports win rates inside target bands across ≥500
seeds per policy; curve matches intended `k(w)`; no unwinnable or trivial seed.
In-game autopilot watchable.

**M4 — meta and polish.** Tech Tree stage 1, Threat Levels, 14 towers, 3 biomes,
full sprite art, particles and UI chrome. Public README a stranger can follow.

**M5 — stage 2 (optional).** Potency nodes, plus the expanded harness matrix
validating win rates across meta tiers.
