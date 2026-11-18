---
title: PHP এক্সটেনশন লোড করা
slug: /developers/apis/javascript-api/php-extensions
description: Node.js এবং ব্রাউজার রানটাইমে বান্ডল করা এবং বাহ্যিক PHP.wasm এক্সটেনশন লোড করুন।
---

<!--
# Loading PHP extensions
-->

# PHP এক্সটেনশন লোড করা (Loading PHP extensions) {#loading-php-extensions}

<!--
PHP reads extension declarations while it starts. In PHP.wasm, that means
extensions must be declared before `loadNodeRuntime()` or `loadWebRuntime()`
creates the runtime.
-->

PHP শুরু হওয়ার সময় এক্সটেনশন ডিক্লারেশনগুলো পড়ে। PHP.wasm-এ এর অর্থ হলো `loadNodeRuntime()` বা `loadWebRuntime()` রানটাইম তৈরি করার আগেই এক্সটেনশনগুলো অবশ্যই ডিক্লেয়ার করতে হবে।

<!--
Use the `extensions` array for both bundled extensions and external `.so`
artifacts.
-->

বান্ডল করা (bundled) এক্সটেনশন এবং বাহ্যিক (external) `.so` আর্টিফ্যাক্ট উভয়ের জন্যই `extensions` অ্যারে ব্যবহার করুন।

<!--
Use external PHP.wasm extensions when the code that must be fast or native-like
is too hot for PHP userland, but you still want to ship it with a Playground
demo, CLI workflow, or embedded app. The same manifest can be loaded by the
JavaScript API, the Playground web Query API, and Playground CLI.
-->

যখন কোনো কোড দ্রুত বা নেটিভের মতো গতিশীল হতে হয় এবং তা PHP ইউজারল্যান্ডের জন্য অতিরিক্ত কর্মক্ষমতা-নিবিড় (hot) হয়, অথচ আপনি সেটি একটি Playground ডেমো, CLI ওয়ার্কফ্লো বা এমবেডেড অ্যাপের সাথে সরবরাহ করতে চান, তখন বাহ্যিক PHP.wasm এক্সটেনশন ব্যবহার করুন। একই ম্যানিফেস্ট JavaScript API, Playground ওয়েব Query API এবং Playground CLI দিয়ে লোড করা যায়।

<!--
External extensions are JSPI side modules. If the browser or Node.js build does
not expose JSPI, PHP.wasm rejects the extension request instead of starting
with a partially loaded runtime.
-->

বাহ্যিক এক্সটেনশনগুলো হলো JSPI সাইড মডিউল। ব্রাউজার বা Node.js বিল্ড যদি JSPI সমর্থন না করে, তবে PHP.wasm একটি আংশিক লোড হওয়া রানটাইম শুরু করার পরিবর্তে এক্সটেনশনের অনুরোধটি প্রত্যাখ্যান করে।

<!--
## Bundled extensions
-->

## বান্ডল করা এক্সটেনশন (Bundled extensions) {#bundled-extensions}

<!--
`@php-wasm/node` ships `intl`, `xdebug`, `redis`, and `memcached`:
-->

`@php-wasm/node`-এর সাথে `intl`, `xdebug`, `redis`, এবং `memcached` অন্তর্ভুক্ত থাকে:

```ts
import { PHP } from '@php-wasm/universal';
import { loadNodeRuntime } from '@php-wasm/node';

const php = new PHP(
	await loadNodeRuntime('8.4', {
		extensions: ['intl', 'redis', 'memcached', { name: 'xdebug', options: { ideKey: 'PLAYGROUND' } }],
	})
);
```

<!--
`@php-wasm/web` currently ships `intl`:
-->

`@php-wasm/web`-এর সাথে বর্তমানে `intl` অন্তর্ভুক্ত থাকে:

```ts
import { PHP } from '@php-wasm/universal';
import { loadWebRuntime } from '@php-wasm/web';

const php = new PHP(
	await loadWebRuntime('8.4', {
		extensions: ['intl'],
	})
);
```

<!--
The old `withIntl`, `withXdebug`, `withRedis`, and `withMemcached` options are
still accepted where they already existed. New code should use `extensions`
because it also supports external extensions.
-->

