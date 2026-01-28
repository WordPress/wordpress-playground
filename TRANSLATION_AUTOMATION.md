# Translation Progress Automation

This document describes the automated translation progress tracking system for WordPress Playground documentation.

## Overview

The repository automatically tracks translation progress across all supported languages. When translation files are added or modified, a GitHub Action automatically updates tracking issues with current progress.

## How It Works

1. **Source Scanning**: The system scans all markdown files in `packages/docs/site/docs/`
2. **Translation Detection**: For each locale, it checks which files exist in `packages/docs/site/i18n/{locale}/docusaurus-plugin-content-docs/current/`
3. **Issue Updates**: It generates a formatted issue body with:
   - Overall progress percentage
   - Collapsible sections for Main, Blueprints, and Developers documentation
   - Checkboxes marking completed vs. pending translations
4. **Automatic Updates**: The tracking issues are updated via GitHub API

## Supported Languages

Currently tracking:
- Bengali (bn) - [Issue #3186](https://github.com/WordPress/wordpress-playground/issues/3186)
- French (fr) - [Issue #2621](https://github.com/WordPress/wordpress-playground/issues/2621)
- Tagalog (tl) - [Issue #2353](https://github.com/WordPress/wordpress-playground/issues/2353)
- Brazilian Portuguese (pt-BR) - [Issue #2306](https://github.com/WordPress/wordpress-playground/issues/2306)
- Gujarati (gu) - [Issue #2320](https://github.com/WordPress/wordpress-playground/issues/2320)

## When It Runs

The automation runs:
- **On push to trunk**: When translation files or source docs are modified
- **Daily at 00:00 UTC**: Ensures tracking stays up-to-date
- **Manual trigger**: Via GitHub Actions workflow_dispatch

## Adding a New Language

To add a new language to the automated tracking:

1. Create a tracking issue for your language
2. Add the locale to `packages/docs/site/docusaurus.config.js`:
   ```js
   locales: ['en', 'bn', 'es', 'fr', 'gu', 'ja', 'pt-br', 'tl', 'your-locale'],
   localeConfigs: {
     'your-locale': {
       label: 'Your Language Name',
       path: 'your-locale',
     },
   }
   ```
3. Add the locale and issue number to `.github/scripts/update-translation-trackers.js`:
   ```js
   const TRACKER_ISSUES = {
     'your-locale': 1234,  // Your issue number
     // ... other locales
   };
   ```
4. Add the display name to the `getLocaleDisplayName()` function in the same file

## Files

- **Workflow**: `.github/workflows/update-translation-progress.yml`
- **Script**: `.github/scripts/update-translation-trackers.js`
- **Documentation**: `packages/docs/site/docs/main/contributing/translations.md`

## Manual Execution

To run the script manually:

```bash
GITHUB_TOKEN=your_token node .github/scripts/update-translation-trackers.js
```

## Benefits

- **No manual updates**: Contributors don't need to manually update checklists
- **Consistent format**: All tracking issues follow the same structure
- **Real-time progress**: Always shows current state of translations
- **Reduced maintenance**: Less work for maintainers
- **Better visibility**: Clear progress metrics for all languages
