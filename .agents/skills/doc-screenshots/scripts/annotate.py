#!/usr/bin/env python3
"""Annotate UI screenshots with documentation callouts.

Renders uniform-width blue arrows with white halos, double-stroke target
outlines, numbered callout cards, dim overlays and a framed canvas, from a
JSON config. All geometry is authored in CSS px relative to the screenshot's
top-left corner; the script supersamples, draws, downsamples once with
LANCZOS and exports WEBP.

Usage:
    python annotate.py config.json
    python annotate.py config.json --crops <dir>   # also save zoomed QA crops

The config is validated before rendering; problems exit with a readable
"config error:" message. `output` must end in .webp. QA crops are named
<output-stem>-NN-<spot>.png, so multiple configs can share one crops dir.

Config schema (all coordinates in CSS px of the screenshot):
{
  "screenshot": "shot.png",          // captured at deviceScaleFactor 2
  "output": "annotated.webp",
  "css_width": 1440,                 // CSS px width of the captured viewport
  "supersample": 2,                  // 2 avoids resampling a dsf-2 capture
  "webp_quality": 89,
  "chrome_bar": {"url": "playground.wordpress.net"},   // optional
  "dim": {"region": [x, y, w, h], "radius": 16},       // optional un-dim window
  "outlines": [
    {"type": "rect", "box": [x, y, w, h], "padding": 8, "radius": 12},
    {"type": "circle", "center": [x, y], "r": 25}
  ],
  "arrows": [                         // free arrows, endpoints in shot coords
    {"from": [x, y], "to": [x, y], "axis": "h"}   // axis: tangent at both ends
  ],
  "cards": [                          // one aligned row of numbered callouts
    {"number": 1, "title": "Refresh page", "subtitle": "Reloads WordPress only",
     "target": 0}                     // index into outlines; auto-draws arrow
  ],
  "cards_top": 340,                   // top edge of the card row, shot coords
  "cards_inset": 48,                  // equal inset from both frame edges
  "cards_gap": 40
}
"""

import json
import math
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

BLUE = (56, 88, 233, 255)          # #3858e9
ARROW_COLOR = (232, 89, 12, 255)   # #e8590c — orange, contrasts with the blue UI
WHITE = (255, 255, 255, 255)
CANVAS_BG = (246, 247, 247, 255)   # #f6f7f7
FRAME_BORDER = (220, 220, 222, 255)  # #dcdcde
CARD_BORDER = (204, 206, 208, 255)   # #ccced0
TITLE_COLOR = (16, 21, 23, 255)      # #101517
SUBTITLE_COLOR = (44, 51, 56, 255)   # #2c3338
DIM_COLOR = (40, 49, 59)             # #28313b
CHROME_BG = (236, 238, 240, 255)     # #eceef0
CHROME_BORDER = (213, 215, 218, 255) # #d5d7da
URL_COLOR = (80, 87, 94, 255)        # #50575e
TRAFFIC = [(255, 95, 87), (254, 188, 46), (40, 200, 64)]

MARGIN = 36
CHROME_H = 44


# ---------------------------------------------------------------- fonts

