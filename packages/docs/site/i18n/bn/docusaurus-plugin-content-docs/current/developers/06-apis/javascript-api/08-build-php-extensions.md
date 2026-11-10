---
title: PHP এক্সটেনশন তৈরি করা
slug: /developers/apis/javascript-api/build-php-extensions
description: PHP এক্সটেনশন সোর্স ডিরেক্টরি থেকে PHP.wasm .so আর্টিফ্যাক্ট এবং ম্যানিফেস্ট তৈরি করুন।
---

<!--
# Building PHP extensions
-->

# PHP এক্সটেনশন তৈরি করা (Building PHP extensions) {#building-php-extensions}

<!--
Use `@php-wasm/compile-extension` when you have a `phpize` extension source
directory and want a distributable PHP.wasm `.so` plus a manifest that
`loadNodeRuntime()` and `loadWebRuntime()` can load before PHP starts.
-->

আপনার কাছে একটি `phpize` এক্সটেনশন সোর্স ডিরেক্টরি থাকলে এবং PHP শুরু হওয়ার আগেই `loadNodeRuntime()` ও `loadWebRuntime()` লোড করতে পারে এমন একটি বিতরণযোগ্য (distributable) PHP.wasm `.so` এবং ম্যানিফেস্ট চাইলে `@php-wasm/compile-extension` ব্যবহার করুন।

<!--
The source directory must contain a normal PHP extension build recipe, usually
`config.m4` and the C or C++ files referenced from it.
-->

সোর্স ডিরেক্টরিতে একটি সাধারণ PHP এক্সটেনশন বিল্ড রেসিপি থাকতে হবে—সাধারণত `config.m4` এবং এতে রেফারেন্স করা C বা C++ ফাইলসমূহ।

```bash
npx @php-wasm/compile-extension \
	--source ./wp-mysql-parser \
	--name wp_mysql_parser \
	--php-versions 8.4 \
	--out ./dist/wp_mysql_parser
```

<!--
Docker is required. The helper reuses the PHP.wasm compile image, builds a
matching PHP source tree, and runs `phpize`, `emconfigure`, and `emmake` with
the side-module flags expected by PHP.wasm.
-->

এর জন্য Docker প্রয়োজন। এই হেল্পারটি PHP.wasm কম্পাইল ইমেজটি পুনরায় ব্যবহার করে, একটি সামঞ্জস্যপূর্ণ PHP সোর্স ট্রি বিল্ড করে এবং PHP.wasm-এর প্রত্যাশিত সাইড-মডিউল ফ্ল্যাগসহ `phpize`, `emconfigure` ও `emmake` চালায়।

<!--
Custom extensions are built for JSPI runtimes. The helper does not build
Asyncify side modules.
-->

কাস্টম এক্সটেনশনগুলো JSPI রানটাইমের জন্য তৈরি করা হয়। হেল্পারটি Asyncify সাইড মডিউল বিল্ড করে না।

<!--
## Output
-->

## আউটপুট (Output) {#output}

<!--
The output directory contains one JSPI artifact for each PHP version plus
`manifest.json`:
-->

আউটপুট ডিরেক্টরিতে প্রতিটি PHP সংস্করণের জন্য একটি করে JSPI আর্টিফ্যাক্ট এবং `manifest.json` থাকে:

