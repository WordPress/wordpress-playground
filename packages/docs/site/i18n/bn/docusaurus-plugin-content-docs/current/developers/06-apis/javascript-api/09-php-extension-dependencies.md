---
title: PHP এক্সটেনশন ডিপেন্ডেন্সি
slug: /developers/apis/javascript-api/php-extension-dependencies
description: কাস্টম PHP.wasm এক্সটেনশন বিল্ড করার সময় WebAssembly ডিপেন্ডেন্সি লিঙ্ক করুন।
---

<!--
# PHP extension dependencies
-->

# PHP এক্সটেনশন ডিপেন্ডেন্সি (PHP extension dependencies) {#php-extension-dependencies}

<!--
Custom PHP.wasm extensions can only link WebAssembly code built with the same
Emscripten toolchain and JSPI ABI as the PHP runtime. Native host libraries from
`/usr/lib`, Homebrew, apt, or npm packages cannot be linked into the final
`.so`.
-->

কাস্টম PHP.wasm এক্সটেনশন শুধুমাত্র এমন WebAssembly কোডের সাথেই লিঙ্ক করতে পারে যা PHP রানটাইমের মতো একই Emscripten টুলচেন এবং JSPI ABI দিয়ে বিল্ড করা হয়েছে। `/usr/lib`, Homebrew, apt, বা npm প্যাকেজের মতো নেটিভ হোস্ট লাইব্রেরিগুলোকে চূড়ান্ত `.so`-এর সাথে লিঙ্ক করা যাবে না।

<!--
Build dependencies as static WebAssembly archives and pass their headers and
archives to `@php-wasm/compile-extension`.
-->

ডিপেন্ডেন্সিগুলোকে স্ট্যাটিক WebAssembly আর্কাইভ হিসেবে বিল্ড করুন এবং সেগুলোর হেডার ও আর্কাইভগুলোকে `@php-wasm/compile-extension`-এ পাস করুন।

<!--
## Playground-built dependencies
-->

## প্লেগ্রাউন্ড-বিল্ট ডিপেন্ডেন্সি (Playground-built dependencies) {#playground-built-dependencies}

<!--
Some libraries already have recipes in `packages/php-wasm/compile`. Build the
JSPI target and pass the mounted path inside the helper container:
-->

কিছু লাইব্রেরির জন্য `packages/php-wasm/compile`-এ ইতিমধ্যেই রেসিপি তৈরি রয়েছে। JSPI টার্গেটটি বিল্ড করুন এবং হেল্পার কন্টেইনারের ভেতরের মাউন্ট করা পাথটি পাস করুন:

```bash
make -C packages/php-wasm/compile libz_jspi

npx @php-wasm/compile-extension \
	--source ./zlib-probe \
	--name zlib_probe \
	--php-versions 8.4 \
	--extra-cflags "-I/php-wasm-compile/libz/jspi/dist/root/lib/include" \
	--extra-ldflags "/php-wasm-compile/libz/jspi/dist/root/lib/lib/libz.a"
```

<!--
Use the `jspi` archive for custom extension builds.
-->

কাস্টম এক্সটেনশন বিল্ডের ক্ষেত্রে `jspi` আর্কাইভ ব্যবহার করুন।

<!--
## Vendored dependencies
-->

## ভেন্ডরকৃত ডিপেন্ডেন্সি (Vendored dependencies) {#vendored-dependencies}

<!--
If the dependency is not built by Playground, vendor the source under your
extension directory and build it with Emscripten before the extension is linked.
Paths from `--source` are available under `/build` inside the helper container:
-->

যদি ডিপেন্ডেন্সিটি প্লেগ্রাউন্ড দ্বারা বিল্ড করা না হয়ে থাকে, তবে আপনার এক্সটেনশন ডিরেক্টরির অধীনে সোর্সটি ভেন্ডর (vendor) করুন এবং এক্সটেনশনটি লিঙ্ক করার আগেই Emscripten দিয়ে এটি বিল্ড করুন। `--source` থেকে দেওয়া পাথগুলো হেল্পার কন্টেইনারের ভেতরে `/build`-এর অধীনে পাওয়া যায়:

```bash
npx @php-wasm/compile-extension \
	--source ./external-lib-probe \
	--name external_lib_probe \
	--php-versions 8.4 \
	--extra-cflags "-I/build/vendor/string-score/install/include" \
	--extra-ldflags "/build/vendor/string-score/install/lib/libstring_score.a"
```

