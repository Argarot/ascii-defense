#!/usr/bin/env python3
"""
Cell-geometry comparison: how many glyphs should a game cell hold, and in
which font?

    python tools/art/compare.py
    python tools/art/compare.py --faces spleen-5x8,unscii-8x8

Font SIZE is held at each font's native design size — nothing is upscaled. What
varies is the font itself and the number of glyphs per cell, chosen so the CELL
stays as square as that font allows. Three rungs per font: the current cell size
(~25x24 px), the next near-square size up, and the one after.

Four sections:

  A. THE LADDER — the same patch of battlefield at each rung, at 1:1, with a
     free background colour per cell.
  B. THE SAME LADDER, GLYPH-LED — identical grid, but the background is forced
     to a single colour so the picture is carried by glyph shape and foreground.
     Compare position for position against A.
  C. DRAWING ROOM — one tower per rung, which is the thing the glyph budget is
     actually being spent on.
  D. THE BACKGROUND RAMP — one font, one rung, four degrees of background
     freedom, with the error and ink cost of each.
"""
from __future__ import annotations

import argparse
import base64
import io
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from collections import Counter

import numpy as np
from PIL import Image

import fonts
import glyphs
import proof
import scene
import solve as solver

ROOT = Path(__file__).resolve().parents[2]

SCREEN_W, SCREEN_H = 1920, 1200
TARGETS = (25, 40)
RUNG_NAMES = ("rung 0 — today's cell", "rung 1 — next square size")
SLACK = 2.0
MIN_SEP = 16.0          # floor on |fg - bg|, in RGB distance
SEP_RAMP = (0.0, 8.0, 16.0, 32.0)
SOLID = 0.75            # ink coverage at or above which a glyph is a block
# Chosen so several cell sizes carry more than one face: those rows are typeface
# comparisons with the geometry held fixed, which is the only way to see what a
# font contributes independently of how big it is.
DEFAULT_FACES = [
    "spleen-5x8", "koi5x8",       # 5x8  — same cell, two typefaces
    "scientifica-11-5x11",        # 5x11
    "spleen-6x12",                # 6x12
    "cozette-6x13",               # 6x13
    "spleen-8x16",                # 8x16
]


def png_uri(img: Image.Image) -> str:
    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


