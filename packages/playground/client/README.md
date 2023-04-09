# Playground Client

Provides a [PlaygroundClient](https://wordpress.github.io/wordpress-playground/interfaces/_wp_playground_client.PlaygroundClient.html) that can be used to control a WordPress Playground iframe:

```ts
import { connectPlayground } from '@wp-playground/client';

const client = await connectPlayground(
	// An iframe pointing to https://playground.wordpress.net/remote.html
	document.getElementById('wp')! as HTMLIFrameElement
);
// client is now a PlaygroundClient instance
await client.isReady();
await client.goTo('/wp-admin/');

const result = await client.run({
	code: '<?php echo "Hi!"; ',
});
console.log(new TextDecoder().decode(result.body));
```

Using TypeScript is highly recommended as this package ships with comprehensive types – hit ctrl+space in your IDE after `client.` and you'll see all the available methods.

## Helpers

The `@wp-playground/client` package also provides a few helpers:

-   [login](https://wordpress.github.io/wordpress-playground/functions/_wp_playground_client.login.html) - Logs the user in to wp-admin.
-   [installPlugin](https://wordpress.github.io/wordpress-playground/functions/_wp_playground_client.installPlugin.html) - Installs a plugin from a given zip file.
-   [installPluginsFromDirectory](https://wordpress.github.io/wordpress-playground/functions/_wp_playground_client.installPluginsFromDirectory.html) - Downloads and installs one or more plugins from the WordPress Plugin Directory.
-   [activatePlugin](https://wordpress.github.io/wordpress-playground/functions/_wp_playground_client.activatePlugin.html) - Activates a specific plugin.
-   [installTheme](https://wordpress.github.io/wordpress-playground/functions/_wp_playground_client.installTheme.html) - Installs a theme from a given zip file.
-   [installThemeFromDirectory](https://wordpress.github.io/wordpress-playground/functions/_wp_playground_client.installThemeFromDirectory.html) - Downloads and installs a theme with a specific name from the WordPress Theme Directory.
