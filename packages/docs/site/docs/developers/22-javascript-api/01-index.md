# JavaScript API

WordPress Playground comes with a JavaScript API client that grants you full control over your WordPress.

:::info API here doesn't mean "REST API"

WordPress Playground is a browser-based application.
The term API here refers to a set of functions you can
call inside JavaScript. This is **not** a network-based REST API.

:::

## Quick start

To use the JavaScript API, you'll need:

-   An `<iframe>` element
-   The `@wp-playground/client` package (from npm or a CDN)

Here's the shortest example of how to use the JavaScript API in a HTML page:

import JSApiShortExample from '@site/docs/\_fragments/\_js_api_short_example.mdx';

<JSApiShortExample />

:::info /remote.html is a special URL

`/remote.html` is a special URL that loads the Playground
API endpoint instead of the demo app with the browser UI. Read more about the difference between `/` and `/remote.html` and [on this page](./02-index-html-vs-remote-html.md).

:::

## Controlling the website

Now that you have a `client` object, you can use it to control the website inside the iframe. There are three ways to do that:

-   [Playground API Client](./03-playground-api-client.md)
-   [Blueprint JSON](./04-blueprint-json-in-api-client.md)
-   [Blueprint functions](./05-blueprint-functions-in-api-client.md)

## Debugging and testing

For quick testing and debugging, the JavaScript API client is exposed as `window.playground` by both `index.html` and `remote.html`.

```javascript
> await playground.listFiles("/")
(6) ['tmp', 'home', 'dev', 'proc', 'internal', 'wordpress']
```

Note that in `index.html`, `playground` is a Proxy object and you won't get any autocompletion from the browser. In `remote.html`,
however, `playground` is a class instance and you will benefit from browser's autocompletion.
