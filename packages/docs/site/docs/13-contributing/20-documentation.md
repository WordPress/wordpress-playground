# Contributing Documentation

WordPress Playground is documented by volunteers and we welcome your contributions.

The [documentation tracking issue](https://github.com/WordPress/wordpress-playground/issues/772) contains a list of all documentation-related issues. It’s a good starting point to see what’s missing and what’s already there.

Anything that you were missing when exploring Playground for the first time is a great addition to the documentation, even if it requires a fundamental change in how the documentation speaks to the user.

## How can I contribute?

### I am not familiar with Markdown

If you are not familiar with Markdown, you can contribute by [opening an issue in the project repository](https://github.com/WordPress/wordpress-playground/issues/new) and describing what you would like to see added or changed.

You could even write the content in the issue description and the project contributors will take care of the rest.

### I am familiar with Markdown

If you are familiar with [Markdown](https://www.markdownguide.org/), you can directly propose changes and new documentation pages by submitting a Pull Request. If you're not familiar with Pull Requests, read the [Collaborating with pull requests](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests) guide first.

The existing documentation lives in the GitHub repository as Markdown files:

https://github.com/WordPress/wordpress-playground/tree/trunk/packages/docs/site/docs

Then, the documentation site is published here:

https://wordpress.github.io/wordpress-playground

Some pages are written in [MDX](https://mdxjs.com/), which is Markdown with JSX. If you are not familiar with MDX, don't worry at all – you can still contribute to these pages by editing just the Markdown part.

### Your first Pull Request

#### An easy way to start

Here's an easy way to start your first Pull Request:

1. Go to https://github.com/WordPress/wordpress-playground/tree/trunk/packages/docs/site/docs
2. Find the page you'd like to edit or a directory where you'd like to add a new page
3. Click the "Add Files" button to add a new file, or click on an existing file and then click the pencil icon to edit it
4. GitHub will ask you to fork the repository and create a new branch for your changes – do that
5. An editor will open where you can make your changes
6. When you're done, click the Commit Changes button and start a Pull Request

That's it! You've just contributed to the WordPress Playground documentation.

The upside of this approach is that you don't need to clone the repository, set up a local development environment, or run any commands. You can edit the documentation directly in your browser.

The downside is that you won't be able to preview your changes on the documentation site. Previewing is not critical and you can be a successful contributor without it, but if you'd still like to see your changes before submitting a Pull Request, follow the instructions below.

#### A more difficult way with a preview

If you'd like to a preview of your changes, you'll need to clone the repository and run the following commands:

```bash
npm install -g nx
npm install
nx dev docs-site
```

This will start a local server where you can preview your changes. From there, you can edit the documentation files
in your code editor and see the changes in real-time.

## What to contribute?

See the [documentation tracking issue](https://github.com/WordPress/wordpress-playground/issues/772) for an up to date list of specific tasks and documentation pages that need to be written.

## General guidelines

-   Document any limitations you run into at https://wordpress.github.io/wordpress-playground/limitations/
-   The documentation structure needs brushing up, you are welcome to move pages around and propose new structures
-   Use simple language and avoid jargon
