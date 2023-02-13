# Embedding WordPress Playground on other websites

The easiest way to integrate is to [link to the demo](https://developer.wordpress.org/playground/demo/) ([like this tutorial on Learn WordPress](https://learn.wordpress.org/tutorial/the-key-to-locking-blocks/)). If you’re looking for more control, you can choose to embed WordPress Playground directly on your site.

**These features described in this document are experimental and may break or change without a warning.**

The latest build available at [https://wasm.wordpress.net/wordpress.html](https://wasm.wordpress.net/wordpress.html) may be embedded using the `<iframe>` HTML tag:

```html
<iframe
    style="width: 800px; height: 500px;"
    src="https://wasm.wordpress.net/wordpress.html?mode=seamless"
></iframe>
```

Notice how the URL says `mode=seamless`. This is a configuration option that turns off the "browser UI" and gives WordPress the entire available space.

Here's the full list of supported configuration options:

* `mode=seamless` or `mode=browser` – Displays WordPress on a full-page or wraps it in a browser UI
* `login=1` – Logs the user in as an admin.
* `url=/wp-admin/` – Load the specified initial page displaying WordPress
* `plugin=coblocks` – Installs the specified plugin. Use the plugin name from the plugins directory URL, e.g. for a URL like `https://wordpress.org/plugins/wp-lazy-loading/`, the plugin name would be `wp-lazy-loading`. You can pre-install multiple plugins by saying `plugin=coblocks&plugin=wp-lazy-loading&…`. Installing a plugin automatically logs the user in as an admin.
* `theme=disco` – Installs the specified theme. Use the theme name from the themes directory URL, e.g. for a URL like `https://wordpress.org/themes/disco/`, the theme name would be `disco`. Installing a theme automatically logs the user in as an admin.
* `php=8.1` – Default: 8.0 Loads the specified PHP version. Supported values: `5.6`, `7.0`, `7.1`, `7.2`, `7.3`, `7.4`, `8.0`, `8.1`, `8.2`.
* `wp=6.1` – Default: 6.1 Loads the specified PHP version. Supported values: `5.9`, `6.0`, `6.1`.
* `rpc=1` – Enables the experimental JavaScript API.

For example, the following code embeds a Playground with a preinstalled Gutenberg plugin, and opens the post editor:

```html
<iframe
    style="width: 800px; height: 500px;"
    src="https://wasm.wordpress.net/wordpress.html?plugin=gutenberg&url=/wp-admin/post-new.php&mode=seamless"
></iframe>
```

## Controlling the embedded WordPress Playground via JavaScript API

**The JavaScript API is an early preview and will likely evolve in the future.**

The embedded Playground can be controlled from JavaScript via `window.postMessage` when the `rpc=1` option is set:

```js
// Ask WordPress Playground whether it has finished booting:
document.querySelector('#playground').contentWindow.postMessage({
   type: 'is_booted',
   requestId: 1
}, '*');

// Receive the messages from WordPress Playground:
window.addEventListener('message', function handleResponse(e) {
   if(e.data.type === 'response' && e.data.requestId === 1 && e.data.response === true) {
      // Navigate to wp-admin once WordPress Playground was booted:
      document.querySelector('#playground').contentWindow.postMessage({
         type: 'go_to',
         path: '/wp-admin/index.php',
      }, '*');
   }
});
```

There isn't yet an npm package to automate the communication, but you could use the utilities implemented available in the WordPress Playground repository:

```js
import { postMessageExpectReply, awaitReply, responseTo } from 'wordpress-playground/src/php-wasm-browser';

const iframe = document.getElementById('wp-playground');
const requestId = postMessageExpectReply(
   iframe.contentWindow,  // Message target
   { type: 'is_booted' }, // requestId is handled automatically
   '*'
);
try {
   const isBooted = await awaitReply(window, requestId, 50); // 50ms timeout
   if(isBooted) {
      iframe.contentWindow.postMessage({
         type: 'go_to',
         path: '/wp-admin/index.php'
      }, '*')
   }
} catch(e) {
   // No response received within timeout.
}
```

WordPress Playground accepts the following messages:

* `{"type": "is_booted", "requestId": <number>}` – Replies with true if the Playground is loaded and ready for messages.
* `{"type": "go_to", "path": <string>}` – Navigates to the requested path.
* `{"type": "rpc", "method": <string>, "args": <string[]>, "requestId": <number>}` – Calls one of the following functions:
  * `run(phpCode: string):` Promise<`{ exitCode: number; stdout: ArrayBuffer; stderr: string[]; }`>
  * `HTTPRequest(request: PHPRequest):` Promise<`{ body: ArrayBuffer; text: string; headers: Record<string, string>; statusCode: number; exitCode: number; rawError: string[]; }`>
  * `readFile(path: string):` Promise<string>
  * `writeFile(path: string, `contents: string): Promise<void>
  * `unlink(path: string):` Promise<void>
  * `mkdirTree(path: string):` Promise<void>
  * `listFiles(path: string):` Promise<string[]>
  * `isDir(path: string):` Promise<boolean>

WordPress Playground will send you the following messages:

* `{ "type": "response", "requestId": <number>, "response": <any> }` – A response to the message you sent earlier, identified by a unique requestId .
* `{ "type": "new_path", "path": <string> }` – Whenever a new page is loaded in the Playground.
