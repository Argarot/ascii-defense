# Handover — state as of 2026-09-05 (end of day; sessions 23, 24 and 25 shipped sixteen PRs)

> **Updated once per working day** (Daniil). State and seams only; sequencing
> lives in the roadmap ledger, the checklist in the WBS, requests in the WBS
> request index. Anything restated here is a drift surface.

**Read order for a fresh context:** [CONTRIBUTING.md](CONTRIBUTING.md) →
[docs/PRD.md](docs/PRD.md) (§4.3.1 the board fills, §4.5 the Core at the
east edge, §5.3 six towers) → [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
(§12 the generation spec) → [docs/ASSETS.md](docs/ASSETS.md) (**§3 is
today's: sprite kinds, sequences, the placeholder generator**) →
[docs/CATALOGUE.md](docs/CATALOGUE.md) (**every tower, enemy and relic in
one table — Daniil's reading table; its PROPOSED section is his request
queue**) → [docs/WBS.md](docs/WBS.md) (D25–D28, the debt register, the
request index's rounds 22 and 23) → this file → the roadmap ledger's next
open row. The gitignored `POSTMORTEM.md` holds collaboration findings —
**read its last three sections before writing any code today.** End every
working day with the `wrap-session` skill, whose "next-session plan"
section is a contract (Daniil, 2026-09-05).

Live: <https://argarot.github.io/ascii-defense/> (verify cache-busted, always).
**Since this evening the title's hero row has SIX towers, the strip has six
buttons and two empty frames, enemies are small walkers, the Core face is a
drawn structure with a blinking eye** — a build without those is older.

## Where the project is

**2026-09-05 shipped sixteen PRs (#111–#127) in three sessions.** Sessions
23 and 24 (#111–#122): the junction cells by effective ports, the Core at
the east edge, the filled board with the mapgen sweep, the bottom strip,
the build sweep, boon colours, the full-screen shell.

Session 25 (evening, #123–#127), on Daniil's amended "Motion" plan:

1. **Three fixes (#123).** The Core column is buildable ground around the
   face (two cells touch it — the precious ones of PRD §4.5); the selected
   build button lost its accent plate (a `>` and the name in accent
   instead); eight button slots at ten columns with `short` names, spare
   slots drawn as empty frames; trait MARKS (`()` `##` `>>` `x3`) when the
   wave columns are narrow.
2. **The catalogue (#124).** `docs/CATALOGUE.md` rendered from content by
   `tools/codex.mjs` (towers with trees and DPS, enemies with traits as
   rules, relics with what they do); CI fails on a stale copy; the
   PROPOSED tables at the end are hand-edited and never touched — a row
   there is a request.
3. **Sprite kinds and sequences; placeholder sprites (#125).** The format
   gained `kind` (tower, terrain, enemy ≤5×3, relic 4×3, face) with a cell
   rule per kind, and `sequences` (charge, fire, cool, hit) with per-frame
   `ms`. `tools/placeholder-sprites.mjs` writes the seven enemies (walk
   cycles), sixteen relic icons and the Core face from art in the script;
   the view draws walkers centred on their position, relic icons in the
   slots, the face from its sprite. 29 sprites then, 31 now.
4. **Attack animations and ability graphics (#126).** The sim keeps each
   tower's last-shot tick (never hashed) and exposes `firePhase()`; the
   view's `attackLook()` plays authored fire/cool/charge sequences, or a
   placeholder derived from the idle frame (flash, one-row recoil, smoke,
   a charge spark in the last quarter of the cooldown). The orbital is a
   column of light then its blast (`strike` event); a freeze frosts the
   board's edges (`freeze` event).
5. **Two towers (#127).** The **Tesla Coil** — a new attack shape `chain`
   (hops to the nearest unhit body within reach, falloff per hop, an
   `arc` event drawn as jagged light) — and the **Missile Rack** (homing,
   explosive, dead zone, slow and heavy: the projectile spec as is). Both
   with either/or trees and generated sprites. Six towers of the target
   eight.

**Deliberately NOT built:** positional interpolation (6.9's first half).
Daniil: "we might want to add more animation frames first" — interpolation
(where an enemy is drawn between two sim ticks) and frame count (how many
pictures a sprite has) are different things; the sequence model shipped,
interpolation waits for his word. Also not built: the art agent's
sequences (placeholders derive them), the Tile Smith as a page, mixed
boon ground, the `X`/`B` road tiers (the linter still warns).

**Built ahead of two open decisions, by his "go":** D25 (multi-cell
towers — the two new ones are one cell) and 2.35 (a unique boon per tower
next to the Core — none has one yet).

**Gate:** session 25 — **Daniil's eye on the live build**: a Bolt that
visibly flashes and recoils; a Tesla arcing through a pack; walkers as
sprites; the six-tower strip; the catalogue readable. 2.27 — still his.

## Fresh-context warnings (beyond CONTRIBUTING)

- **Placeholder sprites are generated, never hand-edited**:
  `tools/placeholder-sprites.mjs` owns their art; edit the script and
  rerun. Their `source` field says so. The art agent replaces one by a
  study in `sources/sprites/` plus an importer rule.
- **The catalogue is generated between markers** (`tools/codex.mjs`);
  outside the markers is Daniil's. CI checks it (`--check`). After any
  roster or pool change: run it, commit the doc.
- **Sprite ids are looked up by convention**: `enemy_<id>`, `relic_<id>`,
  `core_face`, and towers by their roster id. Every sprite loads by glob
  in `main.ts`; the title hero is an explicit list.
- **The attack animation runs on the fire clock, not events**: the tower
  snapshot carries `cooldown01` and `sinceFire`; a tower without authored
  sequences gets the derived placeholder. Sequences are on the WORLD
  clock (`TICK_MS` = 50 ms per tick).
- **The chain attack is a third shape** beside projectile and pulse;
  `attack: 'chain'` needs `chain: {count, reach, falloff}` and a
  `projectile.damage` for the first hop.
- **The strip's column budget** on a 7-tile board (144 columns): eight
  buttons 82, the wave 32, the Core card the rest (~29). Below seven
  tiles it is cramped (debt register).
- **Heredocs through Bash still break** on backslashes and quotes: patch
  scripts go through the Write tool, replacements use a function
  replacer. `console.log` inside a vitest run is not shown by default —
  surface a probe's state through a thrown error instead.
- **The debug spawn mode ignores packs**: `maxSpawns`/`spawnEveryTicks`
  spawn single bodies round-robin over the entries; a test that needs
  neighbours spawns two per entry.

## Next session, proposed — 26: Combat identity

*(Daniil's rule: every shipped session ends with the next one proposed, a
full day on one theme. His "go" is enough.)*

**Theme.** Every tower answers a wave no other can, and the player can
tell which from the card — damage types that decide fights, statuses that
show with their sources, the last two towers, the Core-adjacent boons. It
is next because six towers now share one job (hit points), and every
further tower or enemy is authored against the resistance matrix this
session creates.

1. **Damage types with resistances (2.8)**: `damageType` (kinetic, energy)
   on every tower, resist/immune per enemy in the roster (a brute resists
   kinetic, a shellback's shield resists energy…), the card and the
   catalogue print the matrix. Proof: the build sweep — no single tower
   type clears wave 15 on Standard; each type has a wave it fails.
2. **Statuses visible, every source tracked (2.31)**: per-enemy effects as
   a list with a source and a stacking rule (Frost slow + Concussive slow
   is the named case), marks beside the walker (slowed, frozen, shielded,
   burning when it exists); Splinter's second blast drawn and explained.
3. **Tower facing and the Laser (2.34 + tower 7)**: a direction as tower
   state (set on build, rotated on demand, saved and replayed), the beam
   down a straight run of road hitting every body on it, damage ramping
   while it holds; its sprite per facing from the generator.
4. **The Support tower (tower 8) and the Core-adjacent boons (2.35)**: an
   aura that improves neighbours; then every tower's unique boon next to
   the Core, with these defaults unless amended — Bolt: pierce +1;
   Mortar: no dead zone; Frost: the field freezes every third pulse;
   Refinery: never runs dry; Tesla: +2 bodies; Missile: two per launch;
   Laser: double ramp; Support: aura doubled. Replaces Loadbearing's flat
   triple range.
5. **Hailstorm as a role (2.37) and the eight-tower sweep**: the second
   Bolt tier-3 gets a job (short-range full-damage volleys, or a stacking
   slow); `tools/build-sweep.mjs` grows a build per tower pair; the
   readings go to `docs/lab/`.
6. **The printing-trade lexicon (D8)** as the day's first conversation if
   he wants it — the names the new content inherits; default: keep the
   current names.

**Gate — Daniil's eye on the live build:** he can say which tower is for
which enemy from the card alone; a laser he can point that reads as a
beam; no single tower type clears wave 15 in the sweep.

**His part:** the boon per tower (defaults above), D25 (default: every
tower one cell), D8 names (default: current); the art agent's sequences
and replacements for the tesla/missile placeholders as they come.
Otherwise "go".

**Biggest risk:** damage types retune every fight at once — the sweep
runs before and after each PR, and a tower that loses every job is a
finding, not a fix. **Expensive if wrong:** the resistance matrix is the
thing every future enemy and tower is authored against; PR 1 is where to
argue.

**Interpolation (6.9 first half)** stays out unless he says the word: it
is where enemies are drawn between ticks, not how many frames a sprite
has; a day's PR when wanted.

## Standing open items

- Daniil's playtest of the deployed 2026-09-05 evening build — his.
- The road study's `X` and `B` tiers (flat stones) — his generator; the
  linter warns until then.
- The art agent: enemy, relic, Core-face, tesla and missile studies to
  replace the placeholders; attack sequences for the four studies.
- D25 multi-cell towers, D26 passives vs relics, D27 monetization — open.
- 2.27 gate — his.
- Technical-debt register: terminals once per session; 2× tile previews;
  the lab's analytic model; the lab gate tolerance at 8; the strip cramped
  below 7 tiles wide; the offer modal still shows relics as text (icons
  exist).
