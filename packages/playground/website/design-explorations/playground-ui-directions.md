# Playground browser/environment HTML mockup

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
- `?panel=command` — command-aware action/search layer.

## Current direction: browser-native command layer

This pass follows `.context/playground-ui-reset-brief.md` as the product brief.
It replaces the precision-instrument HTML prototype with a calmer
**browser/environment model**: Playground behaves like a focused browser for a
live WordPress runtime, not a dashboard wrapped around WordPress.

The address bar remains the center of gravity. A compact Environment pill carries
runtime and save/recovery status. Command/search and bottom utility surfaces
appear only when the user asks for broader actions.

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
4. **Command/search layer** is a compact, transient action map for imports,
   files, logs, Blueprint source, database tools, and sharing.
5. **Files and utilities** open in a bottom drawer: wide enough for tree, editor,
   and recovery context while preserving visible WordPress canvas above.

### Anti-goals

- No always-on sidebar, because WordPress already has persistent navigation.
- No row of unrelated buttons beside the address bar.
- No giant Workbench panel that simply covers the site; this pass removes
  Workbench as the primary model.
- No fake iteration scorecard as proof of quality. The previous generated
  iteration artifacts were removed from the PR scope.
- No visual styling that is louder than the interaction model.

## References and borrowed patterns

- Chrome DevTools uses a Drawer for hidden tools and supports moving tools
  between panels and the drawer. That suggested a transient bottom utility
  surface instead of a permanent Playground sidebar.
- Linear makes actions available through buttons, shortcuts, contextual menus,
  and command search. Its command menu prioritizes actions related to the current
  view.
- Linear Peek / Quick Look informed the idea that inspection can preview details
  without replacing the current page.
- VS Code and Codespaces use the Command Palette for broad access to commands
  without exposing every command in persistent chrome.
- Raycast's command/search model informed compact action rows searchable by
  command, keyword, or category.

## Acceptance criteria for this mockup

- Playground remains full-page with the WordPress admin sidebar inside the site.
- The address bar is visible and central at desktop breakpoints.
- Runtime and save/recovery status are visible before any click and open in one
  click from the Environment pill.
- Save copy clearly distinguishes autosave/recovery from intentional Save.
- The command layer and file tray are transient and visually separate from
  WordPress.
- The file editor has useful tree, code, actions, and recovery affordances.

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
| Will I lose this site?                  | Environment + Current | Recovery and intentional Save need to be explained together.        |
| How do I change PHP/WP/storage/network? | Environment sheet     | Runtime is one click from the top chrome, not buried in settings.   |
| How do I import/create/inspect/share?   | Command layer         | Broad actions are searchable without becoming toolbar clutter.      |
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
7. Playground chrome is visually separated from WordPress;
8. Files has readable tree, editor, and recovery rail widths.

Latest local check: 24 screenshots across 6 states and 4 desktop breakpoints,
0 failures. I also checked the main, runtime, command, and files states in Chrome
at 1440×900 and the browser console was clean.
