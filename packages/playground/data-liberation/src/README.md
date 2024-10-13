## Site Transfer Protocol prototype

This is an exploration of what could become the WordPress
Site Transfer Protocol:

https://core.trac.wordpress.org/ticket/60375

The current version is focused on finding and rewriting
URLs as well as downloading any related assets.

Inspect tricky-input.html and tricky-output.html to
see what this repo can do today.

The next steps here would be to flesh out this README more,
start some issues and discussions, and define the minimal
v1 to ship and stress-test in Playground.

### Current status

-   URL rewriting works to perhaps the greatest extent it ever did.
    There are still corner-cases to discuss and performance optimizations
    to reap before making any of this a public API.
-   The URL parser requires PHP 8.1. This is fine for some Playground applications,
    but we'll more compatibility to get any of this into WordPress core. Also, that
    parser uses dozens of classes when we could likely rework it into something as
    self-contained like the WP_HTML_Tag_Processor.
-   Downloading the assets isn't implemented yet. It feels like there's
    no way to even start doing it without a state tracking table as there
    might be way more images to download than the PHP time limit allows.
    Perhaps that doesn't need to be solved to start using this with Markdown.

#### Processing tricky inputs

When this code is fed into the migrator:

```html
<!-- wp:paragraph -->
<p>
	<!-- Inline URLs are migrated -->
	🚀-science.com/science has the best scientific articles on the internet! We're also available via the punycode URL:

	<!-- No problem handling HTML-encoded punycode URLs with urlencoded characters in the path -->
	&#104;ttps://xn---&#115;&#99;ience-7f85g.com/%73%63ience/.

	<!-- Correctly ignores similar–but–different URLs -->
	This isn't migrated: https://🚀-science.comcast/science <br />
	Or this: super-🚀-science.com/science
</p>
<!-- /wp:paragraph -->

<!-- Block attributes are migrated without any issue -->
<!-- wp:image {"src": "https:\/\/\ud83d\ude80-\u0073\u0063ience.com/%73%63ience/wp-content/image.png"} -->
<!-- As are URI HTML attributes -->
<img src="&#104;ttps://xn---&#115;&#99;ience-7f85g.com/science/wp-content/image.png" />
<!-- /wp:image -->

<!-- Classes are not migrated. -->
<span class="https://🚀-science.com/science"></span>
```

This actual output is produced:

```html
<!-- wp:paragraph -->
<p>
	<!-- Inline URLs are migrated -->
	science.wordpress.com has the best scientific articles on the internet! We're also available via the punycode URL:

	<!-- No problem handling HTML-encoded punycode URLs with urlencoded characters in the path -->
	https://science.wordpress.com/.

	<!-- Correctly ignores similar–but–different URLs -->
	This isn't migrated: https://🚀-science.comcast/science <br />
	Or this: super-🚀-science.com/science
</p>
<!-- /wp:paragraph -->

<!-- Block attributes are migrated without any issue -->
<!-- wp:image {"src":"https:\/\/science.wordpress.com\/wp-content\/image.png"} -->
<!-- As are URI HTML attributes -->
<img src="https://science.wordpress.com/wp-content/image.png" />
<!-- /wp:image -->

<!-- Classes are not migrated. -->
<span class="https://🚀-science.com/science"></span>
```

### Related projects

-   https://github.com/WordPress/wordpress-playground/discussions/1524
-   https://github.com/adamziel/wxr-normalize
-   https://github.com/WordPress/blueprints/pull/52
-   https://github.com/adamziel/playground-docs-workflow
-   https://github.com/WordPress/blueprints-library/blob/trunk/src/WordPress/AsyncHttp/Client.php
-   https://github.com/WordPress/wordpress-develop/pull/6713

### What code do I run?

To migrate domain names from tricky-input.html, run:

```shell
php bin/rewrite-urls.php migrate_urls --file ./tricky-input.html --current-site-url https://🚀-science.com/science --new-site-url https://science.wordpress.com
```

To list all the URLs found in that file, run:

```shell
php bin/rewrite-urls.php list_urls --file ./tricky-input.html
```
