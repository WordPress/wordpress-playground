# Bundle Size Tracking

This directory contains scripts for tracking and reporting bundle size changes in WordPress Playground using real browser measurements.

## Overview

The bundle size tracking system uses Playwright to measure actual download sizes at key stages during page load:

1. **First Paint**: Assets downloaded until the progress bar is visible
2. **WordPress Loaded**: Assets downloaded until WordPress site is ready (nested iframes loaded)
3. **Offline Mode Ready**: All assets downloaded after network activity settles

This approach provides real-world measurements instead of static file analysis.

## Scripts

### `measure-bundle-size-browser.mjs`

Uses Playwright to measure bundle size by monitoring actual browser network requests.

**Usage:**
```bash
# Start the development server
npm run dev

# In another terminal, run the measurement
node tools/scripts/measure-bundle-size-browser.mjs
```

**What it measures:**
- Total bytes transferred at each stage
- Number of files loaded
- Time to each milestone
- Top 10 largest files at each stage
- Breakdown by resource type (script, stylesheet, image, etc.)

**Output:**
- `bundle-size-report.json`: Detailed JSON report with measurements

### `compare-bundle-size.mjs`

Compares two bundle size reports and generates a markdown report suitable for GitHub PR comments.

**Usage:**
```bash
node tools/scripts/compare-bundle-size.mjs [base-report] [current-report]
```

**Default paths:**
- `base-report`: `bundle-size-report-base.json`
- `current-report`: `bundle-size-report.json`

**Output:**
- `bundle-size-comment.md`: Markdown-formatted comparison report
- GitHub Actions outputs for workflow automation

## CI Workflow

The bundle size check runs automatically on pull requests via the `.github/workflows/bundle-size-check.yml` workflow.

### How it works

1. **Build & Start Current Branch**: 
   - Builds the website from the PR branch
   - Starts the preview server
   - Installs Playwright
   - Measures bundle size with real browser

2. **Build & Start Base Branch**: 
   - Checks out and builds the base branch (usually `trunk`)
   - Starts the preview server
   - Measures its bundle size with real browser

3. **Compare**: 
   - Generates a comparison report showing size changes at each stage
   - Includes time delta as well as size delta

4. **Comment**: 
   - If any stage changes by more than 50 KB, posts a comment on the PR

### Comment Threshold

A PR comment is posted when any of these change by more than ±50 KB:
- First paint downloads
- WordPress loaded downloads
- Offline mode ready downloads

### Comment Format

The PR comment includes three sections:

#### 🎨 First Paint (Progress Bar Visible)
- Current vs. base size and load time
- Delta in bytes and time
- Top 10 largest files

#### ✅ WordPress Loaded (Site Ready)
- Current vs. base size and load time
- Delta in bytes and time
- Top 10 largest files

#### 💾 Offline Mode Ready (All Downloads Settled)
- Current vs. base size and load time
- Delta in bytes and time
- Top 10 largest files

**Status Indicators**:
- 📈 Size increased
- 📉 Size decreased
- ➡️ No change

## Measurement Stages

### First Paint (Progress Bar Visible)

Measures all downloads until the progress bar becomes visible. This represents the minimum assets needed for users to see that the page is loading.

**Key signals:**
- Progress bar element visible
- Falls back to DOMContentLoaded if no progress bar found

### WordPress Loaded (Site Ready)

Measures all downloads until WordPress is fully loaded in the nested iframe, indicated by the WordPress admin bar being visible.

**Key signals:**
- WordPress admin bar (`#wpadminbar`) is visible in the nested iframe
- Falls back to window load event if admin bar not found

### Offline Mode Ready (All Downloads Settled)

Measures all downloads after network activity settles (5 seconds of no new requests). This represents all assets that would be cached for offline use.

**Key signals:**
- No network requests for 5 consecutive seconds
- Includes all lazy-loaded assets

## Local Development

To test bundle size changes locally:

```bash
# Terminal 1: Start the dev server
npm run dev

# Terminal 2: Measure current build
node tools/scripts/measure-bundle-size-browser.mjs

# Save as base for comparison
cp bundle-size-report.json bundle-size-report-base.json

# Make your changes...

# Restart dev server if needed
npm run dev

# Measure new build
node tools/scripts/measure-bundle-size-browser.mjs

# Compare
node tools/scripts/compare-bundle-size.mjs
```

## Optimization Tips

If your PR triggers a bundle size increase:

1. **Check for new dependencies**: Large libraries can significantly increase bundle size
2. **Use code splitting**: Move non-critical code to lazy-loaded chunks
3. **Optimize assets**: Compress images, minify code
4. **Review network tab**: Use browser DevTools to see what's being loaded
5. **Consider alternatives**: Look for lighter-weight alternatives to heavy dependencies
6. **Analyze resource types**: Check if images, scripts, or styles are the main contributor

## Browser-Based Measurement Benefits

Using real browser measurements instead of static file analysis provides:

- **Realistic data**: Measures what users actually download
- **Network behavior**: Captures caching, compression, and HTTP/2 multiplexing effects
- **Load timing**: Shows when assets are downloaded relative to page milestones
- **Resource prioritization**: Reflects browser's actual loading strategy
- **Accurate offline assets**: Measures what's actually cached, not estimates

## Artifacts

The workflow uploads the following artifacts for debugging:

- `bundle-size-report.json`: Current branch measurements
- `bundle-size-report-base.json`: Base branch measurements
- `bundle-size-comment.md`: Generated PR comment
