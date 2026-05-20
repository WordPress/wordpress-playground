# No-Sidebar Direction

## Trigger

The previous selected direction failed the latest critique: it depended on a persistent mode sidebar and too many visible buttons. That made the UI feel like another dashboard around WordPress rather than a focused Playground browser.

## New Interaction Model

- Default state: one browser-like top chrome over the WordPress canvas.
- Persistent controls:
  - instance identity;
  - address/current route;
  - compact environment chip;
  - save/network/warning status;
  - one `Workbench` entry.
- No persistent sidebar.
- No persistent right inspector.
- Details open only when requested:
  - `Workbench` sheet for start/switch, Blueprints, inspect/recover, save/share/export;
  - `Environment` sheet from the runtime chip;
  - bottom recovery drawer for files/logs/database recovery.

## Why This Is Better

- The first viewport belongs to WordPress again.
- The Playground chrome is still visible and operational, but it does not surround the canvas with controls.
- The broad feature set is discoverable through one named place instead of five permanent mode buttons.
- Runtime remains visible before clicking without becoming a field group.
- Recovery still gets a wide surface because files and logs need width.
- Mobile uses the same top chrome and bottom sheets; it does not inherit a horizontal mode rail.

## Tradeoffs

- Some features are now one click behind `Workbench`; this is acceptable because the entry is named and stable.
- The Workbench sheet must be very well organized. If it becomes a wall of rows, the design regresses into a menu dump.
- Keyboard shortcuts and search can help power users, but the design cannot depend on search alone.

## Quality Gate

- Main state has no left rail, no right panel, and one primary visible Playground action.
- Workbench open state groups actions by user jobs, not implementation categories.
- Error state opens files/logs as a recovery drawer, not as another sidebar.
