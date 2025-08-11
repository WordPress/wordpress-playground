---
title: Playground web instance
slug: /web-instance
---

# WordPress Playground web instance

[https://playground.wordpress.net/](https://playground.wordpress.net/) is a versatile web tool that allows developers to run WordPress in a browser without needing a server. This environment is particularly useful for testing plugins, themes, and other WordPress features quickly and efficiently.

Some key features:

-   **Browser-based**: No local server setup required.
-   **Instant Setup**: Run WordPress with a single click.
-   **Testing Environment**: Ideal for testing plugins and themes.

The [Query Params API](/developers/apis/query-api/) allows you to directly load specific configurations into a Playground instance. This includes setting a particular WordPress version, theme, or plugin. You can also define more complex setups using blueprints (see [examples here](/quick-start-guide#try-a-block-a-theme-or-a-plugin)).

From the Playground website, some toolbars are also available to customize your Playground instance and provide quick access to some resources and utilities.

![Playground Toolbar Snapshot](@site/static/img/about/toolbar-playground.webp)

## Customize Playground

On the toolbar, you'll find:

-   **Playground Settings**: A panel for configuring your current instance, like PHP and WordPress versions.
-   **Playground Manager**: This panel lets you manage WordPress Playground instances, allowing you to save, import, and export them.

### Playground Settings

![snapshot of customize Playground window at Playground instance](@site/static/img/about/playground-settings-panel.webp)

The options available from the **Playground Settings Panel**, correspond to the following [Query API options](/developers/apis/query-api#available-options):

-   `language`: Sets the WordPress instance language.
-   `multisite`: Enables WordPress multisite support.
-   `networking`: Grants network access, allowing fetches from the WordPress plugin directory and internal WordPress APIs.
-   `php`: Specifies the PHP version for the instance.
-   `wp`: Defines the WordPress version.

## Playground Manager

![Playground settings panel allow users to manage multiple instances](@site/static/img/about/playground-manager-panel.webp)

This panel enables users to manage Playground instances. It displays a list of saved Playgrounds and provides access to the current Playground's settings, along with a **Save Button** to store your configurations locally in your browser for later reloading.

![Save Playground Button](@site/static/img/about/playground-manager-save-instance.webp)

Once you click on save, an instance will be stored with a generated name to be revisited anytime. The Playground Manager also has options to export(Additional actions menu) and import(Import actions menu) WordPress Playground instances:

### Additional actions menu

![Additional actions Menu](@site/static/img/about/playground-manager-additional-actions.webp)

-   **Export Pull Request to GitHub**: This option allows you to export WordPress plugins, themes, and entire wp-content directories as pull requests to any public GitHub repository. Check [here](https://www.youtube.com/watch?v=gKrij8V3nK0&t=2488s) a demo of using this option.
-   **Download as zip**: It creates a `.zip` with the setup of the Playground instance, including any themes or plugins installed. This `.zip` won't include content and database changes.
-   **Report error**: If you have any issues with WP Playground, you can report it using the form available from this option. You can help resolve issues with Playground by sharing the error details with the development team behind Playground.
-   **View Blueprint**: This option will open the current blueprint used for the Playground instance in the [Blueprints Builder tool](https://playground.wordpress.net/builder/builder.html). From this tool you'll be able to edit the blueprint online and run a new Playground instance with your edited version of the blueprint.

<span id="edit-the-blueprint"></span>

[![snapshot of Builder mode of WordPress Playground](@site/static/img/about/blueprint-builder.webp)](https://playground.wordpress.net/builder/builder.html)

### Import actions menu

![Import actions Menu](@site/static/img/about/playground-manager-import-actions.webp)

-   **Import from zip**: It allows you to recreate a Playground instance using any `.zip` generated with the "Download as zip" option.
-   **Preview a Gutenberg PR**: Allow testers run branches from the Gutenberg repository to test pull requests instantly.
-   **Import from GitHub**: This option allows you to import plugins, themes, and wp-content directories directly from your public GitHub repositories. To enable this feature, connect your GitHub account with WordPress Playground.

:::caution

The site at https://playground.wordpress.net is there to support the community, but there are no guarantees it will continue to work if the traffic grows significantly.

If you need certain availability, you should [host your own WordPress Playground](/developers/architecture/host-your-own-playground).
:::
