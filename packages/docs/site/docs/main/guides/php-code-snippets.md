---
title: PHP code snippets and embeds
slug: /guides/php-code-snippets
description: Embed editable, runnable PHP and WordPress examples in any web page using the <php-snippet> web component.
sidebar_class_name: navbar-build-item
---

import PhpCodeSnippetLiveExample, { PhpCodeSnippetExample } from '@site/src/components/PhpCodeSnippetLiveExample';

# PHP code snippets and embeds

Use `<php-snippet>` when you want readers to run PHP or WordPress code directly
from a docs page, tutorial, blog post, or demo. It renders a syntax-highlighted
code block with a Run button and starts a real Playground runtime only when the
reader asks for it.

The runtime is shared across matching snippets on the same page, so a tutorial
can include several runnable examples without starting WordPress over and over.

## Try it

The example below is editable and runnable. It also uses a Blueprint to install
a small mu-plugin before the snippet runs, so the PHP code can call a helper
function that did not exist in the default WordPress install.

<PhpCodeSnippetLiveExample />

Here is the complete embed:

```html
<script type="module" src="https://playground.wordpress.net/php-code-snippet.js"></script>

<script id="product-card-blueprint" type="application/json">
	{
		"steps": [
			{
				"step": "writeFile",
				"path": "/wordpress/wp-content/mu-plugins/product-cards.php",
				"data": "<?php\nfunction docs_render_product_card( array $product ): string {\n\treturn sprintf(\n\t\t'<article class=\"product-card\"><h3>%s</h3><p>$%0.2f</p></article>',\n\t\tesc_html( $product['name'] ),\n\t\t$product['price']\n\t);\n}\n"
			}
		]
	}
</script>

<php-snippet name="product-card.php" blueprint="product-card-blueprint">
	<script type="application/x-php">
		<?php
		require '/wordpress/wp-load.php';

		$products = [
			[
				'name'  => 'Canvas Tote',
				'price' => 24,
			],
			[
				'name'  => 'Coffee & Code Mug',
				'price' => 16.5,
			],
		];

		foreach ( $products as $product ) {
			echo docs_render_product_card( $product ) . "\n";
		}
	</script>
	<script type="text/expected-output">
		<article class="product-card"><h3>Canvas Tote</h3><p>$24.00</p></article>
		<article class="product-card"><h3>Coffee &amp; Code Mug</h3><p>$16.50</p></article>
	</script>
</php-snippet>
```

Use this pattern when each example should start from the same prepared site:
helper functions, mu-plugins, options, themes, demo files, or sample content.

## Start with one snippet

For a basic runnable example, add the component script once and place PHP inside
`<php-snippet>`:

<PhpCodeSnippetExample name="hello" />

```html
<script type="module" src="https://playground.wordpress.net/php-code-snippet.js"></script>

<php-snippet name="hello.php">
	<script type="application/x-php">
		<?php
		echo 'Hello from PHP ' . phpversion();
	</script>
	<script type="text/expected-output">
		Hello from PHP 8.4.x
	</script>
</php-snippet>
```

The script itself is small. PHP, WordPress, and the WASM runtime are fetched
later, after the first Run click. The expected output appears before Run and is
replaced with the exact PHP version after execution.

## Write PHP safely in HTML

Put inline PHP in a `<script type="application/x-php">` child. Browsers ignore
script tags with unknown types, which means PHP strings can contain HTML without
escaping every `<` character.

<PhpCodeSnippetExample name="htmlApi" />

```html
<php-snippet name="html-api.php">
	<script type="application/x-php">
		<?php
		require '/wordpress/wp-load.php';

		$html = '<img src="hero.jpg" alt="Hero">';
		$tags = new WP_HTML_Tag_Processor( $html );

		if ( $tags->next_tag( 'img' ) ) {
			$tags->set_attribute( 'loading', 'lazy' );
		}

		echo $tags->get_updated_html();
	</script>
	<script type="text/expected-output">
		<img src="hero.jpg" alt="Hero" loading="lazy">
	</script>
</php-snippet>
```

Very short snippets can also be written as text, as long as PHP opening tags are
escaped:

<PhpCodeSnippetExample name="sum" />

```html
<php-snippet name="sum.php" expected-output="42"> &lt;?php echo 20 + 22; </php-snippet>
```

## Use WordPress APIs

Snippets run in a real WordPress installation by default. Load WordPress with
`require '/wordpress/wp-load.php'`, then call core APIs as usual.

<PhpCodeSnippetExample name="siteTitle" />

