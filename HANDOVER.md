# Handover — state as of 2026-09-06, evening (session 28 shipped six PRs on Relics II after five fixes; sessions 23–28: forty-one PRs in two days)

> **Updated once per working day** (Daniil). State and seams only; sequencing
> lives in the roadmap ledger, the checklist in the WBS, requests in the WBS
> request index. Anything restated here is a drift surface.

**Read order for a fresh context:** [CONTRIBUTING.md](CONTRIBUTING.md) →
[docs/PRD.md](docs/PRD.md) (§4.9 chests and the water finding, §7.4–7.8
the relic layer as built) → [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) →
[docs/ASSETS.md](docs/ASSETS.md) → [docs/ART-AGENT.md](docs/ART-AGENT.md)
(a promise to another agent) → [docs/CATALOGUE.md](docs/CATALOGUE.md)
(towers, enemies, 41 relics, 14 passives, 18 sets, 5 recipes, 3 loot
tables — the in-game HOW TO PLAY renders the same facts from
`packages/app/src/generated/codex.ts`) → [docs/lab/](docs/lab/) (today's
three sweeps: the Laser cadence, the relic sets, and **read the boards
note first**) → [docs/WBS.md](docs/WBS.md) → this file → the roadmap
ledger's next open row. The gitignored `POSTMORTEM.md` holds
collaboration findings — **read its last section before writing any code
today; it has three rules about this working tree.** End every working
day with the `wrap-session` skill.

Live: <https://argarot.github.io/ascii-defense/> (verify cache-busted, always).
**Since today the strip has a PASSIVES row, a relic offer card can wear a
blue or gold frame, clicking a held relic opens a card with SALVAGE and
COMBINE, HOW TO PLAY lists 41 relics** — a build without those is older.

## Where the project is