<!--
`--extra-cflags` is visible during `./configure`. `--extra-ldflags` is applied
to the final side-module link so dependency archives do not break Autoconf's
compiler smoke tests.
-->

`--extra-cflags` ফ্ল্যাগটি `./configure` চলাকালীন দৃশ্যমান থাকে। `--extra-ldflags` চূড়ান্ত সাইড-মডিউল লিঙ্কের ক্ষেত্রে প্রয়োগ করা হয় যাতে ডিপেন্ডেন্সি আর্কাইভগুলো Autoconf-এর কম্পাইলার স্মোক টেস্টে কোনো ত্রুটি না ঘটায়।

<!--
## Prebuilt static archives
-->

## প্রি-বিল্ট স্ট্যাটিক আর্কাইভ (Prebuilt static archives) {#prebuilt-static-archives}

<!--
Use `--extra-ldflags` to link prebuilt static archives such as a Rust
`staticlib`. The helper detects `.a` entries in `--extra-ldflags` and
force-links them into the final side module with `--whole-archive`.
-->

Rust `staticlib`-এর মতো প্রি-বিল্ট স্ট্যাটিক আর্কাইভ লিঙ্ক করতে `--extra-ldflags` ব্যবহার করুন। হেল্পারটি `--extra-ldflags`-এ থাকা `.a` এন্ট্রিগুলো শনাক্ত করে এবং `--whole-archive` ব্যবহার করে সেগুলোকে চূড়ান্ত সাইড মডিউলে ফোর্স-লিঙ্ক (force-link) করে।

```bash
npx @php-wasm/compile-extension \
	--source ./my-rust-extension \
	--name my_rust_extension \
	--php-versions 8.4 \
	--extra-cflags "-I/build/include" \
	--extra-ldflags "/build/target/wasm32-unknown-emscripten/release/libmy_rust_extension.a"
```

<!--
The extension still needs a small `phpize` wrapper. A common Rust pattern is:
-->

এক্সটেনশনটির জন্য তবুও একটি ছোট `phpize` র‍্যাপার প্রয়োজন। একটি বহুল প্রচলিত Rust প্যাটার্ন নিচে দেওয়া হলো:

<!--
- `config.m4` declares the PHP extension and builds a tiny C shim with
  `PHP_NEW_EXTENSION`.
- `_shim.c` defines the PHP module entry and calls exported Rust functions over
  C ABI.
- `--extra-ldflags` points at the Rust `staticlib` archive under `/build`.
-->

- `config.m4` PHP এক্সটেনশনটি ডিক্লেয়ার করে এবং `PHP_NEW_EXTENSION` দিয়ে একটি ক্ষুদ্র C শিম (shim) বিল্ড করে।
- `_shim.c` PHP মডিউল এন্ট্রি নির্ধারণ করে এবং C ABI-এর মাধ্যমে এক্সপোর্ট করা Rust ফাংশনগুলোকে কল করে।
- `--extra-ldflags` ফ্ল্যাগটি `/build`-এর অধীনে থাকা Rust `staticlib` আর্কাইভের দিকে পয়েন্ট করে।

<!--
Do not use `PHP_ADD_LIBRARY_WITH_PATH` for a sibling `.a` archive in
`config.m4`. PHP's libtool setup can look for a matching `.so`, fail to link
the archive into the side module, and still leave a build artifact behind. Pass
static archives through `--extra-ldflags` instead.
-->

`config.m4`-এ পাশাপাশি থাকা কোনো `.a` আর্কাইভের জন্য `PHP_ADD_LIBRARY_WITH_PATH` ব্যবহার করবেন না। PHP-এর libtool সেটআপ একটি ম্যাচিং `.so` খুঁজতে পারে, ফলে সাইড মডিউলে আর্কাইভটি লিঙ্ক করতে ব্যর্থ হতে পারে এবং তবুও পেছনে একটি বিল্ড আর্টিফ্যাক্ট রেখে যেতে পারে। এর পরিবর্তে স্ট্যাটিক আর্কাইভগুলোকে `--extra-ldflags`-এর মাধ্যমে পাস করুন।

<!--
## CMake dependencies
-->

## CMake ডিপেন্ডেন্সি (CMake dependencies) {#cmake-dependencies}