def _load_font(size, bold=False):
    candidates = [
        "/System/Library/Fonts/HelveticaNeue.ttc",
        "/System/Library/Fonts/Helvetica.ttc",
        "/Library/Fonts/Arial.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]
    want = "Bold" if bold else "Regular"
    for path in candidates:
        for index in range(18):
            try:
                font = ImageFont.truetype(path, int(size), index=index)
            except (OSError, ValueError):
                break
            family, style = font.getname()
            if style == want:
                return font
        try:
            return ImageFont.truetype(path, int(size))
        except OSError:
            continue
    return ImageFont.load_default()


# ---------------------------------------------------------------- geometry

def _cubic(p0, c1, c2, p1, t):
    mt = 1.0 - t
    return (
        mt**3 * p0[0] + 3 * mt * mt * t * c1[0] + 3 * mt * t * t * c2[0] + t**3 * p1[0],
        mt**3 * p0[1] + 3 * mt * mt * t * c1[1] + 3 * mt * t * t * c2[1] + t**3 * p1[1],
    )


def _controls(p0, p1, axis):
    dx, dy = p1[0] - p0[0], p1[1] - p0[1]
    if axis == "v":
        return (p0[0], p0[1] + 0.42 * dy), (p1[0], p1[1] - 0.42 * dy)
    return (p0[0] + 0.42 * dx, p0[1]), (p1[0] - 0.42 * dx, p1[1])


def _norm(vx, vy):
    d = math.hypot(vx, vy)
    if d < 1e-9:
        return 0.0, 0.0
    return vx / d, vy / d


WING_ANGLE = math.radians(35)


def _arrow_shapes(p0, p1, axis, half_w, wing_len, tip_ext):
    """Return the stamp centers (shaft + chevron wings) for one arrow.

    The shaft is a uniform-width stroke rendered by stamping filled circles
    at dense, even arc-length steps — this keeps the line width identical
    from tail to tip and leaves round caps with no polygon-edge artifacts.

    The path is a cubic Bézier that hands over to a straight, axis-aligned
    run into the endpoint, always longer than the head, so the arrow
    arrives straight and points exactly at the target — even on short,
    tightly bent arrows, where a plain end-to-end Bézier is still turning
    at the tip.

    The head is an open chevron: two diagonal strokes of the same width as
    the shaft, sweeping back from the tip at ±WING_ANGLE.
    """
    dx_axis, dy_axis = p1[0] - p0[0], p1[1] - p0[1]
    if axis == "v":
        dvec = (0.0, 1.0 if dy_axis >= 0 else -1.0)
        axis_span = abs(dy_axis)
    else:
        dvec = (1.0 if dx_axis >= 0 else -1.0, 0.0)
        axis_span = abs(dx_axis)
    straight = min(wing_len * 2.0, 0.55 * axis_span)
    pm = (p1[0] - dvec[0] * straight, p1[1] - dvec[1] * straight)

    c1, c2 = _controls(p0, pm, axis)
    n_curve, n_straight = 560, 40
    pts = [_cubic(p0, c1, c2, pm, i / n_curve) for i in range(n_curve + 1)]
    pts += [(pm[0] + (p1[0] - pm[0]) * i / n_straight,
             pm[1] + (p1[1] - pm[1]) * i / n_straight)
            for i in range(1, n_straight + 1)]

    dx, dy = dvec
    tip = (p1[0] + dx * tip_ext, p1[1] + dy * tip_ext)
    centers = pts + [tip]

    bx, by = -dx, -dy  # from the tip back along the arrival direction
    cos_a, sin_a = math.cos(WING_ANGLE), math.sin(WING_ANGLE)
    for side in (1.0, -1.0):
        wx = bx * cos_a - side * by * sin_a
        wy = side * bx * sin_a + by * cos_a
        n_wing = 30
        centers += [(tip[0] + wx * wing_len * i / n_wing,
                     tip[1] + wy * wing_len * i / n_wing)
                    for i in range(1, n_wing + 1)]
    return centers


def draw_arrow(draw, p0, p1, axis, scale):
    """Halo pass (white, expanded 3.2px/side, tip extended 3.2px) then orange."""
    passes = [
        (WHITE, (4.5 + 3.2) * scale, (16 + 3.2) * scale, 3.2 * scale),
        (ARROW_COLOR, 4.5 * scale, 16 * scale, 0.0),
    ]
    for color, half_w, wing_len, tip_ext in passes:
        for cx, cy in _arrow_shapes(p0, p1, axis, half_w, wing_len, tip_ext):
            draw.ellipse([cx - half_w, cy - half_w, cx + half_w, cy + half_w],
                         fill=color)


# ---------------------------------------------------------------- outlines

def draw_outline(draw, spec, offset, scale):
    ox, oy = offset
    if spec.get("type", "rect") == "circle":
        cx = spec["center"][0] * scale + ox
        cy = spec["center"][1] * scale + oy
        r = spec.get("r", 25) * scale
        # white halo stroke on both sides, then blue on the exact circle
        halo = 2.5 * scale
        draw.ellipse([cx - r - halo, cy - r - halo, cx + r + halo, cy + r + halo],
                     outline=WHITE, width=int(9 * scale))
        draw.ellipse([cx - r, cy - r, cx + r, cy + r],
                     outline=BLUE, width=int(4 * scale))
        return

    pad = spec.get("padding", 8) * scale
    radius = spec.get("radius", 12) * scale
    x, y, w, h = [v * scale for v in spec["box"]]
    x0, y0 = x + ox - pad, y + oy - pad
    x1, y1 = x + ox + w + pad, y + oy + h + pad
    halo = 2.5 * scale
    draw.rounded_rectangle([x0 - halo, y0 - halo, x1 + halo, y1 + halo],
                           radius=int(round(radius + halo)), outline=WHITE,
                           width=int(9 * scale))
    draw.rounded_rectangle([x0, y0, x1, y1], radius=int(round(radius)),
                           outline=BLUE, width=int(4 * scale))


def outline_extents(spec, offset, scale):
    """Canvas-space (cx, top, bottom) of an outline, for card arrows."""
    ox, oy = offset
    if spec.get("type", "rect") == "circle":
        cx = spec["center"][0] * scale + ox
        cy = spec["center"][1] * scale + oy
        r = spec.get("r", 25) * scale
        return cx, cy - r, cy + r
    pad = spec.get("padding", 8) * scale
    x, y, w, h = [v * scale for v in spec["box"]]
    return x + ox + w / 2, y + oy - pad, y + oy + h + pad


# ---------------------------------------------------------------- helpers

def _shadow(canvas, box, radius, blur, alpha, dy, scale):
    layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    d.rounded_rectangle(
        [box[0], box[1] + dy * scale, box[2], box[3] + dy * scale],
        radius=int(round(radius)), fill=(15, 20, 30, alpha))
    canvas.alpha_composite(layer.filter(ImageFilter.GaussianBlur(blur * scale)))


def _rounded_mask(size, radius):
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, size[0] - 1, size[1] - 1],
                                           radius=int(round(radius)), fill=255)
    return mask


