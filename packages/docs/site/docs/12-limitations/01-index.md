---
title: Limitations
slug: /limitations
---

# Limitations

WordPress Playground has a few limitations that you should be aware of.

## If you are a user

import Limitations from '@site/docs/\_fragments/\_limitations_ui.md';

<Limitations />

## If you are a developer

### Iframe quirks

WordPress is rendered in an iframe, which makes it hard to correctly handle `target="_top"` in links. This means that clicking on `<a target="_top">Click here</a>` may reload the main browser tab.

Also, JavaScript popup windows originating in the iframe may not be displayed in certain cases.

### Pthreads Support

The WebAssembly version of PHP is built without pthreads support, which means you cannot use `pcntl_` functions like `pcntl_fork()` or `pcntl_exec()`. Most of the time, you don't need them, but there are a few WP-CLI commands and a few corner-cases in PHPUnit tests that use them.

You can track the progress of adding pthreads support at https://github.com/WordPress/wordpress-playground/issues/347.

### XDebug Support

XDebug is not supported in the WebAssembly version of PHP. You can track the progress of adding XDebug support at https://github.com/WordPress/wordpress-playground/issues/314.

### Known unsupported PHP Functions

-   `proc_open`
-   `popen('', 'w')` in the `w` mode. `popen('', 'r')` works fine.
