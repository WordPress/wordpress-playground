---
title: Using Xdebug with PHP WASM - Introduction
slug: /developers/xdebug/introduction
description: Debug PHP code running in WebAssembly within WordPress Playground using Xdebug, Chrome DevTools, and IDE integration.
---

# Using Xdebug with PHP WASM

Xdebug is a debugging extension for PHP that lets you set breakpoints, inspect variables, and step through your code. WordPress Playground includes Xdebug in its WebAssembly-compiled PHP, so you can debug WordPress code running directly in your browser or IDE.

## Why Xdebug matters for PHP WASM

Debugging PHP code in WebAssembly is different from debugging traditional PHP. Without Xdebug, you're limited to `var_dump()` and `error_log()` statements. Xdebug gives you a proper debugger with breakpoints, variable inspection, and call stack navigation—the same tools you'd use when debugging PHP on a regular server.

## XDebug on WordPress Playground

For a quick start, check the [getting started with Xdebug guide](/developers/xdebug/getting-started)

You'll learn to debug:

-   Form processing logic
-   Input validation
-   WordPress hooks and filters

## Two debugging approaches

WordPress Playground supports two ways to debug with Xdebug:

**Chrome DevTools**: Debug directly in your browser without any IDE setup. Great for quick debugging sessions or when you want to see everything in one place.

**IDE integration**: Use VSCode or PhpStorm with full IDE features, including code navigation, project-wide search, and advanced breakpoint conditions. Better for complex debugging scenarios.

## What you'll need

-   Node.js installed
-   Chrome or Chromium browser (for DevTools debugging)
-   Visual Studio Code or PhpStorm (for IDE debugging, optional)
-   Basic familiarity with WordPress plugin development

**Next**: [Getting Started with Xdebug →](/developers/xdebug/getting-started)
