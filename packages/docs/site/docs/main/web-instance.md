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

The options available from the "Customize Playground" window correpond to the following [Query API options](../developers/20-query-api/01-index.md##available-options):

-   `storage`
-   `php`
-   `php-extension-bundle`
-   `networking`
-   `wp`

:::tip

You need to activate "Network access" to be able to browse for [plugins](https://w.org/plugins) and [themes](https://w.org/themes) from your WordPress instance.
:::

## Playground Options Menu

![options menu at playground instance snapshot](./_assets/options.png)

This menu contains links to some Playground resources and tools:

-   **Reset Site**: - It will wipe out all data and reload the page with a new site.
-   **Report error**: If you have any issue with WP Playground yoy can report it using the form available from this option. You can help resolve issues with Playground by sharing the error details with development team behind Playground.
-   **Restore from zip**: It allows you to recreate a Playground instance using any `.zip` generated with the "Download as zip" option
-   **Download as zip**: It creates a `.zip` with the setup of the Playground instance including any themes or plugins installed. This `.zip` won't include content and database changes.
-   **Restore from zip**: It allows you to recreate a Playground instance using any `.zip` generated with the "Download as zip" option
-   **Import from Github**: This option allows you to import plugins, themes, and wp-content directories directly from your public GitHub repositories. To enable this feature, connect your GitHub account with WordPress Playground.

-   **Export Pull Request to GitHub**: This option allows you to export WordPress plugins, themes, and entire wp-content directories as pull requests to any public GitHub repository. Check [here](https://www.youtube.com/watch?v=gKrij8V3nK0&t=2488s) a demo of using this option.

-   **View Logs**: This option allows you to search.

-   **Edit the blueprint**: This option allows you to open a "builder" mode of the blueprint being used for the current Playground instance. In this mode you'll be able to edit the blueprint online and run a new Playground instance with your edited version of the blueprint.

<span id="edit-the-blueprint"></span>

![snapshot of Builder mode of WordPress Playground](./_assets/builder-mode.png)
