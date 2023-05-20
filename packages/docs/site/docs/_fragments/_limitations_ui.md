### You can't access the Plugins or Themes Directory in the browser

The web version of WordPress does not support network connections, so the plugin directory in wp-admin is not available. However, you can still upload plugins and open them with "?plugin=coblocks" or a similar query string.

You can track the progress of adding network support in the browser at https://github.com/WordPress/wordpress-playground/issues/85.

### When you refresh the page, you'll lose anything you did (unless you export it)

In the web version of WordPress Playground, all database changes and uploads are gone once the page is refreshed. Preserving them would be useful for courses, technical demos, even sharing a link to your changes.

Be sure to [export your work](../02-start-using/01-index.md#save-your-site) before you close the page.

You can track the progress of support for persisting the changes at https://github.com/WordPress/wordpress-playground/issues/19
