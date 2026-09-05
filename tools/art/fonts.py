"""
Font candidates, loaded onto one footing so they can be compared honestly.

A `Face` is: a name, a cell size in pixels, and a codepoint -> 1-bit coverage
mask. Where the mask comes from differs — a BDF, a .hex dump, a rasterised
outline, or an integer upscale of another face — and that difference is exactly
what the comparison is measuring, so `provenance` records it and the report
prints it.

Two rules learned the hard way and enforced here rather than trusted:

  * DECLARED IS NOT DRAWN. spleen declares the Latin-1 codepoints and draws
    nothing in 99 of them. A font's cmap is not evidence that a glyph has ink.
    Every face filters its solver subset down to glyphs that actually carry
    pixels (space excepted, which is meant to be empty).
  * A MISSING GLYPH IS SILENT. PIL substitutes .notdef without raising, which is
    how the reference pipeline once ran to completion using zero braille. Every
    outline face checks the cmap before rasterising and reports what is absent.
"""
from __future__ import annotations

import gzip
import re
import struct
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]


@dataclass
class Face:
    name: str
    cw: int
    ch: int
    masks: dict[int, np.ndarray]          # codepoint -> (ch, cw) in {0,1}
    provenance: str                       # "vendored" | "needs vendoring" | "derived"
    source: str
    licence: str = "unknown"
    notes: list[str] = field(default_factory=list)

    @property
    def label(self) -> str:
        return f"{self.name} {self.cw}x{self.ch}"


