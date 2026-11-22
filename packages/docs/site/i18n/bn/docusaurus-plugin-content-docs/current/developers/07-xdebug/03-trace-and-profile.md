---
title: Xdebug দিয়ে ট্রেসিং ও প্রোফাইলিং
slug: /developers/xdebug/trace-and-profile
description: ওয়ার্ডপ্রেস প্লেগ্রাউন্ড থেকে Xdebug ফাংশন ট্রেস ও cachegrind প্রোফাইল রেকর্ড করুন এবং Speedscope, KCachegrind বা আপনার IDE-তে দেখুন।
---

<!--
# Tracing and Profiling with Xdebug
-->

# Xdebug দিয়ে ট্রেসিং ও প্রোফাইলিং (Tracing and Profiling with Xdebug) {#tracing-and-profiling-with-xdebug}

<!--
Besides the step debugger, Xdebug can record what your code did after the fact:

- **`trace` mode** writes every function call, argument, and timing to a `trace.*.xt` file.
- **`profile` mode** writes a cachegrind file you can open in [Speedscope](https://www.speedscope.app/), KCachegrind, QCachegrind, or PhpStorm.
-->

স্টেপ ডিবাগারের পাশাপাশি আপনার কোড কী করেছে তা কাজ শেষে রেকর্ড করে রাখতে পারে Xdebug:

- **`trace` মোড** প্রতিটি ফাংশন কল, আর্গুমেন্ট ও সময় সংক্রান্ত তথ্য একটি `trace.*.xt` ফাইলে লিখে রাখে।
- **`profile` মোড** একটি cachegrind ফাইল তৈরি করে, যা [Speedscope](https://www.speedscope.app/), KCachegrind, QCachegrind বা PhpStorm-এ খুলে দেখা যায়।

<!--
When started with `--xdebug`, Playground enables the `debug` and `develop`
modes by default. Use `--php-ini` to enable additional modes or change any
[php.ini setting](https://www.php.net/manual/en/ini.list.php), including
[Xdebug settings](https://xdebug.org/docs/all_settings). Values passed this way
override both Playground's and Xdebug's defaults.
-->

`--xdebug` দিয়ে চালু করলে Playground ডিফল্টভাবে `debug` এবং `develop` মোড সক্রিয় করে। আরও মোড চালু করতে কিংবা [Xdebug সেটিংসসহ](https://xdebug.org/docs/all_settings) যেকোনো [php.ini সেটিং](https://www.php.net/manual/en/ini.list.php) বদলাতে `--php-ini` ব্যবহার করুন। এভাবে দেওয়া মানগুলো Playground এবং Xdebug—উভয়ের ডিফল্ট মানকেই ওভাররাইড করে।

<!--
## Recording a trace and a profile
-->

## ট্রেস ও প্রোফাইল রেকর্ড করা (Recording a trace and a profile) {#recording-a-trace-and-a-profile}

<!--
Trace and profile files are written to `xdebug.output_dir`, which is a path in
Playground's virtual filesystem. Mount a directory of your own there so the
files survive after the request ends:
-->

ট্রেস ও প্রোফাইল ফাইলগুলো `xdebug.output_dir`-এ লেখা হয়, যা Playground-এর ভার্চুয়াল ফাইলসিস্টেমের একটি পাথ। রিকোয়েস্ট শেষ হওয়ার পরেও ফাইলগুলো যেন থেকে যায়, সে জন্য সেখানে আপনার নিজের একটি ডিরেক্টরি মাউন্ট করুন:

```bash
mkdir -p ./xdebug-output

npx @wp-playground/cli@latest server \
	--xdebug \
	--mount ./xdebug-output:/xdebug-output \
	--php-ini xdebug.mode debug,develop,trace,profile \
	--php-ini xdebug.start_with_request trigger \
	--php-ini xdebug.output_dir /xdebug-output \
	--php-ini xdebug.trace_output_name trace.%u.%p \
	--php-ini xdebug.profiler_output_name cachegrind.out.%u.%p
```

<!--
Then request the page you want to measure with the `XDEBUG_TRIGGER` parameter:
-->

এরপর যে পেজটি পরিমাপ করতে চান, সেটিতে `XDEBUG_TRIGGER` প্যারামিটারসহ রিকোয়েস্ট পাঠান:

```bash
curl "http://127.0.0.1:9400/wp-json/wp/v2/posts?XDEBUG_TRIGGER=1"
```

<!--
`./xdebug-output` now holds one `trace.*.xt` file and one `cachegrind.out.*`
file for that request. Drop the cachegrind file into Speedscope to see where
the time went, and open the trace file in your editor to follow the call path.
-->

এখন `./xdebug-output` ডিরেক্টরিতে ওই রিকোয়েস্টের জন্য একটি `trace.*.xt` ফাইল এবং একটি `cachegrind.out.*` ফাইল থাকবে। কোথায় কত সময় লেগেছে তা দেখতে cachegrind ফাইলটি Speedscope-এ ড্রপ করুন এবং কল পাথ অনুসরণ করতে আপনার এডিটরে ট্রেস ফাইলটি খুলুন।

<!--
### Record on demand, not on every request
-->

### প্রতিটি রিকোয়েস্টে নয়, প্রয়োজন অনুযায়ী রেকর্ড করুন (Record on demand, not on every request) {#record-on-demand-not-on-every-request}

<!--
`xdebug.start_with_request=trigger` is the setting that makes recording opt-in.
Nothing is written until a request carries `XDEBUG_TRIGGER` as a `GET`
parameter, a `POST` parameter, or a cookie.
-->

`xdebug.start_with_request=trigger` সেটিংটি রেকর্ডিংকে ঐচ্ছিক (opt-in) করে তোলে। কোনো রিকোয়েস্টে `GET` প্যারামিটার, `POST` প্যারামিটার অথবা কুকি হিসেবে `XDEBUG_TRIGGER` না থাকা পর্যন্ত কিছুই লেখা হয় না।

<!--
This matters because the files are large. One WordPress front-page request
produces a trace of about 135 MB and a cachegrind file of about 22 MB. With
`xdebug.start_with_request=yes`, every request, including every admin-ajax
and REST call your browser makes, writes both files.
-->

এটি বেশ গুরুত্বপূর্ণ, কারণ ফাইলগুলো আকারে বড় হয়। একটি ওয়ার্ডপ্রেস ফ্রন্ট-পেজ রিকোয়েস্ট থেকেই প্রায় 135 MB-এর একটি ট্রেস ফাইল এবং প্রায় 22 MB-এর একটি cachegrind ফাইল তৈরি হয়। `xdebug.start_with_request=yes` থাকলে আপনার ব্রাউজারের পাঠানো প্রতিটি admin-ajax ও REST কলসহ প্রতিটি রিকোয়েস্টেই দুটি ফাইল লেখা হতে থাকে।

<!--
The trigger also starts the step debugger, so a Playground started this way
only connects to your IDE on triggered requests.
-->

এই ট্রিগারটি স্টেপ ডিবাগারও চালু করে, ফলে এভাবে চালু করা Playground শুধুমাত্র ট্রিগার হওয়া রিকোয়েস্টগুলোতেই আপনার IDE-এর সাথে সংযুক্ত হয়।

<!--
### Give every recording its own file name
-->

### প্রতিটি রেকর্ডিংকে আলাদা ফাইলের নাম দিন (Give every recording its own file name) {#give-every-recording-its-own-file-name}

<!--
By default, Xdebug can give two recordings the same file name, so a new
request can overwrite an earlier one. See
[`xdebug.trace_output_name`](https://xdebug.org/docs/all_settings#trace_output_name)
and
[`xdebug.profiler_output_name`](https://xdebug.org/docs/all_settings#profiler_output_name)
for the default names.
-->

ডিফল্টভাবে Xdebug দুটি রেকর্ডিংকে একই ফাইলের নাম দিতে পারে, যার ফলে নতুন রিকোয়েস্ট আগের ফাইলটিকে ওভাররাইট করে ফেলতে পারে। ডিফল্ট নামগুলো জানতে [`xdebug.trace_output_name`](https://xdebug.org/docs/all_settings#trace_output_name) এবং [`xdebug.profiler_output_name`](https://xdebug.org/docs/all_settings#profiler_output_name) দেখুন।

<!--
Adding `%u` (timestamp with microseconds) to `xdebug.trace_output_name` and
`xdebug.profiler_output_name` keeps one file per request, as in the command
above. Running with `--workers=1` also keeps the output predictable.
-->

উপরের কমান্ডের মতো `xdebug.trace_output_name` এবং `xdebug.profiler_output_name`-এ `%u` (মাইক্রোসেকেন্ডসহ টাইমস্ট্যাম্প) যোগ করলে প্রতিটি রিকোয়েস্টের জন্য আলাদা একটি করে ফাইল থাকে। এ ছাড়া `--workers=1` দিয়ে চালালে আউটপুটও নির্ভরযোগ্যভাবে অনুমানযোগ্য থাকে।

<!--
## Using the library API
-->

## লাইব্রেরি API ব্যবহার করা (Using the library API) {#using-the-library-api}

<!--
PHP reads `php.ini` before extension-specific ini files, so settings in
`xdebug.ini` take precedence over matching settings in `php.ini`. The
Playground CLI writes `xdebug.*` entries to `xdebug.ini` and all other entries
to `php.ini`. When using `@php-wasm/node` directly, pass the Xdebug ini path to
`setPhpIniEntries()`:
-->

PHP এক্সটেনশন-নির্দিষ্ট ini ফাইলগুলোর আগে `php.ini` পড়ে, তাই `php.ini`-এর একই সেটিংসের চেয়ে `xdebug.ini`-এর সেটিংস বেশি অগ্রাধিকার পায়। Playground CLI `xdebug.*` এন্ট্রিগুলো `xdebug.ini`-তে এবং বাকি সব এন্ট্রি `php.ini`-তে লেখে। সরাসরি `@php-wasm/node` ব্যবহার করলে `setPhpIniEntries()`-তে Xdebug ini পাথটি পাস করুন:

```ts
import { PHP, PHP_EXTENSIONS_DIR, setPhpIniEntries } from '@php-wasm/universal';
import { joinPaths } from '@php-wasm/util';
import { mkdirSync } from 'node:fs';
import { loadNodeRuntime, createNodeFsMountHandler } from '@php-wasm/node';

const php = new PHP(await loadNodeRuntime('8.5', { extensions: ['xdebug'] }));

await setPhpIniEntries(
	php,
	{
		'xdebug.mode': 'debug,develop,trace,profile',
		'xdebug.start_with_request': 'trigger',
		'xdebug.output_dir': '/xdebug-output',
		'xdebug.trace_output_name': 'trace.%u.%p',
		'xdebug.profiler_output_name': 'cachegrind.out.%u.%p',
	},
	joinPaths(PHP_EXTENSIONS_DIR, 'xdebug.ini')
);

mkdirSync('./xdebug-output', { recursive: true });
await php.mount('/xdebug-output', createNodeFsMountHandler('./xdebug-output'));
```

<!--
Call `setPhpIniEntries()` before the first request runs. PHP parses the ini
files once, on the first run, and ignores every later write.
-->

প্রথম রিকোয়েস্ট চলার আগেই `setPhpIniEntries()` কল করুন। PHP প্রথমবার চলার সময় একবারই ini ফাইলগুলো পার্স করে এবং পরবর্তী যেকোনো পরিবর্তন উপেক্ষা করে।

<!--
Without the third argument, `setPhpIniEntries()` writes `php.ini`, and the
entries an extension ships keep winning over it. An entry you do not set
keeps its default value.
-->

তৃতীয় আর্গুমেন্টটি না দিলে `setPhpIniEntries()` শুধু `php.ini`-তে লেখে, আর এক্সটেনশনের নিজস্ব এন্ট্রিগুলো তখনও প্রাধান্য পেতে থাকে। যে এন্ট্রি আপনি সেট করবেন না, সেটি তার ডিফল্ট মান ধরে রাখে।

<!--
## Starting a trace from PHP
-->

## PHP থেকে ট্রেস শুরু করা (Starting a trace from PHP) {#starting-a-trace-from-php}

<!--
Xdebug's own functions work too, and they need no trigger:
-->

Xdebug-এর নিজস্ব ফাংশনগুলোও এখানে কাজ করে এবং সেগুলোর জন্য কোনো ট্রিগারের প্রয়োজন হয় না:

```php
xdebug_start_trace('/xdebug-output/checkout');
do_the_slow_thing();
xdebug_stop_trace();
```

<!--
This is the narrowest option. It records one block of code instead of a whole
request, which keeps the trace file small enough to read by hand.
-->

এটি সবচেয়ে নির্দিষ্ট ও সীমিত পরিসরের উপায়। পুরো রিকোয়েস্টের বদলে এটি কেবল একটি নির্দিষ্ট কোড ব্লক রেকর্ড করে, ফলে ট্রেস ফাইলটি নিজে পড়ে দেখার মতো ছোট থাকে।
