# Docs Migration PR Plan

Tracking issue: https://github.com/WordPress/wordpress-playground/issues/3497

## Current Status

- Phase 1 groundwork is merged in PRs #3466, #3467, #3470, and #3496.
- This follow-up migration removes remaining heading IDs and fragment references.
- Docusaurus callouts have been replaced with Handbook-compatible raw HTML callouts.
- Translation source comments are preserved; active callout markers are converted so
  scans that target rendered directives stay clean.

## Recommended PR Split

1. Translation heading ID cleanup
    - Remove remaining translated heading IDs.
    - Verify with `rg '\{#[^}]+\}' packages/docs/site/docs packages/docs/site/i18n`.

2. Translation fragment cleanup
    - Inline remaining `APIList` and `ThisIsQueryApi` references.
    - Verify with `rg '(_fragments|<APIList|<ThisIsQueryApi|PlaygroundWpNetWarning|JSApiShortExample)' packages/docs/site/docs packages/docs/site/i18n`.

3. Info callout completion
    - Convert remaining active `info` callouts to `<div class="callout callout-info">`.
    - Convert Markdown links inside touched callouts to HTML anchors.

4. English warning and caution callouts
    - Convert English `warning`, `caution`, and equivalent danger callouts to
      `<div class="callout callout-warning">`.
    - Preserve titles as bold first lines.

5. English tip callouts
    - Convert English `tip` callouts to `<div class="callout callout-tip">`.
    - Keep the local `.callout-tip` Docusaurus fallback style in `custom.css`.

6. Translation callout parity
    - Convert translated info, warning, caution, note, danger, and tip callouts.
    - Suggested batches: `es + fr`, `pt-BR`, `ja`, then `bn + gu + hi + it + tl`.

## Verification

- `rg '\{#[^}]+\}' packages/docs/site/docs packages/docs/site/i18n`
- `rg '(_fragments|<APIList|<ThisIsQueryApi|PlaygroundWpNetWarning|JSApiShortExample)' packages/docs/site/docs packages/docs/site/i18n`
- `rg '^:{3,}' packages/docs/site/docs packages/docs/site/i18n`
- `npm exec nx run docs-site:build`

## Notes

- Raw callouts use Handbook classes: `callout-info`, `callout-tip`, and
  `callout-warning`.
- Links inside raw callouts use HTML anchors so they render correctly in Handbook
  Markdown processing.
- The implementation is intentionally mechanical and should be split into the PR
  sequence above before opening pull requests.
