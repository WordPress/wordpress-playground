---
slug: /contributing/documentation
title: Documentation Contributions
description: A guide on how to contribute to the Playground documentation, from opening issues to submitting pull requests.
---

# Documentation contributions

[WordPress Playground's documentation site](/) is maintained by volunteers like you, who'd love your help.

All documentation-related issues are labeled [`[Type] Documentation`](https://github.com/WordPress/wordpress-playground/issues?q=is%3Aissue%20state%3Aopen%20label%3A%22%5BType%5D%20Documentation%22) or [`[Type] Developer Documentation`](https://github.com/WordPress/wordpress-playground/issues?q=is%3Aissue%20state%3Aopen%20label%3A%22%5BType%5D%20Developer%20Documentation%22) in the [WordPress/wordpress-playground](https://github.com/WordPress/wordpress-playground) repository. Browse the list of open issues to find one you'd like to work on. Alternatively, if you believe something is missing from the current documentation, open an issue to discuss your suggestion.

## How can I contribute?

You can contribute by [opening an issue in the project repository](https://github.com/WordPress/wordpress-playground/issues/new) and describing what you'd like to add or change.

If you feel up to it, write the content in the issue description, and the project contributors will take care of the rest.

Would you like to see the documentation in your language? Check the [Translation section](/contributing/translations).

If you want to make a small documentation change without setting up a local development environment, see [Contribute with the GitHub web interface](/contributing/github-ui).

### Forking the repo, edit files locally and opening Pull Requests

If you are familiar with markdown, you can [fork](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/working-with-forks/fork-a-repo) the `wordpress-playground` repo and propose changes and new documentation pages by submitting a Pull Request.

The process of creating a branch to open new PRs with translated pages on the [WordPress/wordpress-playground](https://github.com/WordPress/wordpress-playground) repository is the same as contributing to other WordPress repositories such as Gutenberg:
https://developer.wordpress.org/block-editor/contributors/code/git-workflow/

The documentation files (`.md` files) are stored in Playground's GitHub repository, [under `/packages/docs/site/docs`](https://github.com/WordPress/wordpress-playground/tree/trunk/packages/docs/site/docs) for English and [`/packages/docs/site/i18n`](https://github.com/WordPress/wordpress-playground/tree/trunk/packages/docs/site/i18n) for other languages.

### Edit in the browser

You can edit existing files or add new documentation pages directly from the GitHub website. This approach does not require Git, a terminal, or a local development environment.

For the full step-by-step workflow, see [Contribute with the GitHub web interface](/contributing/github-ui).

### Local preview

Clone the repository and navigate to the directory on your device. Now run the following commands:

```bash
npm install
npm run build:docs
npm run dev:docs
```

The documentation site opens in a new browser tab and refreshes automatically with each change. Continue to edit the relevant file in your code editor and test the changes in real-time.

### Generated handbook manifest

The documentation build generates `manifest.json` alongside `translation-availability.json`
in `dist/docs/build`. Both use Docusaurus's `postBuild` hook and run only for the default
locale. The deployed manifest is available at
`https://wordpress.github.io/wordpress-playground/manifest.json`.

When adding a page, add its Markdown source and reference it in `sidebars.js`.
The manifest uses Docusaurus's resolved document titles and slugs, plus the sidebar
hierarchy and order. Removing or moving a page updates the manifest on the next build.
Drafts, unlisted pages, and pages marked `orphan: true` are excluded. A page missing
from the sidebar without one of these flags fails manifest generation.

The generator preserves existing handbook URLs that differ from Docusaurus routes,
and uses the generated Markdown versions of the Steps and Playground API Client pages.
The English redirect plugin uses the same entries. Changes to these exceptions belong
in `plugins/generate-handbook-manifest.js`.

The generated manifest uses absolute raw GitHub URLs for its Markdown sources so the
handbook importer can fetch them even though the JSON is hosted on GitHub Pages.
The committed `packages/docs/site/manifest.json` is retained for the existing importer
during migration. Switch the importer's manifest URL to the deployed endpoint above
before removing that legacy snapshot; builds do not update it.

To check the build plugins, run `npx nx run docs-site:test-plugins`.
