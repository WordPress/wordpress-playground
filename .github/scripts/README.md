# GitHub Actions Scripts

This directory contains scripts used by GitHub Actions workflows.

## update-translation-trackers.js

Automatically updates translation progress tracker issues with the current state of translations.

### How it works

1. Scans all source documentation files in `packages/docs/site/docs/`
2. For each configured locale, checks which files have been translated in `packages/docs/site/i18n/{locale}/`
3. Generates a formatted issue body with checkboxes showing completion status
4. Updates the corresponding GitHub issue via the GitHub API

### Configuration

The script tracks progress for the following locales:

- Bengali (bn) - Issue #3186
- French (fr) - Issue #2621
- Tagalog (tl) - Issue #2353
- Brazilian Portuguese (pt-BR) - Issue #2306
- Gujarati (gu) - Issue #2320

To add a new locale, add it to the `TRACKER_ISSUES` object in the script and create a corresponding tracking issue.

### Running manually

```bash
# Requires GITHUB_TOKEN environment variable
GITHUB_TOKEN=your_token node .github/scripts/update-translation-trackers.js
```

### Triggered by

The script is run by the `update-translation-progress.yml` workflow, which is triggered:
- When translation files are added/modified in `packages/docs/site/i18n/`
- When source documentation files are modified
- Daily at 00:00 UTC
- Manually via workflow dispatch
