# Handover — state as of 2026-09-03 (end of day; session 21: the audit, the hygiene round, design round 1)

> **Updated once per working day** (Daniil). State and seams only; sequencing
> lives in the roadmap ledger, the checklist in the WBS, requests in the WBS
> request index. Anything restated here is a drift surface.

**Read order for a fresh context:** [CONTRIBUTING.md](CONTRIBUTING.md) →
[docs/PRD.md](docs/PRD.md) — **§9.2 (wave tempo), §4.6 (caches), §5.3 (the
trees), §7.6 (relics) changed today** → [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
(§12 is the generation spec) → [docs/WBS.md](docs/WBS.md) — **decisions
D17–D23 and the technical-debt register are today's** → this file → the
roadmap ledger's next open row. The gitignored `POSTMORTEM.md` holds
collaboration findings — **read its last three sections before writing any
code today.** End every working day with the `wrap-session` skill.

Live: <https://argarot.github.io/ascii-defense/> (verify cache-busted, always;
the run code `AD1-…` on the pause screen is the build marker, and since today
the HUD's separators are visible braille dots — a HUD showing `seed N   1x`
with a blank gap is the OLD build).

## Where the project is

**Session 21 (2026-09-03) opened with a fresh-eyes audit** of the whole
codebase (three parallel read-only passes: engine; view/render/app;
content/harness/tools/CI) and a design review of the game as a player. The
audit's fix-first list shipped as **PR #98** (hygiene round: blank Latin-1
glyphs made the HUD's separators invisible for three sessions; a stale
snapshot across `ready`; meta saves versioned by the run format; `?threat=abc`
crash; `sellTower` unbounded; empty-wave-1 roster crash; the "press R" lie).
Everything else the audit found is in the **WBS technical-debt register**.

