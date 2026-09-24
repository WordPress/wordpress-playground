# WebAssembly PHP for the web

This package ships WebAssembly PHP binaries and the JavaScript API optimized for the web and a low bundle size.

Here's how to use it:

```js
import { PHP, PHPRequestHandler } from '@php-wasm/universal';
import { loadWebRuntime } from '@php-wasm/web';

// The PHP loader resolves its own .wasm file with
// new URL('./8_5_10/php_8_5.wasm', import.meta.url).
// See "Usage with bundlers" below for the options each bundler still needs.
const php = new PHP(await loadWebRuntime('8.5'));

let response;

php.writeFile('/test.php', `<?php echo "Hello, World!"; ?>`);

// Run a script directly:
response = await php.runStream({
	scriptPath: '/test.php',
});

console.log(await response.stdoutText);
// You will see the following output in the browser console:
// Hello, World!

php.mkdir('/www');
php.writeFile('/www/index.php', `<?php echo "Hello " . $_POST['name']; ?>`);

// Or use the familiar HTTP concepts:
const handler = new PHPRequestHandler({ phpFactory: async () => php });

response = await handler.request({
	method: 'POST',
	url: 'index.php',
	body: { name: 'John' },
});

console.log(response.text);
// You will see the following output in the browser console:
// Hello John
```

## Loading PHP extensions

Pass `extensions` to `loadWebRuntime()` to load optional PHP extensions before
PHP starts:

```js
const php = new PHP(
	await loadWebRuntime('8.4', {
		extensions: ['intl'],
	})
);
```

`@php-wasm/web` ships the `intl` extension. Browser builds can also load
external JSPI `.so` artifacts from a manifest:

```js
const php = new PHP(
	await loadWebRuntime('8.4', {
		extensions: [
			{
				source: {
					format: 'manifest',
					manifestUrl: new URL('/extensions/wp_mysql_parser/manifest.json', location.href),
				},
			},
		],
	})
);
```

In browser runtimes, pass an HTTP(S) URL or a `URL` object. Relative artifact
files in the manifest are resolved against the manifest URL.

External extensions are only supported when JSPI is available. Asyncify support
is limited to the bundled `intl` extension shipped with this package.

## Usage with bundlers

If you use `@php-wasm/web` with a bundler such as Vite, you may see the following errors:

```
✘ [ERROR] No loader is configured for ".dat" files: node_modules/@php-wasm/web/shared/icu.dat

    node_modules/@php-wasm/web/index.js:2276:88:
      2276 │ ...i), a = (await import("./shared/icu.dat")).default, [_, S] = ...
```

The `@php-wasm/web` package imports a few non-JavaScript assets file using the import syntax. This ensures
all the required dependencies may be tracked statically, but it creates an inconvenience for apps relying
on bundlers.

To resolve that error, you'll need to configure your bundler to resolve the import above to the URL
of the `icu.dat` in your app, e.g. `https://playground.wordpress.net/assets/icu.dat`.

### Vite

In Vite, you can use the following options to support importing all the required assets types:

```js
export default defineConfig({
	assetsInclude: [/\.dat$/, /\.so$/, /\.la$/],
	optimizeDeps: {
		exclude: ['@php-wasm/web'],
	},
});
```

`optimizeDeps.exclude` is required. Without it, the Vite dev server pre-bundles the PHP loader into
`node_modules/.vite`, `new URL('./8_5_10/php_8_5.wasm', import.meta.url)` resolves against that
directory, and the request for the `.wasm` file returns 404.

### webpack 5

webpack 5 resolves `new URL('./8_5_10/php_8_5.wasm', import.meta.url)` on its own and emits the
`.wasm` file as an asset. An earlier version of this README asked you to add a `file-loader` rule for
`.wasm`. Delete that rule: `file-loader` also matches the `new URL()` asset and returns the string
`[object%20Module]`, so PHP never starts. Keep the rule only if other code still imports `.wasm`
files, and exclude URL dependencies from it:

```js
{
	test: /\.wasm$/,
	loader: 'file-loader',
	dependency: { not: ['url'] },
}
```

### esbuild

esbuild leaves `new URL(..., import.meta.url)` as written. Builds no longer need
`--loader:.wasm=file`, but you must serve the PHP version directories, such as `8_5_10/`, next to the
bundle.

Other bundlers will typically have analogous options or plugins. If you create a working configuration for
another bundler, feel free to propose a new configuration example for this README at
https://github.com/WordPress/wordpress-playground/edit/trunk/packages/php-wasm/web/README.md

## Attribution

`@php-wasm/web` started as a fork of the original PHP to WebAssembly build published by Oraoto in https://github.com/oraoto/pib and modified by Sean Morris in https://github.com/seanmorris/php-wasm.
