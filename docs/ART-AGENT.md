# Brief for the art agent — sprites for ASCII Defense

*(Written 2026-09-06 for Daniil to hand to a separate agent. Everything an
agent needs to draw new sprites and rework the placeholders, without
reading the rest of the repo. Where this brief and the code disagree, the
code's linter wins: run it.)*

## 0. What you are drawing on

- **Font:** spleen 5×8, fixed. Each glyph is 5 px wide and 8 px tall — not
  square. The glyph set is **printable ASCII, the Unicode braille block
  (U+2800–U+28FF) and the LIGHT box-drawing set** (`─│┌┐└┘├┤┬┴┼` and
  friends). Nothing else exists: no `█▓▒░`, no `°´¨`, no heavy box lines,
  no arrows. The linter refuses any glyph outside the font.
- **Cell:** 8 glyphs wide × 5 glyphs tall = 40 × 40 px, square. One tower
  fills one cell. The board is a grid of cells; the road, ground, rock
  and ore are cells too.
- **Colour:** 24-bit foreground and background per glyph, no palette cap.
  Every colour is a named **role** in `packages/content/assets/palette.json`
  (a sprite never carries a hex directly; the importer turns your named
  colours into roles). Two rules: glyphs must read against their own
  background (the linter warns under 30 luminance points of contrast — a
  warning today, a failure soon), and the board's ground under a tower is
  dark blue-grey `#1c2733`-ish, so a tower's silhouette must carry itself
  on that.
- **Transparency:** a space in the art, or an ink key mapped to `null`, is
  transparent — the ground or the road shows through. Use it; sprites
  that fill their rectangle read as stamps.

## 1. The five kinds of sprite, and their sizes

| kind | cell | states | drawn where |
|---|---|---|---|
| `tower` | 8×5 | 15 keys: `""`, `"0"`, `"1"`, `"00"`, `"01"`, `"10"`, `"11"`, `"000"` … `"111"` — the tower's committed choices per tier, in tier order (0 = the first choice, 1 = the second) | the board cell, and the strip's build button (the `""` state) and the title's hero row |
| `terrain` | 8×5 | one key per road letter (done: the cobble road study) | the board |
| `enemy` | **at most 5 wide × 3 tall** (a grunt is 3×2, a swarmling 2×1, a juggernaut 5×3) | `""` | centred on the walker's position, its feet on the position row, transparent over the road; marks (health, a shield's brackets, a slow's `~`) are drawn beside it by the game |
| `relic` | **exactly 4×3** | `""` | the inventory slot in the strip and the column, over the slot's plate |
| `face` | 8×5 | `"top"`, `"mid"`, `"bot"` — the Core's three stacked cells at the board's east edge; the road arrives at the middle one's WEST edge | the board |

Every state has a base frame and may have:

- **`frames`** — extra idle frames. The idle cycle is `[base, ...frames]`
  at `frameMs` per frame, on the wall clock, phase-offset per instance so
  a row does not march in step. Today every placeholder has two frames at
  360–900 ms. **We want more frames at a faster cadence** (four to eight
  frames at 120–200 ms) — the game reads as choppy and that is the
  cheapest cure. Keep a tower's silhouette fixed across frames; animate
  the glow, the muzzle, the coil, a flag — never the footprint.
- **`variations`** — static alternates picked per board position (roads
  use them). Towers, enemies, relics do not need them.
- **`sequences`** — event-keyed animations, each a list of frames with an
  optional per-frame `ms` (default `frameMs`), played ONCE from the first
  on the world clock, then idle resumes:
  - `charge` — plays through the last quarter of the cooldown while a
    target is held (the tower is about to fire);
  - `fire` — plays the moment it fires;
  - `cool` — plays right after `fire`;
  - `hit` — reserved for enemies (when one takes damage); not drawn yet.

  **The rule for sequences (Daniil, 2026-09-05): subtle.** The tower's
  body never moves, never flashes whole. A brightening lens, a sparked
  muzzle, a recoiling barrel glyph, a puff — one to three glyphs changing
  over 100–300 ms. Today's placeholders are the second idle frame for
  100 ms; anything is better than that, but a flash-and-jump was already
  rejected once.

## 2. What exists, what is a placeholder, what is wanted

Shipped by Daniil's studies (the style to match): **Bolt Turret, Mortar,
Frost Emitter, Refinery** (`sources/sprites/ascii-defense-*-upgrade-tree-*.json`
with their Python generators) and the **cobble road**. Look at those
first: line-heavy silhouettes, a bright "core" glyph per tower, two-tone
steel, a pulse of colour between the two idle frames.

Placeholders written by `tools/placeholder-sprites.mjs` (their `source`
field says so) — **all of these want your version**, in this order:

1. **The eight tower trees' attack `sequences`** — for the four studies
   (add `charge`/`fire`/`cool` to their generators, see §3) and for the
   four new towers below.
2. **Tesla Coil** (`tesla`), **Missile Rack** (`missile`), **Laser Lance**
   (`laser`), **Bastion** (`bastion`): full 15-state trees. Their trees
   (what each choice does, so the art can say it) are in
   `docs/CATALOGUE.md`. The Laser also wants **one state per facing**
   (see §4) — it points north, east, south or west.
3. **Seven enemies** (`enemy_grunt`, `enemy_skitter`, `enemy_swarmling`,
   `enemy_brute`, `enemy_shell`, `enemy_husk`, `enemy_juggernaut`): small
   walkers with a walk cycle of four or more frames. The catalogue lists
   what each is (hp, speed, traits, what it resists). Sizes: keep the
   grunt/skitter/shellback at 3×2, the swarmling at 2×1, the brute and
   husk at 4×3, the juggernaut at 5×3 — the game's marks are laid out
   around those.
4. **Sixteen relic icons** (`relic_<id>`, ids in the catalogue): 4×3,
   one dominant colour per relic, readable at 20×24 px.
5. **The Core face** (`core_face`): three 8×5 cells, top/mid/bot, the
   road entering the middle one from the west; a slow idle (a breathing
   light) and, if you like, a `hit` sequence for a breach.

Not wanted yet: terrain (ground/rock/ore/water are procedural), the
splash, UI chrome.

## 3. How to deliver: studies, never hand-edited JSON

Everything under `packages/content/assets/sprites/` is **generated**. You
deliver **studies** under `sources/sprites/`, and `node tools/import-sprites.mjs`
turns them into sprites and adds their colours to the palette. Two study
shapes import:

**A. The rule form** (what Daniil's tower studies use): per state
`idleA`/`idleB` grids of glyphs, a named `palette`, and the COLOUR as a
rule in the generator (row, glyph, chosen path). The importer has that
rule ported per tower; a new tower in this form needs its rule ported by
the developer — say so in your handover and it happens. Add `charge`,
`fire`, `cool` next to `idleA`/`idleB` as lists of `{ "rows": [...],
"ms": 120, "frame": 0 | 1 }` (`frame` picks which of the two colour
pulses the rule paints).

**B. The painted form** (recommended for everything new — imports with no
developer step):

```jsonc
// sources/sprites/tesla.study.json
{
  "id": "tesla",                // the sprite id (towers: the roster id; enemies: enemy_<id>; relics: relic_<id>; the face: core_face)
  "kind": "tower",              // tower | enemy | relic | face
  "cell": [8, 5],
  "frameMs": 160,
  "palette": { "coil": "#c9d6df", "core": "#7fe7ff", "arc": "#5cd6ff", "dark": "#15232d" },
  "inks": { ".": null, "a": "coil", "b": "core", "c": "arc", "d": "dark" },   // one letter per palette name; "." is transparent
  "states": {
    "": {
      "frames": [                                    // the idle cycle, first = base
        { "art": [" .-~-.  ", " ( * )  ", "  }|{   ", "  ||    ", "|/_||_\\|"],
          "ink": [".aaaaa..", ".a.b.a..", "..aaa...", "..aa....", "aaaaaaaa"],
          "bg":  [".dddddd.", "........", "........", "........", "dddddddd"] },  // bg optional: per-glyph background
        { "...": "the second frame" }
      ],
      "sequences": {
        "charge": [{ "art": ["..."], "ink": ["..."], "ms": 100 }],
        "fire":   [{ "art": ["..."], "ink": ["..."], "ms": 60 }, { "art": ["..."], "ink": ["..."], "ms": 120 }],
        "cool":   [{ "art": ["..."], "ink": ["..."], "ms": 200 }]
      }
    },
    "0": { "frames": [ ... ] },   // and the other fourteen keys for a tower
    "0/e": { "frames": [ ... ] }  // optional: a facing variant of state "0" (n, e, s, w) - the Laser
  }
}
```

Rules the importer holds you to (it refuses, never guesses):

- every grid is exactly `cell` wide and tall, every row a string;
- every ink letter is in `inks`, every `inks` name is in `palette`;
- a tower has all fifteen state keys; a face has top/mid/bot; enemies and
  relics have `""`;
- `frameMs ≥ 60`, sequence `ms ≥ 20`;
- glyphs from the font only.

Your palette names become roles `tower.<id>.<name>` (or `enemy.<id>.…`,
`relic.<id>.…`, `core.face.…`) — a re-tint later is a palette edit, so
name colours by what they are ("steel_high", "lens", "ember"), not by
value. You may also name an existing role verbatim (`enemy.limb`,
`ui.dim`, `terrain.core.lit`) instead of a hex.

Commit the study and its generator (if you wrote one) beside it; the
importer's output is committed by the developer's run, but run it
yourself to check (see §5).

## 4. The Laser's facings, and other slots the format has

- **Facings:** a state key with `/n`, `/e`, `/s` or `/w` appended
  (`""/e` is written `"/e"`, `"01/w"` etc.) is used when the tower faces
  that way; without one the plain state is drawn and the game overlays a
  small arrow. Draw the four for the base state at least; the tree's
  states fall back to the base facing if theirs is missing.
- **The strip's build button** draws the `""` state at 1× on a dark
  plate; a tower must read at 40×40 px with nothing around it.
- **The title's hero row** draws the `""` state of every tower side by
  side: they should look like a family.

## 5. Check your work

```bash
node tools/import-sprites.mjs        # imports every study; errors name the file and row
node tools/validate-content.mjs      # the linter: cells, inks, roles, font, contrast
npx vitest run packages/harness/src/content.test.ts   # every tower has fifteen states with idle frames
npm run dev                          # then http://localhost:5173 - the title shows the towers; a run shows walkers, relics, the face
```

`docs/ASSETS.md` §3 is the format's own page; `docs/CATALOGUE.md` is what
every tower, enemy and relic does. Both are current as of this brief.

## 6. What good looks like here

- The four studies. Study them for silhouette, the two-tone steel, the
  one bright core glyph.
- Motion that is many small changes, not one big one: four to eight idle
  frames; a `fire` that is a muzzle and a lens, 60–150 ms; a `charge`
  that brightens one glyph per frame.
- Enemies that read at a glance by shape alone (a round grunt, a skittering
  x, a boxy brute, a shelled shellback, a tall husk, a wide juggernaut) —
  colour is the second cue, never the only one.
- Relics as objects: a coin, a snowflake, a pillar, a lens, a bag; one
  colour that owns the icon and one dim colour for its frame.
