# Iframe-based rendering

All the PHPRequestHandler responses must be rendered in an iframe to avoid reloading the page. Remember, the entire setup only lives as long as the main `index.html`. We want to avoid reloading the main app at all cost.

In our app example above, `index.php` renders the following HTML:

```html
<a href="page.php">Go to page.php</a>
```

Imagine our `index.html` rendered it in a `<div>` instead of an `<iframe>`. As soon as you clicked on that link, the browser would try to navigate from `index.html` to `page.php`. However, `index.html` runs the entire PHP app including the Worker Thread, the PHPRequestHandler, and the traffic control connecting them to the Service Worker. Navigating away from it would destroy the app.

Now, consider an iframe with the same link in it:

```html
<iframe srcdoc='<a href="page.php">Go to page.php</a>'></iframe>
```

This time, clicking the link the browser to load `page.php` **inside the iframe**. The top-level index.html where the PHP application runs remains unaffected. This is why iframes are a crucial part of the `@php-wasm/web` setup.

## Iframes caveats

-   `target="_top"` isn't handled yet, so clicking links with `target="_top"` will reload the page you’re working on.
-   JavaScript popup originating in the `iframe` may not always display.
