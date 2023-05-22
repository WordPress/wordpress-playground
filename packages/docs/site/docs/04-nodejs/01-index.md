---
title: Usage in Node.js
slug: /usage-in-node-js
---

# Using WordPress Playground in Node.js

As a WebAssembly project, WordPress Playground can also be used in Node.js. Here's how you can do it:

import TOCInline from '@theme/TOCInline';

<TOCInline toc={toc} maxHeadingLevel={2} />

## Start a zero-setup dev environment via VScode extension

You can use the [VScode extension](https://marketplace.visualstudio.com/items?itemName=WordPress.wordpress-playground) to develop your plugin or theme locally without installing Apache or MySQL.

The extension ships with a portable WebAssembly version of PHP and sets up WordPress to use SQLite. All you have to do is click the "Start WordPress Server" button in VScode:

import Image from '@theme/IdealImage';
import vsCodeScreenshot from '@site/static/img/start-wordpress-server.png';

<div style={{maxWidth:350}}><Image img={vsCodeScreenshot} /></div>

## Run WordPress via the `wp-now` CLI tool

import WPNowOverview from '@site/docs/\_fragments/\_wp_now_overview.mdx';

<WPNowOverview />

## Build an app with Playground npm packages

WordPress Playground ships with a set of npm packages that you can use to build your own tools on top of it.

### Use `wp-now` as a library

[The `@wp-now/wp-now` package](https://npmjs.org/@wp-now/wp-now) is not only a CLI tool but also a library providing tools for serving WordPress, setting up the SQLite support, and many more. It is a great package to use when you want to get started with WordPress Playground in Node.js.

### Use JSON Blueprints for Node.js

You can control the WebAssembly PHP using the same [JSON Blueprints](../09-blueprints-api/01-index.md) as in the web version. [They're isomorphic](../09-blueprints-api/06-isomorphic.md).

The [`@wp-playground/blueprints`](https://npmjs.org/@wp-playground/blueprints) package can run Blueprints and exposes many useful helpers you can use in your code. See [Getting Started with Blueprints](../09-blueprints-api/01-index.md) to learn more.

### Work directly with WebAssembly PHP for Node.js

And if you need a low-level control over the underlying WebAssembly PHP build, take a look at the [`@php-wasm/node` package](https://npmjs.org/@php-wasm/node) which ships the PHP WebAssembly runtime. This package is at the core of all WordPress Playground tools for Node.js.