<!--
Build CMake dependencies as static archives with Emscripten and store the
install tree under the extension source directory:
-->

Emscripten দিয়ে CMake ডিপেন্ডেন্সিগুলোকে স্ট্যাটিক আর্কাইভ হিসেবে বিল্ড করুন এবং এক্সটেনশন সোর্স ডিরেক্টরির নিচে ইনস্টল ট্রি সংরক্ষণ করুন:

```bash
source /root/emsdk/emsdk_env.sh

emcmake cmake \
	-S vendor/libfoo \
	-B vendor/libfoo/build \
	-DCMAKE_BUILD_TYPE=Release \
	-DCMAKE_INSTALL_PREFIX="$PWD/vendor/libfoo/install" \
	-DBUILD_SHARED_LIBS=OFF

emmake cmake --build vendor/libfoo/build --target install

npx @php-wasm/compile-extension \
	--source . \
	--name my_extension \
	--php-versions 8.4 \
	--extra-cflags "-I/build/vendor/libfoo/install/include" \
	--extra-ldflags "/build/vendor/libfoo/install/lib/libfoo.a"
```

<!--
## Makefile dependencies
-->

## Makefile ডিপেন্ডেন্সি (Makefile dependencies) {#makefile-dependencies}

<!--
Force Makefile dependencies to use Emscripten tools:
-->

Makefile ডিপেন্ডেন্সিগুলোকে Emscripten টুলস ব্যবহার করতে বাধ্য করুন:

```bash
source /root/emsdk/emsdk_env.sh

emmake make -C vendor/libfoo \
	CC=emcc \
	CXX=em++ \
	AR=emar \
	RANLIB=emranlib \
	PREFIX="$PWD/vendor/libfoo/install" \
	install

npx @php-wasm/compile-extension \
	--source . \
	--name my_extension \
	--php-versions 8.4 \
	--extra-cflags "-I/build/vendor/libfoo/install/include" \
	--extra-ldflags "/build/vendor/libfoo/install/lib/libfoo.a"
```

<!--
The final PHP extension still needs a `phpize` build recipe. If the extension
itself is CMake-only or Makefile-only, add a thin `config.m4` wrapper that
builds the PHP extension and treats the CMake or Make output as dependency
code.
-->

চূড়ান্ত PHP এক্সটেনশনটির জন্য তারপরও একটি `phpize` বিল্ড রেসিপির প্রয়োজন হবে। যদি এক্সটেনশনটি নিজেই শুধুমাত্র CMake বা শুধুমাত্র Makefile ভিত্তিক হয়, তবে একটি হালকা `config.m4` র‍্যাপার যুক্ত করুন যা PHP এক্সটেনশনটি বিল্ড করবে এবং CMake বা Make আউটপুটকে ডিপেন্ডেন্সি কোড হিসেবে বিবেচনা করবে।

<!--
## Rust build systems
-->

## Rust বিল্ড সিস্টেম (Rust build systems) {#rust-build-systems}

<!--
The helper image includes a host `php` CLI because `ext-php-rs` and similar
build systems often shell out to `php` for version detection. The host CLI is
only for build scripts. The compiled extension must still link against the
PHP.wasm headers and side-module ABI.
-->

হেল্পার ইমেজটিতে একটি হোস্ট `php` CLI অন্তর্ভুক্ত থাকে কারণ `ext-php-rs` এবং অনুরূপ বিল্ড সিস্টেমগুলো প্রায়শই সংস্করণ শনাক্তকরণের জন্য শেল কমান্ডের মাধ্যমে `php` ব্যবহার করে। এই হোস্ট CLI শুধুমাত্র বিল্ড স্ক্রিপ্টের জন্যই প্রযোজ্য। কম্পাইল করা এক্সটেনশনটিকে অবশ্যই PHP.wasm হেডার এবং সাইড-মডিউল ABI-এর সাথে লিঙ্ক করতে হবে।

<!--
Rust extensions that use `bindgen` need the same target, sysroot, and Zend
defines as PHP.wasm. The helper exports `BINDGEN_EXTRA_CLANG_ARGS` with:
-->

যেসব Rust এক্সটেনশন `bindgen` ব্যবহার করে, সেগুলোর ক্ষেত্রে PHP.wasm-এর মতোই একই target, sysroot এবং Zend defines প্রয়োজন। হেল্পারটি নিচের আর্গুমেন্টগুলোর সাথে `BINDGEN_EXTRA_CLANG_ARGS` এক্সপোর্ট করে:

```bash
--target=wasm32-unknown-emscripten \
--sysroot=$EMSDK_SYSROOT \
-DZEND_ENABLE_ZVAL_LONG64 \
-D__x86_64__
```

<!--
If you build the Rust archive outside the helper container, set the same value
before running `cargo`.
-->

আপনি যদি হেল্পার কন্টেইনারের বাইরে Rust আর্কাইভ বিল্ড করেন, তবে `cargo` চালানোর আগে একই মান নির্ধারণ করুন।

<!--
Rust `cc-rs` build scripts also need position-independent objects for side
module linking. The helper exports target-specific compiler variables including
`CFLAGS_wasm32_unknown_emscripten=-fPIC` and
`CXXFLAGS_wasm32_unknown_emscripten=-fPIC`. Without `-fPIC`, the final link can
fail with an error like:
-->

Rust `cc-rs` বিল্ড স্ক্রিপ্টের সাইড মডিউল লিঙ্কিংয়ের ক্ষেত্রেও পজিশন-ইন্ডিপেন্ডেন্ট অবজেক্ট (position-independent objects) প্রয়োজন। হেল্পারটি `CFLAGS_wasm32_unknown_emscripten=-fPIC` এবং `CXXFLAGS_wasm32_unknown_emscripten=-fPIC` সহ টার্গেট-নির্দিষ্ট কম্পাইলার ভেরিয়েবল এক্সপোর্ট করে। `-fPIC` ছাড়া, চূড়ান্ত লিঙ্কটি এই জাতীয় ত্রুটির সাথে ব্যর্থ হতে পারে:

```text
R_WASM_MEMORY_ADDR_SLEB cannot be used against symbol ...; recompile with -fPIC
```

<!--
Rust's precompiled `std` for `wasm32-unknown-emscripten` is built with
unwinding support. That imports a `__cpp_exception` WebAssembly tag that
PHP.wasm does not export. Build Rust static libraries with `panic=abort` and a
nightly rebuilt standard library:
-->

`wasm32-unknown-emscripten`-এর জন্য Rust-এর প্রি-কম্পাইলকৃত `std` আনওয়াইন্ডিং (unwinding) সমর্থনসহ বিল্ড করা হয়। এটি একটি `__cpp_exception` WebAssembly ট্যাগ ইমপোর্ট করে যা PHP.wasm এক্সপোর্ট করে না। `panic=abort` এবং নাইটলি রিবিল্ট স্ট্যান্ডার্ড লাইব্রেরি দিয়ে Rust স্ট্যাটিক লাইব্রেরিগুলো বিল্ড করুন:

```bash
RUSTFLAGS="-C panic=abort" cargo +nightly build \
	--release \
	--target wasm32-unknown-emscripten \
	-Zbuild-std=std,panic_abort
```

<!--
Link the resulting `lib*.a` with `--extra-ldflags`.
-->

ফলস্বরূপ তৈরি হওয়া `lib*.a`-কে `--extra-ldflags` দিয়ে লিঙ্ক করুন।

<!--
### PHP version support for `ext-php-rs`
-->

### `ext-php-rs`-এর জন্য PHP সংস্করণ সমর্থন (PHP version support for `ext-php-rs`) {#php-version-support-for-ext-php-rs}

<!--
`ext-php-rs` `0.15` depends on PHP 8 Zend APIs and does not compile against
PHP `7.4` headers. Rust extensions built on top of `ext-php-rs` `0.15` should
restrict the PHP matrix to `8.0` through `8.5`:
-->

`ext-php-rs` `0.15` PHP 8 Zend API-এর ওপর নির্ভরশীল এবং PHP `7.4` হেডারের বিপরীতে কম্পাইল হয় না। `ext-php-rs` `0.15`-এর ওপর ভিত্তি করে তৈরি Rust এক্সটেনশনগুলোর ক্ষেত্রে PHP ম্যাট্রিক্সকে `8.0` থেকে `8.5`-এর মধ্যে সীমাবদ্ধ রাখা উচিত:

