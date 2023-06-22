---
title: FAQ
slug: /faq
---

# FAQ

## Wait, where is PHP running?

In your browser! It is mindblowing, isn't it? There's a new technology called WebAssembly that makes it possible. You can learn more in [this article on web.dev](https://web.dev/wordpress-playground/).

## Is WordPress Playground available in another language?

Yes! Although it requires some work at the moment. You need to tell Playground to download and install the translation files and one way to do it is using [the Blueprints API](https://wordpress.github.io/wordpress-playground/pages/blueprints-getting-started.html). There is no step-by-step tutorial yet, but you can learn by reading the source of [Playground+Translations plugin](https://translate.wordpress.org/projects/wp-plugins/friends/dev/en-gb/default/playground/) [(GitHub link)](https://github.com/akirk/wp-glotpress-playground/blob/main/index.php).

## Will wp-cli be supported?

Yes! Some commands already work if you include `wp-cli.phar` in the executed PHP code, and support for others is work in progress. The documentation will be progressively updated to reflect the progress.
