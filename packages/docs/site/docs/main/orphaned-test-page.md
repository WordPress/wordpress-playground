---
title: Orphaned Test Page
description: This is an intentionally orphaned page to test the CI check
---

# Orphaned Test Page

This page is intentionally not linked in any sidebar menu to demonstrate that the orphan page detection check works correctly.

When this PR is merged, this page should be removed or linked to a sidebar.

## Purpose

This page exists to validate that:
1. The `check-orphan-pages.js` script correctly identifies orphaned pages
2. The CI check fails when orphaned pages are present
3. The error message is clear and actionable

## Expected Behavior

Running `npx nx check-orphan-pages docs-site` should:
- Exit with code 1
- Report this page as orphaned
- Show the file path: `main/orphaned-test-page.md`
- Show the doc ID: `main/orphaned-test-page`
