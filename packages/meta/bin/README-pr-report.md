# Pull Request Report Generator

A tool to generate reports of completed Pull Requests from the WordPress Playground repository, grouped by feature categories.

## Features

- Fetches merged PRs from GitHub API within specified date ranges
- Categorizes PRs into predefined feature groups: **[CLI]**, **[Website]**, **[XDebug]**, **[Blueprints]**, **[Docs]**, **[i18n]**
- Generates markdown reports with PR details, authors, and merge dates
- Provides summary statistics

## Usage

### Prerequisites

You need a GitHub Personal Access Token to use this tool:

1. Go to GitHub Settings > Developer settings > Personal access tokens
2. Generate a new token with `repo` scope (to read public repositories)
3. Set the token as an environment variable:

```bash
export GITHUB_TOKEN=your_github_token_here
```

### Command Line Usage

#### Using the shell wrapper (recommended):

```bash
# Generate report for default date range (Sep 19-26, 2025)
./packages/meta/bin/generate-pr-report.sh

# Generate report for custom date range
./packages/meta/bin/generate-pr-report.sh 2025-09-01 2025-09-30

# Generate report with custom output file
./packages/meta/bin/generate-pr-report.sh 2025-09-19 2025-09-26 my-report.md
```

#### Using the TypeScript script directly:

```bash
# Basic usage
npx tsx packages/meta/bin/pr-report.ts --from=2025-09-19 --to=2025-09-26 --token=$GITHUB_TOKEN

# Save to file
npx tsx packages/meta/bin/pr-report.ts --from=2025-09-19 --to=2025-09-26 --outfile=report.md --token=$GITHUB_TOKEN

# Output to console only
npx tsx packages/meta/bin/pr-report.ts --from=2025-09-19 --to=2025-09-26
```

### Parameters

- `--from`: Start date (YYYY-MM-DD format)
- `--to`: End date (YYYY-MM-DD format)
- `--token`: GitHub personal access token (or use GITHUB_TOKEN env var)
- `--outfile`: Output file path (optional, prints to console if not specified)

## Feature Categories

The tool categorizes PRs based on titles and labels using the following priority order:

1. **[i18n]** - Internationalization and translations
   - Keywords: `i18n`, `translation`, `japanese`, `portuguese`, `gujarati`, `french`, etc.

2. **[XDebug]** - XDebug debugging features
   - Keywords: `xdebug`, `x-debug`, `xdebug bridge`

3. **[Blueprints]** - Blueprint functionality
   - Keywords: `blueprint`, `blueprints`, blueprint-related packages

4. **[Docs]** - Documentation
   - Keywords: `documentation`, `docs`, `readme`, `guide`, `tutorial`

5. **[CLI]** - Command Line Interface
   - Keywords: `cli`, `playground cli`, `wp-now`, CLI-related packages

6. **[Website]** - Website and UI
   - Keywords: `website`, `ui`, `ux`, `frontend`, website-related packages

PRs that don't match any category are listed under **Other**.

## Example Output

```markdown
# Pull Request Report

**Date Range:** 2025-09-19 to 2025-09-26
**Total PRs:** 25

## [CLI] (3 PRs)

- [i18n] Add Japanese translations to Playground CLI ([#2683](https://github.com/WordPress/wordpress-playground/pull/2683)) by @shimotmk - 9/26/2025
- Playground CLI: Log unhandled rejections and stop them from crashing workers ([#2682](https://github.com/WordPress/wordpress-playground/pull/2682)) by @brandonpayton - 9/25/2025

## [Website] (4 PRs)

- [Website] Disable curl_share_init by default ([#2679](https://github.com/WordPress/wordpress-playground/pull/2679)) by @adamziel - 9/24/2025

## [i18n] (7 PRs)

- [i18n] Add Japanese translations to Playground CLI ([#2683](https://github.com/WordPress/wordpress-playground/pull/2683)) by @shimotmk - 9/26/2025
- [i18n] Add French translation for resources.md ([#2680](https://github.com/WordPress/wordpress-playground/pull/2680)) by @beryl-dlg - 9/26/2025

...
```

## Testing

You can test the categorization logic using the test version:

```bash
npx tsx packages/meta/bin/pr-report-test.ts
```

This runs with sample data and doesn't require a GitHub token.

## Implementation Details

- Uses GitHub REST API to fetch merged PRs
- Filters PRs by merge date within the specified range
- Implements priority-based categorization to handle overlapping keywords
- Generates markdown-formatted reports suitable for documentation or sharing

## Troubleshooting

### "GitHub token is required" error
Make sure you have set the `GITHUB_TOKEN` environment variable or pass it via `--token` flag.

### Rate limiting
If you hit GitHub API rate limits, wait a few minutes or use a token with higher rate limits.

### No PRs found
Check that:
- Date range is correct (YYYY-MM-DD format)
- There were actually merged PRs in that date range
- Your token has access to the repository

## Contributing

To modify the categorization logic, edit the `getFeatureCategory()` function in `pr-report.ts`. The priority order and keywords can be adjusted as needed.