পুরোনো `withIntl`, `withXdebug`, `withRedis`, এবং `withMemcached` অপশনগুলো যেখানে আগে থেকেই ছিল সেখানে এখনও গ্রহণযোগ্য। নতুন কোডে `extensions` ব্যবহার করা উচিত কারণ এটি বাহ্যিক এক্সটেনশনগুলোকেও সমর্থন করে।

<!--
## External extensions
-->

## বাহ্যিক এক্সটেনশন (External extensions) {#external-extensions}

<!--
An external extension needs a WebAssembly `.so` built for the same PHP version
as the PHP.wasm JSPI runtime. Publish the artifact with a manifest:
-->

একটি বাহ্যিক এক্সটেনশনের জন্য PHP.wasm JSPI রানটাইমের মতো একই PHP সংস্করণের জন্য নির্মিত একটি WebAssembly `.so` প্রয়োজন। একটি ম্যানিফেস্ট সহ আর্টিফ্যাক্টটি প্রকাশ করুন:

```json
{
	"name": "wp_mysql_parser",
	"version": "0.1.0",
	"artifacts": [
		{
			"phpVersion": "8.4",
			"sourcePath": "wp_mysql_parser-php8.4-jspi.so"
		}
	]
}
```

<!--
`sourcePath` may be an absolute URL or a path relative to the manifest URL. If
the manifest lives at
`https://cdn.example.com/extensions/wp_mysql_parser/manifest.json`, the
`sourcePath` above resolves to
`https://cdn.example.com/extensions/wp_mysql_parser/wp_mysql_parser-php8.4-jspi.so`.
-->

`sourcePath` একটি পরম (absolute) URL বা ম্যানিফেস্ট URL-এর সাপেক্ষে একটি আপেক্ষিক (relative) পাথ হতে পারে। যদি ম্যানিফেস্টটি `https://cdn.example.com/extensions/wp_mysql_parser/manifest.json`-এ থাকে, তবে উপরের `sourcePath` টি `https://cdn.example.com/extensions/wp_mysql_parser/wp_mysql_parser-php8.4-jspi.so`-তে রিসলভ হয়।

<!--
If the extension ships sidecar assets (UI files, data, empty directories), list
them under `extraFiles`. Each `node` declares its final VFS path as
`vfsRoot + vfsPath`:
-->

এক্সটেনশনটি যদি সাইডকার অ্যাসেট (UI ফাইল, ডেটা, ফাঁকা ডিরেক্টরি) সরবরাহ করে, তবে সেগুলোকে `extraFiles`-এর অধীনে তালিকাভুক্ত করুন। প্রতিটি `node` তার চূড়ান্ত VFS পাথকে `vfsRoot + vfsPath` হিসেবে ঘোষণা করে:

```json
{
	"name": "spx",
	"artifacts": [
		{
			"phpVersion": "8.4",
			"sourcePath": "spx-php8.4-jspi.so",
			"extraFiles": {
				"vfsRoot": "/internal/shared/spx",
				"nodes": [
					{ "vfsPath": "data", "type": "directory" },
					{ "vfsPath": "ui/index.html", "sourcePath": "ui/index.html" }
				]
			}
		}
	]
}
```

<!--
In Node.js, `manifestUrl` may be a local path, a `file:` URL, or an HTTP(S)
URL. Relative local paths are resolved from the current working directory:
-->

Node.js-এ `manifestUrl` একটি লোকাল পাথ, একটি `file:` URL, অথবা একটি HTTP(S) URL হতে পারে। আপেক্ষিক লোকাল পাথগুলো বর্তমান ওয়ার্কিং ডিরেক্টরি থেকে রিসলভ করা হয়:

```ts
const php = new PHP(
	await loadNodeRuntime('8.4', {
		extensions: [
			{
				source: {
					format: 'manifest',
					manifestUrl: './dist/wp_mysql_parser/manifest.json',
				},
			},
		],
	})
);
```

<!--
Node.js applies the same local-path support to direct artifact URLs and inline
manifest `baseUrl` values.
-->

