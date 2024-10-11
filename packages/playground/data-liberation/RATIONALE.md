## Data Liberation

This project aims to help the Data Liberation project and unlock powerful new
use cases for WordPress.

### Wait, a PHP project inside a TypeScript monorepo?

Is this is a weird setup? Sure! But is it useful? YES!
This way PHP code can be easily developed and tested with all the
official WordPress Playground runtimes.

## Rationale

### Why work on data tools?

WordPress core _really_ needs reliable data migration tools. There's just no reliable, free, open source solution for:

-   Content import and export
-   Site import and export
-   Site transfer and bulk transfers, e.g. mass WordPress -> WordPress, or Tumblr -> WordPress
-   Site-to-site synchronization

Yes, there's the WXR content export. However, it won't help you backup a photography blog full of media files, plugins, API integrations, and custom tables. There are paid products out there, but nothing in core.

At the same time, so many Playground use-cases are **all about moving your data**. Exporting your site as a zip archive, migrating between hosts with the [Data Liberation browser extension](https://github.com/WordPress/try-wordpress/), creating interactive tutorials and showcasing beautiful sites using [the Playground block](https://wordpress.org/plugins/interactive-code-block/), previewing Pull Requests, building new themes, and [editing documentation](https://github.com/WordPress/wordpress-playground/discussions/1524) are just the tip of the iceberg.

### Why are there no existing data tools?

Moving data around seems easy, but it's a complex problem – consider migrating links.

Imagine you're moving a site from [https://my-old-site.com](https://playground-site-1.com) to [https://my-new-site.com/blog/](https://my-site-2.com). If you just moved the posts, all the links would still point to the old domain so you'll need an importer that can adjust all the URLs in your entire database. However, the typical tools like `preg_replace` or `wp search_replace` can only replace some URLs correctly. They won't reliably adjust deeply encoded data, such as this URL inside JSON inside an HTML comment inside a WXR export:

The only way to perform a reliable replacement here is to carefully parse each and every data format and replace the relevant parts of the URL at the bottom of it. That requires four parsers: an XML parser, an HTML parser, a JSON parser, a WHATWG URL parser. Most of those tools don't exist in PHP. PHP provides `json_encode()`, which isn't free of issues, and that's it. You can't even rely on DOMDocument to parse XML because of its limited availability and non-streaming nature.

### Why build it in Playground?

Playground gives us a lot for free:

-   **Customer-centric environment.** The need to move data around is so natural in Playground. So many people asked for reliable WXR imports, site exports, synchronization with git, and the ability to share their Playground. Playground allows us to get active users and customer feedback every step of the way.
-   **Free QA**. Anyone can share a testing link and easily report any problems they found. Playground is the perfect environment to get ample, fast moving feedback.
-   **Space to mature the API**. Playground doesn’t provide the same backward compatibility guarantees as WordPress core. It's easy to prototype a parser, find a use case where our design breaks down, and start over.
-   **Control over the runtime.** Playground can lean on PHP extensions to validate our ideas, test them on a simulated slow hardware, and ship them to a tablet to see how they do when the app goes into background and the internet is flaky.

Playground enables methodically building spec-compliant software to create the solid foundation WordPress needs.

## The way there

### What needs to be built?

There's been a lot of [gathering information, ideas, and tools](https://core.trac.wordpress.org/ticket/60375). This section is based on 10 years worth of site transfer problems, WordPress synchronization plugins, chats with developers, existing codebases, past attempts at data importing, non-WordPress tools, discussions, and more.

WordPress needs parsers. Not just any parsers, they must be streaming, re-entrant, fast, standard compliant, and tested using a large body of possible inputs. The data synchronization tools must account for data conflicts, WordPress plugins, invalid inputs, and unexpected power outages. The errors must be non-fatal, retryable, and allow manual resolution by the user. No data loss, ever. The transfer target site should be usable as early as possible and show no broken links or images during the transfer. That's the gist of it.

A number of parsers have already been prototyped. There's even [a reliable URL rewriting library](https://github.com/adamziel/site-transfer-protocol). Here's a bunch of early drafts of specific streaming use-cases:

-   [A URL parser](https://github.com/adamziel/site-transfer-protocol/blob/trunk/src/WP_URL.php)
-   [A block markup parser](https://github.com/adamziel/site-transfer-protocol/blob/trunk/src/WP_Block_Markup_Processor.php)
-   [An XML parser](https://github.com/WordPress/wordpress-develop/pull/6713), also explored by @dmsnell and @jonsurrell
-   [A Zip archive parser](https://github.com/WordPress/blueprints-library/blob/87afea1f9a244062a14aeff3949aae054bf74b70/src/WordPress/Zip/ZipStreamReader.php)
-   [A multihandle HTTP client](https://github.com/WordPress/blueprints-library/blob/trunk/src/WordPress/AsyncHttp/Client.php) without curl dependency
-   [A MySQL query parser](https://github.com/WordPress/sqlite-database-integration/pull/157) started by @zieladam and now explored by @janjakes
-   [A stream chaining API](https://github.com/adamziel/wxr-normalize/pull/1) to connect all these pieces

On top of that, WordPress core now has an HTML parser, and @dmsnell have been exploring a [UTF-8](https://github.com/WordPress/wordpress-develop/pull/6883) decoder that would to enable fast and regex-less URL detection in long data streams.

There are still technical challenges to figure out, such as how to pause and resume the data streaming. As this work progresses, you'll start seeing incremental improvements in Playground. One possible roadmap is shipping a reliable content importer, then reliable site zip importer and exporter, then cloning a site, and then extends towards full-featured site transfers and synchronization.

### How soon can it be shipped?

**The work is structured to ship a progression of meaningful user flows.** For example, the [Try WordPress extension](https://github.com/WordPress/try-wordpress/) can already give you a Playground site, even if you cannot migrate it to another WordPress site just yet.

**At the same time, we'll take the time required to build rigorous, reliable software**. We may ship an early version of this or that parser once we're comfortable with their architecture, but we are not rushing the architecture. That would jeopardize the entire project. We're aiming for a solid design that will serve WordPress for years.

The progress will be communicated in the open, while maintaining feedback loops and using the work to ship new Playground features.
