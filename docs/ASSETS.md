# Asset library

**The engine knows no glyphs.** It knows sprite ids, ink keys and footprints.
Which characters get drawn, and in what colour, is decided entirely here.

That separation is the reason no glyph appears in [PRD.md](PRD.md). If you find
yourself writing `'^' = Bolt Turret` in a design document, the design has leaked
into the art and something is wrong.

Live example of everything below: `public/assets/` — loaded at runtime by the
preview, so editing a file and reloading changes the game with no rebuild.

---

## 1. Principle: identity is the silhouette

A tower is not a character with decoration around it. It is a **drawing**, and it
is recognised the way any sprite is recognised — by its overall shape.

```
   ___        .=^=.      ./=^=\.
  /:::\      /#####\     [#####]
 [|-O-|]     [|-O-|]     [|<O>|]
  \___/      '\___/'     '\###/'

  tier 1      tier 3      tier 5
```

Same object, same footprint, three tiers. Detail density and brightness climb;
the shape stays recognisable. This is what "grows in intricacy" means — nothing
about the drawing's size changes.

## 2. The canvas you are drawing on

| | |
|---|---|
| **Font** | [unscii-8](https://github.com/viznut/unscii), 8×8 bitmap, public domain |
| **Cell** | 8 × 8 px — **square**, so no aspect correction. What you draw is what you see. |
| **Grid** | 240 × 135 cells (1920 × 1080), ~232 × 128 usable |
| **Character set** | printable ASCII + Latin-1 supplement + **block elements and box drawing** |
| **Colour** | 24-bit per cell, foreground and background, no palette cap |

### Character set

Strict 7-bit ASCII was rejected: 95 glyphs is too small a vocabulary to shade
with, and it is the main reason the first asset pass looked thin. The set is now
roughly Stone Story's 256 symbols **plus** block elements and box drawing:

```
ASCII        ! " # $ % & ' ( ) * + , - . / 0-9 : ; < = > ? @ A-Z [ \ ] ^ _ ` a-z { | } ~
Latin-1      ´ ‾ ¡ · ° « » ÷ ± ¬ ¦ ¤ § µ ¶ ¸ ¹ ² ³ ¼ ½ ¾
Blocks       █ ▓ ▒ ░ ▀ ▄ ▌ ▐ ▖ ▗ ▘ ▝ ▚ ▞
Box drawing  ─ │ ┌ ┐ └ ┘ ├ ┤ ┬ ┴ ┼ ═ ║ ╔ ╗ ╚ ╝ ╠ ╣ ╦ ╩ ╬ ╭ ╮ ╯ ╰
```

**Half-blocks are the highest-value addition.** `▀ ▄ ▌ ▐` effectively double
resolution along one axis, giving a 16×8 or 8×16 effective grid per cell for
silhouettes and shading. `█ ▓ ▒ ░` give a clean four-step density ramp that is
far more controllable than punctuation dithering.

This means the game is textmode art rather than ASCII in the strict sense. That
is a deliberate trade of purity for the art actually looking good.

## 3. Size classes

| Class | Cells | Pixels |
|---|---|---|
| Wall | 4 × 4 | 32 × 32 |
| **Tower** | **12 × 10** | 96 × 80 |
| Heavy tower | 16 × 14 | 128 × 112 |
| Enemy, small | 4 × 4 | 32 × 32 |
| Enemy, medium | 6 × 6 | 48 × 48 |
| Enemy, large | 10 × 10 | 80 × 80 |
| Boss | 20 × 18 | 160 × 144 |

A 96 × 80 px tower is a real sprite with room for genuine detail — roughly ten
times the drawing area of the 7×4 sketches it replaces.

## 2b. Authoring: REXPaint, not a text editor

Sprites are drawn in **[REXPaint](https://www.gridsagegames.com/rexpaint/)** —
free, Windows-native, multi-layer, written by Cogmind's developer — and
converted by `tools/rexpaint-import` into the runtime JSON.

Hand-typing art into JSON is why the first pass was primitive. Nobody draws well
in a text editor. REXPaint gives a palette picker, layers, shape tools and
undo, and exports XML/CSV that maps cleanly onto our art/ink grids.

The runtime format below stays the build artifact; `.xp` sources are committed
alongside it so the art remains editable.

## 3. Sprite format

```jsonc
{
  "id": "tower_bolt",
  "name": "Bolt Turret",
  "size": [7, 4],
  "bg": "tower.shadow",        // backing colour, lifts the sprite off terrain
  "inkMap": {
    ".": null,                 // transparent — terrain shows through
    "f": "tower.frame",
    "b": "tower.body",
    "e": "tower.edge",
    "c": "PATH",               // resolves to the instance's upgrade path colour
    "w": "tower.core"
  },
  "tiers": {
    "1": {
      "art": ["  ___  ", " /:::\\ ", "[|-O-|]", " \\___/ "],
      "ink": ["..fff..", ".fbbbf.", "efbcbfe", ".fffff."]
    }
  }
}
```

**`art` and `ink` are parallel grids.** Every cell of `art` has a matching cell
of `ink` naming the colour role. Both must be exactly `size[1]` rows of
`size[0]` characters — validated, and a mismatch is reported rather than drawn.

Two keys carry the system:

- **`.` → transparent.** Cells that aren't part of the drawing let terrain
  through, which is what stops sprites reading as rectangular stamps.
- **`"PATH"` → the instance's upgrade path colour.** One drawing serves all
  three specialisations; it recolours itself instead of needing three copies.

Sheets (`enemies.json`) hold several sprites sharing one `inkMap`.

## 4. Palette

`palette.json` maps role names to colours. Sprites never contain a hex value —
they name roles, and the palette decides. That is what makes biome re-tinting a
palette swap rather than an art rewrite.

```jsonc
{
  "terrain": { "ground": "#26323f", "road": "#46566b", "ore": "#e8b52a", ... },
  "tower":   { "shadow": "#11161d", "frame": "#4e5f73", "core": "#e8f0ff", ... },
  "path":    { "A": "#4cc9f0", "B": "#ffb703", "C": "#c08cff" },
  "enemy":   { "body": "#7d3535", "edge": "#e05a5a", "eye": "#ffd166", ... }
}
```

## 5. Terrain: surface, not noise

Terrain is the easiest thing to get wrong, and the two rules that fix it were
both learned by getting it wrong first:

**Ground is mostly empty.** A `density` of ~0.09 — nine percent of tiles carry a
speck, the rest are blank. Filling every tile with a random character produces
visual static that makes entities hard to pick out. Sparse specks read as
ground; dense ones read as noise.

**Glyph choice must use a *mixing* hash.** The obvious `(x*a + y*b) % n` is
linear, and lays down clearly visible diagonal stripes across open ground. Use
an integer hash with shift/multiply mixing. This one cost a full iteration to
notice.

**Class boundaries get explicit edge treatment.** The road is drawn as a band
with distinct edge rows, not as a smear of punctuation. Rock formations get lit
caps on their top row. Edges are what make regions read as *surfaces*.

```jsonc
"ground": { "glyphs": [".", "'", "`", ",", ":"], "density": 0.09,
            "ink": "terrain.ground", "dimChance": 0.55, "dimInk": "terrain.groundDim" },
"road":   { "glyphs": [":", ":", ".", ":", ",", ":"], "density": 0.92,
            "ink": "terrain.road", "litChance": 0.14, "litInk": "terrain.roadLit" }
```

## 6. Authoring rules

Distilled from [Stone Story RPG's ASCII tutorial](https://stonestoryrpg.com/ascii_tutorial.html),
which is the best published source on making this look good:

- **Material language.** Fix a vocabulary where specific symbol combinations
  consistently mean metal, stone, energy, organic. Players absorb it without
  being taught, and it is what makes art read as *objects* rather than texture.
  Define it once, apply it everywhere.
- **Anti-alias edges** with blend characters — half-blocks and lighter density
  glyphs along a boundary soften the step between shapes.
- **Dither for tone.** Space marks out to get gradation; `█ ▓ ▒ ░` is the
  controllable ramp, punctuation the fine one.
- **Negative space is form.** Gaps do as much work as marks.
- **Ground your sprites.** A solid dark block beneath a figure reads as shadow
  and pulls it off the terrain.
- **Consistent light** — highlights top-left, shadow bottom-right, everywhere.
- **Silhouette first.** If it is not recognisable in one colour, more colours
  will not save it.
- **Subtractive animation** — build the full frame, then remove elements
  progressively to produce motion.
- **Legibility is the tie-breaker.** Any sprite that makes enemy count or tower
  state harder to read gets simplified. This overrides every rule above.

## 7. Validation

`validateSprite()` checks geometry today and moves into CI in M1, alongside:

- every `ink` key exists in the sprite's `inkMap`
- every `inkMap` value resolves in the palette
- every `spriteId` referenced by content exists
- every sprite is referenced by something

## 8. Still to do

**Everything currently in `public/assets/` is obsolete.** It was drawn at 7×4
against a 95-glyph set with a 64-colour cap, by hand, in JSON. All three
constraints are gone. Treat it as a format demonstration, not as art.

Outstanding:

- Redraw every sprite in REXPaint at the new size classes, with the full
  character set and the material language defined.
- Define the material language itself — which glyph combinations mean metal,
  stone, energy, organic — before drawing anything else.
- Terrain: biome palettes, rock formation shapes, road surface variants.
- Animation frames. The format supports named frames; none are authored.
- Effects: projectiles, impacts, explosions, death animations. Deferred past M1
  by decision, but the subcell coordinate system that makes them fluid ships in
  M1 (ARCHITECTURE §4a).
- UI chrome: panels, borders, the tech tree screen.
- Directional muzzle overlay — a single cell on the sprite perimeter in the
  firing direction, giving the read of a rotating turret for almost nothing.
