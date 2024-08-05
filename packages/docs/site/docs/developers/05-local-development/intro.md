---
title: Local Development
slug: developers/local-development
id: intro-local-development
---

## Local Development with WordPress Playground

Playground powers offers several development environments designed to streamline the process of setting up and managing WordPress sites.

The easiest way to get WordPress site up and running is to open a [public Playground web instance](../../main/web-instance.md) from https://playground.wordpress.net/ (you could also [host your own WordPress Playground](../23-architecture/18-host-your-own-playground.md)).

Playground provides additional tools to check your code on a local WordPress environment. These tools are designed to enhance the development experience by prioritizing ease of installation and usability:

-   [`wp-now`](./01-wp-now.md) - CLI tool to spin up a WordPress site with a single command

-   [Visual Studio Code Extension](./02-vscode-extension.md) - Integrates WordPress development directly into Visual Studio Code to get a seamless development experience within the popular code editor.

But Playground also provides tools to use WordPress Playground in Node.js:

-   [WordPress Playground in Node.js](./03-php-wasm-node.md) - If you need low-level control over the underlying WebAssembly PHP build, take a look at the [`@php-wasm/node` package](https://npmjs.org/@php-wasm/node) which ships the PHP WebAssembly runtime.