**Design round 1 then shipped as five PRs (#99–#103)**, every item approved
by Daniil with amendments, decisions **D17–D23** minted:

1. **Pacing (D17–D19, #99):** the wave clock runs launch-to-launch and never
   waits for the last enemy; **CALL NEXT WAVE** (button and `N`) banks the
   remaining clock as Scrap; **wave 1 waits for the call**; the next wave is
   composed one wave ahead and shown by kind and count; **boss waves** every
   5th and on the final wave by rule (one boss behind an escort, replacing
   the elite surge); the PRD's `L` offset is live (hp × √(mean lane/floor));
   **traits are rules** (`engine/sim/traits.ts`).
2. **Relics (D20, #100):** `stackable` per relic, unstackables leave the pool
   once held; draws cost 50 Ore ×1.5 per purchase, rerolls 15 ×1.5; pool
   10→16 (Ballistics Lab cut; Second Wind, Quarry, Toll, Bounty Board, and
   the first consumables Sandbags / Flashbang / Ore Pocket).
3. **Caches and loot tables (D21, #101; WBS 2.22 half-shipped):** caches come
   from prospected rock (≤3 per map) and every boss where it dies; opening is
   free; contents roll a **loot table** in content on the new `loot` stream.
   `SAVE_VERSION` 4.
4. **Minimum range (D22, #102):** `minRange` is a folded stat; the Mortar has
   a 2.5-cell dead zone; the range draws as a filled disc of fading rings
   with the hole dark and red-rimmed, for every tower.
5. **Tower trees (D23, #103):** every fork is two roles. New knobs:
   `damageMul`, `shots`+`spread`, `pierceCount`, `shieldMul`,
   `slowedBonusMul`, `freezeEvery`, `slowMul` as a stat, `ignoreArmor`,
   `deepBore50/100`. Refinery mines slower (1 Ore / 40 s) and deep choices
   grow the vein at a slower cycle.

**NOT built today, approved for next:** the **geometry migration to 8×5-glyph
cells** (option 1: board shrinks to fit the viewport, tiles stay 5×5), the
sprite importer (his sprites arrive as JSON; expanded placeholders until then),
committing `tools/art` (still untracked), and the rest of the debt register.

**Two gates remain Daniil's:** the 2.27 gate (loadout-heavy runs without a
defect list) and now **design round 1's gate** — a Standard run where the
eleven review items are gone from his list, and a lab sweep of the 14 variants
per tower showing no path winning every wave (the sweep is NOT yet written;
the lab's reference "stronger" build is Marksman/Piercing/Railbore).

## Fresh-context warnings (beyond CONTRIBUTING)

- **Blank glyphs are dropped from the atlas now**, and a harness test
  (`glyphs.test.ts`) scans view/app source for any codepoint the font cannot
  draw. Write `⠂` (a braille dot) where you would write `·`; never `»`,
  `—`, `…`. The test is the law; CONTRIBUTING's "no Latin-1" was subtly wrong
  (declared but empty) until today.
- **`git commit -F <file>` and one command per step.** Heredocs in the Bash
  tool broke three times today on quoting; scratchpad scripts (`node
  file.mjs`) with anchored replacements that ABORT on a missing anchor were
  the reliable edit path for multi-file changes.
- **The permission classifier refuses `gh pr merge` when chained** with other
  commands; a bare `gh pr merge N --squash --delete-branch` passes. CI must
  be green on the HEAD commit — `gh pr checks --watch` started before a push
  can report the old run; confirm `headRefOid` matches before merging.
- **The browser pane starves `requestAnimationFrame` while hidden** and
  `javascript_tool` reads of `hudText()` come back empty then; front the tab
  (`tabs_select`), `resize_window` to ~1900 wide to see the HUD, and read after
  a real wait. Screenshots worked once fronted; `zoom` does not.
- **`python` on this machine resolves to another tool's venv** (hermes-agent,
  3.11) while `pip` is Python 3.9's. The art pipeline works only because that
  venv happens to carry numpy and Pillow. Use `python -m pip` and a project
  venv before trusting `requirements.txt`.
- **Wave-mode fixtures must call `sim.callWave()` or pass `firstWaveWaits:
  false`** — wave 1 waits for the player now. The lab and every existing
  wave test were updated; a new test that "just ticks" will sit at wave 0.
- **A pushed commit must typecheck before the PR body claims green.** PR
  #102's first push failed typecheck (a private lane in a test) and shipped
  a fix commit; the PR body had already said "197 green".

## Key seams for the next session (the geometry migration)

- **`view/board/style.ts:16-17`** — `CELL_W`/`CELL_H`, the one constant.
  Three places hard-code row/column positions and must move with it: the
  bridge deck rows in `style.ts` (`y === 1`), cache and entry markers in
  `BoardView.ts` (`gx + 1..3, gy + 1`), the fallback tower art. The sprite
  loop in `BoardView.ts` indexes art by the VIEW's cell — a sprite whose
  `cell` differs crashes; the audit's "sprite cell must equal the view cell"
  lint does not exist yet and must land first.
- **`app/protocol.ts:18`** — `BOARD_SLOTS` 12×7 must become a viewport-derived
  value (option 1). Downstream: `workerRuntime.ts` knob derivation,
  `mapgen-sweep.test.ts` and `content.test.ts` inline board sizes, the lab's
  calibration seed, `SAVE_VERSION` (the map changes shape), the golden hash.
- **The HUD/modal 2× scale and the 30-column HUD width** are unnamed literals
  in `main.ts` (five copies) and `tilesmith.ts` (`ZOOM_W/H`); name them once.
- **`tools/art`** is Daniil's Python image→`.xp` pipeline (untracked). Commit
  it with `out/` and `__pycache__` ignored, `*.xp binary`, and a decision on
  `vendor/fonts` (3.3 MB, licences unrecorded). Its `glyphs.py` should read
  `glyphset-spleen.json` instead of re-parsing the BDF (three parsers today).
- **Balance after today is unmeasured**: the wave clock, the L offset, boss
  waves, the Refinery rate and the escalating relic prices all moved at once.
  The lab's analytic model knows nothing of volleys, pierce or the clock. A
  lab sweep before his playtest would say which of today's numbers are
  obviously wrong; the numbers were chosen, not measured.

## Standing open items

- **Design round 1 gate** — Daniil's Standard run; the 14-variant lab sweep.
- **2.27 gate** — still his loadout-heavy verdict.
- **Geometry migration (8×5 cells, option 1)** — next session, plan approved.
- **Sprite importer** — waits for his JSON sprites; placeholders meanwhile.
- **Technical-debt register** (WBS) — the audit's "everything else later".
- `tile_yn7vhz`, 4.12 V8/V9, shore-as-ore, ASSETS.md audit — unchanged.
