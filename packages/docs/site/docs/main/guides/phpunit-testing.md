---
title: Running PHPUnit with the Playground CLI
slug: /guides/phpunit-testing
description: Run PHPUnit tests for WordPress plugins and themes using the Playground CLI — no database required, clean environment on every run.
sidebar_class_name: navbar-build-item
---

The [Playground CLI](/developers/local-development/wp-playground-cli) includes a `php` subcommand that runs PHP scripts directly inside the Playground environment. By mounting your plugin or theme into the Playground filesystem, you can run PHPUnit without a local database. Every run starts with a clean WordPress installation, so tests are fully isolated.

:::info
This guide assumes your plugin or theme has PHPUnit installed via Composer (`composer require --dev phpunit/phpunit`). The `vendor/bin/phpunit` path used below assumes a standard Composer setup.
:::

## Running tests

From your plugin or theme directory, run the following command. Replace `themes/THEME_NAME` with the path to your plugin or theme:

```bash
npx @wp-playground/cli@latest php \
  --auto-mount \
  -- \
  /wordpress/wp-content/themes/THEME_NAME/vendor/bin/phpunit \
  -c /wordpress/wp-content/themes/THEME_NAME/phpunit.xml.dist
```

The `--auto-mount` flag detects whether the current directory is a plugin, theme, or WordPress installation and mounts it at the correct path under `/wordpress/wp-content/`. The `--` separates CLI flags from arguments passed to the PHP interpreter, and you can pass any arguments supported by your PHPUnit configuration.

For a plugin, the path would use `plugins/` instead:

```bash
npx @wp-playground/cli@latest php \
  --auto-mount \
  -- \
  /wordpress/wp-content/plugins/MY_PLUGIN/vendor/bin/phpunit \
  -c /wordpress/wp-content/plugins/MY_PLUGIN/phpunit.xml.dist
```

You can also use `--mount` to explicitly map a local directory to a path inside the Playground filesystem:

```bash
npx @wp-playground/cli@latest php \
  --mount=.:/wordpress/wp-content/plugins/MY_PLUGIN \
  -- \
  /wordpress/wp-content/plugins/MY_PLUGIN/vendor/bin/phpunit \
  -c /wordpress/wp-content/plugins/MY_PLUGIN/phpunit.xml.dist
```

## Choosing PHP and WordPress versions

Use the `--php` and `--wp` flags to test against specific versions:

```bash
npx @wp-playground/cli@latest php \
  --auto-mount \
  --php=8.1 \
  --wp=6.5 \
  -- \
  /wordpress/wp-content/plugins/MY_PLUGIN/vendor/bin/phpunit \
  -c /wordpress/wp-content/plugins/MY_PLUGIN/phpunit.xml.dist
```

Supported PHP versions range from 7.4 to 8.5. For WordPress, you can use a specific version number, `latest`, `nightly`, or `beta`.

## Next steps

- [Playground CLI documentation](/developers/local-development/wp-playground-cli) — full CLI reference and configuration options
- [E2E Testing with Playwright](/guides/e2e-testing-with-playwright) — browser-based end-to-end testing for WordPress plugins and themes