def _chrome_bar(width, url, scale):
    bar = Image.new("RGBA", (width, int(CHROME_H * scale)), CHROME_BG)
    d = ImageDraw.Draw(bar)
    h = bar.size[1]
    d.rectangle([0, h - int(1 * scale), width, h], fill=CHROME_BORDER)
    r = 6.5 * scale
    cy = h / 2 - 0.5 * scale
    for i, color in enumerate(TRAFFIC):
        cx = (22 + i * 20) * scale
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=color + (255,))
    font = _load_font(15 * scale)
    tw = d.textlength(url, font=font)
    pill_w = tw + 48 * scale
    pill_h = 28 * scale
    px0 = (width - pill_w) / 2
    py0 = (h - pill_h) / 2 - 0.5 * scale
    d.rounded_rectangle([px0, py0, px0 + pill_w, py0 + pill_h],
                        radius=int(round(pill_h / 2)), fill=WHITE)
    d.text((width / 2, py0 + pill_h / 2), url, font=font, fill=URL_COLOR,
           anchor="mm")
    return bar


# ---------------------------------------------------------------- cards

def layout_cards(cards, frame_x, frame_w, top_y, inset, gap, scale):
    """One aligned row: equal widths, equal gaps, equal inset from frame edges."""
    n = len(cards)
    inset_px = inset * scale
    gap_px = gap * scale
    card_w = (frame_w - 2 * inset_px - (n - 1) * gap_px) / n
    title_f = _load_font(27 * scale, bold=True)
    sub_f = _load_font(19 * scale)
    pad = 26 * scale
    text_h = (27 + 9 + 19) * scale
    card_h = max(2 * 22 * scale, text_h) + 2 * pad
    placed = []
    for i, card in enumerate(cards):
        x0 = frame_x + inset_px + i * (card_w + gap_px)
        placed.append({
            "spec": card, "x0": x0, "y0": top_y, "w": card_w, "h": card_h,
            "title_f": title_f, "sub_f": sub_f, "pad": pad,
        })
    return placed


def draw_card(canvas, placed, scale):
    c = placed
    x0, y0, w, h = c["x0"], c["y0"], c["w"], c["h"]
    box = [x0, y0, x0 + w, y0 + h]
    radius = int(round(16 * scale))
    _shadow(canvas, box, radius, blur=22, alpha=26, dy=8, scale=scale)
    _shadow(canvas, box, radius, blur=8, alpha=32, dy=3, scale=scale)
    d = ImageDraw.Draw(canvas)
    d.rounded_rectangle(box, radius=radius, fill=WHITE, outline=CARD_BORDER,
                        width=max(1, int(1 * scale)))
    spec = c["spec"]
    badge_r = 22 * scale
    bx = x0 + c["pad"] + badge_r
    by = y0 + h / 2
    d.ellipse([bx - badge_r, by - badge_r, bx + badge_r, by + badge_r], fill=BLUE)
    num_f = _load_font(23 * scale, bold=True)
    d.text((bx, by - 1 * scale), str(spec["number"]), font=num_f, fill=WHITE,
           anchor="mm")
    tx = bx + badge_r + 18 * scale
    line_gap = 9 * scale
    title_h = 27 * scale
    sub_h = 19 * scale
    block_h = title_h + line_gap + sub_h
    ty = y0 + (h - block_h) / 2
    d.text((tx, ty), spec["title"], font=c["title_f"], fill=TITLE_COLOR)
    d.text((tx, ty + title_h + line_gap), spec.get("subtitle", ""),
           font=c["sub_f"], fill=SUBTITLE_COLOR)
    # programmatic overflow check — the quality gate depends on this
    inner_right = x0 + w - c["pad"]
    for text, font in ((spec["title"], c["title_f"]),
                       (spec.get("subtitle", ""), c["sub_f"])):
        if text and tx + d.textlength(text, font=font) > inner_right:
            print(f"WARNING: text overflows card {spec['number']}: {text!r}",
                  file=sys.stderr)