```html
<php-snippet name="site-title.php">
	<script type="application/x-php">
		<?php
		require '/wordpress/wp-load.php';

		update_option( 'blogname', 'Snippet Docs' );
		echo get_bloginfo( 'name' );
	</script>
	<script type="text/expected-output">
		Snippet Docs
	</script>
</php-snippet>
```

If your example is pure PHP and does not need WordPress, use `wp="none"` to skip
the WordPress download and boot step:

<PhpCodeSnippetExample name="purePhp" />

```html
<php-snippet name="pure-php.php" wp="none">
	<script type="application/x-php">
		<?php
		echo 'WordPress installed: ';
		echo file_exists( '/wordpress/wp-load.php' ) ? 'yes' : 'no';
	</script>
	<script type="text/expected-output">
		WordPress installed: no
	</script>
</php-snippet>
```

## Edit examples in place

Runnable snippets are editable by default. The edited code is kept only in the
current page session; refreshing restores the original snippet.

<PhpCodeSnippetExample name="scratch" />

```html
<php-snippet name="scratch.php">
	<script type="application/x-php">
		<?php
		$numbers = range( 1, 5 );
		echo array_sum( $numbers );
	</script>
	<script type="text/expected-output">
		15
	</script>
</php-snippet>
```

Editable snippets also run with `Ctrl+Enter` or `Cmd+Enter` while the editor is
focused.

Use `readonly` for runnable examples that should be copied or run as-is:

<PhpCodeSnippetExample name="readOnly" />

```html
<php-snippet name="reference.php" readonly>
	<script type="application/x-php">
		<?php
		echo 'This example can run, but the code is locked.';
	</script>
	<script type="text/expected-output">
		This example can run, but the code is locked.
	</script>
</php-snippet>
```

`editable="false"` works as a compatibility alias for `readonly`.

## Show output before Run

Use expected output when you want the result visible immediately. The placeholder
is replaced with real runtime output after the reader clicks Run.

<PhpCodeSnippetExample name="precomputed" />

```html
<php-snippet name="precomputed.php">
	<script type="application/x-php">
		<?php
		echo '2 + 2 = ' . ( 2 + 2 );
	</script>
	<script type="text/expected-output">
		2 + 2 = 4
	</script>
</php-snippet>
```

For one-line output, use the `expected-output` attribute:

<PhpCodeSnippetExample name="oneLine" />

```html
<php-snippet name="one-line.php" expected-output="Ready">
	<script type="application/x-php">
		<?php
		echo 'Ready';
	</script>
</php-snippet>
```

## Prepare a site with a Blueprint

Use `blueprint` when snippets need setup before the PHP code runs. Put a JSON
[Blueprint](/blueprints/) in the page and point snippets at it by id or CSS
selector.

<PhpCodeSnippetExample name="greeting" />

```html
<script id="setup-blueprint" type="application/json">
	{
		"steps": [
			{
				"step": "writeFile",
				"path": "/wordpress/wp-content/mu-plugins/helpers.php",
				"data": "<?php\nfunction docs_greet( $name ) {\n\treturn 'Hello, ' . $name;\n}\n"
			}
		]
	}
</script>

<php-snippet name="greeting.php" blueprint="setup-blueprint">
	<script type="application/x-php">
		<?php
		require '/wordpress/wp-load.php';
		echo docs_greet( 'Ada' );
	</script>
	<script type="text/expected-output">
		Hello, Ada
	</script>
</php-snippet>
```

The selector form is useful when generated markup cannot guarantee simple ids:

<PhpCodeSnippetExample name="withSelector" />

```html
<php-snippet blueprint="#setup-blueprint" name="with-selector.php">
	<script type="application/x-php">
		<?php
		require '/wordpress/wp-load.php';
		echo docs_greet( 'Grace' );
	</script>
	<script type="text/expected-output">
		Hello, Grace
	</script>
</php-snippet>
```

Prefer `<script type="application/json">` for Blueprints. Its contents are raw
text, so embedded PHP strings such as `<?php` are safe. A `<template>` can work,
but its contents are parsed as HTML; if you use one, escape `<` in embedded PHP
strings as `\u003c`.

## Load PHP from another file

Use `src` when the PHP source should live in a separate file:

```html
<php-snippet name="external-example.php" src="/snippets/external-example.php" expected-output="Loaded from an external file"></php-snippet>
```

The URL resolves from the page that contains the snippet. If the file is hosted
on another origin, serve it with an `Access-Control-Allow-Origin` header that
allows the documentation page.

`src` loads only the snippet body. Use a Blueprint when you need support files,
plugins, options, or other setup before the snippet runs. The `expected-output`
attribute is still useful with `src` when you already know what the external PHP
file prints.

