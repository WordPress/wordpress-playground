---
slug: /playground-ecosystem
---

# About the WordPress Playground

Thank you for your interest in the ecosystem and welcome to the Playground!

## Official Documentation
[WordPress Playground Official Documentation](https://wordpress.github.io/wordpress-playground/)
- [WordPress Playground](https://github.com/WordPress/wordpress-playground/) — you are here
- [Playground Tools](https://github.com/WordPress/playground-tools/) — utilities and software for the Playground
- [Blueprints Library](https://github.com/WordPress/blueprints-library/) — active development around creating and parsing blueprints
- [The Blueprints Community Gallery](https://github.com/WordPress/blueprints/) — a collaborative space to create and share blueprints

Join discussions, report bugs and discover solutions, and share your knowledge with the community.

## Contributing to the WordPress Playground
WordPress Playground is an open-source project and welcomes all contributors from code to design, and from documentation to triage. If the feature you need is missing, you are more than welcome to start a discussion, open an issue, and even propose a Pull Request to implement it.

### Quick Start Guide 

Code contributions – see the [developer](https://wordpress.github.io/wordpress-playground/docs/contributing/code) section.
Documentation – see the [documentation](https://wordpress.github.io/wordpress-playground/docs/contributing/documentation) section.
Triage – see the [triage](https://wordpress.github.io/wordpress-playground/docs/contributing/publishing) section.
Reporting bugs – open an [issue](https://github.com/WordPress/wordpress-playground/issues/new) in the repository.
Ideas, designs or anything else – open a [discussion](https://github.com/WordPress/wordpress-playground/discussions) and let's talk!

## Playground Tools

A [repository](https://github.com/WordPress/playground-tools) containing the tools and applications for the Playground.
- [Sandbox by WordPress Playground](https://github.com/WordPress/playground-tools/blob/trunk/packages/playground) — a plugin for working with Playgrounds
- [Playground Block](https://github.com/WordPress/playground-tools/blob/trunk/packages/wordpress-playground-block) — embed a Playground instance on a website
- [VS Code Extension](https://github.com/WordPress/playground-tools/blob/trunk/packages/vscode-extension) — start WordPress from within VS Code
- [wp-now](https://github.com/WordPress/playground-tools/blob/trunk/packages/wp-now) — node-based tool for creating WordPress installations

---

## Sandbox by WordPress Playground
After installing the plugin (available in the [Plugin Directory](https://wordpress.org/plugins/playground)), you can:
* create a copy of your site WordPress Playground instance
* test plugins without having to install them on your site
* export snapshots of your instance to share, back-up or for version control
* ...more features coming soon

Your site is cloned in Playground by copying all the files and a database into a new WordPress Playground instance. 

It may sound scary, but your data stays safely with you and is **not** uploaded to any cloud service. Instead, your site's data is shipped directly to your web browser where it stays only as long as you keep your browser tab open. That’s right! WordPress Playground runs a copy of your site directly on your device.

View the [code](https://github.com/WordPress/playground-tools/tree/trunk/packages/playground) for the Sandbox, or find more information in the [Playground Tools](https://github.com/WordPress/playground-tools) repository.

We encourage [contributions](https://github.com/WordPress/playground-tools/blob/trunk/CONTRIBUTING.md) and hope to see this package grow with the community.

---

## Playground block
A [plugin](https://wordpress.org/plugins/interactive-code-block/) that allows you to add a Playground block to your WordPress site.

- embed a Playground instance in posts and pages
- use WordPress as a service in the browser.
- drop in an interactive code editor to teach how to build WordPress plugins
- showcase demos
- and test things out - you site is completely safe 

Whatever you can do with WordPress you can do in the embedded Playground block.

---

## VS Code Extension

Create a [zero-setup WordPress development environment](https://wordpress.github.io/wordpress-playground/local-development/vscode-extension).

After installing the extension (available in the [official marketplace](https://marketplace.visualstudio.com/items?itemName=WordPressPlayground.wordpress-playground)), click the **WordPress Playground** icon in the **Activity Bar**, and you can start a local server from your IDE.

The VS Code extension runs `wp-now` behind the scenes to create virtualized sites, and is in development.

There are limitations, most specifically that you can not use blueprints.

---

## `wp-now` 

Node-based CLI tool to spin up a [local WordPress development environments](https://wordpress.github.io/wordpress-playground/local-development/wp-now) with a single command.

Install `wp-now` via [NPM](https://www.npmjs.com/package/@wp-now/wp-now) to develop, run or test plugins, themes, and fully functional WordPress sites from your terminal. 

Load up blueprints to perform actions while booting and creating a new WordPress installation, edit the file system via your preferred code editor, or perform media operations. You have a fully functioning WordPress website without needing to worry about running a server.

---

## The Blueprints Community Gallery

A [collection](https://github.com/WordPress/blueprints) of curated WordPress setup scripts: Blueprints
- [Browse the Blueprints Gallery](https://github.com/WordPress/blueprints/blob/trunk/GALLERY.md) to explore various WordPress sites and different configurations.
- [Submit your own Blueprint](https://github.com/WordPress/blueprints/blob/trunk/CONTRIBUTING.md) and share your WordPress setup with the community.
- [Take the Blueprints 101 crash course](https://github.com/WordPress/blueprints/blob/trunk/docs/index.md)

Learn more about Blueprints in the [documentation](https://wordpress.github.io/wordpress-playground/blueprints-api/index).

---

## Blueprints Library
A [software library](https://github.com/WordPress/blueprints/) to work with Blueprints.

Currently the Blueprints Library is in [v1](https://github.com/WordPress/blueprints-library) which is written in `TypeScript`, but [v2](https://github.com/WordPress/blueprints/issues/6) will be `PHP` based.

#### API documentation
- [Blueprints API](https://wordpress.github.io/wordpress-playground/blueprints-api/index) — create a Playground instance from a JSON file
- [Query API](https://wordpress.github.io/wordpress-playground/query-api) — create Playgrounds via URL query parameters
- [JavaScript API](https://wordpress.github.io/wordpress-playground/javascript-api/index) — JavaScript client that grants you full control over your instance

Eventually the library will be a robust and useful tool for managing Playgrounds, and merged into WordPress Core.