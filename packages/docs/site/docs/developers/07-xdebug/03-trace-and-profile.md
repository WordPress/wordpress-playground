---
title: Tracing and Profiling with Xdebug
slug: /developers/xdebug/trace-and-profile
description: Record Xdebug function traces and cachegrind profiles from WordPress Playground and read them in Speedscope, KCachegrind, or your IDE.
---

# Tracing and Profiling with Xdebug

Besides the step debugger, Xdebug can record what your code did after the fact:

- **`trace` mode** writes every function call, argument, and timing to a `trace.*.xt` file.
- **`profile` mode** writes a cachegrind file you can open in [Speedscope](https://www.speedscope.app/), KCachegrind, QCachegrind, or PhpStorm.

Playground enables `debug,develop` by default. Turn the other modes on with the
`--php-ini` flag, which sets any [php.ini setting](https://www.php.net/manual/en/ini.list.php),
including every [Xdebug setting](https://xdebug.org/docs/all_settings). Entries
set this way override both the Playground defaults and the Xdebug defaults.

## Recording a trace and a profile

Trace and profile files are written to `xdebug.output_dir`, which is a path in
Playground's virtual filesystem. Mount a directory of your own there so the
files survive after the request ends:

```bash
mkdir -p ./xdebug-output

npx @wp-playground/cli@latest server \
	--xdebug \
	--mount ./xdebug-output:/xdebug-output \
	--php-ini xdebug.mode debug,develop,trace,profile \
	--php-ini xdebug.start_with_request trigger \
	--php-ini xdebug.output_dir /xdebug-output \
	--php-ini xdebug.trace_output_name trace.%t.%p \
	--php-ini xdebug.profiler_output_name cachegrind.out.%t.%p
```

Then request the page you want to measure with the `XDEBUG_TRIGGER` parameter:

```bash
curl "http://127.0.0.1:9400/wp-json/wp/v2/posts?XDEBUG_TRIGGER=1"
```

`./xdebug-output` now holds one `trace.*.xt` file and one `cachegrind.out.*`
file for that request. Drop the cachegrind file into Speedscope to see where
the time went, and open the trace file in your editor to follow the call path.

### Record on demand, not on every request

`xdebug.start_with_request=trigger` is the setting that makes recording opt-in.
Nothing is written until a request carries `XDEBUG_TRIGGER` as a `GET`
parameter, a `POST` parameter, or a cookie.

This matters because the files are large. One WordPress front-page request
produces a trace of about 135 MB and a cachegrind file of about 22 MB. With
`xdebug.start_with_request=yes`, every request, including every admin-ajax
and REST call your browser makes, writes both files.

The trigger also starts the step debugger, so a Playground started this way
only connects to your IDE on triggered requests.

### Give every recording its own file name

Xdebug names the files after the process ID by default, so a second request
from the same worker overwrites the first one. Playground CLI runs several
workers, which makes the collision easy to hit.

Adding `%t` (timestamp) to `xdebug.trace_output_name` and
`xdebug.profiler_output_name` keeps one file per request, as in the command
above. Running with `--workers=1` also keeps the output predictable.

## Using the library API

PHP reads `php.ini` first and each extension's own ini file after, so the
value `xdebug.ini` ships wins over the same entry in `php.ini`. Playground
CLI therefore writes each `--php-ini` entry to the file PHP reads it from:
entries named after an extension go to that extension's ini file, every other
entry goes to `php.ini`. Applications built on `@php-wasm/node`, such as
Studio, write Xdebug entries to `xdebug.ini` with `setPhpIniEntries()`:

```ts
import { PHP, PHP_EXTENSIONS_DIR, setPhpIniEntries } from '@php-wasm/universal';
import { joinPaths } from '@php-wasm/util';
import { loadNodeRuntime, createNodeFsMountHandler } from '@php-wasm/node';

const php = new PHP(await loadNodeRuntime('8.5', { extensions: ['xdebug'] }));

await setPhpIniEntries(
	php,
	{
		'xdebug.mode': 'debug,develop,trace,profile',
		'xdebug.start_with_request': 'trigger',
		'xdebug.output_dir': '/xdebug-output',
		'xdebug.trace_output_name': 'trace.%t.%p',
		'xdebug.profiler_output_name': 'cachegrind.out.%t.%p',
	},
	joinPaths(PHP_EXTENSIONS_DIR, 'xdebug.ini')
);

await php.mount('/xdebug-output', createNodeFsMountHandler('./xdebug-output'));
```

Call `setPhpIniEntries()` before the first request runs. PHP parses the ini
files once, on the first run, and ignores every later write.

Without the third argument, `setPhpIniEntries()` writes `php.ini`, and the
entries an extension ships keep winning over it. An entry you do not set
keeps its default value.

## Starting a trace from PHP

Xdebug's own functions work too, and they need no trigger:

```php
xdebug_start_trace('/xdebug-output/checkout');
do_the_slow_thing();
xdebug_stop_trace();
```

This is the narrowest option. It records one block of code instead of a whole
request, which keeps the trace file small enough to read by hand.
