---
name: doc-screenshots
description: Annotate UI screenshots with documentation callouts in Fellyph's established visual style — uniform-width orange arrows with white halos, double-stroke target outlines, numbered callout cards, dim overlays and a framed canvas. Use this whenever the user asks to annotate a screenshot, add arrows or callouts to a screenshot, create documentation images, highlight UI controls in a capture, or produce docs/tutorial visuals for Playground, Studio or any web UI — even if they just say "add arrows to this" or "make a docs screenshot".
---

# Documentation Screenshot Annotations

Produce annotated UI screenshots in one specific house style: uniform-width orange (#e8590c) arrows with white halos, double-stroke blue outlines around targets, and (for overviews) a row of numbered callout cards over a dimmed screenshot. Never use stock arrow shapes, stroked polylines, or ad-hoc styles.

The geometry engine lives in `scripts/annotate.py`. Your job is to produce accurate coordinates and a config JSON; the script renders everything (supersampling, Bézier ribbons, halos, cards, shadows, WEBP export) exactly to spec. Do not reimplement the drawing by hand.

## Workflow

1. **Capture.** Take screenshots at `deviceScaleFactor: 2`. Never eyeball coordinates: record every target's bounding box programmatically and save the boxes to JSON — including _regions_ (panels, sidebars, block trees), not just buttons; eyeballed region outlines are the most common quality-gate failure. With Playwright:

    ```js
    const viewport = { width: 1440, height: 900 };
    const page = await browser.newPage({ viewport, deviceScaleFactor: 2 });
    // ... navigate, prepare UI state ...
    const box = await page.locator('button:has-text("Export")').boundingBox();
    await page.screenshot({ path: 'shot.png' });
    ```

    **Iframes:** Playwright's `locator(...).boundingBox()` already returns main-viewport coordinates, even inside nested iframes (Playground nests main page → `remote.html` wrapper → the WordPress scope frame) — use the boxes as-is, no offsets. Only raw `getBoundingClientRect()` inside a frame's own `evaluate()` (or the Chrome DevTools MCP tools) needs the enclosing iframe's box offset added.

    **WordPress modals:** Editor screens open welcome guides ("Edit your site" → Get started) whose overlay swallows clicks; some have no `aria-label="Close"` button. Dismiss with an Escape loop — while `.components-modal__screen-overlay` exists, press Escape on the frame's body, wait ~1s — and retry the blocked click between attempts. The modal can appear _after_ the page looks loaded, so dismiss lazily around the click, not once up front.

    Prefer driving the browser from Node with the repo's own `node_modules/playwright`; otherwise run `python3 -m pip install playwright && python3 -m playwright install chromium`, or use the Chrome DevTools MCP capture tools.

    Before capturing, clean up dev-environment artifacts such as update nags, debug badges, and plugin notices. They must not appear in docs imagery.

2. **Author the config.** All geometry is in CSS px relative to the screenshot's top-left. Write a config JSON using the schema in the script's docstring; read it first. Runnable examples of both modes are in `examples/` and share the bundled `sample-shot.webp`. Then run:

    ```bash
    python .agents/skills/doc-screenshots/scripts/annotate.py config.json --crops crops/
    ```

    The script needs Python with Pillow. If no suitable interpreter is active, create a virtual environment in the session scratchpad with `python3 -m venv <scratchpad>/venv && <scratchpad>/venv/bin/python -m pip install Pillow`, then call that interpreter directly. The script validates the config up front and exits with a readable `config error:` message on bad input; `output` must be a `.webp` path.

3. **Quality gate — actually look.** Read the rendered WEBP at full size, plus the zoomed crops the script saves of every arrowhead and outline (named `<output-stem>-NN-<spot>.png`, so one crops directory can serve every config in a batch). Check that tip gaps are even (5–7px short of each outline), halos are unbroken, no arrow crosses another arrow or a sibling annotation, stderr has no card-text overflow warnings, and artifacts are removed. Also sanity-check legibility at docs width (~860px) and mobile (~343px); if labels become unreadable, simplify rather than shrink. Fix and re-render until clean.

## Choosing the annotation mode

- **Pointing at specific controls** (a dialog walkthrough, "click here"): use `outlines` + free `arrows`. No dim, no cards. One arrow per target, tail starting from empty space, arriving straight onto the outline.
- **Overview with a legend** ("these are the three persistence controls"): use `cards` + `outlines` + `dim`. Cards get `target` indexes and the script auto-draws vertical arrows from each card's bottom edge onto its outline. Set `dim.region` to the area holding the documented controls so they stay at full brightness while the rest dims 24% toward #28313b.
- Add `chrome_bar` (44px bar, traffic lights, URL pill) only when browser context matters to the reader.

## Placement rules the script cannot decide for you

- Arrow endpoints: the tip must stop 5–7px short of the target's outline (for card arrows the script handles the 6px gap; for free arrows, place `to` accordingly). Both tangents are axis-parallel — pick `axis` so the arrow leaves and arrives straight, giving the calm S-curve.
- Arrows must never cross each other or overlap another annotation. If a layout forces a crossing, move the tail, flip the axis, or reorder cards so each card sits roughly above its target.
- Outlines must enclose the whole control including secondary lines (a row's timestamp, a button's icon), not just the text node you queried for. Pad 6–10px, radius 10–14 for rounded rects; plain circles r≈25 for icon-only buttons.
- Card copy: title 2–3 words, subtitle one short clause. The script warns on stderr if text overflows its card — treat that as a hard failure.

## Style constants (already baked into the script — do not override)

Arrows are orange #e8590c on pure white halos; outlines, badges and cards stay blue #3858e9. The shaft is a uniform 9px line (constant top to bottom, round caps) ending in an open chevron head — two 16px diagonal strokes of the same width sweeping back from the tip at ±35°; halo expanded 3.2px per side. Outline = white width 9 on the bbox expanded 2.5px, blue width 4 on the exact bbox. Canvas #f6f7f7, 36px margins, rounded frame with 1px #dcdcde border and soft shadow. Cards: white, radius 16, 1px #ccced0 border, double shadow, blue badge r22, Helvetica Neue (27px bold title #101517 / 19px subtitle #2c3338). Export is WEBP quality ~89 after a single LANCZOS downsample from the supersampled canvas.

Reference outputs in this style: an action walkthrough (free arrows onto dialog controls) and an overview legend (three cards over a dimmed page) — match their look, spacing and restraint.

## Repo layout

The source of truth is `.agents/skills/doc-screenshots/`. `.claude/skills` is a committed symlink to `../.agents/skills`, so Claude Code loads the same files — edit only under `.agents/skills/` and never create a separate copy.
