# ASCII Defense — Roadmap

A "session" is one focused working stretch, roughly a few hours.

Read [PRD.md](PRD.md) first, then [ARCHITECTURE.md](ARCHITECTURE.md), then
[CONTRIBUTING.md](../CONTRIBUTING.md). This file assumes all three.

---

## M0 — Foundation ✅ COMPLETE

- WebGL2 glyph renderer, chosen on measurement (canvas 2D fails at 6,000 cells).
- Bitmap font pipeline: `.hex` and `.bdf` parsed to 1-bit atlases at build time.
- GitHub Actions → Pages, live and verified by loading the deployed page.
- Apache-2.0, PRD, architecture, assets, contributing.
- **Presentation decided by measurement, not argument**: spleen 5×8, 5×3-glyph
  cells, 5×5-cell tiles, tile-laying core loop, shading-based depth.

Live: <https://argarot.github.io/ascii-defense/>

---

## M1 — The fun test *(11–14 sessions)*

One board. Lay tiles, build towers, survive waves. Everything needed to answer
"is this fun?" and nothing else.

Sequenced so the risky, foundational parts come first.

### Phase 1 — harness before game code *(2 sessions)*

Nothing game-shaped. This is what makes the next twenty sessions cheap, and
building it afterwards is how projects end up untested.

- Workspaces: `engine content render view bot harness app` + `tools`.
- ESLint with the custom rules enforcing invariants 1–3 in CONTRIBUTING.
- Vitest + **Browser Mode + Playwright** (the renderer cannot be tested in Node).
- **`ci.yml`** — typecheck, lint, unit, golden, snapshot, content validation.
- `pure-rand` replacing the biased hand-rolled PRNG in the mocks.
- Text-snapshot infrastructure built on `GLTerm.toText()`.
- Content pipeline: schemas, `json-schema-to-typescript`, `ajv`, content linter.

**Gate:** CI green on an empty game.

### Phase 2 — art pipeline proof *(0.5 session, needs Daniil)*

- `tools/build-rexpaint-font.mjs` — spleen atlas as a 16-column PNG.
- Install the font into REXPaint, author **one** tower and **one** terrain tile.
- `tools/rexpaint-import.mjs` — `.xp` → runtime JSON.
- Render the imported art in the browser.

**Gate:** a sprite drawn in REXPaint appears in the game unchanged. Prove the
round trip before authoring a library against it.

### Phase 3 — the board *(2–3 sessions)*

- Seeded RNG with named streams; fixed 20 Hz tick; pause / 1× / 2× / 4×.
- Three-level grid; **subcell entity coordinates**; occupancy array.
- Tile library, connector matching, legality. *(Tile-laying flow superseded by
  the 2026-08-15 pivot: a **map generator** assembles the board at run start —
  Core tile center, `entries` carved paths, ore by road distance.)*
- Dijkstra flow field over cells; `L` in cells. *(One field: flyers are cut.)*
- Terrain rendering with background painting and shading.

**Gate:** connectivity property test — seeded boards across edge-biased sizes
plus an adversarial unit battery. (Originally "10,000 generated boards";
rescoped once connectors became derived-by-construction — mass-generating a
space where invalid states are unrepresentable tests the RNG, not the logic.)

### Phase 4 — the game *(3–4 sessions)*

- 4 towers with complete 3-tier either/or trees (Wall is cut — PRD §5.3).
- 6 enemies across 2 damage types and 4 traits; targeting; projectiles.
- Waves, Scrap, Core health and enemy `damage`, win/lose; Refinery and Ore.
- **HUD** — build palette, tower inspector with tier legality, wave state,
  speed controls. *This is a first-class item, not a line: it is the entire
  surface the player touches, and it was previously under-scoped.*
- Replay record/playback; golden state-hash test.

*(The Core's own branch tree was cut here on 2026-08-16 — PRD §14 — and
replaced by Phase 6 below.)*

### Phase 6 — the power layer *(2 sessions)* — **runs before Phase 5**

*(Added 2026-08-16. Numbered 6 because WBS IDs are stable once assigned;
sequenced third-from-last because the fun test cannot be run without it.)*

This is the layer that makes the game a roguelite instead of a tower defense
with a seed: relics acquired mid-run that break rules rather than move numbers
(PRD §7). It is placed before the harness because the harness calibrates
against the game, and calibrating against a game missing its power layer would
produce curves we would immediately throw away.

- Engine **hook layer** — the seams relics modify, applied in a fixed
  deterministic order. Relic schema, codegen, validation.
- Acquisition **B** (wave-clear pick-1-of-3), then **C** (Ore draw/reroll at
  the Core), then **A** (map caches claimed by selection).
