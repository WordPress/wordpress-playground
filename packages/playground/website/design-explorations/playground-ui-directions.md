# Playground Workbench HTML mockup

This PR is a **design exploration only**. It does not wire a new route into the
Playground app. Open the standalone clickable mockup directly:

```text
packages/playground/website/design-explorations/workbench-html-mockup.html
```

For example:

```text
file:///Users/cloudnik/conductor/workspaces/wordpress-playground/helsinki/packages/playground/website/design-explorations/workbench-html-mockup.html?panel=workbench&iteration=350
```

Useful panels:

- `?panel=workbench&iteration=350`
- `?panel=runtime&iteration=350`
- `?panel=files&iteration=350`
- `?panel=current&iteration=350`
- `?panel=share&iteration=350`
- `?panel=command&iteration=350`

## Current direction: precision instrument

The latest pass replaces the warmer atelier-browser direction with a sharper
**precision instrument**. Playground now reads like a focused browser/workbench
built for operating a live WordPress runtime: graphite shell, measured address
bar, status LEDs, compact segmented controls, dark editor-grade panels, and
one deliberate Workbench entry point.

The important product constraints stay intact:

- Playground remains full-page; there is no permanent sidebar competing with
  `wp-admin`.
- The address bar remains central and visible.
- Runtime settings are first-class via the blue chip inside the address bar.
- Workbench is the only broad tool trigger in chrome.
- Panels are transient, anchored, and visually separate from the WordPress site.
- Files open as a real editor/recovery workspace, not a cramped settings panel.

## What changed in this pass

The chrome now has three deliberate zones instead of many equal toolbar buttons:

1. **Identity and persistence** — current Playground name, unsaved state, and
   Save live together. This follows PR 3655's split between automatic recovery
   and intentional saving.
2. **Address and runtime** — the browser-like URL control stays dominant.
   Runtime is inside the same surface because WordPress/PHP/storage/network are
   often-needed environment choices.
3. **Workbench** — one high-confidence command surface for actions that affect
   the running site.

Workbench organizes the product surface by user job instead of implementation
bucket:

| User question                             | Surface                                  | Why                                                           |
| ----------------------------------------- | ---------------------------------------- | ------------------------------------------------------------- |
| What am I looking at, and will I lose it? | Current Playground                       | Identity and safety should be one click from the name.        |
| Where do I go in WordPress?               | Address bar                              | Users like the browser model; do not dilute it.               |
| How do I change WP/PHP/network/storage?   | Runtime chip + Workbench priority action | Runtime settings are important enough to stay visible.        |
| What can I do to this site?               | Workbench                                | One map avoids separate Create/Inspect/Settings vocabularies. |
| How do I recover or edit files?           | Files & recovery                         | File work needs a wide editor and recovery context.           |
| How do I keep or hand off this work?      | Save and Share                           | Preservation/export actions belong together.                  |

## Feature surface audit

Current Playground web exposes these product jobs:

- Navigate the running WordPress site.
- Save/persist a Playground and distinguish unsaved, autosaved, saved, and local
  filesystem sites.
- Resume, rename, delete, or create Playgrounds.
- Create/import from blank WordPress, WordPress PR, Gutenberg PR, GitHub, ZIP,
  Blueprint URL, and Blueprint gallery.
- Configure runtime: WordPress version, PHP version, language, networking,
  multisite, storage.
- Inspect/edit: files, Blueprint source, database tools, logs.
- Preserve/hand off: Save, copy/share URL, download ZIP, export to GitHub.

The mockup surfaces the highest-frequency / highest-risk jobs this way:

- **Runtime** is visible at all times in the address surface and also appears as
  the first Workbench priority action.
- **Save** is next to Playground identity; **Share** groups copy link, ZIP,
  GitHub export, and saved sites.
- **Files** is one Workbench click away and opens wide enough for a readable
  tree, tabs, code, and recovery rail.
- **Import/create** is a priority Workbench tile, not hidden under Inspect.
- **Database, Logs, and Blueprint** are one Workbench scan away under Inspect.
- **Command** carries path/repo/Blueprint power-user flows without replacing the
  browser address bar.

## Public conversation and product constraints

The mockup follows the active product direction from PR 3655 and older redesign
conversation in issue 1561:

- PR 3655 separates automatic recovery from intentional saving: autosaved
  Playgrounds prevent data loss, while saved Playgrounds are explicit user
  intent.
- Issue 1561 called for a redesign that supports multiple offline/stored sites,
  site management, multiple data sources/targets, and Blueprint builder
  integration.
- The same issue also surfaced constraints that matter here: preserve one-click
  WordPress, avoid extra popups, keep the URL bar available, make Save prominent
  for temporary/unsaved sites, and recognize that full-page mode is useful.

The UX model also follows a few broad interface principles:

- **Aesthetic/minimalist design:** reduce competing always-visible controls; the
  top chrome only shows identity, address/runtime, and Workbench.
- **Recognition over recall:** Workbench exposes a categorized map of actions so
  users do not have to remember whether files, logs, database, Blueprints, or
  exports live under a gear, sidebar, or modal.
- **Progressive disclosure:** frequent surfaces are visible or one click away;
  deeper features are grouped contextually and labeled by user intent.
- **Visual attachment and separation:** transient panels anchor to their control
  but use a dark instrument shell and scrim so they do not blend into WordPress.

## Fourth 100-iteration flow scorecard

The runner now tests actual user flows across desktop breakpoints instead of
only measuring static layout properties:

```bash
ITERATION_ROUND=4 node packages/playground/website/design-explorations/workbench-html-mockup-iteration-runner.mjs
```

It generated 100 screenshot-backed iterations under:

```text
.context/workbench-html-mockup-iterations/screenshots-round-4/
```

And wrote:

```text
packages/playground/website/design-explorations/workbench-html-mockup-iterations-round-4.json
packages/playground/website/design-explorations/workbench-html-mockup-iterations-round-4.md
```

Round 4 covers these flows:

1. Open Runtime from Workbench.
2. Apply Runtime settings.
3. Open Files and save code.
4. Open Share and promote Save.
5. Find import/create.
6. Find logs.
7. Find database.
8. Find Blueprint source.
9. Open Command.
10. Open another saved Playground.

The scorecard gates check:

1. click count stays within the flow budget;
2. the expected panel is reached;
3. expected labels/actions are visible;
4. the address bar remains visible and useful;
5. Runtime remains reachable from the address surface;
6. the page has no horizontal overflow;
7. the WordPress preview remains visible behind transient panels;
8. panel word count and visible border count stay below budgets;
9. Playground UI remains visually separated from WordPress;
10. generic AI-font markers are absent from the mockup stylesheet;
11. chrome, panel, and content motion hooks are present;
12. the file editor has readable tree and code widths when opened.

Latest local round-4 run: iterations 301–400, 100 screenshots, 0 visual-gate
failures. Measured limits: max 113 words in a panel, max 7 visibly bordered
panel elements, minimum address width 531px, minimum preview ratio 2.7% for the
wide file editor flow, and 0px max arrow drift.

## Earlier passes

Earlier committed artifacts remain useful history:

- Round 1 established the first clickable Workbench model and base layout gates.
- Round 2 reduced popover clutter, word count, and visible borders.
- Round 3 explored the atelier-browser aesthetic, now superseded by the
  precision-instrument direction above.