```bash
npx @php-wasm/compile-extension \
	--source ./my-rust-extension \
	--name my_rust_extension \
	--php-versions 8.0,8.1,8.2,8.3,8.4,8.5 \
	--extra-ldflags "/build/target/wasm32-unknown-emscripten/release/libmy_rust_extension.a"
```

<!--
The helper itself still supports PHP `7.4`. The limitation is in the Rust
binding layer, not in the WebAssembly side-module ABI. Hand-written Rust
extensions that bind Zend directly through `bindgen` can target PHP `7.4` if
the C ABI shim does the same.
-->

হেল্পারটি নিজেই এখনও PHP `7.4` সমর্থন করে। সীমাবদ্ধতা মূলত Rust বাইন্ডিং লেয়ারে, WebAssembly সাইড-মডিউল ABI-তে নয়। হাতে লেখা Rust এক্সটেনশনগুলো যা `bindgen`-এর মাধ্যমে সরাসরি Zend বাইন্ড করে, সেগুলোও PHP `7.4`-কে লক্ষ্য করতে পারে যদি C ABI শিমটিও একই কাজ করে।

<!--
`ext-php-rs` also generates bindings for one PHP version at a time. When you
build the same Rust crate for several PHP versions, rebuild the staticlib for
each PHP version with that version's Zend API number visible to the build
script, and link the matching archive into each `--php-versions` lane.
-->

`ext-php-rs` একই সাথে শুধুমাত্র একটি PHP সংস্করণের জন্য বাইন্ডিং তৈরি করে। আপনি যখন একাধিক PHP সংস্করণের জন্য একই Rust ক্রেট (crate) বিল্ড করবেন, তখন প্রতিটি PHP সংস্করণের জন্য সংশ্লিষ্ট সংস্করণের Zend API নম্বর বিল্ড স্ক্রিপ্টে দৃশ্যমান রেখে স্ট্যাটিকলিব (staticlib) পুনর্নির্মাণ করুন এবং প্রতিটি `--php-versions` লেনে মানানসই আর্কাইভ লিঙ্ক করুন।

<!--
## Troubleshooting
-->

## সমস্যা সমাধান (Troubleshooting) {#troubleshooting}

<!--
`configure: error: ... not found`

The dependency headers or libraries are not visible inside the container. Use
paths under `/build` for files copied from `--source`, or
`/php-wasm-compile/<dependency>/<mode>/dist/root/lib` for Playground-built
dependencies.
-->

`configure: error: ... not found`

ডিপেন্ডেন্সি হেডার বা লাইব্রেরিগুলো কন্টেইনারের ভেতরে দৃশ্যমান নয়। `--source` থেকে কপি করা ফাইলের ক্ষেত্রে `/build`-এর অধীনে থাকা পাথগুলো ব্যবহার করুন, অথবা প্লেগ্রাউন্ড-বিল্ট ডিপেন্ডেন্সির জন্য `/php-wasm-compile/<dependency>/<mode>/dist/root/lib` ব্যবহার করুন।

<!--
`undefined symbol` when loading the extension

The extension references a function that is not exported by the PHP main module
or was not linked from a WebAssembly dependency archive. Add the dependency
archive to `--extra-ldflags`, or rebuild the main PHP.wasm runtime if the
symbol must come from PHP core.
-->

এক্সটেনশন লোড করার সময় `undefined symbol`

এক্সটেনশনটি এমন একটি ফাংশন রেফারেন্স করছে যা PHP প্রধান মডিউল দ্বারা এক্সপোর্ট করা হয়নি অথবা কোনো WebAssembly ডিপেন্ডেন্সি আর্কাইভ থেকে লিঙ্ক করা হয়নি। ডিপেন্ডেন্সি আর্কাইভটিকে `--extra-ldflags`-এ যুক্ত করুন, অথবা যদি সিম্বলটি PHP কোর থেকে আসা আবশ্যক হয় তবে মূল PHP.wasm রানটাইম পুনর্নির্মাণ করুন।

<!--
`WebAssembly.LinkError` or startup crashes

Check that the extension loads in a JSPI runtime. The custom extension helper
does not build Asyncify artifacts.
-->

`WebAssembly.LinkError` অথবা স্টার্টআপ ক্র্যাশ

এক্সটেনশনটি একটি JSPI রানটাইমে লোড হচ্ছে কিনা তা যাচাই করুন। কাস্টম এক্সটেনশন হেল্পার Asyncify আর্টিফ্যাক্ট বিল্ড করে না।

