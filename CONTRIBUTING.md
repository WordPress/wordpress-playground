# Contributing to WordPress Playground

Thanks for your interest in contributing to WordPress Playground. This project
welcomes contributions to code, documentation, triage, translations, examples,
and testing.

## Start here

- Read the general contribution guide:
  https://wordpress.github.io/wordpress-playground/contributing/
- For code contributions, see:
  https://wordpress.github.io/wordpress-playground/docs/contributing/code
- For documentation contributions, see:
  https://wordpress.github.io/wordpress-playground/docs/contributing/documentation
- For triage, see:
  https://wordpress.github.io/wordpress-playground/contributing/#triaging-issues
- For translations, see:
  https://wordpress.github.io/wordpress-playground/contributing/translations
- For WordCamp Contributor Day, see:
  https://wordpress.github.io/wordpress-playground/contributing/contributor-day/

If you are unsure where to begin, look for issues labeled `Good First Issue` or
open a discussion before starting a larger change.

## Local development

Clone the repository and install dependencies:

```bash
git clone -b trunk --single-branch --depth 1 --recurse-submodules https://github.com/WordPress/wordpress-playground.git
cd wordpress-playground
npm install
```

Start the local development server:

```bash
npm run dev
```

The development server opens WordPress Playground at
http://127.0.0.1:5400/.

## Useful commands

```bash
# Build the documentation site
npm run build:docs

# Format changed files
npm run format:uncommitted

# Run lint checks
npm run lint

# Run tests
npm test

# Run type checks
npm run typecheck
```

Run the checks that are relevant to your change. Documentation-only changes
usually need the documentation build and formatting checks, while code changes
may require linting, tests, and type checks.

## Pull requests

Before opening a pull request:

1. Keep the change focused on one issue or improvement.
2. Include a clear summary of what changed and why.
3. Link the related issue when one exists.
4. Mention which checks you ran.

For larger changes, open an issue or discussion first so maintainers can help
shape the approach before implementation.

## Community expectations

WordPress Playground is part of the WordPress open source project. Contributors
are expected to follow the WordPress community code of conduct:
https://make.wordpress.org/handbook/community-code-of-conduct/
