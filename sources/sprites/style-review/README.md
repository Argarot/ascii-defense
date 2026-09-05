# Sprite style review — round 1

Open **index.html** directly in a browser. It is self-contained and works offline.
The `previews` folder contains one animated comparison GIF per tower, plus
individual `asset-A.gif` through `asset-F.gif` files. PNGs show the first frame.

Scope confirmed by Daniil: eight towers with six broadly different design
languages, a consistent colour identity per tower, and six relic style samples.
Enemies and the Core are deferred. The relic treatments are demonstrated on
Tithe, Frostbite, and Orbital Lance: 18 icons, not the full relic collection.

## Design choices

| Letter | Towers | Relics |
|---|---|---|
| A | Field machinery — exposed, braced mechanisms | Pocket objects |
| B | Armoured citadel — squat protected housings | Engraved seals |
| C | Arcane instrument — facets and suspended energy | Runic charms |
| D | Atomic age — vessels and laboratory apparatus | Glass capsules |
| E | Lattice construct — exposed frames and modules | Miniature devices |
| F | Ancient automaton — carved bodies and inset light | Cut gemstones |

Tower accents: Bolt amber, Mortar copper-orange, Refinery ore gold, Frost ice
blue, Tesla violet, Missile rose, Laser coral red, Bastion jade. The hue stays
fixed across a tower's six options; construction materials vary with the style.

Each candidate has **five distinct idle frames at 160 ms**, an 800 ms loop.
Only one or two local indicators change colour, with a sampled periodic curve;
the art grid, housing and footprint stay fixed. This is deliberately a restrained
light animation. Attack and mechanical event animations belong to the next stage.

Rendering uses the shipped `glyphset-spleen.json` bitmaps and the same bit order
as `GLTerm.ts`, at exactly 5×8 pixels per glyph. Enlargements use nearest-neighbour
scaling. The dark preview square is ground, not part of the sprite; spaces and
`.` ink remain transparent. All designs fit the brief's original glyph subset.

## Source and validation

`generate.py` contains the authored glyph grids, materials and animation rules.
`candidates.json` preserves the review designs and per-frame colour grids. This
is **review data**, not a complete production Sprite v2 or painted study: it
intentionally has no fabricated upgrade states or placeholder attack sequences.
The nested folder keeps candidates out of the production importer's file glob.
No runtime sprite, palette, simulation code or existing study has been changed.

Regenerate using Python with Pillow:

```powershell
python sources/sprites/style-review/generate.py
node sources/sprites/style-review/check-gallery.mjs
```

The generator verifies dimensions, mapped colours, visible atlas glyphs, five
distinct rendered frames, a fixed footprint, and five GIF frames at 160 ms.
Results are in `validation.txt`. The gallery check exercises frame stepping,
reduced motion, native image dimensions, selection, notes and export.

## After the user selects styles

Follow `docs/ART-AGENT.md`, `docs/CATALOGUE.md`, and the current tower roster.
Preserve each chosen ancestor's features as children gain new hardware: an
upgrade path is cumulative, not a replacement theme. The gallery describes
proposed visual cues for every fork. These are proposals, not authored trees.

1. Refine the selected bases and colour/geometry feedback.
2. Author all 15 tower path states and subtle `charge`, `fire`, `cool` sequences.
   Animate only operational details on non-attacking Refinery and Bastion.
3. Add Laser facings, respecting the 5×8 glyph aspect ratio by redrawing each
   direction rather than rotating a rectangular character grid.
4. Apply the selected relic treatment to all sixteen distinct objects.
5. Deliver painted studies under `sources/sprites/` with generators. Run the
   importer, content linter and tower content tests specified in ART-AGENT.md.
   Verify the imported runtime appearance against the approved previews.

The final JSON and full trees are deferred until selection, as requested.
