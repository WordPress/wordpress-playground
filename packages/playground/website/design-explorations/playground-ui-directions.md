# Playground browser/tools HTML mockup

This PR is a **design exploration only**. It does not wire a new route into the
Playground app. Open the standalone clickable mockup directly:

```text
packages/playground/website/design-explorations/workbench-html-mockup.html
```

For example:

```text
file:///Users/cloudnik/conductor/workspaces/wordpress-playground/helsinki/packages/playground/website/design-explorations/workbench-html-mockup.html?panel=runtime
```

Useful starting states:

- `?panel=runtime` — anchored Environment sheet with Save + runtime.
- `?panel=files` — bottom utility drawer with recovery editor.
- `?panel=current` — current Playground and saved/recovery sites.
- `?panel=share` — preserve and export actions.
- `?panel=command` — one-click Playground tools browser with search as a secondary aid.

## Current direction: browser-native tools with WordPress primitives

This pass follows `.context/playground-ui-reset-brief.md` as the product brief.
It replaces the precision-instrument HTML prototype with a calmer
**browser/environment model**: Playground behaves like a focused browser for a
live WordPress runtime, not a dashboard wrapped around WordPress.

The address bar remains the center of gravity. A compact Environment pill carries
runtime and save/recovery status. A one-click Tools browser exposes the broader
feature set without assuming search or a command palette will solve discovery.

## Product and interaction brief

### Primary users

- WordPress contributors and plugin/theme developers testing a specific runtime.
- Documentation, support, and education users who need a quick reproducible site.
- Power users importing GitHub/ZIP/Blueprint work and debugging a broken site.

### Top jobs

1. Navigate WordPress without losing the familiar full-page browser model.
2. See and change runtime settings: WordPress, PHP, storage, network, multisite.
3. Understand whether the site is merely autosaved for recovery or intentionally
   saved as a Playground.
4. Import, inspect, share, and export without crowding the address bar.
5. Edit files only when useful, in a readable recovery workspace.

### Hierarchy

1. **WordPress content** owns the page below the chrome. It is visibly bounded so
   Playground UI never looks like part of `wp-admin`.
2. **Address** is central and browser-like for WordPress navigation.
3. **Environment pill** is always visible and combines `Unsaved`, WordPress,
   PHP, storage, and recovery state. Its anchored sheet has two primary
   operations: Save this Playground and Change runtime.
4. **Tools browser** is a compact, transient action map for imports, files,
   logs, Blueprint source, database tools, and sharing. Search is available, but
   the grouped feature list is the primary discovery mechanism.
5. **Your Playgrounds** opens from the site card and is designed as a searchable
   30-item library with saved, recovery, and local workspaces.
6. **Files and utilities** open in a bottom drawer: wide enough for tree, editor,
   and recovery context while preserving visible WordPress canvas above.

### Anti-goals

- No always-on sidebar, because WordPress already has persistent navigation.
- No row of unrelated buttons beside the address bar.
- No giant Workbench panel that simply covers the site; this pass removes
  Workbench as the primary model.
- No fake iteration scorecard as proof of quality. The previous generated
  iteration artifacts were removed from the PR scope.
- No visual styling that is louder than the interaction model.
- No invented decorative system. The latest pass uses WordPress/Gutenberg-like
  primitives: white surfaces, WordPress grays, blue primary actions, and amber
  only for recovery state.

## References and borrowed patterns

- Chrome DevTools uses a Drawer for hidden tools and supports moving tools
  between panels and the drawer. That suggested a transient bottom utility
  surface instead of a permanent Playground sidebar.
- Linear makes actions available through buttons, shortcuts, contextual menus,
  and command search. Its command menu prioritizes actions related to the current
  view.
- Linear Peek / Quick Look informed the idea that inspection can preview details
  without replacing the current page.
- VS Code and Codespaces use command palettes for broad access, but this mockup
  deliberately treats search as secondary to grouped browsing.
- WordPress admin and Gutenberg component patterns inform the simplified visual
  system: flatter lists, gray separators, and minimal color.

## Acceptance criteria for this mockup

- Playground remains full-page with the WordPress admin sidebar inside the site.
- The address bar is visible and central at desktop breakpoints.
- Runtime and save/recovery status are visible before any click and open in one
  click from the Environment pill.
- Save copy clearly distinguishes autosave/recovery from intentional Save.
- The Tools browser and file tray are transient and visually separate from
  WordPress.
- The file editor has useful tree, code, actions, and recovery affordances.
- Your Playgrounds can handle a long library: 30 saved/recovery/local rows,
  filtering, tabs, metadata columns, and a scrollable list.

## Feature surface mapping

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

The current mockup maps those jobs to surfaces this way:

| User question                           | Surface               | Why                                                                 |
| --------------------------------------- | --------------------- | ------------------------------------------------------------------- |
| Where do I go in WordPress?             | Address bar           | Keep the browser model users like.                                  |
| What runtime am I using?                | Environment pill      | Runtime status must be visible before clicking.                     |
| Will I lose this site?                  | Environment + Library | Recovery and intentional Save need to be explained together.        |
| How do I change PHP/WP/storage/network? | Environment sheet     | Runtime is one click from the top chrome, not buried in settings.   |
| How do I import/create/inspect/share?   | Tools browser         | Broad actions are grouped for browsing; search is secondary.        |
| How do I edit broken-site files safely? | Bottom files tray     | Editing needs width, recovery context, and visible WordPress state. |

## Verification

Run the lightweight browser/environment check:

```bash
node packages/playground/website/design-explorations/workbench-html-mockup-iteration-runner.mjs
```

It writes screenshots and a manifest under:

```text
.context/workbench-browser-environment-checks/
```

The check verifies:

1. no horizontal overflow;
2. address remains visible and central;
3. Environment pill remains visible;
4. WordPress canvas remains the page owner;
5. expected labels/actions are visible in each state;
6. transient surfaces stay bounded;
7. visible border count remains low so popovers do not become card soup;
8. Playground chrome is visually separated from WordPress;
9. Files has readable tree, editor, and recovery rail widths.

Latest local check: 24 screenshots across 6 states and 4 desktop breakpoints,
0 failures. I also checked the Playgrounds library and Tools browser in Chrome
at 1440×900; the browser console was clean.
