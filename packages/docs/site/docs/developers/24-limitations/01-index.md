---
slug: /developers/limitations
description: Learn about the current limitations of WordPress Playground, including browser-specific behaviors, temporary storage by design, iframe quirks, and WP-CLI support.
---

# Limitations

WordPress Playground is under active development and has some limitations you should keep in mind when running it and developing with it.

You can track the status of these issues on the [Playground Project board](https://github.com/orgs/WordPress/projects/180).

## In the browser {#in-the-browser}

### Temporary by design {#temporary-by-design}

Playground creates fresh WordPress instances on each page load. Refreshing the browser page discards all database changes, uploads, and modifications.

**Why this happens**: Playground streams WordPress directly to your browser rather than serving it from a traditional server. Each refresh starts a clean slate.

**To persist your work:**

- **Save**: Enable browser storage via the "Save" button (top right, next to address bar), before refreshing the page via the browser bar.
- **For development**: Use [Playground CLI](/developers/local-development/wp-playground-cli) which supports persistent local storage

:::tip
The dedicated refresh button inside Playground only reloads WordPress content—it preserves your PHP/WP state. The browser's refresh button (F5 or Cmd+R) destroys the entire instance.
:::

![Refresh Playground Button](@site/static/img/refresh-playground-button.webp)

<blockquote>
<figure>
<figcaption><i>1. Exporting Playground:</i></figcaption>

![Save Button](@site/static/img/export-playground.webp)

</figure>

<figure>
<figcaption><i>2. Save button:</i></figcaption>

![Save Button](@site/static/img/saving-playground.webp)

</figure>
</blockquote>

### Browser support {#browser-support}

WordPress Playground is designed to work across all major desktop and mobile browsers. This includes:

- **Desktop browsers**: Chrome, Firefox, Safari, Edge, and other Chromium-based browsers
- **Mobile browsers**: Safari (iOS), Chrome (Android), and other mobile browser variants

Playground leverages modern web technologies and should function consistently across these browser environments. However, some advanced features may have varying levels of support depending on the specific browser and its version.

### Performance expectations {#performance-expectations}

Loading times vary based on what Playground needs to set up:

| Scenario                               | Typical Load Time          |
| -------------------------------------- | -------------------------- |
| Fresh WordPress (no plugins)           | 5-10 seconds               |
| With small plugins                     | 10-20 seconds              |
| With large plugins (e.g., WooCommerce) | 30-60 seconds              |
| On mobile devices                      | 1.5-2x slower than desktop |

![Save Button](@site/static/img/playground-performance-graph.webp)

**Factors that affect performance:**

- **Plugin size**: Large plugins take longer to install at runtime
- **Network speed**: WASM files are 15-30MB
- **Device memory**: Low-memory devices may experience slowdowns
- **Browser**: Chrome/Edge perform best; Safari slightly slower

<blockquote>
<strong>Note:</strong> Opera Mini support is not currently confirmed.
</blockquote>

## When developing with Playground {#when-developing-with-playground}

### Iframe quirks {#iframe-quirks}

Playground renders WordPress in an [`iframe`](/developers/architecture/browser-iframe-rendering) so clicking links with `target="_top"` will reload the page you’re working on.
Also, JavaScript popups originating in the `iframe` may not always display.

### Run WordPress PHP functions {#run-wordpress-php-functions}

Playground supports running PHP code in Blueprints using the [`runPHP` step](/blueprints/steps#RunPHPStep). To run WordPress-specific PHP functions, you’d need to first require [wp-load.php](https://github.com/WordPress/WordPress/blob/master/wp-load.php):

```json
{
	"step": "runPHP",
	"code": "<?php require_once('wordpress/wp-load.php'); OTHER_CODE ?>"
}
```

### Using WP-CLI {#using-wp-cli}

You can execute `wp-cli` commands via the Blueprints [`wp-cli`](/blueprints/steps#WPCLIStep) step. However, since Playground runs in the browser, it doesn't support the [full array](https://developer.wordpress.org/cli/commands/) of available commands. While there is no definite list of supported commands, experimenting in [the online demo](https://playground.wordpress.net/demos/wp-cli.html) will help you assess what's possible.
