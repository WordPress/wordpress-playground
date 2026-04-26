---
title: PHP code snippets and embeds
slug: /guides/php-code-snippets
description: Embed runnable PHP code snippets in any web page using the <php-snippet> web component, or share full PHP demos via the standalone PHP Playground.
sidebar_class_name: navbar-build-item
---

# PHP code snippets and embeds

WordPress Playground ships two ready-made ways to put runnable PHP — and the full WordPress runtime — directly into a web page or a shareable URL. No PHP server, no setup, just a browser.

- **[`<php-snippet>` web component](#embedding-with-php-snippet)** — drop one `<script>` tag into your blog post, docs site, or readme to embed multiple runnable PHP snippets that share a single Playground runtime.
- **[Standalone PHP Playground](#standalone-php-playground)** — a full-page PHP editor at `playground.wordpress.net/php-playground.html` with a shareable URL.

## Embedding with `<php-snippet>`

The `<php-snippet>` custom element renders a syntax-highlighted code block with a Run button. Multiple snippets on the same page share a single hidden Playground runtime that is downloaded only when the visitor clicks Run for the first time.

### Quick start

```html
<script
	type="module"
	src="https://playground.wordpress.net/php-code-snippet.js"
></script>

<php-snippet name="hello.php">
	<script type="application/x-php">
<?php
echo "Hello from PHP " . phpversion();
	</script>
</php-snippet>
```

That's the whole integration. The script is around 5 KB gzipped and contains no PHP or WordPress — those are fetched lazily on the first Run click.

### Why a `<script type="application/x-php">` wrapper?

Browsers ignore the contents of script tags whose `type` they don't understand. That means you can put PHP code that contains literal `<` characters (HTML strings, generics, comparisons) inside the wrapper without escaping anything.

If your snippet has no characters that need escaping, you can put the code directly inside `<php-snippet>`:

```html
<php-snippet name="add.php">
	&lt;?php echo 1 + 2;
</php-snippet>
```

You can also load the code from a separate file:

```html
<php-snippet name="lazy-load.php" src="./snippets/lazy-load.php"></php-snippet>
```

### WordPress is available

Each snippet runs inside a real WordPress installation. `require '/wordpress/wp-load.php'` brings in the core APIs:

```html
<php-snippet name="lazy-load-images.php">
	<script type="application/x-php">
<?php
require '/wordpress/wp-load.php';

$html = '<article>
    <img src="hero.jpg" alt="Hero">
    <img src="inline.jpg" alt="Inline">
</article>';

$tags = new WP_HTML_Tag_Processor( $html );
while ( $tags->next_tag( 'img' ) ) {
    $tags->set_attribute( 'loading', 'lazy' );
    $tags->add_class( 'responsive' );
}

echo $tags->get_updated_html();
	</script>
</php-snippet>
```

### How runtime sharing works

The first time a visitor clicks Run on **any** snippet on the page, the component:

1. Lazy-loads the Playground client (`https://playground.wordpress.net/client/index.js`),
2. Creates one hidden iframe pointing at `https://playground.wordpress.net/remote.html`,
3. Boots PHP and WordPress inside it.

Every later Run — on the same snippet or any other — calls `client.run({ code })` against that same runtime. No additional downloads, no extra processes. A page with five snippets pays the runtime cost once.

While the boot is in progress, every snippet that has its Run clicked shows the same staged progress bar (download → install → ready) drawn from the live progress events Playground emits internally.

### Attributes

| Attribute            | Default                              | Purpose                                       |
| -------------------- | ------------------------------------ | --------------------------------------------- |
| `name`               | `snippet.php`                        | Filename label shown in the snippet header    |
| `php`                | `8.4`                                | PHP version (see [supported versions][php])   |
| `wp`                 | `latest`                             | WordPress version                             |
| `src`                | —                                    | Load PHP from a URL instead of inline         |
| `playground-origin`  | `https://playground.wordpress.net`   | Override the runtime origin (local dev, etc.) |

Snippets that share the same `php`, `wp`, and `playground-origin` values share one runtime; mixing different versions on the same page boots a separate runtime per combination.

[php]: /developers/apis/query-api/#available-options

## Standalone PHP Playground

For full-page editing or sharing a one-off snippet via URL, use the standalone PHP Playground at:

> [playground.wordpress.net/php-playground.html](https://playground.wordpress.net/php-playground.html)

It's a side-by-side editor and preview with PHP and WordPress version selectors. The current code, PHP version, and WordPress version are encoded into the URL fragment, so you can share a working example by copying the URL.

You can embed it in any page with an iframe:

```html
<iframe
	src="https://playground.wordpress.net/php-playground.html#eyJjb2RlIjoiPD9waHBcblxuZWNobyBcIkkgYW0gYSBjb2RlIHNuaXBwZXQhXCI7XG4iLCJwaHAiOiI4LjQifQ=="
	width="100%"
	height="600"
></iframe>
```

The fragment is a base64-encoded JSON payload of `{ code, php, wp }`.

### Standalone PHP Playground `<iframe>` vs. `<php-snippet>` — which should I use?

| Use case                                                          | Pick                |
| ----------------------------------------------------------------- | ------------------- |
| Multiple read-only runnable examples in a docs page or blog post  | `<php-snippet>`     |
| Customizations, e.g. read-only code vs editable code  | `<php-snippet>`     |
| A single code example you don't want to load foreign scripts on your site | Standalone PHP Playground |
