---
slug: /contributing/github-ui
title: Contribute with the GitHub web interface
description: Learn how to edit Playground documentation directly on GitHub without setting up a local development environment.
---

# Contribute with the GitHub web interface

You can improve Playground documentation directly on GitHub. This is useful for typo fixes, small clarifications, and translation updates when you do not want to clone the repository or set up a local development environment.

Before you start, sign in to GitHub and identify the documentation page you want to change.

## When to use this workflow

The GitHub web interface is a good fit for:

- Fixing typos.
- Clarifying a sentence or paragraph.
- Updating links.
- Improving an existing translation.
- Adding a short documentation page.

For larger changes, updates that need local preview, or changes that affect code, use the local workflow in [Documentation contributions](/contributing/documentation) or [Code contributions](/contributing/code).

## Find the documentation file

Most English documentation pages live in the [`packages/docs/site/docs`](https://github.com/WordPress/wordpress-playground/tree/trunk/packages/docs/site/docs) directory.

Translated documentation lives in [`packages/docs/site/i18n`](https://github.com/WordPress/wordpress-playground/tree/trunk/packages/docs/site/i18n). For more details about translation file paths, see [Contributions to translations](/contributing/translations).

For existing pages, the fastest way to find the source file is from the documentation site:

1. Open the documentation page you want to update.
2. Select the **Edit this page** link near the bottom of the page.
3. GitHub opens the source file for that page.

You can also browse the repository directly:

1. Open the [WordPress Playground repository](https://github.com/WordPress/wordpress-playground).
2. Browse to the relevant documentation directory.
3. Select the file that matches the page you want to update.

The screenshots below use translation files as examples, but the same GitHub controls apply to English documentation files.

## Edit an existing page

1. Open the file in GitHub.
2. Select the pencil icon to edit the file.
3. If GitHub asks you to fork the repository, follow the prompt. This creates a copy under your GitHub account.
4. Make your changes in the editor.

![Editing a documentation file in GitHub](/img/contributing/editing-translations.webp)

GitHub's web editor is best for small, focused changes. If your update is large or needs local preview, use the local workflow in [Documentation contributions](/contributing/documentation).

## Add a new page

1. Open the directory where the new page should live.
2. Select **Add file** and then **Create new file**.
3. Enter the file name. You can create folders by typing the folder name followed by `/`.
4. Add the page content.
5. Mention where the page should appear in the documentation sidebar when you open the pull request.
   If you are comfortable editing another file, you can also add the page to
   [`packages/docs/site/sidebars.js`](https://github.com/WordPress/wordpress-playground/blob/trunk/packages/docs/site/sidebars.js).

![Creating a new documentation file in GitHub](/img/contributing/adding-file-github-ui.webp)

For new English documentation pages, add front matter at the top of the file:

```markdown
---
slug: /example-page
title: Example page
description: A short description of the page.
---
```

For new translated pages, mirror the English file path in the matching language directory. For example,
a French translation of `packages/docs/site/docs/main/contributing/documentation.md` belongs in
`packages/docs/site/i18n/fr/docusaurus-plugin-content-docs/current/main/contributing/documentation.md`.
Keep the original English content in a comment above the translation so reviewers can compare the text.

## Review your changes

Before submitting, use the **Preview** tab in GitHub to check basic Markdown formatting. This is not
a full Docusaurus preview, so also review links and images carefully. Site-relative paths such as
`/img/contributing/example.webp` may not behave the same way in GitHub's Markdown preview.

![Editing content in the GitHub web editor](/img/contributing/editor-github-ui.webp)

Look for:

- Headings in the right order.
- Working links.
- Lists and code blocks that render correctly.
- A focused change that is easy to review.

## Propose the change

1. Scroll to the **Commit changes** section.
2. Add a short commit message, such as `Fix typo in documentation guide`.
3. Add a short description if the change needs context.
4. Select the option to create a new branch for the commit.
5. Select **Propose changes**.
6. On the next page, select **Create pull request**.

## What happens next

A maintainer will review your pull request. They may ask for changes before merging it.

If you are contributing translations, you can also request a review in the `#polyglots` or `#playground` channel in [Make WordPress Slack](https://make.wordpress.org/chat/).
