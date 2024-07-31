---
title: Playground Website
slug: /web-instance
---

# WordPress Playground Website

[https://playground.wordpress.net/](https://playground.wordpress.net/) is a versatile tool that allows developers to run WordPress in a browser without needing a server. This environment is particularly useful for testing plugins, themes, and other WordPress features quickly and efficiently.

Some key features:

-   **Browser-based**: No need for a local server setup.
-   **Instant Setup**: Run WordPress with a single click.
-   **Testing Environment**: Ideal for testing plugins and themes.

Via [Query Params](../developers/20-query-api/01-index.md) we can directly load in the Playground instance things such as a specific version of WordPress, a theme, a plugin or a more complex setup via blueprints (check [here](./quick-start-guide.md#try-a-block-a-theme-or-a-plugin) some examples).

From the Playground website there are also available some toolbars to customize your playground instance and to provide quick access to some resources and utilities.

![Playground Toolbar Snapshot](./_assets/toolbar.png)

## Customize Playground

![snapshot of customize playground window at playground instance](./_assets/customize-playground.png)

All the options available from the "Customize Playground" window correpond to the following [Query API options](../developers/20-query-api/01-index.md##available-options) :

-   `storage`
-   `php`
-   `php-extension-bundle`
-   `networking`
-   `wp`

## Playground Options Menu

![options menu at playground instance snapshot](./_assets/options.png)
