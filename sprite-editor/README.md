# ASCII Defense Sprite Editor

A standalone editor for the project's Sprite v2 JSON format. It lives outside
the game packages and never writes to repository files. All exports are normal
browser downloads.

## Open it

Double-click **`index.html`** or **`ASCII Defense Sprite Editor.html`**. Both
are the complete app:
code, styles, palette, grid definition, Spleen glyph atlas, and bundled sprite
references are embedded in that one file. It does not need a server, terminal,
installation, browser extension, or network connection.

`index.source.html` is the development template. When changing the editor
itself, rebuild the self-contained files from the repository root:

```powershell
node sprite-editor/build-offline.mjs
```

The development source automatically loads:

- `packages/app/public/assets/glyphset-spleen.json`
- `packages/content/assets/palette.json`
- `packages/content/assets/grid.json`
- matching runtime tower sprites when converting legacy tower studies

The offline deliverable embeds all three. **Load palette**, **Load atlas**, and
**Tower reference** remain available for testing replacements or future assets.

## Accepted JSON

1. Runtime Sprite v2 documents with `states` and `inkMap`. These round-trip
   directly.
2. Legacy tower studies from `sources/sprites/`. Their glyph grids are
   converted to path-keyed states and their corresponding runtime Sprite v2 is
   used as the colour-role reference. The study format does not contain enough
   per-cell colour information to reconstruct those roles by itself.
3. Legacy road studies with `tiers` and `inkMap`. Tier numbers are converted to
   the project's twelve road state letters and study frames become static
   `variations`.

Every accepted input downloads as Sprite v2. The editor refuses to download a
document with invalid dimensions, unmapped ink keys, missing palette roles, or
glyphs absent from the loaded Spleen atlas.

## Editing model

- A state contains a base version and optional static variations.
- Each version contains a base frame and optional animation frames.
- The three apply switches independently control glyph, foreground role, and
  background role painting.
- New palette roles receive a one-character local `inkMap` key when first
  painted. Existing mappings are preserved.
- Space and the Erase tool produce transparent cells.
- The Colour Lab has an HSV wheel and two colour slots. The colour brush can
  paint foreground and/or background roles with a square or circular solid,
  linear-gradient, or radial-fade brush up to eight glyph cells wide.
- Custom colours become `sprite.<id>.custom.<hex>` palette roles. Download the
  accompanying palette patch and merge its `roles` into the game's
  `palette.json` when integrating the sprite.
- Rectangle draws an outline; hold Shift while releasing to fill it.
- Select a region before using Ctrl+C. Ctrl+V pastes at the selection origin,
  the hovered cell, or 0,0 in that order.
- Compare Frames shows the previous, current, and next animation frames. The
  side previews are clickable; Play animates the main, tiled, or composite view.
- Tile Preview repeats the current state and can cycle its static variations.
- Composite Preview adds another sprite above or below the current one, with
  independent companion state and variation selection.
- Eyedropper is tool 4. Right-click or Alt-click also picks from any edit cell.

Run the format and real-project adapter checks with:

```powershell
node sprite-editor/tests.mjs
```
