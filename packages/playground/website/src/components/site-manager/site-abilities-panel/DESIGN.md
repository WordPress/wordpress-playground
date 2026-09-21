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
ability replaces the list with its detail and runner.

Use section spacing for the panel rhythm and 12px vertical padding for list rows.
Within each row, use a two-column grid with a flexible identity column and an
intrinsic-width WebMCP toggle column, separated by 12px. Stack the label and
identifier with 4px gaps. Descriptions span both columns and show up to two lines;
the detail view retains the full description. Long names and identifiers wrap.
Formatted output wraps and scrolls within a maximum height of 360px. The pane
introduces no custom breakpoint.

## Elevation & Depth

Rows are separated by thin borders. This surface adds no shadows or raised cards.

## Components

Reuse `@wordpress/components`: secondary Refresh, link ability labels, tertiary
Back to abilities, primary Run, SearchControl, TextareaControl, ToggleControl,
and Notice. Action buttons retain their intrinsic width.

Keep per-ability WebMCP switches beside the abilities they affect. Exposure is
session-only and starts disabled. An unsupported-browser notice leaves inspection
and execution available. Keep schema details collapsible and the JSON input
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