# ------------------------------------------------------------------ bitmap src
def from_bdf(path: Path, name: str, provenance: str, cw: int | None = None,
             ch: int | None = None, licence: str = "unknown") -> Face:
    """
    Read a BDF into fixed cells, deriving the cell from the font's own metrics.

    Three things a naive reader gets wrong, all of them silently:

      * FONTBOUNDINGBOX IS NOT THE CELL. It is the union of every glyph's box,
        so a font carrying any double-width glyph reports a cell twice as wide
        as its text cell. Cozette declares 13x15 and is a 6x13 font. The cell is
        the common DWIDTH by FONT_ASCENT + FONT_DESCENT.
      * ROWS ARE PADDED TO WHOLE BYTES. A 12-wide glyph has 4 hex digits per row
        and its leftmost pixel is bit 15, not bit 7. Testing against 0x80 works
        for spleen's 5x8 and mangles every font wider than 8.
      * PER-GLYPH BOUNDING BOXES MOVE THE GLYPH. A glyph's BBX need not match the
        font's, and the difference is where it sits in the cell.

    Glyphs whose advance differs from the cell (the double-width ones) are
    counted and skipped rather than squeezed.
    """
    text = path.read_text(encoding="utf-8", errors="replace").split("\n")

    props: dict[str, int] = {}
    fbb = None
    widths: dict[int, int] = {}
    # The text cell is the advance of the ASCII glyphs, not the modal advance of
    # the whole font. scientifica is a 5x11 face carrying 491 double-width
    # forms, so "most common DWIDTH" chose 11 and excluded every letter it has.
    enc = -1
    for line in text:
        if line.startswith("FONTBOUNDINGBOX"):
            fbb = [int(v) for v in line.split()[1:5]]
        elif line.startswith("FONT_ASCENT ") or line.startswith("FONT_DESCENT "):
            k, v = line.split()[:2]
            props[k] = int(v)
        elif line.startswith("ENCODING "):
            enc = int(line.split()[1])
        elif line.startswith("DWIDTH ") and 0x20 <= enc <= 0x7E:
            w = int(line.split()[1])
            widths[w] = widths.get(w, 0) + 1
    if fbb is None:
        fbb = [cw or 8, ch or 16, 0, 0]

    common_w = max(widths, key=widths.get) if widths else fbb[0]
    cell_w = cw or common_w
    if ch:
        cell_h = ch
    elif "FONT_ASCENT" in props and "FONT_DESCENT" in props:
        cell_h = props["FONT_ASCENT"] + props["FONT_DESCENT"]
    else:
        cell_h = fbb[1]
    ascent = props.get("FONT_ASCENT", fbb[1] + fbb[3])

    masks: dict[int, np.ndarray] = {}
    skipped = 0
    cp, rows, bbx, dwidth = -1, None, None, common_w
    for raw in text:
        line = raw.strip()
        if line.startswith("ENCODING "):
            cp = int(line.split()[1])
        elif line.startswith("DWIDTH "):
            dwidth = int(line.split()[1])
        elif line.startswith("BBX "):
            bbx = [int(v) for v in line.split()[1:5]]
        elif line == "BITMAP":
            rows = []
        elif line == "ENDCHAR":
            if cp >= 0 and rows is not None:
                if dwidth != cell_w:
                    skipped += 1
                else:
                    bw, bh, bx, by = bbx or [cell_w, cell_h, 0, 0]
                    m = np.zeros((cell_h, cell_w))
                    digits = max(2, ((bw + 7) // 8) * 2)
                    bits = digits * 4
                    for i, hexrow in enumerate(rows[:bh]):
                        y = ascent - (by + bh) + i
                        if not (0 <= y < cell_h):
                            continue
                        value = int(hexrow.ljust(digits, "0")[:digits], 16)
                        for j in range(bw):
                            x = bx + j
                            if 0 <= x < cell_w and value & (1 << (bits - 1 - j)):
                                m[y, x] = 1.0
                    masks[cp] = m
            cp, rows, bbx, dwidth = -1, None, None, common_w
        elif rows is not None and re.fullmatch(r"[0-9A-Fa-f]+", line):
            rows.append(line)

    face = Face(name, cell_w, cell_h, masks, provenance, str(path), licence)
    if skipped:
        face.notes.append(f"{skipped} glyphs whose advance is not {cell_w}px "
                          f"(double-width forms) skipped")
    return face


def from_hex(path: Path, name: str, provenance: str, cw: int = 8, ch: int = 8,
             licence: str = "unknown") -> Face:
    """Read a unifont-style .hex dump (one hex row per scanline)."""
    masks: dict[int, np.ndarray] = {}
    nibbles = (cw // 4) * ch
    step = cw // 4
    for line in path.read_text(encoding="utf-8", errors="replace").split("\n"):
        m = re.fullmatch(r"([0-9A-Fa-f]+):([0-9A-Fa-f]+)", line.strip())
        if not m or len(m.group(2)) != nibbles:
            continue
        grid = np.zeros((ch, cw))
        for y in range(ch):
            byte = int(m.group(2)[y * step:(y + 1) * step], 16)
            for x in range(cw):
                if byte & (1 << (cw - 1 - x)):
                    grid[y, x] = 1.0
        masks[int(m.group(1), 16)] = grid
    return Face(name, cw, ch, masks, provenance, str(path), licence)


# -------------------------------------------------------------------- PCF src
_PCF_ACCEL, _PCF_METRICS, _PCF_BITMAPS, _PCF_ENCODINGS, _PCF_BDF_ACCEL = 2, 4, 8, 32, 256
_BYTE_BIG, _BIT_BIG, _COMPRESSED = 1 << 2, 1 << 3, 0x100


def from_pcf(path: Path, name: str, provenance: str,
             licence: str = "unknown") -> Face:
    """
    Read an X11 PCF bitmap font into fixed cells.

    Worth having for its own sake: half the bitmap fonts anyone would want to
    try here — Terminus, Cozette, the whole misc-fixed lineage — ship as PCF,
    so a harness that only reads BDF can only ever see half the field.

    The cell is the font's own advance width by its ascent+descent, and each
    glyph is placed by its left side bearing and ascent. PCF stores per-glyph
    bounding boxes that routinely differ from the font's, exactly as BDF does,
    and ignoring them stacks every glyph in the corner.
    """
    raw = (gzip.open(path, "rb").read() if str(path).endswith(".gz")
           else path.read_bytes())
    if raw[:4] != b"\x01fcp":
        raise SystemExit(f"{path} is not a PCF font")

    (ntables,) = struct.unpack_from("<i", raw, 4)
    tables = {}
    for i in range(ntables):
        t, fmt, size, off = struct.unpack_from("<iiii", raw, 8 + 16 * i)
        tables[t] = off
    end = lambda f: ">" if f & _BYTE_BIG else "<"          # noqa: E731

    # -- accelerators: the font's own ascent/descent, i.e. the cell height
    acc = tables.get(_PCF_BDF_ACCEL, tables.get(_PCF_ACCEL))
    (af,) = struct.unpack_from("<i", raw, acc)
    e = end(af)
    ascent, descent = struct.unpack_from(e + "ii", raw, acc + 4 + 8)

    # -- metrics
    off = tables[_PCF_METRICS]
    (mf,) = struct.unpack_from("<i", raw, off)
    e = end(mf); p = off + 4
    metrics = []
    if mf & _COMPRESSED:
        (n,) = struct.unpack_from(e + "h", raw, p); p += 2
        for _ in range(n):
            v = struct.unpack_from("5B", raw, p); p += 5
            metrics.append(tuple(x - 0x80 for x in v))
    else:
        (n,) = struct.unpack_from(e + "i", raw, p); p += 4
        for _ in range(n):
            v = struct.unpack_from(e + "5hH", raw, p); p += 12
            metrics.append(v[:5])

    # -- bitmaps
    off = tables[_PCF_BITMAPS]
    (bf,) = struct.unpack_from("<i", raw, off)
    e = end(bf); p = off + 4
    (ng,) = struct.unpack_from(e + "i", raw, p); p += 4
    offsets = struct.unpack_from(e + f"{ng}i", raw, p); p += 4 * ng
    sizes = struct.unpack_from(e + "4i", raw, p); p += 16
    pad = 1 << (bf & 3)
    data = raw[p:p + sizes[bf & 3]]
    msb_first = bool(bf & _BIT_BIG)

    # -- encodings
    off = tables[_PCF_ENCODINGS]
    (ef,) = struct.unpack_from("<i", raw, off)
    e = end(ef); p = off + 4
    minc, maxc, minb, maxb, _def = struct.unpack_from(e + "5h", raw, p); p += 10
    count = (maxb - minb + 1) * (maxc - minc + 1)
    index = struct.unpack_from(e + f"{count}H", raw, p)

    # The cell is the advance width UNLESS the design overstrikes it. X11 bold
    # bitmap faces routinely draw 7-8 px of ink on a 6 px advance and rely on
    # the next glyph overlapping; in a fixed atlas cell that is not overlap, it
    # is clipping, and koi6x13b's A, M and W came out fused before this.
    reach = max(m[0] + (m[1] - m[0]) for m in metrics)
    shift = max(0, -min(m[0] for m in metrics))
    cw = max(max(m[2] for m in metrics), reach + shift)
    ch = ascent + descent
    masks: dict[int, np.ndarray] = {}
    for b1 in range(minb, maxb + 1):
        for c2 in range(minc, maxc + 1):
            g = index[(b1 - minb) * (maxc - minc + 1) + (c2 - minc)]
            if g == 0xFFFF:
                continue
            cp = (b1 << 8 | c2) if maxb > 0 else c2
            lsb, rsb, _adv, gasc, gdesc = metrics[g]
            w, h = rsb - lsb, gasc + gdesc
            m = np.zeros((ch, cw))
            if w > 0 and h > 0:
                stride = ((w + pad * 8 - 1) // (pad * 8)) * pad
                start = offsets[g]
                for y in range(h):
                    yy = ascent - gasc + y
                    if not (0 <= yy < ch):
                        continue
                    row = data[start + y * stride: start + y * stride + stride]
                    for x in range(w):
                        xx = lsb + shift + x
                        if not (0 <= xx < cw):
                            continue
                        byte = row[x // 8]
                        bit = ((byte >> (7 - x % 8)) if msb_first
                               else (byte >> (x % 8))) & 1
                        if bit:
                            m[yy, xx] = 1.0
            masks[cp] = m
    face = Face(name, cw, ch, masks, provenance, str(path), licence)
    adv = max(m[2] for m in metrics)
    if cw != adv:
        face.notes.append(f"cell widened from the {adv}px advance to {cw}px so "
                          f"the design's overstrike is not clipped")
    return face


# ----------------------------------------------------------------- outline src
def from_outline(path: Path, name: str, provenance: str, cw: int, ch: int,
                 threshold: int = 128, want=None, licence: str = "unknown") -> Face:
    """
    Rasterise an outline font onto a cw x ch cell.

    Size and offset are FITTED, not guessed. A hand-picked pixel size clips the
    glyph against the cell edge — measured on FreeMono at px=15 in an 8x16 cell,
    'A' and '@' both lost their left column and the specimen sheet read as
    garbage. Here the size comes from the advance width and the offset from the
    ink bounding box, and anything still overflowing the cell is counted and
    reported rather than silently cropped.
    """
    from fontTools.ttLib import TTFont
    from PIL import Image, ImageDraw, ImageFont

    want = list(want or (list(range(0x20, 0x7F)) + list(range(0x2800, 0x2900))))
    cmap = TTFont(str(path), fontNumber=0, lazy=True).getBestCmap()
    absent = [c for c in want if c not in cmap]
    present = [c for c in want if c in cmap]

    REF = 64
    probe = ImageFont.truetype(str(path), REF)
    advance = probe.getlength("M") or REF
    px = max(4, int(round(cw * REF / advance)))

    font = ImageFont.truetype(str(path), px)
    pad_x, pad_y = cw, ch
    canvas = (cw + 2 * pad_x, ch + 2 * pad_y)

    def stamp(cp: int, ox: float, oy: float) -> np.ndarray:
        im = Image.new("L", canvas, 0)
        ImageDraw.Draw(im).text((pad_x + ox, pad_y + oy), chr(cp), font=font, fill=255)
        return (np.asarray(im, float) >= threshold).astype(float)

    # fit the vertical offset from a tall reference set, and the horizontal one
    # from the advance so the glyph sits where a terminal would put it.
    ref = [c for c in (ord(x) for x in "MHXgjypq|[](") if c in cmap] or present[:8]
    tops, bots, lefts, rights = [], [], [], []
    for cp in ref:
        ink = np.argwhere(stamp(cp, 0, 0) > 0)
        if ink.size:
            tops.append(ink[:, 0].min()); bots.append(ink[:, 0].max())
            lefts.append(ink[:, 1].min()); rights.append(ink[:, 1].max())
    if tops:
        oy = (ch - (max(bots) - min(tops) + 1)) / 2 - (min(tops) - pad_y)
        ox = (cw - (max(rights) - min(lefts) + 1)) / 2 - (min(lefts) - pad_x)
    else:
        ox = oy = 0.0

    masks: dict[int, np.ndarray] = {}
    clipped = 0
    for cp in present:
        big = stamp(cp, ox, oy)
        cell = big[pad_y:pad_y + ch, pad_x:pad_x + cw]
        if big.sum() > cell.sum():
            clipped += 1
        masks[cp] = cell

    face = Face(name, cw, ch, masks, provenance, str(path), licence)
    face.notes.append(f"rasterised at {px}px, offset ({ox:+.1f}, {oy:+.1f})")
    if absent:
        face.notes.append(f"{len(absent)} of {len(want)} codepoints absent from "
                          f"the cmap and skipped")
    if clipped:
        face.notes.append(f"{clipped} glyphs overflow the cell and are cropped")
    return face


def cap_ink(face: Face, max_ink: float, name: str | None = None) -> Face:
    """
    Drop glyphs denser than `max_ink` from a face.

    The no-blocks rule is written as a codepoint range (U+2580-259F), and that
    is not what it enforces. Measured with a flat background, unscii-8 spends
    26% of its cells on glyphs of ink >= 0.75 — U+28FF alone takes 288 of them
    — because a fully-dotted braille cell IS a solid block, legally. The
    property that keeps output looking like text is the ink ceiling, not the
    codepoint. This makes that ceiling adjustable so the question can be
    answered by looking rather than by arguing.
    """
    masks = {cp: m for cp, m in face.masks.items() if m.mean() <= max_ink}
    out = Face(name or f"{face.name} ink<={max_ink:g}", face.cw, face.ch, masks,
               face.provenance, face.source, face.licence)
    out.notes.append(f"{len(face.masks) - len(masks)} glyphs above "
                     f"{max_ink:g} ink coverage removed")
    return out


def upscale(face: Face, factor: int) -> Face:
    masks = {cp: np.kron(m, np.ones((factor, factor)))
             for cp, m in face.masks.items()}
    out = Face(f"{face.name} x{factor}", face.cw * factor, face.ch * factor,
               masks, "derived", face.source, face.licence)
    out.notes.append(f"pixel-doubled from {face.label} — no new detail, "
                     f"only larger marks")
    return out


# -------------------------------------------------------------------- registry
X11_CYRILLIC = Path("/usr/share/fonts/X11/cyrillic")

# From Debian's xfonts-cyrillic, which carries the upstream licence text.
# "PD" below is the literal upstream wording: "Public domain font. Share and
# enjoy." The others are BSD-style retain-the-notice terms. All are compatible
# with an Apache-2.0 project, which is more than can be said for Unifont.
X11_FACES = {
    "koi5x8":      "public domain",
    "koi6x9":      "public domain",
    "koi6x13":     "BSD-style (Winitzki)",
    "koi6x13b":    "public domain",
    "koi7x14":     "public domain",
    "koi7x14b":    "public domain",
    "koi8x13":     "public domain",
    "koi8x16":     "no restrictions",
    "koi9x15":     "public domain",
    "koi9x15b":    "public domain",
    "koi9x18":     "public domain",
    "koi10x20":    "BSD-style (Cronyx)",
    "koi12x24b":   "no restrictions",
    "screen8x16":  "BSD-style (Cronyx)",
    "screen8x16b": "BSD-style (Cronyx)",
}

SANDBOX_UNIFONT = Path("/usr/share/fonts/opentype/unifont/unifont.otf")
SANDBOX_FREEMONO = Path("/usr/share/fonts/truetype/freefont/FreeMono.ttf")


def registry(vendor: Path | None = None) -> dict[str, callable]:
    v = vendor or (ROOT / "vendor")
    reg: dict[str, callable] = {
        "spleen-5x8": lambda: from_bdf(v / "spleen" / "spleen-5x8.bdf",
                                       "spleen", "vendored", 5, 8,
                                       licence="BSD-2-Clause"),
        "unscii-8x8": lambda: from_hex(v / "unscii" / "unscii-8.hex",
                                       "unscii-8", "vendored", 8, 8,
                                       "public domain"),
    }
    reg["unscii-8x8-light"] = lambda: cap_ink(reg["unscii-8x8"](), 0.55,
                                              "unscii-8 light")
    reg["spleen-10x16"] = lambda: upscale(reg["spleen-5x8"](), 2)
    reg["unscii-16x16"] = lambda: upscale(reg["unscii-8x8"](), 2)

    if SANDBOX_UNIFONT.exists():
        reg["unifont-8x16"] = lambda: from_outline(
            SANDBOX_UNIFONT, "unifont", "needs vendoring", 8, 16,
            licence="GPLv2+ with font exception")
    if SANDBOX_FREEMONO.exists():
        # FreeMono's advance/height ratio is ~0.6, so an 8x16 cell (0.50) can
        # only hold it by shrinking it until the stems threshold away — measured
        # at 13px, 'A' lost its apex and 'i' and 'l' lost their stems entirely.
        # Give it cells that match its own proportions instead.
        reg["freemono-10x16"] = lambda: from_outline(
            SANDBOX_FREEMONO, "FreeMono", "needs vendoring", 10, 16, threshold=96,
            licence="GPLv3+ with font exception")
        reg["freemono-12x20"] = lambda: from_outline(
            SANDBOX_FREEMONO, "FreeMono", "needs vendoring", 12, 20, threshold=96,
            licence="GPLv3+ with font exception")

    for stem, lic in X11_FACES.items():
        f = X11_CYRILLIC / f"{stem}.pcf.gz"
        if f.exists():
            reg[stem] = (lambda p=f, n=stem, l=lic:
                         from_pcf(p, n, "sandbox", l))

    # Anything dropped into vendor/fonts/*.bdf joins the sweep automatically.
    known = {"spleen": "BSD-2-Clause", "cozette": "MIT", "ter-u": "SIL OFL 1.1",
             "scientifica": "SIL OFL 1.1", "tamzen": "permissive (Tamsyn)"}

    extra = v / "fonts"
    if extra.is_dir():
        for pcf in sorted(list(extra.glob("*.pcf")) + list(extra.glob("*.pcf.gz"))):
            reg[pcf.name.split(".")[0]] = (
                lambda p=pcf: from_pcf(p, p.name.split(".")[0], "vendored"))
        for bdf in sorted(extra.glob("*.bdf")):
            lic = next((L for k, L in known.items() if bdf.stem.startswith(k)),
                       "unknown")
            face = from_bdf(bdf, bdf.stem, "vendored", licence=lic)
            key = (bdf.stem if re.search(r"\d+x\d+$", bdf.stem)
                   else f"{bdf.stem}-{face.cw}x{face.ch}")
            reg[key] = (lambda p=bdf, L=lic:
                        from_bdf(p, p.stem, "vendored", licence=L))
    return reg


def _probe_bdf(path: Path) -> tuple[int, int] | None:
    for line in path.read_text(encoding="utf-8", errors="replace").split("\n"):
        if line.startswith("FONTBOUNDINGBOX"):
            parts = line.split()
            return int(parts[1]), int(parts[2])
    return None


# --------------------------------------------------------------- cell ladders
def cell_ladder(cw: int, ch: int, targets=(25, 40, 64),
                tol: float = 0.25, limit: int = 40) -> list[tuple[int, int]]:
    """
    Glyphs-per-cell options that keep the CELL as square as it can be.

    A cell is the placement unit — one tower, one terrain patch — and it wants
    to be square on screen even though the glyph is not. For a glyph of cw x ch
    that means Cw/Ch must approximate ch/cw, so the usable options form a sparse
    lattice: for spleen's 5x8 they are the Fibonacci-looking 5x3, 8x5, 13x8
    (25x24, 40x40, 65x64 px), and for a coarse glyph like unifont's 8x16 there
    are far fewer rungs to stand on. That sparsity is a real property of the
    font, not an artifact of this function, and the report shows it.

    Returns one (Cw, Ch) per target side length, strictly increasing in area,
    each within `tol` of square.
    """
    cands = []
    for Cw in range(1, limit + 1):
        for Ch in range(1, limit + 1):
            w, h = Cw * cw, Ch * ch
            ratio = w / h
            if abs(ratio - 1) <= tol:
                cands.append((w * h, w, h, Cw, Ch, abs(ratio - 1)))
    cands.sort()

    out: list[tuple[int, int]] = []
    used_area = 0
    for T in targets:
        pick = None
        for area, w, h, Cw, Ch, off in cands:
            if area <= used_area:
                continue
            score = (abs((area ** 0.5) - T), off)
            if pick is None or score < pick[0]:
                pick = (score, area, Cw, Ch)
        if pick is None:
            break
        out.append((pick[2], pick[3]))
        used_area = pick[1]
    return out
