# Adding Dock tools

`tool-registry.tsx` owns navigation, pane presentation, and site-tool rendering.
Add a definition there instead of maintaining another navigation or routing list.

1. Choose a unique `section`; `DockToolSection` and `SiteToolSection` derive from
   the definitions. Use `group: 'main'` for primary actions, `'developer'` for
   developer tools, or `'hidden'` for destinations without a navigation button.
2. Supply `label`, `ariaLabel`, and a navigation `icon`, plus the pane `title`,
   `description`, and `layout` (`default`, `compact`, `editor`, or `wide`). Use
   `fixedHeight` only when the pane needs it; `isPrimary` marks a primary action.
3. For a site tool, provide a `Panel` component and, when needed, an existing
   `panelClassName`. Adapt existing components in
   `../site-manager/site-info-panel/site-tool-renderers.tsx`.

The shared `SiteToolPanelProps` contract provides:

- `site`: the active site's metadata.
- `playground`: its client, which can be `undefined` while loading.
- `isVisible`: whether this retained tool is currently shown.
- `mobileHeaderTarget`: the shared editor header slot when visible on mobile,
  otherwise `null`.

Use these props in the adapter to bridge the tool's existing interface. Reuse
WordPress controls and existing pane styles. Use `PaneLoading` while the whole
pane is unavailable, or `InlineProgress` when surrounding content remains usable.

## Mounting and retention

`SiteToolPanels` derives its panels from registry entries with a `Panel`. It
mounts each tool on first selection, then hides it instead of unmounting it when
another destination opens. The site manager keys the host by the active site's
slug, so changing sites resets retained panels. Closing the Dock preserves them.
Use `isVisible` for work that should run only while shown; hidden components
remain mounted. Expensive components can use `lazy` and `Suspense` in their
adapter, as Files, Blueprint, and Terminal do.

## Developer tools preference

`useDeveloperTools` owns the developer group's visibility. An explicit toggle saves `true`
under `localStorage['playground-developer-tools']`, or removes the key when
disabled. Opening a developer pane externally reveals the row for this session
without saving that preference. Hiding developer tools closes an open developer pane;
a blocked pane close prevents toggling. Storage failures leave session use intact.

## Rows and responsive behavior

Registry order determines button order within each group. Main actions and enabled
developer tools share one horizontally scrolling row. The Dev Tools toggle follows
Export, separated by a pale vertical line; its developer tools follow the toggle.
Keep added buttons inside the existing developer group.

The Dock measures its size and tools container with `ResizeObserver`; those
measurements drive pane positioning, collapse travel, and full-width clearance.
Desktop shows the address row above the tools. On mobile, the address row sits
below them. Mobile collapse removes the tools container from layout so the
measured height follows the visible address row.

Check new tools in floating, full-width, and mobile modes, including first open,
switching away and back, changing sites, and revealing the developer tools.
