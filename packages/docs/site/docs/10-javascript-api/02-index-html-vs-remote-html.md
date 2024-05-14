---
sidebar_position: 3
---

# `remote.html` vs `index.html`

[playground.wordpress.net](https://playground.wordpress.net/) exposes two distinct APIs through two separate HTML files: `remote.html` and `index.html`. Here's an overview of their functions and differences:

-   `index.html` uses WordPress Playground API client to control the "endpoint" that is `remote.html`.
-   The [Query API](../08-query-api/01-index.md) is exclusively provided by `index.html`, independent of the WordPress Playground JavaScript API.
-   The [JavaScript API](../10-javascript-api/01-index.md) is exclusively provided by `remote.html`. Only that file can be used as an "endpoint" for the `PlaygroundClient` class.

Here's a bit more about each of these files:

## Remote.html

`remote.html` runs and renders WordPress and also exposes an API for developers to control it. Importantly, `remote.html` does not render any UI elements, such as browser UI or version switchers. It's just WordPress. The primary functions of `remote.html` are:

-   Loading the suitable version of php.wasm, the WebAssembly build of PHP.
-   Loading the correct version of WordPress for user interaction.
-   Initiating PHP in a WebWorker and registering a ServiceWorker for HTTP requests.
-   Listening to the `message` event from the parent window and executing the appropriate code command.

That last part is how the public API works. The parent window (`index.html`) sends a message to the iframe (`remote.html`) with a command and arguments, and the iframe then executes that command and sends the result back with another message.

Sending messages is cumbersome so the PlaygroundClient class provides an object-oriented API that handles the messages internally.

For quick testing and debugging, `remote.html` also exposes the JavaScript API client as `window.playground`. You can use it from your devtools as follows:

```javascript
> await playground.listFiles("/")
(6) ['tmp', 'home', 'dev', 'proc', 'internal', 'wordpress']
```

`playground` is a class instance in this context and you will benefit from browser's autocompletion.

## Index.html

`index.html` is an independent app built around `remote.html` using the WordPress Playground API client.

It renders the browser UI, version selectors, and renders WordPress by embedding `remote.html` via an iframe. UI features like an address bar or a version selector are implemented by communicating with `remote.html` using `PlaygroundClient`.

`index.html` monitors the query parameters it receives and triggers the appropriate `PlaygroundClient` methods. For instance, `?plugin=coblocks` triggers `installPluginsFromDirectory( client, ['coblocks'] )`. This mechanism forms the basis of the Query API.

For quick testing and debugging, `index.html` also exposes the JavaScript API client as `window.playground`. You can use it from your devtools as follows:

```javascript
> await playground.listFiles("/")
(6) ['tmp', 'home', 'dev', 'proc', 'internal', 'wordpress']
```

Note that `playground` is a Proxy object in this context and you won't get any autocompletion from the browser.
