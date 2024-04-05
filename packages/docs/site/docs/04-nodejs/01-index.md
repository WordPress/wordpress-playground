---
title: Usage in Node.js
slug: /usage-in-node-js
---

# Using WordPress Playground in Node.js

As a WebAssembly project, WordPress Playground can also be used in Node.js. Here's how you can do it:

import TOCInline from '@theme/TOCInline';

<TOCInline toc={toc} maxHeadingLevel={2} />

## Start a zero-setup dev environment via VScode extension

You can use the [VScode extension](https://marketplace.visualstudio.com/items?itemName=WordPressPlayground.wordpress-playground) to develop your plugin or theme locally without installing Apache or MySQL.

The extension ships with a portable WebAssembly version of PHP and sets up WordPress to use SQLite. All you have to do is click the "Start WordPress Server" button in VScode:

import Image from '@theme/IdealImage';
import vsCodeScreenshot from '@site/static/img/start-wordpress-server.png';

<div style={{maxWidth:350}}><Image img={vsCodeScreenshot} /></div>

### Work directly with WebAssembly PHP for Node.js

And if you need a low-level control over the underlying WebAssembly PHP build, take a look at the [`@php-wasm/node` package](https://npmjs.org/@php-wasm/node) which ships the PHP WebAssembly runtime. This package is at the core of all WordPress Playground tools for Node.js.
