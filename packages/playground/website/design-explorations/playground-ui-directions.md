# Playground Workbench HTML mockup

This PR is now a design exploration only. It does **not** wire a new route into the
Playground app. Open the standalone clickable mockup directly:

```text
packages/playground/website/design-explorations/workbench-html-mockup.html
```

For example:

```text
file:///Users/cloudnik/conductor/workspaces/wordpress-playground/helsinki/packages/playground/website/design-explorations/workbench-html-mockup.html?panel=workbench
```

Useful panels:

- `?panel=workbench`
- `?panel=runtime`
- `?panel=files`
- `?panel=current`
- `?panel=share`
- `?panel=command`

## What changed in this direction

The latest direction keeps the pieces people already understand:

- Playground is still full-page.
- The address bar is still visible and central.
- WordPress remains the main canvas.
- Playground tools are visually separate from WordPress and open only on demand.

The chrome now has three deliberate zones instead of a row of equal toolbar
buttons:

1. **Playground identity and persistence** — active Playground name, save state,
   and Save live together. This reflects PR 3655's model: autosaves are recovery
   copies; Save is an intentional promotion.
2. **Address and runtime** — the address bar remains the browser-like primary
   control. Runtime is a chip inside the address surface, so WordPress/PHP,
   network, and storage settings stay one click away without adding another
   top-level button.
3. **Workbench** — one dark, high-confidence entry point for tasks that affect
   the running site.

Each panel is anchored to its invoking control with a visual triangle, but the
surfaces no longer feel like the same popover wearing different content.
Runtime, Workbench, Share, Command, Current Playground, and Files each get their
own accent and background wash. Runtime has no Back to Workbench button. Share
is not hidden under Inspect. Files open as a wide editor-grade workspace rather
than a cramped settings tab.

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

The mockup groups those jobs this way:

| User question                             | Surface                                  | Why                                                                |
| ----------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------ |
| What am I looking at, and will I lose it? | Current Playground                       | Identity and safety should be one click from the name.             |
| Where do I go in WordPress?               | Address bar                              | Users like the browser model; do not dilute it.                    |
| How do I change WP/PHP/network/storage?   | Runtime chip + Workbench priority action | Runtime settings are important enough to be visible.               |
| What can I do to this site?               | Workbench                                | A single map avoids separate Create/Inspect/Settings vocabularies. |
| How do I recover or edit files?           | Files & recovery                         | File work needs a real editor surface and recovery context.        |
| How do I keep or hand off this work?      | Save and share                           | Preservation/export actions belong together.                       |

## Public conversation and research constraints

The mockup follows the active product direction from PR 3655 and older redesign
conversation in issue 1561:

- PR 3655 separates automatic recovery from intentional saving: autosaved
  Playgrounds prevent data loss, while saved Playgrounds are explicit user intent.
- Issue 1561 called for a redesign that supports multiple offline/stored sites,
  site management, multiple data sources/targets, and Blueprint builder
  integration.
- The same issue also surfaced constraints that matter here: preserve one-click
  WordPress, avoid extra popups, keep the URL bar available, make Save prominent
  for temporary/unsaved sites, and recognize that full-page mode is useful.

The UX model also follows a few broad interface principles:

- **Aesthetic/minimalist design:** reduce competing always-visible controls; the
  top chrome only shows identity, navigation/runtime, and Workbench.
- **Recognition over recall:** Workbench exposes a categorized map of actions so
  users do not have to remember whether files, logs, database, Blueprints, or
  exports live under a gear, sidebar, or modal.
- **Progressive disclosure:** frequently needed surfaces are visible or one click
  away; deeper features are grouped contextually and labeled by user intent.
- **Consistency and visual attachment:** every transient panel shares the same
  connector, shell behavior, and close mechanics, while panel-specific accents
  make Runtime, Workbench, Files, Share, Command, and Current Playground
  distinguishable at a glance.

## 100-iteration evidence

The mockup includes a Playwright-backed iteration runner:

```bash
node packages/playground/website/design-explorations/workbench-html-mockup-iteration-runner.mjs
```

It generates 100 desktop screenshots under:

```text
.context/workbench-html-mockup-iterations/screenshots/
```

And writes the audit artifacts:

```text
packages/playground/website/design-explorations/workbench-html-mockup-iterations.json
packages/playground/website/design-explorations/workbench-html-mockup-iterations.md
```

Every iteration records:

- a screenshot path;
- 25 concrete change entries tied to actual CSS/layout values and product
  decisions;
- visual-test metrics;
- a review;
- a reflection for the next iteration.

The visual gates check that:

1. the active popover arrow is centered on the invoking trigger;
2. Runtime has no Back to Workbench button;
3. the page has no horizontal overflow;
4. the address bar remains visible;
5. the WordPress preview remains visible behind transient panels;
6. the file editor has readable tree and code widths when opened.

Latest local run: 100 iterations, 100 screenshots, 0 visual-gate failures.

## Second 100-iteration pass

The second pass responds to the critique that the first Workbench mockup still
felt too popover-shaped, too wordy, and too bordered.

```bash
ITERATION_ROUND=2 node packages/playground/website/design-explorations/workbench-html-mockup-iteration-runner.mjs
```

It generates another 100 screenshots under:

```text
.context/workbench-html-mockup-iterations/screenshots-round-2/
```

And writes the second-run artifacts:

```text
packages/playground/website/design-explorations/workbench-html-mockup-iterations-round-2.json
packages/playground/website/design-explorations/workbench-html-mockup-iterations-round-2.md
```

Round 2 adds stricter checks for:

1. distinct panel classes and accent tokens;
2. old Runtime helper fluff staying removed;
3. panel word counts staying below per-panel budgets;
4. visible borders staying below per-panel budgets;
5. the same desktop layout gates from round 1.

Latest local round-2 run: iterations 101–200, 100 screenshots, 0 visual-gate
failures. The measured maximums were 128 words in a panel and 14 visibly
bordered elements, both from the wide file editor.