Node.js সরাসরি আর্টিফ্যাক্ট URL এবং ইনলাইন ম্যানিফেস্টের `baseUrl` মানের ক্ষেত্রেও একই লোকাল-পাথ সমর্থন প্রয়োগ করে।

<!--
External extensions are only supported when JSPI is available. Asyncify support
is limited to the bundled extensions shipped with the PHP.wasm packages, such
as `intl`, `xdebug`, `redis`, and `memcached`.
-->

বাহ্যিক এক্সটেনশনগুলো কেবল তখনই সমর্থিত যখন JSPI উপলব্ধ থাকে। Asyncify সমর্থন শুধুমাত্র PHP.wasm প্যাকেজের সাথে আসা বান্ডল করা এক্সটেনশনগুলোর মধ্যেই সীমাবদ্ধ, যেমন `intl`, `xdebug`, `redis`, এবং `memcached`।

<!--
In the browser, pass an absolute URL or construct one with the base URL you want:
-->

ব্রাউজারে একটি পরম (absolute) URL পাস করুন অথবা আপনার কাঙ্ক্ষিত বেস URL দিয়ে একটি URL তৈরি করুন:

```ts
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

<!--
If you already have the manifest object in memory, pass `baseUrl` so relative
artifact files can still be resolved:
-->

আপনার মেমরিতে যদি ম্যানিফেস্ট অবজেক্টটি আগে থেকেই থাকে, তবে `baseUrl` পাস করুন যাতে আপেক্ষিক আর্টিফ্যাক্ট ফাইলগুলো তখনো রিসলভ করা যায়:

```ts
await loadNodeRuntime('8.4', {
	extensions: [
		{
			source: {
				format: 'manifest',
				manifest,
				baseUrl: 'https://cdn.example.com/extensions/wp_mysql_parser/',
			},
		},
	],
});
```

<!--
If you already have the `.so` bytes, skip the manifest:
-->

যদি আপনার কাছে ইতিমধ্যে `.so` বাইটগুলো থাকে, তবে ম্যানিফেস্ট এড়িয়ে যান:

```ts
await loadNodeRuntime('8.4', {
	extensions: [
		{
			name: 'wp_mysql_parser',
			source: {
				format: 'so',
				bytes,
			},
		},
	],
});
```

<!--
Use a direct artifact URL when the caller, not a manifest, chooses the artifact:
-->

যখন ম্যানিফেস্টের পরিবর্তে কলার নিজেই আর্টিফ্যাক্ট নির্বাচন করে, তখন একটি সরাসরি (direct) আর্টিফ্যাক্ট URL ব্যবহার করুন:

```ts
await loadWebRuntime('8.4', {
	extensions: [
		{
			source: {
				format: 'url',
				name: 'wp_mysql_parser',
				url: new URL('https://cdn.example.com/wp_mysql_parser-php8.4-jspi.so'),
			},
		},
	],
});
```

<!--
## Try published PHP.wasm extensions
-->

## প্রকাশিত PHP.wasm এক্সটেনশন ব্যবহার করে দেখুন (Try published PHP.wasm extensions) {#try-published-phpwasm-extensions}

<!--
Two projects publish ready-to-use manifests you can inspect before building
your own:

- [SQLite Database Integration native extension](https://wordpress.github.io/sqlite-database-integration/native-extension/)
  publishes `wp_mysql_parser`, a native lexer/parser used by the SQLite
  Database Integration plugin.
- [PHP Toolkit Native APIs WASM releases](https://wordpress.github.io/php-toolkit/wp_native_apis-wasm-extension/)
  publishes `wp_native_apis`, an experimental extension for WordPress native
  APIs.
-->

দুটি প্রজেক্ট ব্যবহারের জন্য প্রস্তুত ম্যানিফেস্ট প্রকাশ করে যা আপনার নিজস্ব এক্সটেনশন তৈরির আগে আপনি যাচাই করতে পারেন:

- [SQLite Database Integration নেটিভ এক্সটেনশন](https://wordpress.github.io/sqlite-database-integration/native-extension/) `wp_mysql_parser` প্রকাশ করে, যা SQLite Database Integration প্লাগিন দ্বারা ব্যবহৃত একটি নেটিভ লেক্সার/পার্সার।
- [PHP Toolkit Native APIs WASM রিলিজ](https://wordpress.github.io/php-toolkit/wp_native_apis-wasm-extension/) `wp_native_apis` প্রকাশ করে, যা ওয়ার্ডপ্রেসের নেটিভ API-এর জন্য একটি পরীক্ষামূলক এক্সটেনশন।

<!--
To try a published extension in Playground web, pass its manifest URL with the
`php-extension` Query API parameter. This loads the extension before PHP starts,
without writing any JavaScript:
-->

Playground ওয়েবে একটি প্রকাশিত এক্সটেনশন ব্যবহার করে দেখতে, `php-extension` Query API প্যারামিটারের সাথে এর ম্যানিফেস্ট URL পাস করুন। এটি কোনো JavaScript না লিখেই PHP শুরু হওয়ার আগে এক্সটেনশনটি লোড করে:

```text
https://playground.wordpress.net/?php=8.5&php-extension=https://wordpress.github.io/sqlite-database-integration/wp_mysql_parser-wasm-extension/latest/manifest.json
```

<!--
Use `/latest/manifest.json` for a quick demo. Use one of the pinned manifest
URLs from the extension release page for reproducible demos, tests, and
documentation links.
-->

দ্রুত ডেমোর জন্য `/latest/manifest.json` ব্যবহার করুন। পুনরাবৃত্তিযোগ্য (reproducible) ডেমো, টেস্ট এবং ডকুমেন্টেশন লিঙ্কের জন্য এক্সটেনশন রিলিজ পেজ থেকে পিন করা ম্যানিফেস্ট URL-গুলোর একটি ব্যবহার করুন।

<!--
Repeat the parameter to load more than one extension:
-->

একাধিক এক্সটেনশন লোড করতে প্যারামিটারটির পুনরাবৃত্তি করুন:

```text
https://playground.wordpress.net/?php=8.5&php-extension=https://example.com/one/manifest.json&php-extension=https://example.com/two/manifest.json
```

<!--
The Query API accepts absolute, root-relative, and page-relative manifest URLs.
After resolution, the manifest URL must use HTTP(S). For example, if your
Playground page is served from `https://example.com/tools/`, these are valid:
-->