```text
dist/wp_mysql_parser/
|-- manifest.json
`-- wp_mysql_parser-php8.4-jspi.so
```

<!--
The manifest matches the `PHPExtensionManifest` shape from
`@php-wasm/universal`. It records the extension name, the artifact matrix,
and a `sourcePath` for each artifact relative to the manifest URL:
-->

ম্যানিফেস্টটি `@php-wasm/universal`-এর `PHPExtensionManifest` গঠনের (shape) সাথে মেলে। এটি এক্সটেনশনের নাম, আর্টিফ্যাক্ট ম্যাট্রিক্স এবং ম্যানিফেস্ট URL-এর সাপেক্ষে প্রতিটি আর্টিফ্যাক্টের একটি `sourcePath` রেকর্ড করে:

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
Host the whole output directory from the same static location. Relative
artifact paths are resolved from the manifest URL.
-->

সম্পূর্ণ আউটপুট ডিরেক্টরিটি একই স্ট্যাটিক লোকেশন থেকে হোস্ট করুন। ম্যানিফেস্ট URL থেকেই আপেক্ষিক (relative) আর্টিফ্যাক্ট পাথগুলো নির্ধারণ (resolve) করা হয়।

<!--
### Sidecar files
-->

### সাইডকার ফাইল (Sidecar files) {#sidecar-files}

<!--
Pass `--extra-files <hostDir>:<vfsRoot>` to stage data directories, web UI
assets, ICU data, or anything else the extension needs at runtime. The host
directory is copied next to the manifest, and each entry is recorded under
`extraFiles.nodes` with a `vfsPath` relative to `vfsRoot` and a `sourcePath`
relative to the manifest URL:
-->

রানটাইমে এক্সটেনশনের প্রয়োজনীয় ডেটা ডিরেক্টরি, ওয়েব UI অ্যাসেট, ICU ডেটা বা অন্য যেকোনো কিছু স্টেজ করতে `--extra-files <hostDir>:<vfsRoot>` পাস করুন। হোস্ট ডিরেক্টরিটি ম্যানিফেস্টের পাশে কপি করা হয় এবং প্রতিটি এন্ট্রি `extraFiles.nodes`-এর অধীনে `vfsRoot`-এর সাপেক্ষে একটি `vfsPath` এবং ম্যানিফেস্ট URL-এর সাপেক্ষে একটি `sourcePath` হিসেবে রেকর্ড করা হয়:

```bash
npx @php-wasm/compile-extension \
	--source ./spx-src \
	--name spx \
	--php-versions 8.2 \
	--extra-files ./web-ui:/internal/shared/spx \
	--out ./dist/spx
```

<!--
Empty directories are recorded as `type: "directory"` nodes so the loader
creates them before PHP starts. Multiple `--extra-files` entries are
allowed, but they must agree on `vfsRoot` — the manifest format stores a
single root per group.
-->

খালি ডিরেক্টরিগুলো `type: "directory"` নোড হিসেবে সংরক্ষিত হয় যাতে PHP চালু হওয়ার আগেই লোডার সেগুলো তৈরি করে নিতে পারে। একাধিক `--extra-files` এন্ট্রি ব্যবহারের অনুমতি রয়েছে, তবে সেগুলোর `vfsRoot` একই হতে হবে — কারণ ম্যানিফেস্ট ফরম্যাট প্রতি গ্রুপে একটি একক রুট সংরক্ষণ করে।

<!--
## Loading in Node.js
-->

## Node.js-এ লোড করা (Loading in Node.js) {#loading-in-nodejs}

<!--
Pass the manifest to the startup-time `extensions` option:
-->

স্টার্টআপের সময় `extensions` অপশনে ম্যানিফেস্টটি পাস করুন:

```ts
import { PHP } from '@php-wasm/universal';
import { loadNodeRuntime } from '@php-wasm/node';

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
Node.js accepts local paths, `file:` URLs, and HTTP(S) URLs for `manifestUrl`.
The loader selects the artifact whose `phpVersion` matches the runtime,
stages the `.so`, copies any `extraFiles` declared in the manifest, writes a
generated `.ini` file, and starts PHP with the extension scan directory
configured.
-->

Node.js `manifestUrl`-এর জন্য লোকাল পাথ, `file:` URL এবং HTTP(S) URL গ্রহণ করে। লোডারটি রানটাইমের সাথে মিলে যাওয়া `phpVersion`-এর আর্টিফ্যাক্টটি নির্বাচন করে, `.so` ফাইল স্টেজ করে, ম্যানিফেস্টে ঘোষিত যেকোনো `extraFiles` কপি করে, একটি জেনারেট করা `.ini` ফাইল লেখে এবং এক্সটেনশন স্ক্যান ডিরেক্টরি কনফিগার করে PHP চালু করে।

<!--
## Loading in the browser
-->

## ব্রাউজারে লোড করা (Loading in the browser) {#loading-in-the-browser}

<!--
In the browser, host the output directory and pass an absolute URL:
-->

ব্রাউজারে আউটপুট ডিরেক্টরিটি হোস্ট করুন এবং একটি পূর্ণ (absolute) URL পাস করুন:

