# Handover — state as of 2026-09-05 (midday; session 23 shipped four PRs, session 24 proposed)

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

**Session 23 (2026-09-05 morning) shipped four PRs (#111–#114):** retune 1
(Hailstorm and Cluster to 60%); the playtest fixes — junction cells drawn by
EFFECTIVE ports (an 'X' with north closed wears the T art), the range as
three thin rings, the Bolt's own gold dash, the ramp a notch down; Daniil's
art tooling tracked (`sprite-editor/`, `tools/art/`, `vendor/fonts/`);
his thought dump sorted into the docs (PRD §4.3.1, §7.8, §13, §15.1, §18;
WBS D25–D28, 2.30–2.34, 4.27–4.29, 5.6–5.8, 6.9–6.10, 7.8; ledger 23–38).
Measured on 2026-09-04: five specials fail to generate on every small
board. **Session 22 (2026-09-04)** shipped the geometry migration and the
art pipeline (#105–#109, D24); Daniil played design round 1 and called its
gate.

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

## Next session, proposed — 24: the board and the screen

*(Daniil's rule, 2026-09-05: every shipped session ends with the next one
proposed, and it must be a full day of visible progress. His "go" is
enough; defaults are stated where he has not amended.)*

**Theme.** The Core moves to the edge, the board fills, the empty screen
works. It is next because every balance number, the lab, the difficulty
curve and the bottom strip all sit on the board's shape, and the shape is
about to change.

1. **The Core at the edge** *(Daniil's redesign, 2026-09-05)*. The Core
   tile is retired. The cell grid gains ONE extra row along the bottom
   edge; a three-cell **Core face** sits in it under the road's last cell;
   the strip's other cells are blank. The road tree roots at the slot above
   the face (column drawn per seed from the middle third); **entries only
   on the north, east and west borders**; the Core has exactly one
   entrance; the per-entry floor still binds. `verifyMap`: one road cell
   touches the face. Sim breach unchanged (Core cells are 'C'). View: the
   face drawn in the current style until Daniil's sprite arrives; board
   canvas one cell taller. Library: `core_*` tiles removed; the smith's
   'C' brush retired. Seven sites assume height = slots × 5 (`main.ts`,
   `workerRuntime.ts`, `BoardView.ts`, sim, verify); each moves to a
   `cellsH` read from the map. Golden hash moves with the reason. Saves
   are stamped (D15) — old ones refused with a sentence.
2. **The board fills, lanes balanced** (2.30, D28 defaults): specials
   placed first as fixed nodes; the tree grows from the root to **90%** of
   land slots; every dead end is an entrance; every lane **at least 70% of
   the longest** where the board allows. When constraints fight: tree >
   specials > floor > balance > coverage. ARCHITECTURE §12 rewritten;
   `tools/mapgen-sweep.mjs` permanent (fails, rerolls, coverage, balance
   ratio per board × loadout × seed).
3. **The bottom strip** (4.27): a third terminal, full width under the
   board. The Core face's card (hp, relic slots, ACTIVES — moved out of the
   HUD column, right under the face they belong to), this wave and the
   next by type with each type's specialty, and **build buttons drawn
   with the towers' own sprites** at board scale, full colour when
   affordable, grey when not, with button chrome. `boardSize.ts` reserves
   the strip; at 1080p that costs one tile row (7×4 plus the Core row).
4. **Difficulty on the new boards** (item 4, properly): a mixed-build lab
   (a Bolt line at the choke, a Frost, a Mortar, economy-driven) on the new
   generator across boards and seeds; the ramp and the D18 offset retuned
   from that table; Hailstorm judged at 60% vs 75% in the same run.
5. **The full-screen shell** (4.28): a screen host that sizes every page
   to the viewport; the title as a designed page with the menu; run setup,
   loadout and summary as pages; the board as a page. Placeholder title art
   until the art agent's splash. The Tile Smith stays on its own page this
   session.
6. **Boon colours and the contrast lint** (4.29, 2.32), riding along.

**Gate — Daniil's playtest on the live build:** five-special loadouts
generate every time on his screen; the Core face sits at the bottom with
its actives under it; the strip shows the wave and the buttons; a Standard
run with an ordinary build reaches wave 10+ and the shortest lane does not
decide it.

**His part:** the Core face sprite and button art from the art agent
(placeholders until then); amendments to the D28 defaults if any; the
playtest at the end.

**Biggest risk:** one entrance makes the last two slots the whole game — a
choke where five towers see everything. PR 4 measures exactly that (choke
build vs spread build) before the numbers are set; if the choke wins by a
mile, the answer is a longer shared tail or a min-range rule, not a quieter
tower. **Expensive if wrong:** the Core's position is in every save, in the
Core-adjacent relic, in the lab's placement heuristics and in the smith —
PR 1 is where to argue, because moving it again costs PR 1 again.

## Standing open items

- The three losing forks (sweep) — Daniil's retune call.
- Session 22 playtest of the deployed 8×5 build — his.
- 2.27 gate — his.
- Missing terrain and enemy sprites — his art, then one importer input shape.
- Technical-debt register (WBS) — grew by: terminals rebuilt per run, a 1×
  preview surface for the picker, the lab's analytic model ignorant of
  volleys/pierce/min range/the clock.
- `tile_yn7vhz`, 4.12 V8/V9, shore-as-ore — unchanged.