Query API পরম (absolute), রুট-আপেক্ষিক (root-relative), এবং পেজ-আপেক্ষিক (page-relative) ম্যানিফেস্ট URL গ্রহণ করে। রিসলভ করার পর, ম্যানিফেস্ট URL-টি অবশ্যই HTTP(S) হতে হবে। উদাহরণস্বরূপ, যদি আপনার Playground পেজটি `https://example.com/tools/` থেকে পরিবেশিত হয়, তবে এগুলো বৈধ:

```text
?php-extension=https://cdn.example.com/wp_mysql_parser/manifest.json
?php-extension=/extensions/wp_mysql_parser/manifest.json
?php-extension=./extensions/wp_mysql_parser/manifest.json
```

<!--
The same manifest-loading path is documented in the
[Query API reference](/developers/apis/query-api).
-->

একই ম্যানিফেস্ট লোডিং পাথ [Query API রেফারেন্সে](/developers/apis/query-api) নথিভুক্ত আছে।

<!--
The same manifest works in Playground CLI:
-->

একই ম্যানিফেস্ট Playground CLI-তেও কাজ করে:

```bash
npx @wp-playground/cli@latest server \
	--php=8.5 \
	--php-extension=https://wordpress.github.io/sqlite-database-integration/wp_mysql_parser-wasm-extension/latest/manifest.json \
	--blueprint=https://wordpress.github.io/sqlite-database-integration/blueprint.json
```

<!--
When you embed Playground with `@wp-playground/client`, pass the same manifest
through the `extensions` option:
-->

আপনি যখন `@wp-playground/client` দিয়ে Playground এমবেড করবেন, তখন `extensions` অপশনের মাধ্যমে একই ম্যানিফেস্ট পাস করুন:

```html
<iframe id="wp"></iframe>
<script type="module">
	import { startPlaygroundWeb } from 'https://playground.wordpress.net/client/index.js';

	const client = await startPlaygroundWeb({
		iframe: document.getElementById('wp'),
		remoteUrl: 'https://playground.wordpress.net/remote.html',
		extensions: [
			{
				source: {
					format: 'manifest',
					manifestUrl: 'https://wordpress.github.io/sqlite-database-integration/wp_mysql_parser-wasm-extension/latest/manifest.json',
				},
			},
		],
	});

	await client.isReady();
</script>
```

<!--
Use the lower-level runtime API when you are building directly on
`@php-wasm/node` or `@php-wasm/web`:
-->

আপনি যখন সরাসরি `@php-wasm/node` বা `@php-wasm/web`-এর ওপর ভিত্তি করে তৈরি করছেন, তখন লোয়ার-লেভেল রানটাইম API ব্যবহার করুন:

```ts
import { PHP } from '@php-wasm/universal';
import { loadNodeRuntime } from '@php-wasm/node';

const php = new PHP(
	await loadNodeRuntime('8.5', {
		extensions: [
			{
				source: {
					format: 'manifest',
					manifestUrl: 'https://wordpress.github.io/sqlite-database-integration/wp_mysql_parser-wasm-extension/latest/manifest.json',
				},
			},
		],
	})
);
```

<!--
## Build your own extension
-->

## আপনার নিজস্ব এক্সটেনশন তৈরি করুন (Build your own extension) {#build-your-own-extension}

<!--
`@php-wasm/compile-extension` turns a normal `phpize` extension directory into
JSPI `.so` artifacts and a loadable manifest:
-->

`@php-wasm/compile-extension` একটি সাধারণ `phpize` এক্সটেনশন ডিরেক্টরিকে JSPI `.so` আর্টিফ্যাক্ট এবং একটি লোডযোগ্য ম্যানিফেস্টে রূপান্তরিত করে:

```bash
npx @php-wasm/compile-extension \
	--source ./wp-mysql-parser \
	--name wp_mysql_parser \
	--php-versions 8.0,8.1,8.2,8.3,8.4,8.5 \
	--out ./dist/wp_mysql_parser
```

<!--
Host the whole output directory from one static location. The manifest lets the
runtime select the artifact that matches the active PHP version and load it
before PHP starts.
-->

সম্পূর্ণ আউটপুট ডিরেক্টরি একটি স্ট্যাটিক লোকেশন থেকে হোস্ট করুন। ম্যানিফেস্ট রানটাইমকে সক্রিয় PHP সংস্করণের সাথে মিলে যাওয়া আর্টিফ্যাক্টটি নির্বাচন করতে এবং PHP শুরু হওয়ার আগে তা লোড করতে দেয়।

<!--
## Startup files
-->

## স্টার্টআপ ফাইল (Startup files) {#startup-files}

<!--
PHP loads extensions from `.ini` files it reads during startup. PHP.wasm builds
those files from the extension request before the runtime starts:
-->

PHP স্টার্টআপের সময় পঠিত `.ini` ফাইলগুলো থেকে এক্সটেনশন লোড করে। PHP.wasm রানটাইম শুরু হওয়ার আগেই এক্সটেনশন রিকোয়েস্ট থেকে সেই ফাইলগুলো তৈরি করে:

```ini
extension=/internal/shared/extensions/my_extension.so
my_extension.option=value
```

<!--
`loadWithIniDirective` chooses the first line of that generated `.ini` file.
Regular PHP extensions use `extension`. Zend extensions such as Xdebug use
`zend_extension`:
-->

`loadWithIniDirective` সেই জেনারেট করা `.ini` ফাইলের প্রথম লাইন নির্ধারণ করে। সাধারণ PHP এক্সটেনশনগুলো `extension` ব্যবহার করে। Zend এক্সটেনশন যেমন Xdebug `zend_extension` ব্যবহার করে:

```ini
zend_extension=/internal/shared/extensions/xdebug.so
xdebug.mode=debug,develop
```

<!--
The remaining startup options describe what PHP.wasm writes before PHP starts:

- `iniEntries`: extra lines in the generated extension `.ini` file.
- `extraFiles`: sidecar files staged in the PHP virtual filesystem.
- `env`: environment variables set before PHP starts.
- `extensionDir`: the virtual directory for the `.so` and generated `.ini`
  files.
-->

বাকি স্টার্টআপ অপশনগুলো PHP শুরু হওয়ার আগে PHP.wasm কী কী লেখে তা বর্ণনা করে:

- `iniEntries`: জেনারেট করা এক্সটেনশন `.ini` ফাইলে অতিরিক্ত লাইনগুলো।
- `extraFiles`: PHP ভার্চুয়াল ফাইলসিস্টেমে প্রস্তুত রাখা সাইডকার ফাইলগুলো।
- `env`: PHP শুরু হওয়ার আগে সেট করা এনভায়রনমেন্ট ভেরিয়েবলগুলো।
- `extensionDir`: `.so` এবং তৈরি হওয়া `.ini` ফাইলের জন্য ভার্চুয়াল ডিরেক্টরি।

<!--
A Zend extension needs `zend_extension` and usually several `.ini` entries:
-->

একটি Zend এক্সটেনশনের জন্য `zend_extension` এবং সাধারণত বেশ কয়েকটি `.ini` এন্ট্রি প্রয়োজন:

```ts
await loadNodeRuntime('8.4', {
	extensions: [
		{
			name: 'my_debugger',
			loadWithIniDirective: 'zend_extension',
			iniEntries: {
				'my_debugger.mode': 'debug',
				'my_debugger.start_with_request': 'yes',
			},
			source: { format: 'so', bytes },
		},
	],
});
```

<!--
An extension with data files can stage them before PHP starts and point the
extension at their virtual path. `extraFiles` keys are absolute VFS paths:
-->

ডেটা ফাইলসহ একটি এক্সটেনশন PHP শুরু হওয়ার আগে সেগুলোকে প্রস্তুত করতে পারে এবং এক্সটেনশনটিকে সেগুলোর ভার্চুয়াল পাথে নির্দেশ করতে পারে। `extraFiles`-এর key-গুলো হলো পরম (absolute) VFS পাথ:

```ts
await loadNodeRuntime('8.4', {
	extensions: [
		{
			name: 'my_text_extension',
			source: { format: 'so', bytes },
			env: {
				MY_TEXT_DATA: '/internal/shared/my_text_extension',
			},
			extraFiles: {
				files: {
					'/internal/shared/my_text_extension/data.bin': dataBytes,
				},
			},
		},
	],
});
```

<!--
## Limits
-->

## সীমাবদ্ধতা (Limits) {#limits}

<!--
Extension loading is startup-only. PHP.wasm writes a generated `.ini` file for
each extension, stages the `.so` and any sidecar files, updates
`PHP_INI_SCAN_DIR`, and then starts PHP. Loading an extension into an already
running PHP runtime with `dl()` is not supported by this API.
-->

এক্সটেনশন লোড করা শুধুমাত্র স্টার্টআপের সময়ই সম্ভব। PHP.wasm প্রতিটি এক্সটেনশনের জন্য একটি জেনারেট করা `.ini` ফাইল লেখে, `.so` এবং যেকোনো সাইডকার ফাইল প্রস্তুত করে, `PHP_INI_SCAN_DIR` আপডেট করে এবং তারপর PHP চালু করে। `dl()` দিয়ে ইতিমধ্যেই চলমান একটি PHP রানটাইমে এক্সটেনশন লোড করা এই API-তে সমর্থিত নয়।

<!--
Legacy PHP builds do not support extension loading. The runtime will reject
extension requests for those PHP versions instead of starting with a partially
loaded configuration.
-->

লেগ্যাসি (legacy) PHP বিল্ডগুলো এক্সটেনশন লোডিং সমর্থন করে না। আংশিক লোড হওয়া কনফিগারেশনের সাথে শুরু করার পরিবর্তে রানটাইম সেই PHP সংস্করণগুলোর জন্য এক্সটেনশন অনুরোধ প্রত্যাখ্যান করবে।
