---
title: Running PHPUnit with PHP.wasm
slug: /guides/phpunit-testing
description: Run standalone PHPUnit tests with PHP.wasm and understand the current Playground CLI limitation.
sidebar_class_name: navbar-build-item
---

The native `@wp-playground/cli` runtime does not expose a standalone `php`
command. Its PHP component currently provides an HTTP SAPI boundary, which
cannot faithfully reproduce PHP CLI argument parsing, stdin, or PHAR execution.
The former `wp-playground php ...` PHPUnit workflow is therefore unavailable.

For a standalone PHP project whose files and dependencies are already present
on the host, use [`@php-wasm/cli`](https://www.npmjs.com/package/@php-wasm/cli):

```bash
npx @php-wasm/cli@latest vendor/bin/phpunit -c phpunit.xml.dist
```

This runs PHPUnit in a PHP CLI session, but it does not boot WordPress or create
the WordPress test database and fixtures. WordPress integration tests still
need a test environment that explicitly provides those dependencies.

For browser-facing plugin and theme tests, use the Playground CLI's `start` or
`server` command with PHP 8.2 and drive the site over HTTP. See
[E2E Testing with Playwright](/guides/e2e-testing-with-playwright).

## Next steps

- [Playground CLI documentation](/developers/local-development/wp-playground-cli)
- [E2E Testing with Playwright](/guides/e2e-testing-with-playwright)
