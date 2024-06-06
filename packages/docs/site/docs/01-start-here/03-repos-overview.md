# WordPress Playground ecosystem

The various tools that make up the Playground project are managed in a few separate GitHub repositories:
- [WordPress Playground](https://github.com/WordPress/wordpress-playground/) — you are here
- [Playground Tools](https://github.com/WordPress/playground-tools/) — software built for, and with, the Playground
- [Blueprints Library](https://github.com/WordPress/blueprints-library/) — active development around creating and parsing blueprints
- [The Blueprints Community Gallery](https://github.com/WordPress/blueprints/) — a collaborative space to create and share blueprints

We encourage users to get familiar with the Playground ecosystem. 

Join discussions, report bugs, discover solutions to problems you run into, and share your knowledge with the community.

## WordPress Playground

The main repository contains the codebase for the Playground and browser-based [utilities and demos](https://wordpress.github.io/wordpress-playground/links-and-resources#apps-built-with-wordpress-playground). 

- [Blueprint Builder](https://playground.wordpress.net/builder/builder.html) — runtime for Blueprints in the browser ([source code](https://github.com/WordPress/wordpress-playground/tree/trunk/packages/playground/website/builder))
- [WordPress PR Previewer](https://playground.wordpress.net/wordpress.html) — test WordPress Core pull requests in the browser ([source code](https://github.com/WordPress/wordpress-playground/blob/trunk/packages/playground/website/public/wordpress.html))
- [Gutenberg PR Previewer](https://playground.wordpress.net/gutenberg.html) — test Gutenberg pull requests in the browser ([source code](https://github.com/WordPress/wordpress-playground/blob/trunk/packages/playground/website/public/gutenberg.html))
- [... and more](https://github.com/WordPress/wordpress-playground/)

Explore the [source code](https://github.com/WordPress/wordpress-playground/tree/trunk/packages/playground)  for Playground, join the [ discussions](https://github.com/WordPress/wordpress-playground/discussions), suggest improvements by opening [issues](https://github.com/WordPress/wordpress-playground/issues) (or help others by commenting on their questions), submit [PRs](https://github.com/WordPress/wordpress-playground/pulls) for bug fixes, [contribute](https://wordpress.github.io/wordpress-playground/contributing/index) to the documentation, and be a part of the community.

[Learn](https://wordpress.org/playground/) About the Playground
Explore the WordPress Playground [repository](https://github.com/WordPress/wordpress-playground/)

---

## [Playground Tools](https://github.com/WordPress/playground-tools/)
Tools and utilities for the Playground:

- [WordPress Playground Block](https://github.com/WordPress/playground-tools/blob/trunk/packages/wordpress-playground-block)
- [WordPress Playground plugin](https://github.com/WordPress/playground-tools/blob/trunk/packages/playground)
- [WordPress Playground for VS Code](https://github.com/WordPress/playground-tools/blob/trunk/packages/vscode-extension)
- [wp-now NPM package](https://github.com/WordPress/playground-tools/blob/trunk/packages/wp-now)

This repository is also the best place to search for issues related to `wp-now` or the `VS Code Extension` for WordPress Playground. If the request you are looking for is not specific to the online version of the Playground, it may be in the Playground Tools repository.

#### Tools that exist in the Playground Tools repository:

- [VS Code Extension](https://marketplace.visualstudio.com/items?itemName=WordPressPlayground.wordpress-playground) - Easily spin up WordPress instances in VS Code
- [`wp-now` ](https://www.npmjs.com/package/%40wp-now/wp-now)- a fully featured, extensible environment for WordPress development


- [Playground Block](https://wordpress.org/plugins/interactive-code-block/) - embed Playground via a block on your WordPress site
- [Interactive Code Block](https://wordpress.org/plugins/interactive-code-block/) - an interactive code editor to demonstrate and teach your readers how WordPress plugins are built.
- [Playground Plugin](https://wordpress.org/plugins/playground/) - Copy your site or test plugins easily


The list of Playground Tools continues to grow by the day, and we cannot wait to see what exciting tools are added next. Want to contribute? Swing on by the Playground Tools [repository](https://github.com/WordPress/playground-tools/) and see what you can do to help.

---

## [Blueprints Library](https://github.com/WordPress/blueprints-library)
A software library to work with Blueprints.

The Blueprints Library repository represents active development on parsing and creating blueprints, and will contain the `PHP` based [Blueprints v2](https://github.com/WordPress/wordpress-playground/issues/1025) - when development is complete.

Discussions can range from how blueprints work, to very technical information about the way Blueprints are processed by WordPress.

Eventually, the Blueprints Library will represent a robust and useful tool for managing Playgrounds, that will be merged into WordPress Core.

Please share your feedback: 
- Share your thoughts and ideas in the [Blueprints v2 Specification](https://github.com/WordPress/blueprints/issues/6) issue – or any other issue that interests you
- Start new discussions
- Propose changes through comments and pull requests

Explore the Blueprints Library [repository](https://github.com/WordPress/blueprints-library)

---

## [Blueprints Community](https://github.com/adamziel/blueprints)
The Blueprints Community Gallery is a place for users to share their blueprints with others, find inspiration, gain recognition, learn, and improve on what can be done with the WordPress Playground.

Each blueprint contains a set of instructions for setting up a specific type of WordPress site, along with the necessary configuration files. We would very much value your blueprint submission!

#### Contribute a blueprint
There's a very simple contribution flow to adding your own blueprint, the [Blueprints Crash Course](https://github.com/adamziel/blueprints/blob/blueprints-crash-course/docs/index.md), and of course the [Blueprints Gallery](https://github.com/adamziel/blueprints/blob/blueprints-crash-course/GALLERY.md) to check out for ideas. Readers are encouraged to [Submit a Blueprint](https://github.com/adamziel/blueprints/blob/blueprints-crash-course/CONTRIBUTING.md) to the Gallery, and to share their thoughts with the Blueprints Community.

Submitting Issues with Blueprints is perfectly acceptable here, unless it seems more pertinent to submit the blueprint to one of the other repositories. For instance, if you're using one of the Playground Tools or seeing a general error with the Playground, the other repositories may be better suited to raise the issue. 

[Join the Blueprints Community](https://github.com/adamziel/blueprints)

---

## Official repo
[WordPress Playground on Docusaurus](https://wordpress.github.io/wordpress-playground/)

### API Documentation
- [Blueprints API](https://wordpress.github.io/wordpress-playground/blueprints-api/index)
- [Query API](https://wordpress.github.io/wordpress-playground/query-api)
- [JavaScript API](https://wordpress.github.io/wordpress-playground/javascript-api/index)

As well as other useful information about the project.

All docs are works in progress, and we welcome contributions.

If you have any questions or suggestions, please open an issue or submit a pull request.