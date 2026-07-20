---
name: doc-screenshots
description: Annotate UI screenshots with documentation callouts in Fellyph's established visual style — tapered blue ribbon arrows with white halos, double-stroke target outlines, numbered callout cards, dim overlays and a framed canvas. Use this whenever the user asks to annotate a screenshot, add arrows or callouts to a screenshot, create documentation images, highlight UI controls in a capture, or produce docs/tutorial visuals for Playground, Studio or any web UI — even if they just say "add arrows to this" or "make a docs screenshot".
---

# Documentation Screenshot Annotations

Produce annotated UI screenshots in one specific house style: tapered blue
(#3858e9) ribbon arrows with white halos, double-stroke outlines around
targets, and (for overviews) a row of numbered callout cards over a dimmed
screenshot. Never use stock arrow shapes, stroked polylines, or ad-hoc styles.

The geometry engine lives in `scripts/annotate.py`. Your job is to produce
accurate coordinates and a config JSON; the script renders everything
(supersampling, Bézier ribbons, halos, cards, shadows, WEBP export) exactly
to spec. Do not reimplement the drawing by hand.

## Workflow

1. **Capture.** Take screenshots at `deviceScaleFactor: 2`. Never eyeball
   coordinates: record each target's bounding box programmatically and save
   the boxes to JSON. Element coordinates are viewport-relative even inside
   nested iframes — when a target lives in an iframe, add the iframe's own
   box offset. With Playwright:

    ```js
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
    // ... navigate, prepare UI state ...
    const box = await page.locator('button:has-text("Export")').boundingBox();
    await page.screenshot({ path: 'shot.png' });
    ```

    Playwright is not in the repo venv — `pip install playwright && playwright
install chromium` if needed, or capture via the Chrome DevTools MCP tools
    (`take_screenshot` + `evaluate_script` with `getBoundingClientRect()`),
    which gives the same viewport-relative CSS-px boxes.

    Before capturing, clean up dev-environment artifacts: update nags, debug
    badges, plugin notices. They must not appear in docs imagery.

2. **Author the config.** All geometry is in CSS px relative to the
   screenshot's top-left. Write a config JSON (schema in the script's
   docstring — read it; working examples of both modes are in `examples/`)
   and run:

    ```bash
    source venv/bin/activate
    python .claude/skills/doc-screenshots/scripts/annotate.py config.json --crops crops/
    ```

3. **Quality gate — actually look.** Read the rendered WEBP at full size,
   plus the zoomed crops the script saves of every arrowhead and outline.
   Check: tip gaps even (5–7px short of each outline), halos unbroken,
   no arrow crosses another arrow or a sibling annotation, no card text
   overflow warnings on stderr, artifacts removed. Also sanity-check
   legibility at docs width (~860px) and mobile (~343px) — if labels become
   unreadable, simplify rather than shrink. Fix and re-render until clean.

## Choosing the annotation mode

- **Pointing at specific controls** (a dialog walkthrough, "click here"):
  use `outlines` + free `arrows`. No dim, no cards. One arrow per target,
  tail starting from empty space, arriving straight onto the outline.
- **Overview with a legend** ("these are the three persistence controls"):
  use `cards` + `outlines` + `dim`. Cards get `target` indexes and the
  script auto-draws vertical arrows from each card's bottom edge onto its
  outline. Set `dim.region` to the area holding the documented controls so
  they stay at full brightness while the rest dims 24% toward #28313b.
- Add `chrome_bar` (44px bar, traffic lights, URL pill) only when browser
  context matters to the reader.

## Placement rules the script cannot decide for you

- Arrow endpoints: the tip must stop 5–7px short of the target's outline
  (for card arrows the script handles the 6px gap; for free arrows, place
  `to` accordingly). Both tangents are axis-parallel — pick `axis` so the
  arrow leaves and arrives straight, giving the calm S-curve.
- Arrows must never cross each other or overlap another annotation. If a
  layout forces a crossing, move the tail, flip the axis, or reorder cards
  so each card sits roughly above its target.
- Outlines must enclose the whole control including secondary lines (a
  row's timestamp, a button's icon), not just the text node you queried
  for. Pad 6–10px, radius 10–14 for rounded rects; plain circles r≈25 for
  icon-only buttons.
- Card copy: title 2–3 words, subtitle one short clause. The script warns
  on stderr if text overflows its card — treat that as a hard failure.

## Style constants (already baked into the script — do not override)

Blue #3858e9 on pure white halos; ribbon tapers 7.5px → 3.5px with a 16×8
triangular head; halo expanded 3.2px per side. Outline = white width 9 on
the bbox expanded 2.5px, blue width 4 on the exact bbox. Canvas #f6f7f7,
36px margins, rounded frame with 1px #dcdcde border and soft shadow. Cards:
white, radius 16, 1px #ccced0 border, double shadow, blue badge r22,
Helvetica Neue (27px bold title #101517 / 19px subtitle #2c3338). Export is
WEBP quality ~89 after a single LANCZOS downsample from the supersampled
canvas.

Reference outputs in this style: an action walkthrough
(free arrows onto dialog controls) and an overview legend (three cards over
a dimmed page) — match their look, spacing and restraint.
