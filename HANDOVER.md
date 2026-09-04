# Handover — state as of 2026-09-04 (end of day; session 22: the geometry migration)

> **Updated once per working day** (Daniil). State and seams only; sequencing
> lives in the roadmap ledger, the checklist in the WBS, requests in the WBS
> request index. Anything restated here is a drift surface.

**Read order for a fresh context:** [CONTRIBUTING.md](CONTRIBUTING.md) →
[docs/PRD.md](docs/PRD.md) → [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
(§12 is the generation spec) → [docs/ASSETS.md](docs/ASSETS.md) — **§1 and §3
are today's: the 8×5 cell and sprite format v2** → [docs/WBS.md](docs/WBS.md)
(decision **D24**, the debt register) → this file → the roadmap ledger's next
open row. The gitignored `POSTMORTEM.md` holds collaboration findings — **read
its last three sections before writing any code today.** End every working
day with the `wrap-session` skill.

Live: <https://argarot.github.io/ascii-defense/> (verify cache-busted, always).
**Since today the caption under the board reads `8x5 glyph cells ⠂ NxM tiles`**
— a caption without that is the old build.

## Where the project is

**Session 22 (2026-09-04) shipped the geometry migration and Daniil's art
pipeline, five PRs (#105–#109), decision D24.** Daniil played design round 1
first and called its gate ("quite fun and quite challenging").

1. **Sprite format v2 + the importer (#105):** a sprite is a map of `states`
   keyed by a string the view chooses — a tower's choice path (`""`, `"0"`,
   `"01"`, `"010"`; 15 keys for a 3-tier tree) or a terrain cell letter —
   with `frames` (animation), `variations` (static alternates picked by
   position hash) and `bgInk`. `content/assets/grid.json` declares the cell
   content is authored for; the linter refuses any sprite whose cell differs,
   and checks every glyph against the shipped atlas. `tools/import-sprites.mjs`
   turns Daniil's generator studies (`sources/sprites/*.json`, committed with
   their `generate_*.py`) into content: the four tower colour RULES are ported
   from the generators and every glyph painted; 69 tower + 17 road palette
   roles. Re-import after a study changes; an unknown rule fails, never guesses.
2. **The view net (#106):** `render` exports `TermSurface` (what the view
   draws on) and `TextTerm` (arrays); every view class is typed to it. Golden
   text tests for terrain cells, the board and the HUD; the goldens changed
   in #107 and #108 in exactly the way each intended.
3. **The flip (#107):** the cell is **8×5 glyphs = 40×40 px**, read from
   grid.json; the board is **sized to the viewport** (`app/boardSize.ts`,
   7×5 tiles at 1920×1080, clamped 6×4…12×7) and rides `init`; a saved run
   continues only on a screen that fits its map. The three 5×3 literals are
   gone; `UI_SCALE`/`HUD_COLS` named once; the loadout picker pages at
   `tileCapacity()`.
4. **Roads from sprites (#108):** every road letter draws from the cobble
   sprite, one of four variations per cell by position hash; the route
   graph's kerb is drawn over the art only where it closes a side the letter
   leaves open.
5. **The variant sweep (#109):** `node tools/sweep.mjs`; tables in
   `docs/lab/sweep-2026-09-04.md`. The smaller board is not harder across
   the board (no threat retune needed); **three forks fail the design-round-1
   gate as measured**: Hailstorm vs Railbore, Cluster vs Concussive,
   Absolute Zero vs Shatterfield (the last a solo-measurement artefact). A
   retune is proposed there, not applied.

**Not built:** ground, rock, ore, Core and water sprites (Daniil draws them
later; glyph pools cover them at the larger cell, untuned); the tower
studies' state names predate the D23 tree rework (he will rename visuals);
enemies are still single glyphs.

**Gates:** design round 1 — **passed by Daniil's play** except the sweep's
three failing forks, which are his retune call; 2.27 (loadout-heavy runs) —
still his; session 22 — the deployed build at 8×5 with his towers and roads
on the board, which he has not yet played.

## Fresh-context warnings (beyond CONTRIBUTING)

- **Sprites are generated, never hand-edited.** `content/assets/sprites/*.json`
  come from `node tools/import-sprites.mjs`; edit the study under
  `sources/sprites/` (or its generator) and re-import. A hand edit is lost on
  the next import.
- **The cell lives in `grid.json` only.** Do not write 8 or 5 or 40 anywhere;
  read `CELL_W`/`CELL_H`/`GLYPH_PX_W`/`GLYPH_PX_H` from the view. The linter
  fails any sprite that disagrees with the file.
- **The board is per session, from the viewport.** `BOARD_SLOTS` (12×7) is
  only the worker's default for tests and the lab. A save whose map is
  another size is refused on this screen with a sentence — rebuilding the
  terminals per run is in the debt register, not done.
- **Tile previews are 40×25 glyphs at the 2× UI scale** (400×400 px each):
  the loadout picker shows about three per page on a 1920-wide screen. A
  1× preview surface is the fix and is in the register.
- **The browser pane starves `requestAnimationFrame` while hidden**; front the
  tab, `resize_window` to ~1900 wide, and read `hudText()` after a real wait.
  Screenshots work fronted. Reset the viewport with the desktop preset.
- **Heredocs through the Bash tool keep breaking on quoting** (backticks,
  regex escapes). Scratchpad `.mjs` scripts with anchored replacements that
  abort on a missing anchor were the only reliable multi-file edit path;
  the Edit tool for one-line fixes. Two of today's scripts aborted mid-file
  because an anchor was indented differently than remembered — read the
  line first.
- **PR bodies are written after the gate prints, from its output.** One
  commit message today said 222 tests when the run printed 220.
- **`gh pr merge` only bare** (the classifier refuses it chained), and only
  after `gh pr checks` reports pass on the same SHA as `git rev-parse HEAD`.

## Key seams for the next session

- **Balance is now measured, not tuned.** `docs/lab/sweep-2026-09-04.md`
  names the three losing forks and a first retune (Hailstorm and Cluster to
  60% per shot, Cluster scatter 0.7). The sweep measures a tower solo; a
  mixed-build sweep (a bolt line plus the frost variant) is what would judge
  Absolute Zero fairly. `packages/harness/src/lab/sweep.ts` is where that
  goes; `runLab` already accepts explicit placements.
- **`view/board/style.ts` draws roads from `ROAD_SPRITE`** and everything else
  from glyph pools. When Daniil's ground/rock/ore/Core/water sprites arrive
  (same study format, one state per letter), the pool branch becomes the
  fallback and the sprite branch generalises from "road letters" to "any
  letter with a state". The importer needs one more input shape for them.
- **Enemies** are `ENEMY_LOOK` glyphs in `BoardView.ts`; the sprite format
  can carry them (states by enemy id, frames for a walk cycle) once drawn.
- **`main.ts` still creates its terminals once.** Rebuilding them on `ready`
  when the map's size differs would let any save resume anywhere; today the
  save is refused instead.
- **The naming session (D8) is next in the ledger (23)**, then damage types
  (2.8) and attack shapes (4.10). The trait table (`engine/sim/traits.ts`) is
  where resistances slot in.

## Standing open items

- The three losing forks (sweep) — Daniil's retune call.
- Session 22 playtest of the deployed 8×5 build — his.
- 2.27 gate — his.
- Missing terrain and enemy sprites — his art, then one importer input shape.
- Technical-debt register (WBS) — grew by: terminals rebuilt per run, a 1×
  preview surface for the picker, the lab's analytic model ignorant of
  volleys/pierce/min range/the clock.
- `tile_yn7vhz`, 4.12 V8/V9, shore-as-ore — unchanged.