def geometry(gs, shape) -> dict:
    w, h = gs.cw * shape[0], gs.ch * shape[1]
    bx, by = SCREEN_W // w, SCREEN_H // h
    return {"glyphs": list(shape), "cell_px": [w, h],
            "ratio": round(w / h, 3), "glyphs_per_cell": shape[0] * shape[1],
            "board_cells": [bx, by], "board_tiles": [bx // 5, by // 5]}


def render(gs, src, cols, rows, min_sep=MIN_SEP):
    s = solver.solve(src, gs, cols, rows, slack=SLACK, min_sep=min_sep)
    img = proof.render(gs, s.grid, s.fg, s.bg)
    flat = s.grid.ravel()
    used = {int(i) for i in flat}
    braille = [i for i in used if 0x2800 <= gs.codepoints[i] <= 0x28FF]
    per_cell = gs.masks[flat].mean(1)
    # Share of CELLS by glyph class, not share of the vocabulary. Reporting
    # "65 distinct glyphs (22 braille)" in earlier rounds was misleading: it
    # described the alphabet, and the alphabet is not what you look at. By
    # cells, braille was about 2% even then.
    cls = np.array([glyphs.glyph_class(gs.codepoints[int(i)]) for i in flat])
    counts = Counter(int(i) for i in flat)
    top = [(chr(gs.codepoints[i]), n) for i, n in counts.most_common(16)]
    sep = np.linalg.norm(s.fg.astype(float) - s.bg.astype(float), axis=-1).ravel()
    space = gs.index_of(0x20) if 0x20 in gs.codepoints else -1
    return img, {"rmse": round(s.err ** 0.5, 2), "distinct": len(used),
                 "braille": len(braille),
                 "ink": round(float(gs.masks[flat].mean()) * 100, 1),
                 "solid": round(float((per_cell >= SOLID).mean()) * 100, 1),
                 "blank": round(float((flat == space).mean()) * 100, 1),
                 "sep_min": round(float(sep.min()), 1),
                 "sep_med": round(float(np.median(sep)), 1),
                 "pct_ascii": round(float((cls == 0).mean()) * 100, 1),
                 "pct_other": round(float((cls == 1).mean()) * 100, 1),
                 "pct_braille": round(float((cls == 2).mean()) * 100, 1),
                 "top": top,
                 "px": list(img.size)}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--faces", default=",".join(DEFAULT_FACES))
    ap.add_argument("--out", default=str(ROOT / "out" / "cells"))
    args = ap.parse_args()

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    reg = fonts.registry()
    keys = [k.strip() for k in args.faces.split(",") if k.strip()]

    sets, ladders = {}, {}
    for k in keys:
        if k not in reg:
            raise SystemExit(f"unknown face '{k}'. known: {', '.join(reg)}")
        gs = sets[k] = glyphs.from_face(reg[k]())
        ladders[k] = fonts.cell_ladder(gs.cw, gs.ch, TARGETS)
        rungs = "  ".join(f"{a}x{b}->{a*gs.cw}x{b*gs.ch}" for a, b in ladders[k])
        print(f"{k:16s} glyph {gs.cw}x{gs.ch}  {rungs}")

    report = {"screen": [SCREEN_W, SCREEN_H], "targets": list(TARGETS),
              "slack": SLACK, "repertoire": list(glyphs.DEFAULT_SUBSETS),
              "faces": {}}
    A, B, C = {}, {}, {}

    for k in keys:
        gs = sets[k]
        report["faces"][k] = {
            "label": gs.label, "glyph": [gs.cw, gs.ch],
            "provenance": gs.provenance, "licence": gs.licence,
            "solver_glyphs": int(gs.solve_idx.size),
            "max_ink": round(gs.max_ink, 2),
            "native_ink": round(gs.native_ink, 2), "notes": list(gs.notes),
            "rungs": [],
        }
        for r, shape in enumerate(ladders[k]):
            geo = geometry(gs, shape)
            cols, rows = scene.CELLS_X * shape[0], scene.CELLS_Y * shape[1]
            board_src = scene.board(cols * gs.cw, rows * gs.ch)
            A[(k, r)], m_sep = render(gs, board_src, cols, rows)
            B[(k, r)], m_off = render(gs, board_src, cols, rows, min_sep=0.0)
            tower_src = scene.tower(shape[0] * gs.cw, shape[1] * gs.ch)
            C[(k, r)], m_tower = render(gs, tower_src, *shape)
            A[(k, r)].save(out / f"board_{k}_r{r}.png")
            B[(k, r)].save(out / f"boardoff_{k}_r{r}.png")
            report["faces"][k]["rungs"].append(
                geo | {"sep": m_sep, "off": m_off, "tower": m_tower})
            print(f"  {k:14s} r{r} {geo['cell_px'][0]}x{geo['cell_px'][1]}px "
                  f"{geo['glyphs_per_cell']:3d} g/cell  "
                  f"board {geo['board_cells'][0]}x{geo['board_cells'][1]}  "
                  f"rmse {m_off['rmse']}->{m_sep['rmse']}  "
                  f"blank {m_off['blank']}%->{m_sep['blank']}%  "
                  f"ink {m_sep['ink']}%  sep>={m_sep['sep_min']}")

    # ---------------------------------------------------------------- ramp
    ramp_key = keys[0]
    gs = sets[ramp_key]
    shape = ladders[ramp_key][min(1, len(ladders[ramp_key]) - 1)]
    cols, rows = scene.CELLS_X * shape[0], scene.CELLS_Y * shape[1]
    ramp_src = scene.board(cols * gs.cw, rows * gs.ch)
    ramp = []
    for sep in SEP_RAMP:
        img, m = render(gs, ramp_src, cols, rows, min_sep=sep)
        label = "off" if sep == 0 else f"|fg-bg| >= {sep:g}"
        ramp.append((label, img, m))
        print(f"  ramp {label:16s} rmse {m['rmse']:6}  ink {m['ink']}%  "
              f"blank {m['blank']}%")
    report["ramp"] = {"face": ramp_key, "glyphs": list(shape),
                      "modes": [{"label": l} | m for l, _, m in ramp]}

    # ---- control: the same content drawn soft, to show where the dot-texture
    # of the earlier rounds actually came from.
    gsc = sets[keys[0]]
    shape = ladders[keys[0]][-1]
    cc, rr = scene.CELLS_X * shape[0], scene.CELLS_Y * shape[1]
    control = []
    for label, fn in (("crisp — flat masses, hard edges", scene.board),
                      ("soft — the earlier rounds' source", scene.board_soft)):
        img, m = render(gsc, fn(cc * gsc.cw, rr * gsc.ch), cc, rr)
        control.append((label, img, m))
        top = " ".join(f"{c!r}x{n}" for c, n in m["top"][:8])
        print(f"  control {label[:20]:22s} rmse {m['rmse']:6}  "
              f"braille {m['pct_braille']}%  distinct {m['distinct']}\n"
              f"          {top}")
    report["control"] = [{"label": l} | m for l, _, m in control]

    (out / "cells.json").write_text(json.dumps(report, indent=2))
    html = build_html(report, keys, ladders, sets, A, B, C, ramp, control)
    (out / "cells.html").write_text(html, encoding="utf-8")
    print(f"\nwrote {out / 'cells.html'}  ({len(html) / 1e6:.1f} MB)")
    return 0


# --------------------------------------------------------------------- report
def build_html(report, keys, ladders, sets, A, B, C, ramp, control) -> str:
    f = report["faces"]
    n_rungs = max(len(f[k]["rungs"]) for k in keys)

    trows = []
    for k in keys:
        d = f[k]
        for r, g in enumerate(d["rungs"]):
            first = r == 0
            trows.append(
                f"<tr{' class=grp' if first else ''}>"
                + (f"<td class=n rowspan={len(d['rungs'])}>{d['label']}</td>"
                   if first else "")
                + f"<td>{r}</td>"
                f"<td>{g['glyphs'][0]}&times;{g['glyphs'][1]}</td>"
                f"<td><b>{g['glyphs_per_cell']}</b></td>"
                f"<td>{g['cell_px'][0]}&times;{g['cell_px'][1]}</td>"
                f"<td>{g['ratio']:.2f}</td>"
                f"<td>{g['board_cells'][0]}&times;{g['board_cells'][1]}</td>"
                f"<td>{g['board_tiles'][0]}&times;{g['board_tiles'][1]}</td>"
                f"<td>{g['off']['rmse']}</td><td>{g['sep']['rmse']}</td>"
                f"<td>{g['sep']['ink']}%</td>"
                f"<td>{g['off']['blank']}%</td>"
                f"<td class='{'warn' if g['sep']['blank'] > 0 else 'ok'}'>"
                f"{g['sep']['blank']}%</td>"
                f"<td>{g['sep']['sep_min']}</td>"
                f"<td>{g['sep']['pct_ascii']}%</td>"
                f"<td class='{'warn' if g['sep']['pct_braille'] > 15 else ''}'>"
                f"{g['sep']['pct_braille']}%</td>"
                + (f"<td rowspan={len(d['rungs'])}>{d['solver_glyphs']}</td>"
                   f"<td rowspan={len(d['rungs'])}>{d['native_ink']:.2f}"
                   f"{'&rarr;' + format(d['max_ink'], '.2f') if d['native_ink'] > d['max_ink'] + 1e-9 else ''}"
                   f"</td>" if first else "")
                + (f"<td class='{'warn' if d['provenance'] != 'vendored' else 'ok'}' "
                   f"rowspan={len(d['rungs'])}>{d['provenance']}<br>"
                   f"<small>{d['licence']}</small></td>" if first else "")
                + "</tr>")

    def grid(images, metric_key, zoom=0):
        head = "".join(f"<th>{RUNG_NAMES[r]}</th>" for r in range(n_rungs))
        body = []
        for k in keys:
            cells = []
            for r in range(n_rungs):
                if (k, r) not in images:
                    cells.append("<td class=empty>—</td>")
                    continue
                g = f[k]["rungs"][r]
                img = images[(k, r)]
                shown = (f"<img class=one src='{png_uri(img)}'>"
                         if not zoom else
                         f"<div class=pair><img class=one src='{png_uri(img)}'>"
                         f"<img src='{png_uri(img.resize((img.width*zoom, img.height*zoom), Image.NEAREST))}'></div>")
                m = g[metric_key]
                cells.append(
                    f"<td>{shown}<small>{g['glyphs'][0]}&times;{g['glyphs'][1]} "
                    f"= {g['glyphs_per_cell']} glyphs &middot; cell "
                    f"{g['cell_px'][0]}&times;{g['cell_px'][1]}px &middot; board "
                    f"{g['board_cells'][0]}&times;{g['board_cells'][1]}<br>"
                    f"RMSE {m['rmse']} &middot; {m['distinct']} distinct "
                    f"&middot; {m['pct_ascii']}% ASCII / {m['pct_braille']}% "
                    f"braille by cell &middot; {m['ink']}% ink"
                    f"</small></td>")
            body.append(f"<tr><th class=n>{f[k]['label']}</th>{''.join(cells)}</tr>")
        return ("<div class=scroll><table class=grid>"
                f"<tr><th></th>{head}</tr>{''.join(body)}</table></div>")

    ramp_html = "".join(
        f"<figure><figcaption><b>{label}</b><span>RMSE {m['rmse']} &middot; "
        f"{m['ink']}% ink &middot; {m['pct_braille']}% braille by cell &middot; "
        f"{m['distinct']} distinct</span></figcaption>"
        f"<img src='{png_uri(img)}'></figure>" for label, img, m in ramp)

    vocab = []
    for k in keys:
        g = f[k]["rungs"][-1]["sep"]
        chips = "".join(
            f"<span class=chip><b>{'&nbsp;' if ch == ' ' else _esc(ch)}</b>"
            f"<i>{n}</i></span>" for ch, n in g["top"])
        vocab.append(
            f"<div class=voc><h3>{f[k]['label']}</h3>"
            f"<p>{g['pct_ascii']}% ASCII &middot; {g['pct_other']}% other "
            f"&middot; {g['pct_braille']}% braille, by cell &middot; "
            f"{g['distinct']} distinct glyphs</p><div class=chips>{chips}</div>"
            f"</div>")

    ctrl = "".join(
        f"<figure><figcaption><b>{label}</b><span>RMSE {m['rmse']} &middot; "
        f"{m['distinct']} distinct &middot; {m['pct_braille']}% braille by cell"
        f"</span></figcaption><img src='{png_uri(img)}'></figure>"
        for label, img, m in control)

    notes = []
    for k in keys:
        if f[k]["notes"]:
            notes.append(f"<li><b>{f[k]['label']}</b> — "
                         + "; ".join(f[k]["notes"]) + "</li>")

    rf = report["ramp"]
    return TEMPLATE.format(
        table="\n".join(trows), a=grid(A, "sep"), b=grid(B, "off"),
        vocab="\n".join(vocab), control=ctrl,
        c=grid(C, "tower", zoom=3), ramp=ramp_html,
        notes="\n".join(notes) or "<li>none</li>",
        screen=f"{report['screen'][0]}&times;{report['screen'][1]}",
        repertoire=" + ".join(report["repertoire"]),
        rampface=f[rf["face"]]["label"],
        maxink=f"{glyphs.MAX_INK:g}", minsep=f"{MIN_SEP:g}",
        rampshape=f"{rf['glyphs'][0]}&times;{rf['glyphs'][1]}")


def _esc(ch: str) -> str:
    return {"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"}.get(ch, ch)


TEMPLATE = """<!doctype html>
<html lang=en><meta charset=utf-8>
<title>ASCII Defense — glyphs per cell</title>
<style>
:root {{ color-scheme: dark; --bg:#131417; --fg:#e6e6ea; --dim:#9a9aa6;
        --line:#2a2b31; --warn:#d9a441; --ok:#6fbf87; }}
* {{ box-sizing:border-box }}
body {{ margin:0; padding:2.5rem clamp(1rem,4vw,4rem); background:var(--bg);
       color:var(--fg); font:15px/1.55 ui-sans-serif,system-ui,sans-serif }}
h1 {{ font-size:1.6rem; margin:0 0 .3rem }}
h2 {{ font-size:1.15rem; margin:3rem 0 .4rem; padding-top:1.2rem;
      border-top:1px solid var(--line) }}
p.lede {{ color:var(--dim); max-width:66ch; margin:.2rem 0 0 }}
p.note {{ color:var(--dim); max-width:76ch; margin:.5rem 0 1.4rem }}
nav {{ margin:1rem 0 0; display:flex; gap:1.1rem; flex-wrap:wrap; font-size:13px }}
nav a {{ color:var(--dim); text-decoration:none; border-bottom:1px solid var(--line) }}
nav a:hover {{ color:var(--fg) }}
table {{ border-collapse:collapse; margin:1rem 0 0; font-size:13.5px }}
th,td {{ padding:.38rem .75rem; text-align:right; border-bottom:1px solid var(--line) }}
th {{ color:var(--dim); font-weight:600 }}
td.n,th.n {{ text-align:left; font-weight:600; white-space:nowrap;
             vertical-align:top }}
tr.grp td, tr.grp th {{ border-top:1px solid var(--line) }}
.warn {{ color:var(--warn) }} .ok {{ color:var(--ok) }}
td small {{ color:var(--dim); font-weight:400 }}
.scroll {{ overflow-x:auto; padding-bottom:.5rem }}
table.grid td {{ text-align:center; vertical-align:top; padding:.7rem }}
table.grid small {{ display:block; color:var(--dim); font-size:11px;
                    margin-top:.45rem; line-height:1.45 }}
td.empty {{ color:var(--dim) }}
img {{ image-rendering:pixelated; display:block; background:#000;
       border:1px solid var(--line); margin:0 auto }}
.pair {{ display:flex; gap:.6rem; align-items:center; justify-content:center }}
.voc {{ margin:0 0 1.5rem }}
.voc h3 {{ font-size:1rem; margin:0 0 .15rem }}
.voc p {{ color:var(--dim); font-size:12.5px; margin:0 0 .5rem }}
.chips {{ display:flex; flex-wrap:wrap; gap:.35rem }}
.chip {{ display:inline-flex; align-items:baseline; gap:.35rem; padding:.2rem .5rem;
        border:1px solid var(--line); border-radius:4px; background:#191a1f }}
.chip b {{ font-family:ui-monospace,Menlo,Consolas,monospace; font-size:14px }}
.chip i {{ color:var(--dim); font-style:normal; font-size:11px }}
figure {{ margin:0 0 1.8rem }}
figcaption {{ display:flex; gap:.9rem; align-items:baseline; margin-bottom:.4rem }}
figcaption span {{ color:var(--dim); font-size:12.5px }}
figure img {{ margin:0 }}
ul {{ color:var(--dim); max-width:76ch }}
code {{ font-size:.92em; color:var(--fg) }}
</style>
<h1>Glyphs per cell</h1>
<p class=lede>Font size is held at each font's native design size — nothing is
upscaled. What varies is the font and the number of glyphs in a cell, chosen so
the <b>cell</b> stays as square as that font allows. Rung 0 is today's
25&times;24 px cell; rung 1 is the next near-square size up. Screen budget
{screen}; repertoire is whatever each font draws in {repertoire}.</p>
<p class=lede style="margin-top:.9rem">Two rules apply throughout, and they are
the point of this round:
<b>no glyph may exceed {maxink} ink coverage</b>, and
<b>a cell's foreground may not come within {minsep} of its background</b>
in RGB distance. The first stops a fully-dotted braille cell standing in for a
block. The second means nothing can disappear into the background — every cell
carries a visible mark — while leaving the background colour itself completely
free.</p>
<nav><a href="#table">the ladder</a><a href="#a">A · board, free background</a>
<a href="#b">B · the rule off</a><a href="#c">C · drawing room</a>
<a href="#v">the vocabulary</a><a href="#ctl">why it looked like dots</a>
<a href="#d">D · the separation ramp</a><a href="#add">provenance</a>
<a href="#notes">notes</a></nav>

<h2 id=table>The ladder</h2>
<p class=note>Near-square cells form a sparse lattice: for spleen's 5&times;8
glyph they land on 5&times;3 and 8&times;5 — 25&times;24 and 40&times;40 px. A
coarser glyph has fewer rungs to stand on, and the ratio column shows which
fonts cannot reach square at all. Several rows share a cell size on purpose —
5&times;8, 6&times;13 and 8&times;16 each carry two or three faces, so those are
typeface comparisons with the geometry held fixed. <b>RMSE off</b> and
<b>RMSE on</b> are the same picture without and with the separation rule; the
gap between them is what the rule costs. RMSE compares within a row and between
faces of the same cell size, not across different cell sizes.</p>
<table>
<tr><th class=n>Font</th><th>Rung</th><th>Glyphs</th><th>per cell</th>
<th>Cell px</th><th>Ratio</th><th>Board cells</th><th>Tiles</th>
<th>RMSE off</th><th>RMSE on</th><th>Ink</th><th>Blank off</th><th>Blank on</th>
<th>Min sep</th><th>ASCII</th><th>Braille</th>
<th>Glyphs</th><th>Ink ceiling</th><th>Status</th></tr>
{table}
</table>

<h2 id=a>A · The board, both rules on</h2>
<p class=note>The same 12&times;7 cells of battlefield in every image, at 1:1,
with the ink ceiling and the separation floor applied. Read across a row to see
what more glyphs per cell buys; read down a column to compare fonts at a matched
cell size. The board-size cost is printed under each.</p>
{a}

<h2 id=b>B · The same board with the separation rule off</h2>
<p class=note>Identical grid to A, one change: the foreground may equal the
background again. Compare position for position. The <b>blank</b> figure is the
thing to watch — without the rule most of the board is empty cells carrying no
glyph at all, which is where the flatness came from.</p>
{b}

<h2 id=v>The vocabulary each font actually uses</h2>
<p class=note>Every glyph the solver chose at rung 1, most-used first, with the
number of cells it fills. This is the table that was missing: earlier rounds
reported the size of the <i>alphabet</i> ("65 distinct glyphs, 22 braille"),
which describes what was available, not what you look at. By cell, braille was
about 2% even then — the misleading number was mine.</p>
{vocab}

<h2 id=ctl>Why it looked like dots</h2>
<p class=note>Same content, two sources: drawn as flat masses with hard edges,
and drawn the way the earlier rounds drew it — supersampled, Gaussian blurred,
box downsampled. Read the numbers before the pictures, because they contradict
the obvious story. Braille is 1.0% of cells crisp and 1.1% soft: <b>blur is not
what made the earlier output look like dot texture, and braille was never
driving it either.</b> What blur costs is vocabulary — 46 distinct glyphs
against 32 — and in both cases a single near-empty glyph fills roughly 60% of
the board, which is correct for open ground and is what ASSETS.md asks for.
The honest conclusion is that most of the visible improvement in this round
comes from drawing the source properly — the game's real palette instead of
invented browns, and flat masses with lit and dark edges instead of blurred
blobs — rather than from anything in the solver.</p>
{control}

<h2 id=c>C · What one tower gets</h2>
<p class=note>The glyph budget exists to be spent on objects, so here is the
object. Both rules on, 1:1 on the left and 3&times; on the right.</p>
{c}

<h2 id=d>D · The separation ramp</h2>
<p class=note>{rampface}, {rampshape} glyphs per cell, with the floor on
|fg&nbsp;&minus;&nbsp;bg| raised step by step. The interesting part is how
cheap it is: the constraint falls out of the algebra as an exact projection, so
the error it costs is small and the texture it buys is not. Watch the blank
percentage collapse to zero at the first step.</p>
{ramp}

<h2 id=add>Provenance and licences</h2>
<p class=note>Every face in this table is either already in the repo, downloaded
from an upstream release into <code>vendor/fonts/</code>, or present in the
build sandbox. Anything dropped into <code>vendor/fonts/</code> as
<code>.bdf</code> or <code>.pcf</code> joins the sweep automatically.</p>
<ul>
<li><b>spleen 5&times;8 / 6&times;12 / 8&times;16 / 12&times;24</b> —
BSD-2-Clause, Frederic Cambus, from the spleen 2.1.0 release. Every size ships
the full Braille Patterns block; these are separately drawn designs, not
upscales.</li>
<li><b>Cozette 6&times;13</b> — MIT, from release v.1.30.0. 4,891 glyphs
including braille and box drawing.</li>
<li><b>unscii-8 8&times;8</b> — public domain, already vendored.</li>
<li><b>koi5x8, koi6x13b, koi7x14, screen8x16</b> — X11 bitmap fonts from
Debian's <code>xfonts-cyrillic</code>. The koi faces are upstream-labelled
"Public domain font. Share and enjoy."; the screen face is Cronyx under
BSD-style retain-the-notice terms. No braille and no box drawing — they bring
ASCII plus Cyrillic, and the <b>Glyphs</b> column shows the handicap.</li>
<li><b>unifont 8&times;16</b> — GPLv2+ with font exception. Flagged, not
recommended: <code>tools/build-fonts.mjs</code> already records the decision to
avoid Unifont-derived files.</li>
<li><b>Terminus</b> — <b>not obtained.</b> It publishes through SourceForge,
which this sandbox cannot reach, and has no upstream GitHub release. If you want
it in the table, download <code>terminus-font-4.49.tar.gz</code> yourself and
drop the <code>.bdf</code> files into <code>vendor/fonts/</code>.</li>
</ul>

<h2 id=notes>Notes</h2>
<ul>
{notes}
<li><b>Nothing here is upscaled.</b> Each font is at its native design size;
FreeMono is an outline font, so its pixel size is a free parameter rather than a
property, and it sits here as a control.</li>
<li><b>Licensing gates two of these.</b> <code>tools/build-fonts.mjs</code>
already records the decision to avoid Unifont-derived files. spleen is
BSD-2-Clause and unscii is public domain; Unifont and FreeMono carry GPL font
exceptions.</li>
<li><b>Alignment-tolerant matching was tried and rejected.</b> The standard
reference for this problem is Xu, Zhang &amp; Wong's structure-based ASCII art,
which matches glyphs to image regions with a log-polar shape descriptor so that
a near-miss of a pixel or two does not disqualify a well-shaped glyph. Blurring
both sides before matching is the cheap version of that idea, and measured here
it makes the output <i>worse</i>: at sigma 0.8 the braille share rises from 1%
to 9%, because blurring turns a scattered dot pattern into smooth tone that
matches anything. Their method assumes pure black-on-white text with no colour;
here every cell already carries its own foreground and background, so tone is
handled and the glyph only has to carry shape — and for that, exact matching is
correct. Recorded so it is not re-tried.</li>
<li><b>The class prior is a safety net, not the fix.</b> ASCII, box drawing and
geometric shapes are preferred over Cyrillic, which is preferred over braille; a
lower-ranked glyph must beat the best in-class candidate by a margin and loses
every tie. On a crisp source it changes about 1% of cells. The scene did the
work; the prior stops the old failure mode recurring on soft input.</li>
<li><b>The ink ceiling is now the block ban.</b> The rule as written is a
codepoint range (U+2580&ndash;259F) and unscii's fully-dotted braille walked
straight through it. The ceiling here is {maxink} for every font; the
<b>Ink ceiling</b> column shows each font's native maximum and, where it was
higher, what it was cut to. Only unscii is cut — every other face in this table
is already below the line, which is itself a useful thing to know.</li>
<li><b>The separation rule costs almost nothing.</b> Reparametrising a cell as
background plus ink&times;contrast makes the reduced objective isotropic in the
contrast vector, so "nearest solution with |fg&nbsp;&minus;&nbsp;bg| &ge; s" has
a closed form rather than needing a search. Two things then fall out rather than
being imposed: glyphs with no contrast to give — space, and a completely filled
cell — are excluded by the algebra, and a flat cell prefers a <i>sparse</i>
glyph, so forcing a mark everywhere yields faint texture instead of static.</li>
<li>Changing font or cell shape means regenerating the REXPaint atlas
(<code>run.py --install-font</code>) and touching
<code>tools/build-fonts.mjs</code> — and cell shape is a
<code>content</code>-schema change, since every sprite declares its
<code>cell</code>.</li>
</ul>
</html>
"""

if __name__ == "__main__":
    raise SystemExit(main())