# ---------------------------------------------------------------- main

def render(cfg):
    scale = cfg.get("supersample", 2)
    shot = Image.open(cfg["screenshot"]).convert("RGB")
    css_w = cfg["css_width"]
    shot_w = int(css_w * scale)
    shot_h = int(round(shot.size[1] * shot_w / shot.size[0]))
    if shot.size != (shot_w, shot_h):
        shot = shot.resize((shot_w, shot_h), Image.LANCZOS)
    shot = shot.convert("RGBA")

    chrome = cfg.get("chrome_bar")
    chrome_h = int(CHROME_H * scale) if chrome else 0
    frame_w, frame_h = shot_w, shot_h + chrome_h
    margin = int(MARGIN * scale)
    canvas = Image.new("RGBA", (frame_w + 2 * margin, frame_h + 2 * margin),
                       CANVAS_BG)

    # frame with soft shadow, rounded corners, 1px border
    frame_r = int(round(cfg.get("frame_radius", 16) * scale))
    fbox = [margin, margin, margin + frame_w, margin + frame_h]
    _shadow(canvas, fbox, frame_r, blur=18, alpha=42, dy=7, scale=scale)

    frame = Image.new("RGBA", (frame_w, frame_h), WHITE)
    if chrome:
        frame.alpha_composite(_chrome_bar(frame_w, chrome["url"], scale))
    frame.alpha_composite(shot, (0, chrome_h))

    dim = cfg.get("dim")
    if dim:
        overlay = Image.new("RGBA", frame.size,
                            DIM_COLOR + (int(0.24 * 255),))
        if dim.get("region"):
            x, y, w, h = [v * scale for v in dim["region"]]
            hole = ImageDraw.Draw(overlay)
            hole.rounded_rectangle(
                [x, y + chrome_h, x + w, y + chrome_h + h],
                radius=int(round(dim.get("radius", 16) * scale)),
                fill=(0, 0, 0, 0))
        frame.alpha_composite(overlay)

    canvas.paste(frame, (margin, margin),
                 _rounded_mask(frame.size, frame_r))
    d = ImageDraw.Draw(canvas)
    d.rounded_rectangle(fbox, radius=frame_r, outline=FRAME_BORDER,
                        width=max(1, int(1 * scale)))

    offset = (margin, margin + chrome_h)  # screenshot origin on canvas
    outlines = cfg.get("outlines", [])
    for spec in outlines:
        draw_outline(d, spec, offset, scale)

    for arrow in cfg.get("arrows", []):
        p0 = (arrow["from"][0] * scale + offset[0],
              arrow["from"][1] * scale + offset[1])
        p1 = (arrow["to"][0] * scale + offset[0],
              arrow["to"][1] * scale + offset[1])
        draw_arrow(d, p0, p1, arrow.get("axis", "v"), scale)

    tips = [(a["to"][0] * scale + offset[0], a["to"][1] * scale + offset[1])
            for a in cfg.get("arrows", [])]

    cards = cfg.get("cards", [])
    if cards:
        top_y = cfg["cards_top"] * scale + offset[1]
        placed = layout_cards(cards, margin, frame_w, top_y,
                              cfg.get("cards_inset", 48),
                              cfg.get("cards_gap", 40), scale)
        # arrows first (tucked 4px under the card bottom edge), cards on top
        for p in placed:
            target = p["spec"].get("target")
            if target is None:
                continue
            cx_t, top_t, _ = outline_extents(outlines[target], offset, scale)
            start = (p["x0"] + p["w"] / 2, p["y0"] + p["h"] - 4 * scale)
            end = (cx_t, top_t - 6 * scale)  # tip stops 6px short of outline
            draw_arrow(d, start, end, "v", scale)
            tips.append(end)
        for p in placed:
            draw_card(canvas, p, scale)
            d = ImageDraw.Draw(canvas)

    final = canvas.resize(
        (canvas.size[0] // scale, canvas.size[1] // scale), Image.LANCZOS
    ).convert("RGB")
    final.save(cfg["output"], quality=cfg.get("webp_quality", 89))
    print(f"wrote {cfg['output']} ({final.size[0]}x{final.size[1]})")
    return final, [(t[0] / scale, t[1] / scale) for t in tips], scale


def save_crops(final, tips, cfg, out_dir, scale):
    """Zoomed crops of every arrowhead and outline for the quality gate.

    Crop names are prefixed with the output basename so several configs (or
    re-renders) can share one crops directory without overwriting each other.
    """
    import os
    os.makedirs(out_dir, exist_ok=True)
    stem = os.path.splitext(os.path.basename(cfg["output"]))[0]
    margin = MARGIN
    chrome_h = CHROME_H if cfg.get("chrome_bar") else 0
    spots = [("tip", x, y) for x, y in tips]
    for i, spec in enumerate(cfg.get("outlines", [])):
        if spec.get("type", "rect") == "circle":
            x, y = spec["center"]
        else:
            x, y = spec["box"][0] + spec["box"][2] / 2, spec["box"][1]
        spots.append((f"outline{i}", x + margin, y + margin + chrome_h))
    for idx, (name, x, y) in enumerate(spots):
        half = 90
        box = (max(0, int(x - half)), max(0, int(y - half)),
               min(final.size[0], int(x + half)), min(final.size[1], int(y + half)))
        crop = final.crop(box)
        crop = crop.resize((crop.size[0] * 3, crop.size[1] * 3), Image.NEAREST)
        path = f"{out_dir}/{stem}-{idx:02d}-{name}.png"
        crop.save(path)
        print(f"crop: {path}")


def validate(cfg):
    """Check the config before rendering; exit with readable errors."""
    errors = []
    for key in ("screenshot", "output", "css_width"):
        if key not in cfg:
            errors.append(f"missing required key {key!r}")
    if "output" in cfg and not str(cfg["output"]).lower().endswith(".webp"):
        errors.append("output must end in .webp (the exporter writes WEBP)")
    for i, spec in enumerate(cfg.get("outlines", [])):
        if spec.get("type", "rect") == "circle":
            if len(spec.get("center", [])) != 2:
                errors.append(f"outlines[{i}]: circle needs center [x, y]")
        elif len(spec.get("box", [])) != 4:
            errors.append(f"outlines[{i}]: rect needs box [x, y, w, h]")
    for i, arrow in enumerate(cfg.get("arrows", [])):
        for key in ("from", "to"):
            if len(arrow.get(key, [])) != 2:
                errors.append(f"arrows[{i}]: needs {key} [x, y]")
        if arrow.get("axis") not in (None, "h", "v"):
            errors.append(f'arrows[{i}]: axis must be "h" or "v"')
    n_outlines = len(cfg.get("outlines", []))
    for i, card in enumerate(cfg.get("cards", [])):
        if "number" not in card or "title" not in card:
            errors.append(f"cards[{i}]: needs number and title")
        target = card.get("target")
        if target is not None and not (
            isinstance(target, int) and 0 <= target < n_outlines
        ):
            errors.append(
                f"cards[{i}]: target {target!r} is not an index into outlines"
                f" (0..{n_outlines - 1})")
    if cfg.get("cards") and "cards_top" not in cfg:
        errors.append("cards need cards_top (top edge of the card row)")
    if errors:
        sys.exit("config error:\n  " + "\n  ".join(errors))


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    try:
        with open(sys.argv[1]) as fh:
            cfg = json.load(fh)
    except FileNotFoundError:
        sys.exit(f"config error: no such config file {sys.argv[1]!r}")
    except json.JSONDecodeError as exc:
        sys.exit(f"config error: {sys.argv[1]} is not valid JSON ({exc})")
    validate(cfg)
    try:
        final, tips, scale = render(cfg)
    except FileNotFoundError:
        sys.exit(
            f"config error: cannot open screenshot {cfg['screenshot']!r}")
    if "--crops" in sys.argv:
        crops_at = sys.argv.index("--crops")
        if crops_at + 1 >= len(sys.argv):
            sys.exit("config error: --crops needs a directory argument")
        save_crops(final, tips, cfg, sys.argv[crops_at + 1], scale)


if __name__ == "__main__":
    main()