## Pin PHP or WordPress versions

The default PHP version is `8.4`, and the default WordPress version is `latest`.
Set `php` or `wp` when the example depends on a specific version.

<PhpCodeSnippetExample name="enum" />

```html
<php-snippet name="enum.php" php="8.4">
	<script type="application/x-php">
		<?php
		enum Status {
			case Draft;
			case Published;
		}

		echo Status::Published->name;
	</script>
	<script type="text/expected-output">
		Published
	</script>
</php-snippet>
```

<PhpCodeSnippetExample name="wpVersion" />

```html
<php-snippet name="wp-version.php" wp="6.8">
	<script type="application/x-php">
		<?php
		require '/wordpress/wp-load.php';
		echo get_bloginfo( 'version' );
	</script>
	<script type="text/expected-output">
		6.8
	</script>
</php-snippet>
```

See the [Query API reference](/developers/apis/query-api/#available-options)
for available PHP and WordPress versions.

## Show code without running it

Set `runnable="false"` for fragments that should be highlighted but not
executed, such as incomplete examples or code that depends on external services.

<PhpCodeSnippetExample name="illustration" />

```html
<php-snippet name="illustration.php" runnable="false">
	<script type="application/x-php">
		<?php
		// This fragment is shown for discussion, not execution.
		add_filter( 'the_content', 'docs_filter_content' );
	</script>
</php-snippet>
```

## Self-host the runtime

Most pages should use the hosted runtime from `https://playground.wordpress.net`.
Set `playground-origin` when developing Playground itself, testing a self-hosted
deployment, or pinning examples to infrastructure you control.

```html
<php-snippet name="local-runtime.php" playground-origin="http://localhost:5400">
	<script type="application/x-php">
		<?php
		echo phpversion();
	</script>
	<script type="text/expected-output">
		8.4.x
	</script>
</php-snippet>
```

## Runtime sharing

The first Run click on a page:

1. Loads the Playground client.
2. Creates a hidden iframe pointed at `remote.html`.
3. Boots PHP, and WordPress unless the snippet uses `wp="none"`.
4. Runs the snippet code and writes stdout into the output panel.

Later runs reuse an existing runtime when `playground-origin`, `php`, `wp`, and
the resolved Blueprint JSON all match. This keeps related snippets fast while
still isolating examples that need different setup.

## Security and CSP

Snippet PHP runs inside the Playground runtime iframe, not in the parent page.
The parent page still loads the web component script and creates the hidden
runtime iframe.

If your site has a Content Security Policy, allow:

- The module script from `https://playground.wordpress.net`.
- The hidden iframe from the same origin.
- Network requests for the PHP, WordPress, and Playground runtime assets.

For stricter environments, self-host the snippet script and use
`playground-origin` to point snippets at your deployment.

## Standalone PHP Playground

Use the standalone PHP Playground when you want a full-page editor, a shareable
URL, or an iframe instead of inline examples:

> [playground.wordpress.net/php-playground.html](https://playground.wordpress.net/php-playground.html)

You can embed it directly:

```html
<iframe src="https://playground.wordpress.net/php-playground.html#eyJjb2RlIjoiPD9waHBcblxuZWNobyBcIkkgYW0gYSBjb2RlIHNuaXBwZXQhXCI7XG4iLCJwaHAiOiI4LjQifQ==" width="100%" height="600"></iframe>
```

The URL fragment is a base64-encoded JSON payload with `code`, `php`, and `wp`
fields.

## Which embed should you use?

| Use case                                              | Use                             |
| ----------------------------------------------------- | ------------------------------- |
| Several runnable examples in one article              | `<php-snippet>`                 |
| A tutorial step where readers should edit code inline | `<php-snippet>`                 |
| Shared setup across examples                          | `<php-snippet blueprint="...">` |
| A pure PHP language example                           | `<php-snippet wp="none">`       |
| A runnable example that should not be edited          | `<php-snippet readonly>`        |
| A single full-page editor with a shareable URL        | Standalone PHP Playground       |
| A complete WordPress site preview                     | Standard Playground iframe      |

## Troubleshooting

If the snippet does not render, check that the module script loaded and that the
browser supports custom elements.

If Run never finishes, open DevTools and check failed requests for `remote.html`,
PHP `.wasm` files, WordPress zip files, Blueprint resources, or cross-origin
`src` files.

If a Blueprint-backed snippet cannot find helper functions, confirm the
`blueprint` attribute points to the right element and that the JSON is valid.

If output differs from the expected placeholder, trust the runtime output. The
placeholder is static documentation; Run executes the current code against the
selected PHP, WordPress, and Blueprint setup.
