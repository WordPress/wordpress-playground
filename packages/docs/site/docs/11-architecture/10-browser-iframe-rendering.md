# Iframe-based rendering

To avoid page reloads, all the `PHPRequestHandler` responses must be rendered in an iframe. Remember, the entire setup only lives as long as the main `index.html`. We want to avoid reloading the main app at all costs.

In our app example above, `index.php` renders the following HTML:

```html
<a href="page.php">Go to page.php</a>
```

Imagine our `index.html` rendered it in a `<div>` instead of an `<iframe>`. As soon as you click on that link, the browser will try to navigate from `index.html` to `page.php`. However, `index.html` runs the entire PHP app, including the Worker Thread, the PHPRequestHandler, and the traffic control connecting them to the Service Worker. Navigating away from it would destroy the app.

Now, consider an iframe with the same link in it:

```html
<iframe srcdoc='<a href="page.php">Go to page.php</a>'></iframe>
```

This time, click the link in the browser to load `page.php` **inside the iframe**. The top-level `index.html`, where the PHP application runs, remains unaffected. That's why iframes are crucial for the `@php-wasm/web` setup.

:::info Crash reports
Playground doesn't collect crash reports automatically. Instead, it prompts users to submit a crash report when an instance fails to run in the browser.

The report includes a log, description, and a URL, and users can modify it before submitting it.

The [Logger API](https://github.com/WordPress/wordpress-playground/blob/trunk/packages/playground/website/public/logger.php) handles it from there. This simple REST API validates the data and sends it to the **Making WordPress** [#playground-logs Slack channel](https://wordpress.slack.com/archives/C06Q5DCKZ3L).
:::

## Iframes caveats

-   `target="_top"` isn't handled yet, so clicking links with `target="_top"` will reload the page you’re working on.
-   JavaScript popups originating in the `iframe` may not always display.
