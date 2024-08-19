# WebAssembly PHP

WordPress Playground build [the PHP interpreter](https://github.com/php/php-src) to WebAssembly using [Emscripten](https://emscripten.org/docs/porting/networking.html) and a [dedicated pipeline](https://github.com/WordPress/wordpress-playground/blob/0d451c33936a8db5b7a158fa8aad288c19370a7d/packages/php-wasm/compile/Dockerfile).

![Building C programs to WebAssembly](@site/static/img/c-programs-general.png)

Building PHP to WebAssembly is very similar to building vanilla PHP. The wasm build required [adjusting a function signature here](https://github.com/WordPress/wordpress-playground/blob/0d451c33936a8db5b7a158fa8aad288c19370a7d/packages/php-wasm/compile/build-assets/php7.1.patch#L8-L9), [forcing a config variable there](https://github.com/WordPress/wordpress-playground/blob/0d451c33936a8db5b7a158fa8aad288c19370a7d/packages/php-wasm/compile/Dockerfile#L495), and applying [a few small patches](https://github.com/WordPress/wordpress-playground/tree/0d451c33936a8db5b7a158fa8aad288c19370a7d/packages/php-wasm/compile/build-assets), but there's relatively few adjustments involved.

![Building PHP to WebAssembly](@site/static/img/c-programs-php.png)

However, vanilla PHP builds aren't very useful in the browser. As a server software, PHP doesn't have a JavaScript API to pass the request body, upload files, or populate the `php://stdin` stream. WordPress Playground had to build one from scratch. The WebAssembly binary comes with a [dedicated PHP API module](https://github.com/WordPress/wordpress-playground/blob/0d451c33936a8db5b7a158fa8aad288c19370a7d/packages/php-wasm/compile/build-assets/php_wasm.c) written in C and a [JavaScript PHP class](https://github.com/WordPress/wordpress-playground/blob/da38192af57a95699d8731c855b82ac0222df61b/packages/php-wasm/common/src/lib/php.ts) that exposes methods like writeFile() or run().

Because every PHP version is just a static .wasm file, the PHP version switcher is actually pretty boring. It simply tells the browser to download, for example, `php_7_3.wasm` instead of, say, `php_8_2.wasm`.

![Building different versions of PHP to WebAssembly](@site/static/img/c-programs-php-versions.png)

### Networking support varies between platforms

When it comes to networking, WebAssembly programs are limited to calling JavaScript APIs. It is a safety feature, but also presents a challenge. How do you support low-level, synchronous networking code used by PHP with the high-level asynchronous APIs available in JavaScript?

In Node.js, the answer involves a WebSocket to TCP socket proxy, [Asyncify](https://emscripten.org/docs/porting/asyncify.html), and patching deep PHP internals like php_select. It's complex, but there's a reward. The Node.js-targeted PHP build can request web APIs, install composer packages, and even connect to a MySQL server.

In the browser, networking is supported to a limited extent. Network calls initiated using `wp_safe_remote_get`, like the ones in the plugin directory or the font library, are translated into `fetch()` calls and succeed if the remote server sends the correct CORS headers. However, a full support for arbitrary HTTPS connection involves opening a raw TCP socket which is not possible in the browser. There is an [open GitHub issue](https://github.com/WordPress/wordpress-playground/issues/85) that explores possible ways of addressing this problem.