- ~20 relics as content across passive / active / consumable.
- The **Core as vessel**: HP, relic inventory, active firing, cooldowns.
- **Prospecting**: rock contents dealt at generation, revealed for Scrap;
  gated behind the Refinery's Survey path.

**Gate:** a run in which two relics combine into something absurd, reproduced
from its seed and input log.

### Phase 5 — smoke harness *(0.5–1 session)*

- Crude bot; `harness calibrate` and `harness check`; per-wave margin table.
- The bot's policy includes relic picks — they are part of run power (PRD §9).

**M1 exit gate:** Daniil plays it and says whether it is fun. Nothing past this
point is worth building if the answer is no.

---

## M2 — A complete run *(3–4 sessions)*

Full difficulty arc, escalating waves, save/resume, run summary. 4 more towers,
~8 more enemies, more relics.

## M3 — Trustworthy difficulty *(2–3 sessions)*

Real bot policy; calibrated curves committed as reviewable data; human offset
from Daniil's replays; `balance.yml` gate; unwinnable/trivial seed detection;
tech tree stage 1; in-game autopilot.

---

## ◆ Decision point

**~14–18 sessions in there is a complete, balanced, replayable game.** Everything
below is expansion and should only be built if the answer to "is this fun and do
I want more of it?" is yes.

---

## M4+ — Expansion *(8–15 sessions, à la carte)*

| Item | Sessions |
|---|---|
| Effects: subcell particles, projectiles, impacts, tower animation | 2–3 |
| Full art pass + material language + biomes | 2–3 |
| Towers 5–9; traits 6–11; third damage type | 2–4 |
| Tech tree stage 2 | 1–2 |
| Daily challenges + replay sharing | 0.5–1 |
| Ore tiers activated | 0.5 |
| Tech tree stage 3 (Potency) — optional | 1–2 |

---

## Totals

| | Sessions |
|---|---|
| M1–M3 — complete playable game | **17–21** |
| M4+ | +8–15 |
| **Full scope** | **25–36** |

M1 grew from 6–8 to 8–11 because the HUD was previously a bullet point, the
modular package split is real work, and the art pipeline now has a proof step.
It grew again to 11–14 on 2026-08-16 when the relic layer (Phase 6) was added —
the single largest scope increase of the project, taken deliberately because
the M1 gate asks "is it fun?" and the honest answer needs the acquisition loop
in the room. Building it after the gate would mean asking the question twice.

---

## Risks

**1 — Calibration may not transfer from bot to human.** The bot will play worse
than Daniil, and the offset may vary by wave and by build.
*Mitigation:* harness ships in M1; curves are committed data, so retuning is a
diff. *Fallback:* bounded dynamic difficulty adjustment, clamped so it can
never trivialise or brick a run.

**2 — Generated maps may be samey.** *(Replaced the tile-laying risk after the
2026-08-15 pivot.)* If the generator's output blurs together, runs blur
together, and the roguelite dies.
*Mitigation:* map knobs are difficulty data and tunable per threat level; the
tile pool grows via meta progression, so variety is content, not code; the
generator is seeded, so a boring map is a reproducible bug report.

**3 — Art volume.** 8 towers × 15 tiers + terrain + enemies + UI, all
hand-drawn at 5×3.
*Mitigation:* REXPaint instead of hand-typed JSON; the material language defined
once, up front; M1 ships 4 towers complete rather than 8 half-done.

**4 — The tuning tail is the schedule risk, not the features.** Making 100+
upgrades feel good is open-ended. The linter and harness make "better or worse"
measurable rather than a matter of opinion.

**5 — Relics widen the difficulty distribution faster than calibration can
track it** *(added 2026-08-16)*. Combinations are the point, and combinations
are combinatorial: 20 relics is 190 pairs nobody play-tested.
*Mitigation:* relics are data behind a fixed hook layer, so an offender is a
one-line pool removal, not a code change; calibration targets a distribution
rather than a point (PRD §9); and a run trivialised *by relics* is the feature
working, so the harness must only alarm on maps, never on draws.
*Fallback:* rarity tiers on the pool, which the schema reserves from day one.

---

## Daniil's actions

**Done:** GitHub, scoped token, repo, Pages, REXPaint installed, and every
presentation decision.

**Next, at the Phase 2 gate:** draw one tower with me in REXPaint so we prove
the round trip before building a library on it.

**Before Phase 4:** define the material language jointly — which glyph
combinations mean metal, stone, energy. It is the highest-leverage art decision
and a taste call.

**At the M1 gate:** play it, and record a few runs — those replays become the
human offset in M3.

Running cost remains **$0**.
