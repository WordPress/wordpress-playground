---
title: Isomorphic packages
slug: /developers/architecture/isomorphic-packages
description: Learn what isomorphic packages are in WordPress Playground, why they matter, and how to avoid browser-only or Node.js-only assumptions.
---

# Isomorphic packages

Many WordPress Playground packages are designed to be isomorphic, also known as universal. In this context, an isomorphic package can run in more than one JavaScript environment, most commonly the browser and Node.js, without changing its public API.

This matters because Playground is used in many places:

- In the browser at [playground.wordpress.net](https://playground.wordpress.net/).
- In embedded iframes controlled through the JavaScript API.
- In Node.js tools such as `@wp-playground/cli`.
- In build, test, and automation workflows.

When a package stays isomorphic, the same feature can be reused across those environments. For example, code that prepares a Blueprint, validates a PHP version, or talks to a Playground client can be shared by browser apps, CLI tools, tests, and documentation examples.

## Tradeoffs

Isomorphic code is more portable, but it also has to avoid APIs that only exist in one runtime.

Browser-only APIs include:

- `window`
- `document`
- `DOMParser`
- `localStorage`
- Service Worker APIs

Node.js-only APIs include:

- `fs`
- `path`
- `process`
- `Buffer`
- Native Node.js streams

Using these APIs directly can make a package harder to reuse. A browser app that imports `fs`, or a Node.js script that imports `document`, will fail unless a bundler, polyfill, or adapter fills the gap.

## Patterns for isomorphic code

Prefer platform-neutral APIs when possible:

- Use `fetch`, `URL`, `URLSearchParams`, `TextEncoder`, and `TextDecoder` when they fit the task.
- Accept data as arguments instead of reading it from the DOM or file system inside shared code.
- Put browser-specific or Node.js-specific code behind a small adapter.
- Keep environment detection near the edge of the package, not scattered through shared logic.

For example, a shared package can accept a file-like object or a URL instead of reading directly from `document.querySelector()` or `fs.readFileSync()`. The browser entry point can collect the file from an input element, while the Node.js entry point can read it from disk and pass the same kind of data to the shared function.

## Examples

An isomorphic helper can build a Playground URL from a Blueprint object because it only needs JavaScript objects and URL APIs:

```ts
export function blueprintToUrl(blueprint: Record<string, unknown>): string {
	const url = new URL('https://playground.wordpress.net/');
	url.searchParams.set('blueprint', JSON.stringify(blueprint));
	return url.toString();
}
```

A browser-specific helper is not isomorphic because it reads from the DOM:

```ts
export function getBlueprintFromTextarea() {
	return JSON.parse(document.querySelector('textarea')?.value || '{}');
}
```

A Node.js-specific helper is not isomorphic because it reads from the local file system:

```ts
import { readFileSync } from 'fs';

export function getBlueprintFromFile(filePath: string) {
	return JSON.parse(readFileSync(filePath, 'utf8'));
}
```

Both non-isomorphic examples can still be useful. The key is to keep them in browser or Node.js entry points, and keep the core package logic portable where reuse across Playground environments is expected.
