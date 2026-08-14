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

## 2. Size classes

Character cells are roughly 1:1.7, so a 7-wide × 4-tall sprite is close to
square on screen.

| Class | Cells | Used for |
|---|---|---|
| Tower | **7 × 4** | all standard towers |
| Heavy tower | 9 × 5 | late-tier siege pieces |
| Wall | 3 × 2 | the precision mazing tool |
| Enemy, small | 2 × 1 | swarm units |
| Enemy, medium | 3 × 2 | line infantry, flyers |
| Enemy, large | 5 × 3 | armoured units |
| Boss | 11 × 6 | act finales |

### Consequence for the viewport

7×4 towers mean the board cannot be 96 cells wide. A battle needs room for
20–25 towers, which at this scale is roughly **160 × 50 cells** — about
1440 × 750 px at a 9 × 15 cell. That is comfortable on desktop and is the
reason this game is desktop-only.

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

- **Printable 7-bit ASCII only.** Frame vocabulary: `. ' \` , : ; - = _ | / \ ( ) [ ] < > ^ ~ * # % & @`
- **Consistent light.** Highlights on the top and left, shadow on the bottom
  and right, everywhere.
- **Density ramp** for volume, dark to light: `` `.:-=+*#%@ ``
- **Silhouette first.** If it isn't recognisable at one colour, more colours
  won't save it.
- **Legibility is the tie-breaker.** Any sprite that makes enemy count or tower
  state harder to read gets simplified. This overrides every rule above.

## 7. Validation

`validateSprite()` checks geometry today and moves into CI in M1, alongside:

- every `ink` key exists in the sprite's `inkMap`
- every `inkMap` value resolves in the palette
- every `spriteId` referenced by content exists
- every sprite is referenced by something

## 8. Still to do

The current library is a **direction proof, not a finished set**. Outstanding:

- Enemy art is the weakest part; large and boss classes need real drawings.
- Terrain needs biome variants and better rock formation shapes.
- No animation frames yet — the format supports named frames, none are authored.
- No projectiles, impacts, death animations or UI chrome.
- Directional muzzle overlay: a single cell drawn on the sprite perimeter in the
  firing direction, giving the read of a rotating turret for almost nothing.
