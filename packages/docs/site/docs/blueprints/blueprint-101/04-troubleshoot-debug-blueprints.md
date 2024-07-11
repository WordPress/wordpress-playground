---
title: Troubleshoot and debug
description: A list of challenges and workarounds
hide_table_of_contents: false
---

# Troubleshoot and debug Blueprints

When you build Blueprints, you might run into issues. Here are tips and tools to help you debug them:

## Review common gotchas

-   Require `wp-load`: to run a WordPress PHP function using the `runPHP` step, you would need to require [wp-load.php](https://github.com/WordPress/WordPress/blob/master/wp-load.php). So, the value of the `code` key should start with `"<?php require_once('wordpress/wp-load.php'); REST_OF_YOUR_CODE"`.
-   Enable `networking`: to access wp.org assets (themes, plugins, blocks, or patterns), or load a stylesheet using [add_editor_style()](https://developer.wordpress.org/reference/functions/add_editor_style/) (say, when [creating a custom block style](https://developer.wordpress.org/news/2023/02/creating-custom-block-styles-in-wordpress-themes)), you would need to enable the `networking` option: `"features": {"networking": true}`.

## Blueprints Builder

You can use an in-browser [Blueprints editor](https://playground.wordpress.net/builder/builder.html) to build, validate, and preview your Blueprints in the browser.

:::warning CAUTION
The editor is under development and the embedded Playground sometimes fails to load. To get around it, refresh the page. We're aware of that, and are working to improve the experience.
:::

## Check for errors in the browser console

If your Blueprint isn’t running as expected, open the browser developer tools to see if there are any errors.

To open the developer tools in Chrome, Firefox, Safari\*, and Edge: press `Ctrl + Shift + I` on Windows/Linux or `Cmd + Option + I` on macOS.

:::info
If you haven't yet, enable the Develop menu: go to **Safari > Settings... > Advanced** and check **Show features for web developers**.
:::

The developer tools window allows you to inspect network requests, view console logs, debug JavaScript, and examine the DOM and CSS styles applied to your webpage. This is crucial for diagnosing and fixing issues with Blueprints.

## Ask for help

The community is here to help! If you have questions or comments, [open a new issue](https://github.com/wordpress/blueprints/issues) in this repository. Remember to include the following details:

-   The Blueprint you’re trying to run.
-   The error message you’re seeing, if any.
-   The full output from the browser developer tools.
-   Any other relevant information that might help us understand the issue: OS, broswer version, etc.

---

**Table of contents**

1. [What are Blueprints, and what can you do with them?](./01-what-are-blueprints-what-you-can-do-with-them.md)
2. [How to load and run Blueprints?](./02-how-to-load-run-blueprints.md)
3. [Build your first Blueprint](./03-build-your-first-blueprint.md)
4. **Troubleshoot and debug Blueprints**
