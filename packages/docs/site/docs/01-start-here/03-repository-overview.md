---
slug: /playground-ecosystem
---

# WordPress Playground ecosystem

The various tools that make up the Playground project are managed in a few separate GitHub repositories:
- [https://github.com/WordPress/wordpress-playground](https://github.com/WordPress/wordpress-playground/).
- [https://github.com/WordPress/playground-tools](https://github.com/WordPress/playground-tools/).
- [https://github.com/WordPress/blueprints](https://github.com/WordPress/blueprints).
- [https://github.com/WordPress/blueprints-library](https://github.com/WordPress/blueprints-library/).

By mapping where each part is, we hope to encourage you to get familiar with the codebase and understand how Playground is built. Visit the relevant repository to ask questions, report bugs, discover solutions to problems you run into, and share your knowledge with the community.

## WordPress Playground

The [main repository](https://github.com/WordPress/wordpress-playground) contains the core codebase and additional browser-based [utilities and demos](https://wordpress.github.io/wordpress-playground/links-and-resources#apps-built-with-wordpress-playground). Here are a few highlights:

- [Blueprint Builder](https://playground.wordpress.net/builder/builder.html): create and test Blueprints in the browser ([source code](https://github.com/WordPress/wordpress-playground/tree/trunk/packages/playground/website/builder)).
- [WordPress PR Previewer](https://playground.wordpress.net/wordpress.html): test pull requests submitted to WordPress core in the browser ([source code](https://github.com/WordPress/wordpress-playground/blob/trunk/packages/playground/website/public/wordpress.html)).
- [Gutenberg PR Previewer](https://playground.wordpress.net/gutenberg.html): test pull requests from the Gutenberg plugin in the browser ([source code](https://github.com/WordPress/wordpress-playground/blob/trunk/packages/playground/website/public/gutenberg.html)).

Explore the [source code for Playground](https://github.com/WordPress/wordpress-playground/tree/trunk/packages/playground), join [the discussions](https://github.com/WordPress/wordpress-playground/discussions), suggest improvements by opening [issues](https://github.com/WordPress/wordpress-playground/issues) (or help others by commenting on their questions), submit [PRs](https://github.com/WordPress/wordpress-playground/pulls) for bug fixes, contribute to the documentation, and be a part of the community.

## WordPress Playground tools

A [repository](https://github.com/WordPress/playground-tools) containing the tools and applications built using WordPress Playground:
* [WordPress Playground Block](https://github.com/WordPress/playground-tools/blob/trunk/packages/wordpress-playground-block)
* [WordPress Playground plugin](https://github.com/WordPress/playground-tools/blob/trunk/packages/playground)
* [WordPress Playground for VS Code](https://github.com/WordPress/playground-tools/blob/trunk/packages/vscode-extension)
* [wp-now NPM package](https://github.com/WordPress/playground-tools/blob/trunk/packages/wp-now)

Let's go over them briefly:

### WordPress Playground Block

A plugin that allows you to add a Playground block to your WordPress site.
After installing the plugin (available in the [Plugin Directory](https://wordpress.org/plugins/interactive-code-block/)), you can use the block to embed a Playground instance in posts and pages. You can also include an interactive code editor to demonstrate and teach others how to build WordPress plugins.

### WordPress Playground plugin

A plugin that allows you to clone your site and test plugins locally.
After installing the plugin (available in the [Plugin Directory](https://wordpress.org/plugins/playground)), you can:
* Create a copy of your site (including the database) in a private WordPress Playground instance—your data remains safe on your device.
* Test plugins available in the WordPress Plugin from the admin dashboard without installing them on your site.
⠀
### WordPress Playground for VS Code

An extension for Microsoft Visual Studio Code that creates a [zero-setup WordPress development environment](https://wordpress.github.io/wordpress-playground/local-development/vscode-extension).
After installing the extension (available in the [official marketplace](https://marketplace.visualstudio.com/items?itemName=WordPressPlayground.wordpress-playground)), click the **WordPress Playground** icon in the **Activity Bar**, and you can start a local server from your IDE.

### `wp-now` NPM package

This node-based CLI tool lets you spin up a [local WordPress development environment](https://wordpress.github.io/wordpress-playground/local-development/wp-now) or a test site with a single command.
After installing `@wp-now/wp-now` (available in the [NPM registry](https://www.npmjs.com/package/@wp-now/wp-now)), you can develop, run, or test plugins, themes, and fully functional WordPress sites from your terminal.

Visit the [playground-tools](https://github.com/WordPress/playground-tools/) repository to follow the ongoing development, submit issues, or contribute to the project.

## WordPress Blueprints Community Gallery

The [repository](https://github.com/WordPress/blueprints) features a collection of Blueprints: pre-configured WordPress setup scripts that you can run in your browser using Playground.
* [Browse the Blueprints Gallery](https://github.com/WordPress/blueprints/blob/trunk/GALLERY.md) to explore various WordPress sites and different configurations.
* [Submit your own Blueprint](https://github.com/WordPress/blueprints/blob/trunk/CONTRIBUTING.md) and share your WordPress setup with the community.

⠀Not sure what Blueprints are? Curious to understand how you can use them?
* [Learn more about Blueprints](https://wordpress.github.io/wordpress-playground/blueprints-api/index) here in the documentation.
* Check out the [Blueprints 101 crash course](https://github.com/WordPress/blueprints/blob/trunk/docs/index.md) over in the Blueprints Community Gallery.

## The Blueprints PHP library

This [repository](https://github.com/WordPress/blueprints-library) is where the Playground team explores ways to transition Blueprints from a TypeScript library to a PHP library. This would make Blueprints a platform-agnostic universal WordPress site setup tool that works in any environment: browser, Node.js, Docker, mobile, desktop, and hosting environments.

Follow the ongoing discussions about the proposed new specification, review the [roadmap](https://github.com/WordPress/blueprints-library/issues/84), check out [the experimental live demo](https://playground.wordpress.net/demos/php-blueprints.html), and consider contributing to help shape the next generation of Playground.
