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



## Step-by-step: Editing documentation via the GitHub UI

This guide walks you through editing a documentation page directly on GitHub — 
no local setup or command line needed. It's perfect for fixing typos, improving 
explanations, or adding missing information.

### Before you start

- Make sure you have a [GitHub account](https://github.com/signup). It's free!
- You must be logged in to GitHub.

### 1. Find the file you want to edit

Browse to `packages/docs/site/docs/` in the repository and find the `.md` file 
for the documentation page you want to edit.

### 2. Open the editor

Click on the file, then click the **pencil icon (✏️)** in the top-right corner. 
This opens GitHub's built-in web editor.

### 3. Make your changes

Edit directly in the browser. Use the **Preview** tab to check how it looks.

### 4. Commit your changes

Scroll down to **"Commit changes"** and:
1. Write a short commit message (e.g. `Fix typo in quick-start guide`)
2. Select **"Create a new branch for this commit and start a pull request"**
3. Name your branch (e.g. `docs/fix-typo-quickstart`)
4. Click **"Propose changes"**

### 5. Open a Pull Request

1. Give your PR a clear title
2. Explain what you changed and why
3. Reference the issue: `Fixes #2540`
4. Click **"Create pull request"**

A maintainer will review your contribution. Thank you for contributing! 🎉

