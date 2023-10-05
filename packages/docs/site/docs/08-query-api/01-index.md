---
sidebar_position: 5
slug: /query-api
---

# Query API

WordPress Playground exposes a simple API that you can use to configure the Playground in the browser.

It works by passing configuration options as query parameters to the Playground URL. For example, to install the pendant theme, you would use the following URL:

```text
https://playground.wordpress.net/?theme=pendant
```

You can go ahead and try it out. The Playground will automatically install the theme and log you in as an admin. You may even embed this URL in your website using an `<iframe>` tag:

```html
<iframe src="https://playground.wordpress.net/?theme=pendant"></iframe>
```

## Available options

| Option         | Default Value | Description                                                                                                                                                                                                                                                                                                                                                    |
| -------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `php`          | `8.0`         | Loads the specified PHP version. Supported values: `5.6`, `7.0`, `7.1`, `7.2`, `7.3`, `7.4`, `8.0`, `8.1`, `8.2`, `latest`                                                                                                                                                                                                                                     |
| `wp`           | `latest`      | Loads the specified WordPress version. Supported values: `5.9`, `6.0`, `6.1`, `6.2`, `6.3`, `latest`, `nightly`                                                                                                                                                                                                                                                                  |
| `plugin`       |               | Installs the specified plugin. Use the plugin name from the plugins directory URL, e.g. for a URL like `https://wordpress.org/plugins/wp-lazy-loading/`, the plugin name would be `wp-lazy-loading`. You can pre-install multiple plugins by saying `plugin=coblocks&plugin=wp-lazy-loading&…`. Installing a plugin automatically logs the user in as an admin |
| `theme`        |               | Installs the specified theme. Use the theme name from the themes directory URL, e.g. for a URL like `https://wordpress.org/themes/disco/`, the theme name would be `disco`. Installing a theme automatically logs the user in as an admin                                                                                                                      |
| `url`          | `/wp-admin/`  | Load the specified initial page displaying WordPress                                                                                                                                                                                                                                                                                                           |
| `mode`         | `seamless`    | Displays WordPress on a full-page or wraps it in a browser UI                                                                                                                                                                                                                                                                                                  |
| `lazy`         |               | Defer loading the Playground assets until someone clicks on the "Run" button                                                                                                                                                                                                                                                                                   |
| `login`        | `1`           | Logs the user in as an admin                                                                                                                                                                                                                                                                                                                                   |
| `gutenberg-pr` |               | Loads the specified Gutenberg Pull Request                                                                                                                                                                                                                                                                                                                     |
| `storage`      |               | Selects the storage for Playground: `temporary` gets erased on page refresh, `browser` is stored in the browser, and `device` is stored in the selected directory on a device. The last two protect the user from accidentally losing their work upon page refresh.                                                                            |

For example, the following code embeds a Playground with a preinstalled Gutenberg plugin, and opens the post editor:

```html
<iframe src="https://playground.wordpress.net/?plugin=gutenberg&url=/wp-admin/post-new.php&mode=seamless"> </iframe>
```