<!--
`wasm-ld: unknown file type` or `file not recognized`

One of the linked libraries is a native host library. Rebuild that dependency
with Emscripten and link the resulting `.a` file.
-->

`wasm-ld: unknown file type` অথবা `file not recognized`

লিঙ্ক করা লাইব্রেরিগুলোর মধ্যে একটি নেটিভ হোস্ট লাইব্রেরি। Emscripten দিয়ে সেই ডিপেন্ডেন্সিটি পুনর্নির্মাণ করুন এবং ফলস্বরূপ প্রাপ্ত `.a` ফাইলটি লিঙ্ক করুন।

<!--
`R_WASM_MEMORY_ADDR_SLEB cannot be used against symbol`

A C or C++ object in a static archive was not compiled as position-independent
code. Rebuild it with `-fPIC`, or make sure Rust `cc-rs` sees
`CFLAGS_wasm32_unknown_emscripten=-fPIC`.
-->

`R_WASM_MEMORY_ADDR_SLEB cannot be used against symbol`

স্ট্যাটিক আর্কাইভের একটি C বা C++ অবজেক্ট পজিশন-ইন্ডিপেন্ডেন্ট কোড হিসেবে কম্পাইল করা হয়নি। এটি `-fPIC` দিয়ে পুনর্নির্মাণ করুন, অথবা নিশ্চিত করুন যে Rust `cc-rs` `CFLAGS_wasm32_unknown_emscripten=-fPIC` দেখতে পাচ্ছে।

<!--
`__cpp_exception` is undefined when loading a Rust extension

The Rust archive was built against an unwinding `std`. Rebuild it with
`RUSTFLAGS="-C panic=abort"` and
`cargo +nightly build -Zbuild-std=std,panic_abort`.
-->

Rust এক্সটেনশন লোড করার সময় `__cpp_exception` আনডিফাইন্ড

Rust আর্কাইভটি একটি unwinding `std`-এর বিপরীতে বিল্ড করা হয়েছিল। এটি `RUSTFLAGS="-C panic=abort"` এবং `cargo +nightly build -Zbuild-std=std,panic_abort` দিয়ে পুনর্নির্মাণ করুন।

<!--
`bad export type for 'stdin'` or another C runtime global

The side module pulled in a dependency object that expects a mutable C runtime
global the main PHP.wasm module does not export. Rebuild the dependency with
the unused feature disabled, link a smaller archive that excludes that object,
or move the dependency into the main PHP.wasm build so the global is provided
by the runtime.
-->

`bad export type for 'stdin'` অথবা অন্য কোনো C রানটাইম গ্লোবাল

সাইড মডিউলটি এমন একটি ডিপেন্ডেন্সি অবজেক্ট টেনে নিয়েছে যা একটি পরিবর্তনশীল C রানটাইম গ্লোবাল প্রত্যাশা করে যা প্রধান PHP.wasm মডিউল এক্সপোর্ট করে না। অব্যবহৃত ফিচারটি নিষ্ক্রিয় করে ডিপেন্ডেন্সিটি পুনর্নির্মাণ করুন, এমন একটি ছোট আর্কাইভ লিঙ্ক করুন যা সেই অবজেক্টটিকে বাদ দেয়, অথবা ডিপেন্ডেন্সিটিকে মূল PHP.wasm বিল্ডে স্থানান্তর করুন যাতে রানটাইম দ্বারা গ্লোবালটি সরবরাহ করা যায়।

<!--
`phpize` cannot find headers

The helper image builds and installs a minimal matching PHP source tree before
running `phpize`. If an extension includes headers from optional PHP
extensions, copy or generate those headers in the Docker layer or include them
in the extension source.
-->

`phpize` হেডার খুঁজে পাচ্ছে না

`phpize` চালানোর আগে হেল্পার ইমেজটি একটি ন্যূনতম সামঞ্জস্যপূর্ণ PHP সোর্স ট্রি বিল্ড ও ইনস্টল করে। যদি কোনো এক্সটেনশনে ঐচ্ছিক PHP এক্সটেনশনগুলোর হেডার অন্তর্ভুক্ত থাকে, তবে ডকার লেয়ারে সেই হেডারগুলো কপি বা তৈরি করুন অথবা এক্সটেনশন সোর্সে সেগুলোকে অন্তর্ভুক্ত করুন।
