---
title: Getting Started with Xdebug
slug: /developers/xdebug/getting-started
description: Learn which WordPress Playground runtimes currently support Xdebug.
---

# Getting Started with Xdebug

The native Wasmtime runtime published in `@wp-playground/cli` does not include
Xdebug. The `--xdebug`, `--experimental-devtools`, and
`--experimental-unsafe-ide-integration` options are therefore unavailable for
the Playground CLI.

For standalone PHP scripts, [`@php-wasm/cli`](https://www.npmjs.com/package/@php-wasm/cli)
provides an Xdebug-enabled PHP.wasm runtime:

```bash
npx @php-wasm/cli@latest --xdebug script.php
```

You can also ask that CLI to configure a supported IDE integration:

```bash
npx @php-wasm/cli@latest \
	--xdebug \
	--experimental-unsafe-ide-integration=vscode \
	script.php
```

This runs a standalone PHP CLI session; it does not boot WordPress. Xdebug for
the native WordPress Playground CLI will require a future PHP component build
that includes the extension and debugger bridge.