**2026-09-06, evening. First the feedback round on the morning build
(#147–#151):** every effect born at the newest tick died before the
render clock reached it (motion v2's prune) — fixed, and every effect is
now painted at least once; statuses are the ground under the walker,
not glyphs; the Laser has no range and pulses once a second with a
shaped pulse; the Orbital is a two-cell column of background light; on
pause the board draws from the newest snapshot so builds show at once.

**Then session 28, Relics II (#152–#157), on the accepted defaults:**

1. **The passive layer (#152; D26 decided).** Passives are tower mods
   folded into every tower like a tier plus econ knobs; six slots; a
   pick every second wave from three; `passives/pool.json` (14, tagged);
   the strip's PASSIVES row; the golden moved 3921408197 → 1825542629
   (three empty lanes, reason on the constant).
2. **Rarity with teeth, tags, sets (#153).** Every relic has a base
   rarity; every draw rolls by wave, never below the base; rare/epic
   `tiers` carry their own numbers and text; tags on relics and passives
   light `sets/pool.json` (18) at two and three of a tag; frames say the
   rarity.
3. **Replace, salvage, combine, skip (#154).** Twelve relic slots; a full
   row asks which held relic a pick replaces; S skips any offer; a held
   relic's card in the column salvages (10/20/35 Ore) or combines — two
   of a kind climb a rarity, `recipes/pool.json` (5 duos) fuse into
   fusion-only relics; a slot pulses when its rule fires; the summary
   counts fires.
4. **The pool grown (#155).** Twenty relics on nineteen new engine knobs,
   36 in the pool plus 5 fusion-only; placeholder icons for the 25 without
   art; Foundry shipped from the PROPOSED table; a discounted tower never
   sells at a profit (the test caught it).
5. **Void chests and loot in the codex (#156).** Chests surface and sink on
   the loot stream, claimed through `void_chest`; every table printed.
   **Found: the session-24 boards have no water on 17 of 18 seeds**, so
   chests take unprospected rock as a second home on a waterless board —
   PRD §4.9 carries the amendment for Daniil.
6. **The relic sweep and the distance term (#157).** Eight random
   six-relic sets land 16.5–19.3 against 13.8 with none (inside the 16–24
   band, none past 24); the inline instrument now goes to the choke and
   the aimed Laser line reads **27.0** — the strongest build by a wide
   margin.

**Not built:** passive sprites (two-letter labels stand); full keyboard
operation (4.24's second half); the Tile Smith as a page of the shell.

**Readings for Daniil, his calls:** the Laser at 27.0 (knobs: pulse
damage 20 → 14, or heat ×2 → ×1.5); the ramp after damage types; the
strip's text scale; Hailstorm's role; whether the generator should leave
water for the chests or rock stays; whether relic offers should exclude
relics whose rule cannot apply to the held towers (the sweep did not
need it).

**Gates:** session 28 — **Daniil's eye on the live build**: a full row
is a decision, not a wall; a rare card reads as rare; two runs of one
seed differ for the relics alone; a chest is worth watching for. 2.27 —
his.

## Fresh-context warnings (beyond CONTRIBUTING)

- **Two agents share this working tree.** The art agent's untracked
  files (`packages/view/src/board/terrainSprites*.ts`,
  `packages/content/assets-reworked/`, `sources/`) and its uncommitted
  edits to TRACKED files (`packages/view/src/board/style.ts` today) live
  beside yours. `git add` by explicit path only, and `git diff <file>`
  before adding to see every hunk is yours — PR 5 shipped two of theirs
  and CI caught it. Local `tsc --build` fails on their test fixture;
  CI is the arbiter. Never `git stash`, `checkout .` or `reset --hard`.
- **The gate is the exit code, not a grep.** `npx vitest run > log; test
  $? -eq 0` before any commit; `gh pr checks N --watch` exit 0 AND no
  `pending` line AND the head SHA equal to the branch tip before merge.
- **`__ad` grew a lot today**: `fx()`, `frame(now)` (one frame by hand —
  the hidden pane fires no animation frames), `grant(id)`, `fire(id, x,
  y)`, `passives()`, `pickPassive(n)`, `relicsHeld()`, `sets()`,
  `openRelic(i)`, `salvage(i)`, `combine(a, b)`, `combineTargets(i)`,
  `uses()`, `skipOffer()`, `chests()`, `surfaceChest(x, y)`,
  `claimChest(x, y)`, `lootLog()`. The grant, surface and frame hooks
  are not recorded inputs: a run that used them replays differently.
- **Relic effects are read at the HELD rarity** (`heldEffects(hi)`,
  `relicEffectsAt`), never `def.effects` directly; the five held arrays
  grow and shrink only through `pushHeld`/`spliceHeld`.
- **The relic pool's size is a map knob** (`relicPoolSize` → boon
  cells). Growing the pool moves every board; a sweep is comparable only
  within its own file.
- **A rule that fires calls `noteRelicUse(field)`** at its site, or the
  strip never pulses for it and the summary never counts it.
- **The render clock is the picture's time for walkers and shots only**;
  everything else draws from the newest snapshot (the pause fix).
- **A PRD section older than the last generator change** (session 24) may
  describe a board that no longer exists — §4.9 did. Check the section's
  nouns against a generated board before building on it.

## Next session, proposed — 29 (ledger row 29): Enemies II

*(The ledger's old "28–29 content completeness" split: enemies first.
His "go" is enough; defaults stated.)*

**Theme.** Seven bodies in the roster and eight towers, forty-one relics,
fourteen passives against them: the enemy side is now the thin one, and
two runs differ by the relics far more than by what walks in. Fourteen
enemies across the trait matrix, with new traits that ask new questions
of the eight attack shapes, a wave composer that uses them, and the lab
reading every one.

1. **Seven new bodies (PR 1–2)**: across kinetic/energy resist and the
   traits — a splitter (dies into swarmlings), a healer (mends neighbours
   in reach), a burrower (unhittable for stretches of road), a charger
   (speeds up when hit), a shieldbearer (projects a shield onto the body
   ahead), a leech (breaches heal it — no, breaches steal Scrap), a
   second boss shape. Each a rule in `traits.ts`, a sprite from the
   placeholder generator, a codex page. Default numbers from the sweep.
2. **The wave composer II (PR 3)**: packs and formations — a shielded
   column, a splitter line, a healer behind brutes — from wave 6 on;
   bosses with an escort; the "1 front" fronts named by kind.
3. **Counter legibility (PR 4)**: every new trait shows on the body (the
   ground rule, a mark only where the ground cannot carry it) and prints
   on the strip's WAVE NOW with the tower that answers it.
4. **The Laser and the ramp (PR 5)**: the balance pass Daniil's readings
   are waiting for, against a stated target: default — the reference
   build with six random relics at 16–24 on Standard, the Laser line
   within four waves of the reference, Hailstorm's crowd kills above the
   Railbore line's. The sweep before and after.
5. **The enemy sweep (PR 6)**: every new body alone and in its pack
   against the eight builds; the trait that no build answers is flagged.

**Gate — Daniil's eye on the live build:** wave 10 looks different from
wave 5 for what walks in, not only how much; every new body says what
it does by standing there; no build clears every wave alone.

**His part:** the balance target (default above), names for the seven if
he wants them (the PROPOSED enemies table), the water-or-rock call for
the chests, art as it comes.

**Biggest risk:** traits that touch the flow field (the burrower) or the
hit test (the shieldbearer) reach into the sim's hot paths; a rule
wrong there costs replay fidelity. Each new trait is a replayed,
hashed, golden-checked change. **Expensive if wrong:** the trait API
(`traits.ts` rules + per-enemy state arrays) is what every later body
is authored against; PR 1 is where to argue.

## Standing open items

- Daniil's playtest of the evening build — his; the six gates above.
- The Laser at 27.0, the ramp, the strip's text scale, Hailstorm — his
  four calls, now with a fifth: water or rock for the chests.
- Retire Loadbearing beside the Core gifts — his call.
- The art agent: its terrain work is live in this tree; a directory
  contract (writes under `sources/` only, the dev commits on request)
  is the fix for the three rounds it cost today.
- Repo settings: the homepage is empty and the token cannot set it.
- D25 multi-cell towers, D27 monetization — open.
- 2.27 gate — his.
- Technical-debt register: passive sprites; the Tile Smith as a page;
  4.24's keyboard half; terminals once per session; 2× tile previews;
  the lab's analytic model; the offer modal without icons; relic offers
  weighted by applicability.
