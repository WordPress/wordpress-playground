---
title: Isomorphism
sidebar_position: 5
---

https://github.com/WordPress/wordpress-playground/pull/214

## Description

Generalizes [Playground Blueprints](https://github.com/WordPress/wordpress-playground/pull/211) from working with just the in-browser Playground API client to working:

-   On the web and in Node.js
-   With a local Playground object
-   With a remote Playground client

With this PR applied, all of the following `login()` calls are valid:

```ts
// In the browser
const phpInSameThread = new PHP(await loadWebRuntime('7.4'));
// unzip WordPress in /wordpress
await login(phpInSameThread);

const phpInWorker = await consumeAPI(playgroundIframe);
await login(phpInWorker);
```

```ts
// In node.js
const phpInSameThread = new PHP(await loadNodeRuntime('7.4'));
phpInSameThread.mount('/wordpress', '/wordpress');
await login(phpInSameThread);
// ^ @TODO: Still fails unless you provide a DOMParser polyfill
```

This opens the door to using Blueprints in Node.js tools.

## Implementation

Blueprint were initially implemented as a part of the browser API client in `@wp-playground/client`. This PR decouples them into an isomorphic `@wp-playground/blueprints` package that depends on `@php-wasm/universal` which is also isomorphic.

In other words, step handlers such as `login(playground)` used to require a `PlaygroundClient` instance, but now they can work with a `UniversalPHP` instance defined as follows:

```ts
type IsomorphicLocalPHP = {
	/* ... PHP methods ... */
};
// Remote<T> means every method of T now returns a promise
type IsomorphicRemotePHP = Remote<IsomorphicLocalPHP>;
type UniversalPHP = IsomorphicLocalPHP | IsomorphicRemotePHP;
```

`UniversalPHP` is a type, not a class. It's a common core of all PHP implementations in other packages and provides methods like `run()`, `request()`, and `writeFile()`. `@php-wasm/universal` also provides a reference implementation of `UniversalPHP` called `PHP`.

## Other notes

-   `@php-wasm/universal`, `@wp-playground/client`, and `@wp-playground/blueprints` are published as isomorphic ESM/CJS packages. `@php-wasm/node` is published as CJS only for now.

## Follow-up work

-   `@wp-playground/blueprints` will need to be smart about providing a Node.js polyfill for `new DOMParser()` and `fetch()`.
