# Documentation contributions

[WordPress Playground's documentation site](https://wordpress.github.io/wordpress-playground) is maintained by volunteers like you, who'd love your help.

All [documentation-related topics](https://github.com/WordPress/wordpress-playground/labels/%5BType%5D%20Documentation) are labeled `documentation`. Browse the list of open issues to find one you'd like to work on. Alternatively, if you believe something is missing from the current documentation, open an issue to discuss your suggestion.

## How can I contribute?

You can contribute by [opening an issue in the project repository](https://github.com/WordPress/wordpress-playground/issues/new) and describing what you'd like to add or change.

If you feel up to it, write the content in the issue description, and the project contributors will take care of the rest.

### I'm familiar with markdown and GitHub

If you are familiar with markdown, you can propose changes and new documentation pages by submitting a Pull Request.

The documentation is stored in Playground's GitHub repository, [under `/packages/docs/site/docs`](https://github.com/WordPress/wordpress-playground/tree/trunk/packages/docs/site/docs).

## Edit in the browser

1. Find the page you'd like to edit or the directory of the chapter you'd like to add a new page to.
2. Click the **Add Files** button to add a new file, or click on an existing file and then click the pencil icon to edit it.
3. GitHub will ask you to fork the repository and create a new branch with your changes.
4. An editor will open where you can make the changes.
5. When you're done, click the **Commit Changes** button and submit a Pull Request.

That's it! You've just contributed to the WordPress Playground documentation.

This approach means you don't need to clone the repository, set up a local development environment, or run any commands.

The downside is that you won't be able to preview your changes. Keep reading to learn how to review your changes before submitting a Pull Request.

### Local preview

Clone the repository and navigate to the directory on your device. Now run the following commands:

```bash
npm install
npm run build:docs
npm run dev:docs
```

The documentation site opens in a new browser tab and refreshes automatically with each change. Continue to edit the relevant file in your code editor and test the changes in real-time.
