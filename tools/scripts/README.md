# Bundle Size Tracking

This directory contains scripts for tracking and reporting bundle size changes in WordPress Playground.

## Overview

The bundle size tracking system helps ensure that changes to the codebase don't significantly increase the download size required for:

1. **First Paint**: Assets needed to display the initial WordPress Playground interface
2. **Offline Mode**: Assets cached for offline functionality

## Scripts

### `analyze-bundle-size.mjs`

Analyzes the build output and generates a detailed report of asset sizes.

**Usage:**

```bash
npm run build:website
node tools/scripts/analyze-bundle-size.mjs
```

**Output:**

-   `bundle-size-report.json`: Detailed JSON report with size information for all assets

**What it measures:**

-   Total size and gzipped size for first paint assets
-   Total size and gzipped size for offline mode assets
-   Individual file sizes
-   Top 10 largest files in each category

### `compare-bundle-size.mjs`

Compares two bundle size reports and generates a markdown report suitable for GitHub PR comments.

**Usage:**

```bash
node tools/scripts/compare-bundle-size.mjs [base-report] [current-report]
```

**Default paths:**

-   `base-report`: `bundle-size-report-base.json`
-   `current-report`: `bundle-size-report.json`

**Output:**

-   `bundle-size-comment.md`: Markdown-formatted comparison report
-   GitHub Actions outputs for workflow automation

## CI Workflow

The bundle size check runs automatically on pull requests via the `.github/workflows/bundle-size-check.yml` workflow.

### How it works

1. **Build Current Branch**: Builds the website from the PR branch and analyzes the bundle size
2. **Build Base Branch**: Checks out and builds the base branch (usually `trunk`) and analyzes its bundle size
3. **Compare**: Generates a comparison report showing size changes
4. **Comment**: If size changes exceed 50 KB (gzipped) in either category, posts a comment on the PR

### Comment Threshold

A PR comment is posted when:

-   First paint assets change by more than ±50 KB (gzipped), OR
-   Offline mode assets change by more than ±50 KB (gzipped)

### Comment Format

The PR comment includes:

-   **Size Comparison**: Current vs. base size with delta
-   **File Count**: Number of files in each category
-   **Files with Largest Changes**: Top 10 files with the biggest size deltas
-   **Top 10 Largest Files**: Current largest files in each category
-   **Status Indicators**:
    -   🆕 New file
    -   🗑️ Removed file
    -   📈 Size increased
    -   📉 Size decreased
    -   ➡️ No change

## First Paint Assets

Files considered critical for the first paint include:

-   `index.html` and `remote.html`
-   Core JavaScript bundles in `/assets/` (excluding optional chunks)
-   Core CSS files
-   Service worker
-   Manifest files

**Excluded from first paint:**

-   Optional chunks (e.g., CodeMirror extensions in `/assets/optional/`)
-   PHP WASM files (loaded on demand)
-   WordPress build ZIPs (loaded on demand)
-   SQLite integration (loaded on demand)
-   Demos and builder assets

## Offline Mode Assets

Files required for offline functionality are determined by the `assets-required-for-offline-mode.json` manifest, which is automatically generated during the build process by the `listAssetsRequiredForOfflineMode` Vite plugin.

See `packages/vite-extensions/vite-list-assets-required-for-offline-mode.ts` for details on how this manifest is generated.

## Local Development

To test bundle size changes locally:

```bash
# Build the website
npm run build:website

# Analyze current build
node tools/scripts/analyze-bundle-size.mjs

# Save as base for comparison
cp bundle-size-report.json bundle-size-report-base.json

# Make your changes...

# Build again
npm run build:website

# Analyze new build
node tools/scripts/analyze-bundle-size.mjs

# Compare
node tools/scripts/compare-bundle-size.mjs
```

## Optimization Tips

If your PR triggers a bundle size increase:

1. **Check for new dependencies**: Large libraries can significantly increase bundle size
2. **Use code splitting**: Move non-critical code to lazy-loaded chunks
3. **Optimize assets**: Compress images, minify code
4. **Review bundle composition**: Use tools like `vite-bundle-visualizer` to understand what's taking up space
5. **Consider alternatives**: Look for lighter-weight alternatives to heavy dependencies

## Artifacts

The workflow uploads the following artifacts for debugging:

-   `bundle-size-report.json`: Current branch analysis
-   `bundle-size-report-base.json`: Base branch analysis
-   `bundle-size-comment.md`: Generated PR comment
