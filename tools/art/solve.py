"""
Stage 2 — choose a glyph, a foreground and a background per cell.

Model: a cell's rendered pixels are  bg*(1-a) + fg*a  where `a` is the glyph's
coverage mask. Least squares in (fg, bg) per channel; the design matrix depends
only on the glyph, so the 2x2 normal equations are solved once per glyph and
reused across every cell. The residual picks the winner.

Two corrections against the reference spec, both load-bearing at 5x8:

  * Degenerate masks are solved, not discarded. A glyph with no ink (space, and
    U+2800) has a singular normal matrix, but its correct answer is obvious:
    bg = mean of the cell, residual = the cell's variance. Dropping it forces
    every flat region to carry ink, which is exactly the "ground is mostly
    empty" rule in ASSETS.md §5 inverted.
  * The target is box-filtered when downsampling. NEAREST is right only when the
    source is already grid-aligned at the output resolution.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from PIL import Image

from glyphs import GlyphSet

TRANSPARENT = (255, 0, 255)          # REXPaint reserves this as "empty cell"


@dataclass
class Solved:
    grid: np.ndarray                 # (rows, cols) runtime glyph indices
    fg: np.ndarray                   # (rows, cols, 3) uint8
    bg: np.ndarray                   # (rows, cols, 3) uint8
    err: float                       # mean squared error per pixel per channel
    cols: int
    rows: int
    bg_palette: list | None = None   # background colours, when bg was constrained


def rows_for(src: Image.Image, gs: GlyphSet, cols: int) -> int:
    """Glyphs are taller than wide, so a square source needs rows = cols*cw/ch."""
    return max(1, round(cols * (gs.cw / gs.ch) * (src.height / src.width)))


def target(src: Image.Image, gs: GlyphSet, cols: int, rows: int) -> np.ndarray:
    w, h = cols * gs.cw, rows * gs.ch
    resample = Image.BOX if (w < src.width or h < src.height) else Image.NEAREST
    return np.asarray(src.convert("RGB").resize((w, h), resample), dtype=np.float64)


def bg_palette(free: Solved, k: int) -> np.ndarray:
    """
    The K background colours a constrained solve is allowed to use.

    Derived from the free solution's own backgrounds by median cut, so the
    palette is whatever that picture actually needed rather than a guess. k=1
    collapses to a single flat background, which is the strongest form of
    "let the glyphs carry it".
    """
    flat = free.bg.reshape(-1, 3)
    if k <= 1:
        return np.median(flat, axis=0).round().astype(np.uint8)[None, :]
    # Median cut on the DISTINCT colours, not on every cell. Run over the raw
    # cells it splits by population, and a board whose background is 80% ground
    # spends all K entries on near-identical browns while the water and the
    # road — the colours a player actually reads — collapse into one of them.
    uniq = np.unique(flat, axis=0)
    if len(uniq) <= k:
        return uniq
    im = Image.fromarray(uniq[:, None, :], "RGB").quantize(
        colors=k, method=Image.MEDIANCUT)
    pal = np.asarray(im.getpalette()[:k * 3], dtype=np.uint8).reshape(-1, 3)
    return np.unique(pal, axis=0)


def solve(src: Image.Image, gs: GlyphSet, cols: int, rows: int | None = None,
          tie: float = 0.02, slack: float = 3.0, chunk: int = 4096,
          bg: str = "free", bg_k: int = 4, min_sep: float = 0.0,
          class_cost: tuple[float, ...] = (0.0, 6.0, 10.0)) -> Solved:
    """
    `bg` chooses what the background is allowed to do.

      "free"  — a background colour per cell, solved jointly with the foreground
      "quant" — backgrounds restricted to `bg_k` colours taken from the free
                solution; the picture is carried by glyph shape and foreground
      "flat"  — one background colour for the whole image

    Constraining the background is not free: it costs error. It is a look, not
    an optimisation, and the report prints both numbers so the trade is visible.
    """
    if bg == "free":
        return _solve_sep(src, gs, cols, rows, tie, slack, chunk, min_sep,
                          class_cost)
    free = _solve_sep(src, gs, cols, rows, tie, slack, chunk, 0.0, class_cost)
    if bg not in ("quant", "flat"):
        raise SystemExit(f"unknown bg mode '{bg}'")
    pal = bg_palette(free, 1 if bg == "flat" else bg_k)
    return _solve_fixed_bg(src, gs, free.cols, free.rows, tie, slack, chunk, pal)


def _solve_free(src: Image.Image, gs: GlyphSet, cols: int, rows: int | None = None,
                tie: float = 0.02, slack: float = 3.0, chunk: int = 4096) -> Solved:
    rows = rows if rows is not None else rows_for(src, gs, cols)
    px = target(src, gs, cols, rows)
    n = rows * cols
    P = gs.ch * gs.cw
    T_all = (px.reshape(rows, gs.ch, cols, gs.cw, 3)
               .transpose(0, 2, 1, 3, 4)
               .reshape(n, P, 3))

    M = gs.masks[gs.solve_idx]                       # (G, P)
    ink = M.mean(1)
    A, B = M, 1.0 - M
    aa, bb, ab = (A * A).sum(1), (B * B).sum(1), (A * B).sum(1)
    det = bb * aa - ab * ab
    ok = det > 1e-9
    safe = np.where(ok, det, 1.0)
    degenerate = np.nonzero(~ok)[0]

    resid = 0.0
    best = np.empty(n, dtype=np.int64)
    out_fg = np.empty((n, 3))
    out_bg = np.empty((n, 3))

    # Chunked over cells. The unchunked form allocates (G, n, 3) float64 arrays
    # — 485 MB for a 1920x1200 board at 5x8 — and spends its life in the
    # allocator. Chunking changes no arithmetic and makes the sweep tractable.
    for lo in range(0, n, chunk):
        T = T_all[lo:lo + chunk]
        m = T.shape[0]
        # A real BLAS gemm rather than einsum: contract over P by folding the
        # colour axis into the column dimension. Same numbers, several times
        # faster, and the sweep runs enough solves for that to matter.
        T2 = np.ascontiguousarray(T.transpose(1, 0, 2).reshape(P, m * 3))
        At = (A @ T2).reshape(-1, m, 3)
        Bt = (B @ T2).reshape(-1, m, 3)
        fg = np.clip((-ab[:, None, None] * Bt + bb[:, None, None] * At)
                     / safe[:, None, None], 0, 255)
        bg = np.clip((aa[:, None, None] * Bt - ab[:, None, None] * At)
                     / safe[:, None, None], 0, 255)

        tt = (T * T).sum((1, 2))
        err = tt[None, :] - (bg * Bt + fg * At).sum(2)

        # --- degenerate glyphs: no ink, or full ink. Solve them directly.
        if degenerate.size:
            mean = T.mean(1)                          # (m, 3)
            flat = tt - P * (mean * mean).sum(1)
            for g in degenerate:
                fg[g] = mean
                bg[g] = mean
                err[g] = flat
        np.maximum(err, 0.0, out=err)

        # --- tie-break. Among glyphs that score near the best, take the
        # lightest. A purely RELATIVE tolerance is not enough and this is not a
        # subtlety: in a near-flat cell the best error is close to zero, so 2%
        # of it is close to nothing, and the winner is whichever dense letter
        # happens to correlate with a three-level gradient. Measured on the test
        # card, that filled the entire grey ramp with `b$kkkk`. `slack` adds an
        # ABSOLUTE tolerance in colour levels of RMS error, which is the knob
        # that actually decides how empty the output is — ASSETS.md's "ground is
        # mostly empty" rule made operational. Ties resolve to the lowest index,
        # so the choice is deterministic.
        emin = err.min(0)
        near = err <= emin + tie * np.abs(emin) + (slack ** 2) * P * 3 + 1e-6
        pick = np.where(near, ink[:, None], np.inf).argmin(0)

        idx = np.arange(m)
        best[lo:lo + m] = pick
        out_fg[lo:lo + m] = fg[pick, idx]
        out_bg[lo:lo + m] = bg[pick, idx]
        resid += float(err[pick, idx].sum())

    chosen = gs.solve_idx[best]
    resid /= n * P * 3

    fg8 = np.rint(out_fg).astype(np.uint8).reshape(rows, cols, 3)
    bg8 = np.rint(out_bg).astype(np.uint8).reshape(rows, cols, 3)
    # 255,0,255 is REXPaint's transparency key; a background must never be it.
    hit = np.all(bg8 == np.array(TRANSPARENT, dtype=np.uint8), axis=-1)
    bg8[hit] = (254, 0, 255)

    return Solved(grid=chosen.reshape(rows, cols), fg=fg8, bg=bg8,
                  err=resid, cols=cols, rows=rows)


def _cells(src: Image.Image, gs: GlyphSet, cols: int, rows: int) -> np.ndarray:
    px = target(src, gs, cols, rows)
    P = gs.ch * gs.cw
    return (px.reshape(rows, gs.ch, cols, gs.cw, 3)
              .transpose(0, 2, 1, 3, 4)
              .reshape(rows * cols, P, 3))


def _solve_fixed_bg(src: Image.Image, gs: GlyphSet, cols: int, rows: int,
                    tie: float, slack: float, chunk: int,
                    pal: np.ndarray) -> Solved:
    """
    Least squares with the background restricted to `pal`.

    With bg known and the coverage mask binary, the two halves of a cell stop
    interacting: the ink pixels are matched by the mean of the target over
    exactly those pixels, and the rest are matched by the fixed background. So

        err = SUM|t|^2  -  |A.t|^2 / ink   -  2 (B.t . bg)  +  (P - ink) |bg|^2

    which needs the same two matrix products as the free solve and one extra
    term per palette entry.
    """
    n = rows * cols
    P = gs.ch * gs.cw
    T_all = _cells(src, gs, cols, rows)

    M = gs.masks[gs.solve_idx]
    ink = M.mean(1)
    A, B = M, 1.0 - M
    aa = A.sum(1)
    nb = P - aa
    live = aa > 0
    inv_aa = np.where(live, 1.0 / np.where(live, aa, 1.0), 0.0)

    pal_f = pal.astype(float)
    pal_sq = (pal_f * pal_f).sum(1)

    best = np.empty(n, dtype=np.int64)
    best_k = np.empty(n, dtype=np.int64)
    out_fg = np.empty((n, 3))
    resid = 0.0

    for lo in range(0, n, chunk):
        T = T_all[lo:lo + chunk]
        m = T.shape[0]
        T2 = np.ascontiguousarray(T.transpose(1, 0, 2).reshape(P, m * 3))
        At = (A @ T2).reshape(-1, m, 3)
        Bt = (B @ T2).reshape(-1, m, 3)
        tt = (T * T).sum((1, 2))

        ink_term = (At * At).sum(2) * inv_aa[:, None]
        base = tt[None, :] - ink_term

        errs = np.stack([base - 2.0 * (Bt @ c) + nb[:, None] * cs
                         for c, cs in zip(pal_f, pal_sq)])       # (K, G, m)
        kpick = errs.argmin(0)
        err = np.take_along_axis(errs, kpick[None], 0)[0]
        np.maximum(err, 0.0, out=err)

        emin = err.min(0)
        near = err <= emin + tie * np.abs(emin) + (slack ** 2) * P * 3 + 1e-6
        pick = np.where(near, ink[:, None], np.inf).argmin(0)

        idx = np.arange(m)
        best[lo:lo + m] = pick
        best_k[lo:lo + m] = kpick[pick, idx]
        fg = At[pick, idx] * inv_aa[pick][:, None]
        # a glyph with no ink has no foreground to solve for; give it the
        # background so the cell reads as flat rather than as a stray colour.
        fg[~live[pick]] = pal_f[kpick[pick, idx]][~live[pick]]
        out_fg[lo:lo + m] = np.clip(fg, 0, 255)
        resid += float(err[pick, idx].sum())

    chosen = gs.solve_idx[best]
    resid /= n * P * 3

    fg8 = np.rint(out_fg).astype(np.uint8).reshape(rows, cols, 3)
    bg8 = pal[best_k].reshape(rows, cols, 3).astype(np.uint8)
    hit = np.all(bg8 == np.array(TRANSPARENT, dtype=np.uint8), axis=-1)
    bg8[hit] = (254, 0, 255)

    return Solved(grid=chosen.reshape(rows, cols), fg=fg8, bg=bg8,
                  err=resid, cols=cols, rows=rows,
                  bg_palette=[list(map(int, c)) for c in pal])


def _solve_sep(src: Image.Image, gs: GlyphSet, cols: int, rows: int | None,
               tie: float, slack: float, chunk: int, min_sep: float,
               class_cost: tuple[float, ...] = (0.0, 6.0, 10.0)) -> Solved:
    """
    Free background, with a floor on how close the foreground may come to it.

    Reparametrise a cell as  pred = c + a*u  with c the background and
    u = fg - bg the contrast vector. Eliminating c gives, per glyph,

        u* = (e.d) / alpha        e = a - mean(a),  d = t - mean(t)
        alpha = SUM e^2 = ink * (P - ink) / P
        E    = SUM|d|^2 - alpha |u*|^2

    and because alpha is a scalar that does not depend on colour channel, the
    reduced objective in u is isotropic: E(u) = E* + alpha |u - u*|^2. So the
    constrained optimum under |u| >= s is exactly u = s * u*/|u*|, costing
    alpha (s - |u*|)^2. No search, no approximation.

    Two consequences fall out of the algebra rather than being imposed:

      * alpha = 0 exactly when a glyph is all ink or no ink. Those are the
        glyphs with no contrast to give — space among them — and the
        constraint excludes them by construction rather than by a rule.
      * a flat cell pays alpha*s^2, so the solver prefers SMALL alpha there,
        which means a sparse glyph. Forcing every cell to show a mark does not
        fill the board with dense letters; it fills it with faint ones.
    """
    rows = rows if rows is not None else rows_for(src, gs, cols)
    n = rows * cols
    P = gs.ch * gs.cw
    T_all = _cells(src, gs, cols, rows)

    idx = gs.solve_idx
    M = gs.masks[idx]
    ink_count = M.sum(1)
    alpha = ink_count * (P - ink_count) / P
    keep = alpha > 1e-9 if min_sep > 0 else np.ones(len(idx), bool)
    if min_sep > 0:
        idx, M, ink_count, alpha = idx[keep], M[keep], ink_count[keep], alpha[keep]
    inv_alpha = np.where(alpha > 1e-9, 1.0 / np.where(alpha > 1e-9, alpha, 1.0), 0.0)
    abar = ink_count / P
    ink = M.mean(1)

    # Class prior. A glyph outside the preferred class must beat the best
    # in-class candidate by `class_cost[rank]` levels of RMS error before it is
    # taken, and loses every tie regardless. How much this matters depends
    # entirely on the font: spleen barely notices it, because its ASCII already
    # wins on merit. Cozette does — with 255 braille glyphs, 255 Cyrillic and a
    # light ASCII set (ink ceiling 0.41), an unweighted solve spends 18.7% of
    # cells on braille and puts Й and Ж on the board. At (0, 6, 10) that becomes
    # 91.5% ASCII and 7.3% braille for 0.25 RMSE. Braille as the last resort it
    # was meant to be, rather than as the alphabet.
    rank = (gs.rank[keep] if gs.rank is not None
            else np.zeros(len(idx), dtype=int))
    rank = np.asarray(rank, dtype=int)
    penalty = np.array([class_cost[min(r, len(class_cost) - 1)] for r in rank])
    penalty = (penalty ** 2) * P * 3
    # tie-break key: class first, then the lightest mark within that class
    tb_key = rank * 2.0 + ink

    best = np.empty(n, dtype=np.int64)
    out_fg = np.empty((n, 3))
    out_bg = np.empty((n, 3))
    resid = 0.0
    grey = np.array([1.0, 1.0, 1.0]) / np.sqrt(3.0)

    for lo in range(0, n, chunk):
        T = T_all[lo:lo + chunk]
        m = T.shape[0]
        tbar = T.mean(1)                                       # (m,3)
        T2 = np.ascontiguousarray(T.transpose(1, 0, 2).reshape(P, m * 3))
        At = (M @ T2).reshape(-1, m, 3)
        ed = At - ink_count[:, None, None] * tbar[None]
        u = ed * inv_alpha[:, None, None]                      # (G,m,3)
        norm = np.sqrt((u * u).sum(2))

        dcent = (T * T).sum((1, 2)) - P * (tbar * tbar).sum(1)
        err = dcent[None, :] - alpha[:, None] * norm * norm + penalty[:, None]
        if min_sep > 0:
            short = norm < min_sep
            err = err + np.where(short, alpha[:, None] * (min_sep - norm) ** 2, 0.0)
        np.maximum(err, 0.0, out=err)

        emin = err.min(0)
        near = err <= emin + tie * np.abs(emin) + (slack ** 2) * P * 3 + 1e-6
        pick = np.where(near, tb_key[:, None], np.inf).argmin(0)

        cols_i = np.arange(m)
        up = u[pick, cols_i]
        np_ = norm[pick, cols_i]
        if min_sep > 0:
            # scale up to the floor; a cell with no contrast at all gets its
            # mark on the luminance axis, brightening dark ground and darkening
            # bright ground so the mark is visible either way.
            scale = np.where(np_ > 1e-6, min_sep / np.maximum(np_, 1e-6), 0.0)
            up = np.where((np_ < min_sep)[:, None], up * scale[:, None], up)
            dead = np_ <= 1e-6
            if dead.any():
                lum = tbar[dead] @ np.array([0.299, 0.587, 0.114])
                up[dead] = grey * min_sep * np.where(lum < 128, 1.0, -1.0)[:, None]

        bgv = tbar - abar[pick][:, None] * up
        fgv = bgv + up
        # Shift the pair into gamut instead of clipping it: a common offset
        # preserves fg - bg exactly, so the separation survives.
        low = np.minimum(bgv, fgv)
        high = np.maximum(bgv, fgv)
        delta = np.where(low < 0, -low, 0.0)
        delta = delta - np.maximum(0.0, high + delta - 255.0)
        bgv = np.clip(bgv + delta, 0, 255)
        fgv = np.clip(fgv + delta, 0, 255)

        best[lo:lo + m] = pick
        out_bg[lo:lo + m] = bgv
        out_fg[lo:lo + m] = fgv
        resid += float(err[pick, cols_i].sum() - penalty[pick].sum())

    chosen = idx[best]
    resid /= n * P * 3
    fg8 = np.rint(out_fg).astype(np.uint8).reshape(rows, cols, 3)
    bg8 = np.rint(out_bg).astype(np.uint8).reshape(rows, cols, 3)
    hit = np.all(bg8 == np.array(TRANSPARENT, dtype=np.uint8), axis=-1)
    bg8[hit] = (254, 0, 255)
    return Solved(grid=chosen.reshape(rows, cols), fg=fg8, bg=bg8,
                  err=resid, cols=cols, rows=rows)
