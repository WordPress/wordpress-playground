---
name: WordPress Playground abilities pane
description: Scoped design guidance for the existing Dock developer tool.
spacing:
    small: '8px'
    toolbar: '12px'
    section: '16px'
---

# Design System: Abilities Pane

## Overview

Operate within Playground's existing wide Dock pane. This surface inherits the
WordPress component system and serves developers inspecting and running PHP
abilities. Its visual character is plain, compact, and task focused.

This document covers only `SiteAbilitiesPanel`, as implemented in `index.tsx`
and `style.module.css`.

## Colors

Inherit control, text, focus, and notice colors from the shared components and
Dock. List dividers use the existing `--interactive-border` token, with the
implementation's neutral fallback. No pane-specific accent palette is defined.

## Typography

Inherit the application typography. Ability labels are link buttons; identifiers
use code text. The detail heading establishes the selected ability, and a smaller
heading introduces its result. Schemas and results preserve JSON formatting.

## Layout

Use one vertical column inside the host pane. The toolbar places the current
WordPress user opposite Refresh. Search precedes the ability list; selecting an
ability replaces the list with its detail and runner. Back to abilities restores
the list with its search and group expansion unchanged.

Group abilities by namespace, the part of the name before `/`. WordPress does not
record the registering plugin, but the namespace is conventionally its slug. Show
`core` as "WordPress core" first, then other namespaces alphabetically; abilities
keep their registration order within a group. Groups start collapsed.

Each group header uses the same two-column grid as ability rows: a tertiary
disclosure button with a chevron and the group name, opposite a group WebMCP
toggle whose help text reports how many of the group's abilities are exposed.
The group switch and its count align to the column's end so the switch lines up
with the row switches beneath it.
The expanded group's rows are indented 24px beneath the header.

While search has text, groups without matches are hidden and matching groups
expand automatically; the disclosure can still collapse them for that search.
Clearing search restores the expansion chosen without search. The group toggle
and its count always cover the whole group, not only matching rows; when rows are
filtered, its help text says so.

Use section spacing for the panel rhythm and 12px vertical padding for headers
and rows. Within each row, use a two-column grid with a flexible identity column
and an intrinsic-width WebMCP toggle column, separated by 12px. Stack the label
and identifier with 4px gaps. Descriptions span both columns and show up to two
lines; the detail view retains the full description. Long names and identifiers
wrap. Formatted output wraps and scrolls within a maximum height of 360px. The
pane introduces no custom breakpoint.

## Elevation & Depth

Rows are separated by thin borders. This surface adds no shadows or raised cards.

## Components

Reuse `@wordpress/components`: secondary Refresh, link ability labels, tertiary
Back to abilities, primary Run, SearchControl, TextareaControl, ToggleControl,
and Notice. Action buttons retain their intrinsic width.

Keep WebMCP switches beside the abilities they affect. A group switch is on
only when every ability in the group is exposed; turning it on or off applies to
the whole group in one update. A partially exposed group shows an unchecked
switch, and its count, exposed to assistive technology as the switch's
description, conveys the partial state. Do not add a custom tri-state control.
Per-ability switches remain inside the expanded group. Exposure is session-only
and starts disabled. An unsupported-browser notice leaves inspection and
execution available. Keep schema details collapsible and the JSON input
explicitly labeled; its help text explains empty input and possible site changes.

Use PaneLoading for initial loading and InlineProgress for refresh and execution.
Move focus to the detail heading after selection. Announce results through the
status region and place errors near their related operation or ability.

## Do's and Don'ts

- Preserve the existing Dock layout and WordPress control variants.
- Keep the current execution identity visible.
- Keep exposure controls distinct from the Run action.
- Do not imply that exposure choices persist beyond the session.
- Do not introduce a parallel component system or decorative cards.
