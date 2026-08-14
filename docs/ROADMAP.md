# ASCII Defense — Roadmap & Estimates

A "session" = one focused working stretch, roughly a few hours.

These docs are written to be **handed off**. Anything load-bearing is stated
explicitly rather than left as conversational context. Start with
[HANDOFF.md](HANDOFF.md).

---

## M0 — Foundation & delivery path ✅ COMPLETE

- Vite 7 + TypeScript strict, zero runtime dependencies.
- `src/term/Term.ts` — glyph atlas + dirty-cell renderer. 0.93 ms/frame at
  120×50 with 400 entities, against 17.22 ms/frame for naive `fillText`.
- GitHub Actions building and deploying to Pages.
- Apache-2.0, PRD, architecture, roadmap.

**Live: <https://argarot.github.io/ascii-defense/>** — verified by loading the
deployed page and confirming it renders, not by trusting a green check.

## M1 — The fun test *(6–8 sessions)*

One battle. No run structure. Everything needed to answer "is this fun?"

*Re-estimated up from 4–5. The renderer is being rebuilt on WebGL2, the art
pipeline now runs through an external tool, and subcell coordinates touch the
sim from the start. All three were decided after the first estimate.*

- **WebGL2 renderer** replacing the canvas `Term`: instanced quads, white glyph
  atlas, 24-bit per-cell colour. The `put/write/clear/flush/toText` API is
  preserved; only the guts change. Canvas 2D measured 38 ms/frame under real
  animation load and is not viable — see ARCHITECTURE §4.
- **unscii-8** vendored (public domain), 8×8 square cells, 240×135 grid.
- **`tools/rexpaint-import`** — REXPaint XML/CSV → runtime sprite JSON.
- **Subcell entity coordinates** from day one — ARCHITECTURE §4a.
- Workspace restructure into `packages/*`; lint rules for `no-Math.random` and
  `engine-must-not-import-DOM`.
- Seeded RNG with named streams; fixed 20 Hz tick; pause / 1× / 2× / 4×.
- Content pipeline: JSON schemas, generated types, validation, content linter.
- Map procgen: terrain, road carving, meaningful shortcuts, ore node scattering
  weighted by distance from path.
- Dijkstra flow field (ground + flying) and the **speculative field** that backs
  the path-preview overlay.
- Occupancy grid; 3×2 placement; click targeting.
- Sprite system loading from JSON.
- 5 towers with complete 3×5 trees, crosspathing enforced. 6 enemies across the
  two damage types and five traits.
- Wave composition; Scrap; lives; win/lose.
- Mouse-first HUD: range preview, **path preview**, build palette, upgrade panel
  showing all three paths and which remain legal.
- **Smoke harness** — the bot exists, crudely, and produces margin numbers.
- Replay record/playback with the golden state-hash test.

**Exit gate:** Daniil plays it and says whether it is fun. Nothing past this
point is worth building if the answer is no.

## M2 — A complete game *(3–4 sessions)*

The smallest thing that is a whole game rather than a demo.

- 8 battles in sequence, escalating; draft 1-of-3 between each.
- Ore banking (per-tier record, one tier active).
- 5-node tech tree — enough to prove the loop, not the full tree.
- Run state machine, save/resume, versioned persistence with migration tests.
- Win and lose screens; run summary.

Deliberately **not** here: branching node maps, shops, forges, events, bosses.
They are expansion, not core.

**Exit gate:** a run can be played start to finish, won or lost, and resumed.

## M3 — Trustworthy difficulty *(2–3 sessions)*

- Bot promoted from smoke to a real single policy.
- `harness calibrate` — solves budget curves from measured margin, writes them
  to `content/balance/curves.json` as reviewable data.
- Human offset constant measured from Daniil's recorded replays.
- `harness check` in CI; fails on drift.
- Unwinnable/trivial seed detection across ≥500 seeds.
- In-game autopilot toggle.

**Exit gate:** injected regressions are caught; no unwinnable or trivial seed.

---

## ◆ Decision point

**Roughly 9–12 sessions in, there is a complete, balanced, replayable game.**

Everything below is expansion, and should only be built if the answer to "is
this fun and do I want more of it?" is yes.

---

## M4+ — Expansion *(8–15 sessions, à la carte)*

| Item | Sessions |
|---|---|
| **Effects system** — subcell particles, projectiles, impacts, explosions, tower animation; hot-reloadable definitions, templating, importance-scaled timing | 2–3 |
| Branching node map, shops, forges, events | 2–3 |
| Act bosses with unique mechanics | 1–2 |
| Towers 6–9 (Acid, Arc Coil, Bastion, Rail Lance) | 2–3 |
| Enemy traits 6–11; third damage type | 1–2 |
| Full art pass: terrain, enemies, particles, UI chrome, biomes | 2–3 |
| Tech tree stage 2 (full tree, 5 disciplines) | 1–2 |
| Ore tiers activated | 0.5 |
| Daily challenges + replay sharing UI | 0.5–1 |
| Tech tree stage 3 (Potency nodes) — *optional, see PRD §10* | 1–2 |

---

## Totals, honestly

| | Sessions |
|---|---|
| M1–M3 — complete playable game | **11–15** |
| M4+ — everything else | +10–18 |
| **Full scope as described** | **21–33** |

Two earlier numbers were wrong and are corrected here. The original 11–15
underestimated the tuning tail: the last 20% of balance work across 100+
upgrades is not 20% of the effort. Scoping *everything* was honestly 25–35; the
cuts in this revision — 8 towers instead of 14, 2 damage types instead of 4,
5 traits instead of 11, node maps deferred — bring it to 17–27, with the
genuinely playable milestone at 9–12.

---

## Risks

**1 — Calibration may not transfer from bot to human.** The bot will play worse
than Daniil, and the offset between them may not be a constant — it may vary by
wave, by build, by map.
*Mitigation:* the harness ships in M1, so divergence surfaces early; budget
curves are committed data, so retuning is a diff, not a code change.
*Fallback:* bounded dynamic difficulty adjustment — a clamped correction on
`k(w)` that can never trivialise or brick a run.

**2 — Mazing may be unreadable even with the overlay.** Flow-field routing is
genuinely hard to convey.
*Mitigation:* the speculative field lives in the engine, so preview and reality
cannot disagree. If it still doesn't land, the fallback is raising ground cost
until shortcuts are rare and mazing becomes a minor optimisation rather than a
core mechanic — a content-level change.

**3 — Mining may feel flat.** Balanced purely by opportunity cost, with nothing
threatening extractors.
*Mitigation:* the decision is real from the first extractor because Ore never
helps the current run. If it still feels inert, Raiders remain designed-in — the
wave generator supports per-wave objective splits from the start.

**4 — The tuning tail is the schedule risk, not the features.** Every estimate
above assumes content that is *authored*; making 100+ upgrades feel good is
open-ended.
*Mitigation:* the content linter flags cost-to-power outliers mechanically, and
the harness makes "did this get better or worse" measurable rather than a
matter of opinion.

---

## Daniil's actions

**Done:** GitHub account, `gh` with a repo-scoped fine-grained token, repo,
Pages.

**Next, at the M1 gate:** play it. Report whether placing and upgrading feels
good, whether the board reads clearly, and whether mazing is a decision you
actually think about. Record a few runs — those replays become the human offset
constant in M3.

Running cost remains **$0**.
