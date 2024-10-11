## Plan

The initial plan is to build a tool to export and import a single WordPress post.
Yes! Just one post. The tricky part is that all the links, media files, post meta,
etc. must be preserved. This is closely related to WXR exporters, so let's keep
these codebases open on our screens as we work on this project.

### Design goals

-   Build re-entrant data tools that can start, stop, resume, tolerate errors, accept alternative media files, posts etc. from the user.
-   WordPress-first – let's build everything in PHP using WordPress naming conventions.
-   Compatibility – Every WordPress version, PHP version (7.2+, CLI), and Playground runtime (web, CLI, browser extension, desktop app, CI etc.) should be supported.
-   Dependency-free – No PHP extensions required. If this means we can't rely on cUrl, then let's build an HTTP client from scratch. Only minimal Composer dependencies allowed, and only when absolutely necessary.
-   Simple – no advanced OOP patterns. Our role model is [WP_HTML_Processor](https://developer.wordpress.org/reference/classes/wp_html_processor/) – a **single class** that can parse nearly all HTML. There's no "Node", "Element", "Attribute" classes etc. Let's aim for the same here.
-   Extensibility – Playground should be able to benefit from, say, WASM markdown parser even if core WordPress cannot.
-   Reusability – Each library should be framework-agnostic and usable outside of WordPress. We should be able to use them in non-WordPress tools like https://github.com/adamziel/playground-content-converters.

### Prior art

Here's a few codebases we'll need to review and bring into this project:

-   URL rewriter: https://github.com/adamziel/site-transfer-protocol
-   URL detector : https://github.com/WordPress/wordpress-develop/pull/7450
-   WXR rewriter: https://github.com/adamziel/wxr-normalize/
-   Stream Chain: https://github.com/adamziel/wxr-normalize/pull/1
-   Unicode-aware comprehensive sluggify(): https://github.com/WordPress/wordpress-develop/pull/5466
-   Doodlings on how a Core URL parser could look: https://github.com/WordPress/wordpress-develop/pull/6666
-   XML parser: https://github.com/WordPress/wordpress-develop/pull/6713
-   Streaming PHP parsers: https://github.com/WordPress/blueprints-library/tree/trunk/src/WordPress
-   Zip64 support (in JS ZIP parser): https://github.com/WordPress/wordpress-playground/pull/1799
-   Local Zip file reader in PHP (seeks to central directory, seeks back as needed): https://github.com/adamziel/wxr-normalize/blob/rewrite-remote-xml/zip-stream-reader-local.php

### Related resources

-   Site transfer protocol: https://core.trac.wordpress.org/ticket/60375
-   Solving rewriting site URLs in WordPress using the HTML API and URL parser: https://github.com/WordPress/data-liberation/discussions/74
-   WordPress for docs (importing architecture): https://github.com/WordPress/wordpress-playground/discussions/1524
-   Collaborative editing in Gutenberg: https://github.com/WordPress/gutenberg/discussions/65012

### Repository structure

The structure of this project is an open exploration and will change multiple times.

It consists of the following parts:

-   First-party libraries, e.g. streaming parsers
-   WordPress plugins where those libraries are used, e.g. content importers
-   Third party libraries installed via Composer, e.g. a URL parser

**Structural goals:**

-   Publish each library as a separate Composer package
-   Publish each WordPress plugin separately (perhaps a single plugin would be the most useful?)
-   No duplication of libraries between WordPress plugins
-   Easy installation in Playground via Blueprints, e.g. no `composer install` required
-   Compatibility with different Playground runtimes (web, CLI) and versions of WordPress and PHP

**Ideas:**

-   Use Composer dependency graph to automatically resolve dependencies between libraries and WordPress plugins
-   or use WordPress "required plugins" feature to manage dependencies
-   or use Blueprints to manage dependencies
