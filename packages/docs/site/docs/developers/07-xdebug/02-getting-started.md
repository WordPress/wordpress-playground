---
title: Getting Started with Xdebug
slug: /developers/xdebug/getting-started
description: Guide for translators: maintain UI consistency across languages. Learn about remote.html differences and best practices for keeping localization in sync across locales.
---

# Getting Started with Xdebug

Before you can start debugging, you need to get WordPress Playground running with Xdebug enabled. This guide covers the basics.

## PHP WASM CLI vs Playground CLI

You have two CLI tools to choose from:

**`@php-wasm/cli`**: Run standalone PHP scripts. Use this when you're debugging PHP code that doesn't need WordPress.

**`@wp-playground/cli`**: Run a full WordPress installation. Use this when debugging WordPress plugins, themes, or core functionality.

For debugging WordPress plugins (which is what we'll do in this guide), use Playground CLI.

## Quick start with npx

The fastest way to get started is using npx, which doesn't require installation:

```bash
npx @wp-playground/cli@latest server --xdebug
```

This starts WordPress on `http://127.0.0.1:9400` with Xdebug enabled. You can now connect a debugger.

## Starting with DevTools

To debug with Chrome DevTools, add the `--experimental-devtools` flag:

```bash
npx @wp-playground/cli@latest server --xdebug --experimental-devtools
```

The terminal will display a URL to connect Chrome DevTools. We'll cover the full setup in the [Chrome DevTools debugging guide](/developers/testing/xdebug/chrome-devtools).

## Starting with IDE integration

To debug with VSCode or PhpStorm, add the `--experimental-unsafe-ide-integration` flag:

```bash
npx @wp-playground/cli@latest server --xdebug --experimental-unsafe-ide-integration
```

This automatically configures your IDE for debugging. See the [IDE debugging guide](/developers/testing/xdebug/ide-integration) for details.

## Installing locally (optional)

If you prefer to install the packages locally:

```bash
npm install @wp-playground/cli
```

Then run:

```bash
npx @wp-playground/cli server --xdebug
```

## Next steps

Now that you have Playground running with Xdebug, choose your debugging method:

-   [Debug with Chrome DevTools](/developers/testing/xdebug/chrome-devtools) - Browser-based debugging
-   [Debug with IDE integration](/developers/testing/xdebug/ide-integration) - VSCode or PhpStorm

Both guides use the same example plugin so you can follow along regardless of which method you choose.

---

**Next steps**:

-   [Debug with Chrome DevTools →](/developers/testing/xdebug/chrome-devtools)
-   [Debug with IDE integration →](/developers/testing/xdebug/ide-integration)
