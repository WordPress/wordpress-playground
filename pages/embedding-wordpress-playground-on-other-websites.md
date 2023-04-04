# Embedding WordPress Playground on other websites

The easiest way to integrate is to [link to the demo](https://developer.wordpress.org/playground/demo/) ([like this tutorial on Learn WordPress](https://learn.wordpress.org/tutorial/the-key-to-locking-blocks/)). If you’re looking for more control, you can choose to embed WordPress Playground directly on your site.

**These features described in this document are experimental and may break or change without a warning.**

The latest build available at [https://playground.wordpress.net/](https://playground.wordpress.net/) may be embedded using the `<iframe>` HTML tag:

```html
<iframe
	style="width: 800px; height: 500px;"
	src="https://playground.wordpress.net/?mode=seamless"
></iframe>
```

Notice how the URL says `mode=seamless`. This is a configuration option that turns off the "browser UI" and gives WordPress the entire available space.

Here's the full list of supported configuration options:

-   `mode=seamless` or `mode=browser` – Displays WordPress on a full-page or wraps it in a browser UI
-   `login=1` – Logs the user in as an admin.
-   `url=/wp-admin/` – Load the specified initial page displaying WordPress
-   `plugin=coblocks` – Installs the specified plugin. Use the plugin name from the plugins directory URL, e.g. for a URL like `https://wordpress.org/plugins/wp-lazy-loading/`, the plugin name would be `wp-lazy-loading`. You can pre-install multiple plugins by saying `plugin=coblocks&plugin=wp-lazy-loading&…`. Installing a plugin automatically logs the user in as an admin.
-   `theme=disco` – Installs the specified theme. Use the theme name from the themes directory URL, e.g. for a URL like `https://wordpress.org/themes/disco/`, the theme name would be `disco`. Installing a theme automatically logs the user in as an admin.
-   `php=8.1` – Default: 8.0 Loads the specified PHP version. Supported values: `5.6`, `7.0`, `7.1`, `7.2`, `7.3`, `7.4`, `8.0`, `8.1`, `8.2`.
-   `wp=6.1` – Default: 6.1 Loads the specified PHP version. Supported values: `5.9`, `6.0`, `6.1`.
-   `rpc=1` – Enables the experimental JavaScript API.

For example, the following code embeds a Playground with a preinstalled Gutenberg plugin, and opens the post editor:

```html
<iframe
	style="width: 800px; height: 500px;"
	src="https://playground.wordpress.net/?plugin=gutenberg&url=/wp-admin/post-new.php&mode=seamless"
></iframe>
```

## Controlling the embedded WordPress Playground via JavaScript API

**The JavaScript API is an early preview and will likely evolve in the future.**

Use the [`connectPlayground`](/functions/_wp_playground_client.connectPlayground.html) function to control a Playground instance embedded in an iframe:

```ts
const playgroundClient = connectPlayground(
	// An iframe pointing to https://playground.wordpress.net/remote.html
	iframe
);

const output = await playgroundClient.run({
	code: `<?php echo "Hello, world!";`,
});
console.log(output);

const response = await playgroundClient.request({
	relativeUrl: '/wp-login.php',
	method: 'GET',
});
console.log(response);

await playgroundClient.goTo({ relativeUrl: '/wp-admin' });
```

For more details see the [`PlaygroundClient`](/interfaces/_wp_playground_client.PlaygroundClient.html) and read the [`playground website source code`](https://github.com/WordPress/wordpress-playground/blob/trunk/src/packages/playground/website).