```ts
import { PHP } from '@php-wasm/universal';
import { loadWebRuntime } from '@php-wasm/web';

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
Serve the `.so` artifacts with a static-file server that permits cross-origin
requests from the page that creates the runtime.
-->

রানটাইম তৈরি করা পৃষ্ঠাটি থেকে ক্রস-অরিজিন (cross-origin) অনুরোধের অনুমতি দেয় এমন একটি স্ট্যাটিক-ফাইল সার্ভার দিয়ে `.so` আর্টিফ্যাক্টগুলো পরিবেশন (serve) করুন।

<!--
## Direct artifacts
-->

## সরাসরি আর্টিফ্যাক্ট (Direct artifacts) {#direct-artifacts}

<!--
Use a manifest when you publish a matrix. If the caller already picked the
artifact, use `format: 'url'` instead:
-->

ম্যাট্রিক্স প্রকাশ করলে ম্যানিফেস্ট ব্যবহার করুন। কলার ইতোমধ্যে আর্টিফ্যাক্টটি নির্বাচন করে থাকলে পরিবর্তে `format: 'url'` ব্যবহার করুন:

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
## Compatibility
-->

## সামঞ্জস্যতা (Compatibility) {#compatibility}

<!--
Build every PHP version you plan to support. A `.so` built for PHP 8.4 cannot
be loaded into PHP 8.3. Custom extension artifacts are JSPI-only and must be
loaded by a JSPI runtime.
-->

আপনি যেসব PHP সংস্করণ সমর্থন করার পরিকল্পনা করছেন তার প্রত্যেকটির জন্য বিল্ড করুন। PHP 8.4-এর জন্য তৈরি একটি `.so` ফাইল PHP 8.3-তে লোড করা যাবে না। কাস্টম এক্সটেনশন আর্টিফ্যাক্টগুলো শুধুমাত্র JSPI-ভিত্তিক এবং অবশ্যই একটি JSPI রানটাইম দিয়ে লোড করতে হবে।

<!--
The helper supports PHP `7.4` and `8.0` through `8.5`. Pass the matrix as a
comma-separated list:
-->

এই হেল্পারটি PHP `7.4` এবং `8.0` থেকে `8.5` পর্যন্ত সমর্থন করে। কমা দিয়ে পৃথক করা তালিকার মাধ্যমে ম্যাট্রিক্সটি পাস করুন:

```bash
npx @php-wasm/compile-extension \
	--source ./wp-mysql-parser \
	--name wp_mysql_parser \
	--php-versions 8.0,8.1,8.2,8.3,8.4,8.5 \
	--out ./dist/wp_mysql_parser
```

<!--
Extension loading is startup-only. Declare custom extensions in the
`extensions` option before the runtime is created.
-->

এক্সটেনশন লোডিং শুধুমাত্র স্টার্টআপের সময় সম্পন্ন হয়। রানটাইম তৈরি হওয়ার আগেই `extensions` অপশনে কাস্টম এক্সটেনশন ডিক্লেয়ার করুন।

<!--
## Running the helper in CI
-->

## CI-তে হেল্পার চালানো (Running the helper in CI) {#running-the-helper-in-ci}

<!--
The helper is published as `@php-wasm/compile-extension` on npm and only
needs Docker and Node. A typical GitHub Actions job:
-->

হেল্পারটি npm-এ `@php-wasm/compile-extension` হিসেবে প্রকাশিত এবং এটির জন্য শুধুমাত্র Docker ও Node প্রয়োজন। একটি সাধারণ GitHub Actions জব:

```yaml
- uses: actions/checkout@v4

- uses: actions/setup-node@v4
  with:
      node-version: '24'

- name: Build the extension matrix
  run: |
      npx --yes @php-wasm/compile-extension \
        --source ./my-extension \
        --name my_extension \
        --php-versions 8.0,8.1,8.2,8.3,8.4,8.5 \
        --out ./dist/my-extension
```

<!--
When you build the matrix in GitHub Actions, set `strategy.max-parallel: 1`
on the WASM job. Parallel Docker builds on hosted runners frequently hit
apt-mirror flakes during the base image build.
-->

GitHub Actions-এ ম্যাট্রিক্স বিল্ড করার সময়, WASM জবে `strategy.max-parallel: 1` নির্ধারণ করুন। কারণ হোস্টেড রানারগুলোতে সমান্তরাল (parallel) Docker বিল্ড বেস ইমেজ তৈরির সময় প্রায়শই apt-mirror অস্থিরতার (flakes) সম্মুখীন হয়।

<!--
For native dependencies, see
[PHP extension dependencies](/developers/apis/javascript-api/php-extension-dependencies).
-->

নেটিভ ডিপেন্ডেন্সির জন্য [PHP এক্সটেনশন ডিপেন্ডেন্সি (PHP extension dependencies)](/developers/apis/javascript-api/php-extension-dependencies) দেখুন।
