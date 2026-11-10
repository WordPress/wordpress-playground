---
sidebar_position: 5
title: কোয়েরি API (Query API)
slug: /developers/apis/query-api
description: এই পৃষ্ঠায় ওয়ার্ডপ্রেস প্লেগ্রাউন্ড কোয়েরি API (Query API) এর বিস্তারিত বিবরণ দেওয়া হয়েছে, যা আপনাকে URL কোয়েরি প্যারামিটারের মাধ্যমে একটি WP ইনস্ট্যান্স কনফিগার করতে দেয়।
---

<!--
# Query API
-->

# কোয়েরি API (Query API) {#query-api}

<!--
WordPress Playground exposes a simple API that you can use to configure the Playground in the browser.
-->

ওয়ার্ডপ্রেস প্লেগ্রাউন্ড একটি সহজ ও ব্যবহারবান্ধব API প্রদান করে যা আপনি ব্রাউজারে প্লেগ্রাউন্ড কনফিগার করার জন্য ব্যবহার করতে পারেন।

<!--
It works by passing configuration options as query parameters to the Playground URL. For example, to install the pendant theme, you would use the following URL:
-->

এটি প্লেগ্রাউন্ড URL-এ কোয়েরি প্যারামিটার হিসেবে কনফিগারেশন অপশন পাস করার মাধ্যমে কাজ করে। উদাহরণস্বরূপ, pendant থিম ইনস্টল করতে আপনি নিচের URL ব্যবহার করবেন:

```text
https://playground.wordpress.net/?theme=pendant
```

<!--
You can go ahead and try it out. The Playground will automatically install the theme and log you in as an admin. You may even embed this URL in your website using an `<iframe>` tag:
-->

আপনি এখনই এটি পরীক্ষা করে দেখতে পারেন। প্লেগ্রাউন্ড স্বয়ংক্রিয়ভাবে থিমটি ইনস্টল করবে এবং অ্যাডমিন হিসেবে আপনাকে লগইন করাবে। এমনকি আপনি একটি `<iframe>` ট্যাগ ব্যবহার করে আপনার ওয়েবসাইটে এই URL-টি এম্বেডও করতে পারেন:

```html
<iframe src="https://playground.wordpress.net/?theme=pendant"></iframe>
```

<!--
## Available options
-->

## উপলভ্য অপশনসমূহ (Available options) {#available-options}

<!--
| Option             | Default Value         | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------ | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `php`              | `8.5`                 | Loads the specified PHP version. Accepts `7.4`, `8.0`, `8.1`, `8.2`, `8.3`, `8.4`, `8.5`, `latest`, or `next`. Use `next` to preview the next PHP version from the php-src development branch; it is currently supported by the web runtime only.                                                                                                                                                                                                                           |
| `php-extension`    |                       | Loads a custom PHP.wasm extension manifest before PHP starts. Accepts absolute, root-relative, or page-relative HTTP(S) URLs. Can be used multiple times.                                                                                                                                                                                                                                                                                                                   |
| `wp`               | `latest`              | Loads the specified WordPress version. Accepts the last three major WordPress versions. As of June 1, 2024, that's `6.3`, `6.4`, or `6.5`. You can also use the generic values `latest`, `nightly`, or `beta`.                                                                                                                                                                                                                                                              |
| `blueprint-url`    |                       | The URL of the Blueprint that will be used to configure this Playground instance.                                                                                                                                                                                                                                                                                                                                                                                           |
| `networking`       | `yes`                 | Enables or disables the networking support for Playground. Accepts `yes` or `no`.                                                                                                                                                                                                                                                                                                                                                                                           |
| `plugin`           |                       | Installs the specified plugin. Use the plugin name from the WordPress Plugins Directory URL. For example, if the URL is `https://wordpress.org/plugins/wp-lazy-loading/`, the plugin name would be `wp-lazy-loading`. You can pre-install multiple plugins by saying `plugin=coblocks&plugin=wp-lazy-loading&…`. Installing a plugin automatically logs the user in as an admin. More than one plugin could be installed, just repeating the `plugin` attribute on the URL. |
| `theme`            |                       | Installs the specified theme. Use the theme name from the WordPress Themes Directory URL. For example, if the URL is `https://wordpress.org/themes/disco/`, the theme name would be `disco`. Installing a theme automatically logs the user in as an admin. Multiples themes could be installed just repeating the `theme` attribute on the URL.                                                                                                                            |
| `url`              | `/wp-admin/`          | Load the specified initial WordPress page in this Playground instance.                                                                                                                                                                                                                                                                                                                                                                                                      |
| `mode`             | `browser-full-screen` | Determines how the WordPress instance is displayed. Either wrapped in a browser UI or full width as a seamless experience. Accepts `browser-full-screen`, or `seamless`.                                                                                                                                                                                                                                                                                                    |
| `lazy`             |                       | Defer loading the Playground assets until someone clicks on the "Run" button. Does not accept any values. If `lazy` is added as a URL parameter, loading will be deferred.                                                                                                                                                                                                                                                                                                  |
| `login`            | `yes`                 | Log the user in as an admin. Accepts `yes` or `no`.                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `multisite`        | `no`                  | Enables the WordPress multisite mode. Accepts `yes` or `no`.                                                                                                                                                                                                                                                                                                                                                                                                                |
| `import-site`      |                       | Imports site files and database from a ZIP file specified by a URL.                                                                                                                                                                                                                                                                                                                                                                                                         |
| `import-wxr`       |                       | Imports site content from a WXR file specified by a URL. It uses the WordPress Importer plugin, so the default admin user must be logged in.                                                                                                                                                                                                                                                                                                                                |
| `site-slug`        |                       | Selects which site to load from browser storage. If the specified site does not exist, Playground creates a new browser-saved site with the specified slug unless temporary storage is requested.                                                                                                                                                                                                                                                                           |
| `storage`          |                       | Controls the storage lifecycle. Use `storage=temp` to create a genuinely temporary Playground that is discarded when the page is refreshed or closed. Without it, Playground may autosave the new Playground when browser storage and saving are available.                                                                                                                                                                                                                 |
| `language`         | `en_US`               | Sets the locale for the WordPress instance. This must be used in combination with `networking=yes` otherwise WordPress won't be able to download translations.                                                                                                                                                                                                                                                                                                              |
| `core-pr`          |                       | Installs a specific https://github.com/WordPress/wordpress-develop core PR. Accepts the PR number. For example, `core-pr=6883`.                                                                                                                                                                                                                                                                                                                                             |
| `gutenberg-pr`     |                       | Installs a specific https://github.com/WordPress/gutenberg PR. Accepts the PR number. For example, `gutenberg-pr=65337`.                                                                                                                                                                                                                                                                                                                                                    |
| `gutenberg-branch` |                       | Installs a specific branch from https://github.com/WordPress/gutenberg. Accepts the branch name. For example, `gutenberg-branch=trunk`.                                                                                                                                                                                                                                                                                                                                     |
| `page-title`       |                       | Customizes the browser tab title. Useful for identifying different Playground instances when working with multiple tabs. The parameter is preserved when navigating between sites.                                                                                                                                                                                                                                                                                          |
| `can-save`         |                       | Controls whether the Playground shell offers automatic browser saving. Use `can-save=no` to start a temporary Playground and hide the Dock save status/persistence prompt.                                                                                                                                                                                                                                                                                                  |
| `mcp-port`         | `7999`                | Sets the WebSocket port used by the MCP bridge to communicate with the MCP server. For example, `mcp-port=8080`.                                                                                                                                                                                                                                                                                                                                                            |
| `overlay`          |                       | Opens a Playground tool on page load. Supports `new` for the Dock's **New** pane. For example, `?overlay=new`. `blueprints` is kept as a compatibility alias that opens the same **New** pane, so `?overlay=blueprints` still works. The parameter is removed from the URL when the pane is closed.                                                                                                                                                                         |
| `dock`             |                       | Sets the initial Dock state. Accepts `minimized`, `collapsed`, `expanded`, `full-width`, or `full-width-collapsed`. Overrides the saved width preference for this visit. Ignored in seamless mode. Minimized and collapsed states are ignored on small screens. Opening a pane restores the Dock as needed.                                                                                                                                                                 |
-->

| অপশন (Option) | ডিফল্ট মান (Default Value) | বিবরণ (Description) |
| --- | --- | --- |
| `php` | `8.5` | নির্দিষ্ট PHP সংস্করণ লোড করে। `7.4`, `8.0`, `8.1`, `8.2`, `8.3`, `8.4`, `8.5`, `latest` অথবা `next` গ্রহণ করে। php-src ডেভেলপমেন্ট ব্রাঞ্চ থেকে পরবর্তী PHP সংস্করণের প্রিভিউ দেখতে `next` ব্যবহার করুন; এটি বর্তমানে শুধুমাত্র ওয়েব রানটাইমে সমর্থিত। |
| `php-extension` | | PHP চালু হওয়ার আগে একটি কাস্টম PHP.wasm এক্সটেনশন ম্যানিফেস্ট লোড করে। অ্যাবসলিউট, রুট-রিলেটিভ বা পেজ-রিলেটিভ HTTP(S) URL গ্রহণ করে। একাধিকবার ব্যবহার করা যেতে পারে। |
| `wp` | `latest` | নির্দিষ্ট ওয়ার্ডপ্রেস সংস্করণ লোড করে। সর্বশেষ তিনটি প্রধান ওয়ার্ডপ্রেস সংস্করণ গ্রহণ করে। ১ জুন, ২০২৪ অনুযায়ী এগুলো হলো `6.3`, `6.4` বা `6.5`। আপনি সাধারণ মান `latest`, `nightly` বা `beta` ব্যবহার করতে পারেন। |
| `blueprint-url` | | ব্লুপ্রিন্ট (Blueprint)-এর URL যা এই প্লেগ্রাউন্ড ইনস্ট্যান্স কনফিগার করতে ব্যবহৃত হবে। |
| `networking` | `yes` | প্লেগ্রাউন্ডের জন্য নেটওয়ার্কিং সমর্থন সক্রিয় বা নিষ্ক্রিয় করে। `yes` অথবা `no` গ্রহণ করে। |
| `plugin` | | নির্দিষ্ট প্লাগইন ইনস্টল করে। ওয়ার্ডপ্রেস প্লাগইন ডিরেক্টরি URL থেকে প্লাগইনের নামটি ব্যবহার করুন। উদাহরণস্বরূপ, URL যদি `https://wordpress.org/plugins/wp-lazy-loading/` হয়, তবে প্লাগইনের নাম হবে `wp-lazy-loading`। আপনি `plugin=coblocks&plugin=wp-lazy-loading&…` যুক্ত করে একাধিক প্লাগইন প্রি-ইনস্টল করতে পারেন। কোনো প্লাগইন ইনস্টল করলে ব্যবহারকারী স্বয়ংক্রিয়ভাবে অ্যাডমিন হিসেবে লগইন হয়ে যান। URL-এ `plugin` অ্যাট্রিবিউট পুনরাবৃত্তি করে একাধিক প্লাগইন ইনস্টল করা যেতে পারে। |
| `theme` | | নির্দিষ্ট থিম ইনস্টল করে। ওয়ার্ডপ্রেস থিম ডিরেক্টরি URL থেকে থিমের নামটি ব্যবহার করুন। উদাহরণস্বরূপ, URL যদি `https://wordpress.org/themes/disco/` হয়, তবে থিমের নাম হবে `disco`। কোনো থিম ইনস্টল করলে ব্যবহারকারী স্বয়ংক্রিয়ভাবে অ্যাডমিন হিসেবে লগইন হয়ে যান। URL-এ `theme` অ্যাট্রিবিউট পুনরাবৃত্তি করে একাধিক থিম ইনস্টল করা যেতে পারে। |
| `url` | `/wp-admin/` | এই প্লেগ্রাউন্ড ইনস্ট্যান্সে নির্দিষ্ট প্রারম্ভিক ওয়ার্ডপ্রেস পেজ লোড করে। |
| `mode` | `browser-full-screen` | ওয়ার্ডপ্রেস ইনস্ট্যান্সটি কীভাবে প্রদর্শিত হবে তা নির্ধারণ করে। ব্রাউজার UI-তে আবদ্ধ কিংবা ফুল উইডথ হিসেবে একটি নিরবচ্ছিন্ন (seamless) অভিজ্ঞতা হিসেবে প্রদর্শিত হতে পারে। `browser-full-screen` বা `seamless` গ্রহণ করে। |
| `lazy` | | কেউ "Run" বাটনে ক্লিক না করা পর্যন্ত প্লেগ্রাউন্ডের অ্যাসেট লোড হওয়া স্থগিত রাখে। কোনো মান গ্রহণ করে না। URL প্যারামিটার হিসেবে `lazy` যুক্ত থাকলে লোডিং বিলম্বিত হবে। |
| `login` | `yes` | ব্যবহারকারীকে অ্যাডমিন হিসেবে লগইন করায়। `yes` অথবা `no` গ্রহণ করে। |
| `multisite` | `no` | ওয়ার্ডপ্রেস মাল্টিসাইট মোড সক্রিয় করে। `yes` অথবা `no` গ্রহণ করে। |
| `import-site` | | একটি URL দ্বারা নির্দিষ্ট ZIP ফাইল থেকে সাইটের ফাইল ও ডেটাবেস ইম্পোর্ট করে। |
| `import-wxr` | | একটি URL দ্বারা নির্দিষ্ট WXR ফাইল থেকে সাইটের বিষয়বস্তু (content) ইম্পোর্ট করে। এটি WordPress Importer প্লাগইন ব্যবহার করে, তাই ডিফল্ট অ্যাডমিন ব্যবহারকারীর লগইন থাকা আবশ্যক। |
| `site-slug` | | ব্রাউজার স্টোরেজ থেকে কোন সাইটটি লোড করতে হবে তা নির্বাচন করে। নির্দিষ্ট সাইটটি বিদ্যমান না থাকলে, অস্থায়ী স্টোরেজ চাওয়া না হলে প্লেগ্রাউন্ড উক্ত স্লাগ সহ একটি নতুন ব্রাউজার-সংরক্ষিত সাইট তৈরি করে। |
| `storage` | | স্টোরেজের লাইফসাইকেল নিয়ন্ত্রণ করে। পেজ রিফ্রেশ বা বন্ধ করার সাথে সাথে মুছে যাবে এমন একটি সম্পূর্ণ অস্থায়ী প্লেগ্রাউন্ড তৈরি করতে `storage=temp` ব্যবহার করুন। এটি ছাড়া, ব্রাউজার স্টোরেজ এবং সেভিং উপলভ্য থাকলে প্লেগ্রাউন্ড নতুন প্লেগ্রাউন্ডকে স্বয়ংক্রিয়ভাবে সংরক্ষণ (autosave) করতে পারে। |
| `language` | `en_US` | ওয়ার্ডপ্রেস ইনস্ট্যান্সের লোকাল (ভাষা) নির্ধারণ করে। এটি অবশ্যই `networking=yes`-এর সাথে মিলিয়ে ব্যবহার করতে হবে, অন্যথায় ওয়ার্ডপ্রেস অনুবাদসমূহ ডাউনলোড করতে পারবে না। |
| `core-pr` | | https://github.com/WordPress/wordpress-develop থেকে একটি নির্দিষ্ট কোর PR ইনস্টল করে। PR নম্বর গ্রহণ করে। উদাহরণস্বরূপ, `core-pr=6883`। |
| `gutenberg-pr` | | https://github.com/WordPress/gutenberg থেকে একটি নির্দিষ্ট PR ইনস্টল করে। PR নম্বর গ্রহণ করে। উদাহরণস্বরূপ, `gutenberg-pr=65337`। |
| `gutenberg-branch` | | https://github.com/WordPress/gutenberg থেকে একটি নির্দিষ্ট ব্রাঞ্চ ইনস্টল করে। ব্রাঞ্চের নাম গ্রহণ করে। উদাহরণস্বরূপ, `gutenberg-branch=trunk`। |
| `page-title` | | ব্রাউজার ট্যাব টাইটেল কাস্টমাইজ করে। একাধিক ট্যাব নিয়ে কাজ করার সময় বিভিন্ন প্লেগ্রাউন্ড ইনস্ট্যান্স শনাক্ত করতে কার্যকর। সাইটগুলোর মধ্যে নেভিগেট করার সময় প্যারামিটারটি অক্ষুণ্ণ থাকে। |
| `can-save` | | প্লেগ্রাউন্ড শেল স্বয়ংক্রিয় ব্রাউজার সেভিং অফার করবে কিনা তা নিয়ন্ত্রণ করে। একটি অস্থায়ী প্লেগ্রাউন্ড শুরু করতে এবং ডক (Dock)-এর সেভ স্ট্যাটাস/পারসিস্টেন্স প্রম্পট লুকাতে `can-save=no` ব্যবহার করুন। |
| `mcp-port` | `7999` | MCP সার্ভারের সাথে যোগাযোগের জন্য MCP ব্রিজ কর্তৃক ব্যবহৃত ওয়েবসকেট (WebSocket) পোর্ট নির্ধারণ করে। উদাহরণস্বরূপ, `mcp-port=8080`। |
| `overlay` | | পেজ লোডের সময় একটি প্লেগ্রাউন্ড টুল খোলে। ডকের **New** প্যানেলের জন্য `new` সমর্থন করে। উদাহরণস্বরূপ, `?overlay=new`। `blueprints` একটি কম্প্যাটিবিলিটি উপনাম (alias) হিসেবে রাখা হয়েছে যা একই **New** প্যানেল খোলে, ফলে `?overlay=blueprints` এখনও কাজ করে। প্যানেলটি বন্ধ করা হলে URL থেকে প্যারামিটারটি অপসারিত হয়। |
| `dock` | | ডক (Dock)-এর প্রাথমিক অবস্থা নির্ধারণ করে। `minimized`, `collapsed`, `expanded`, `full-width`, অথবা `full-width-collapsed` গ্রহণ করে। এই ভিজিটের জন্য সংরক্ষিত উইডথ (width) প্রেফারেন্স ওভাররাইড করে। সিমলেস (seamless) মোডে উপেক্ষা করা হয়। ছোট স্ক্রিনে `minimized` এবং `collapsed` অবস্থাগুলো উপেক্ষা করা হয়। কোনো প্যানেল খোলা হলে প্রয়োজন অনুযায়ী ডক পুনরুদ্ধার করা হয়। |

<!--
Use `language=browser` to choose a WordPress translation from the browser's preferred languages
(`navigator.languages`). Regional preferences fall back to an available translation of the same
language. If no translation matches, WordPress uses US English (`en_US`). For example:
[Open Playground in your browser's language](https://playground.wordpress.net/?language=browser&networking=yes).
-->

ব্রাউজারের পছন্দসই ভাষা (`navigator.languages`) থেকে ওয়ার্ডপ্রেস অনুবাদ বেছে নিতে `language=browser` ব্যবহার করুন। আঞ্চলিক পছন্দসমূহ একই ভাষার উপলভ্য অনুবাদের ওপর ফলব্যাক করে। কোনো অনুবাদের মিল না পাওয়া গেলে, ওয়ার্ডপ্রেস মার্কিন ইংরেজি (`en_US`) ব্যবহার করে। উদাহরণস্বরূপ:
[আপনার ব্রাউজারের ভাষায় প্লেগ্রাউন্ড খুলুন](https://playground.wordpress.net/?language=browser&networking=yes)।

<!--
For example, the following code embeds a Playground with a preinstalled Gutenberg plugin and opens the post editor:
-->

উদাহরণস্বরূপ, নিচের কোডটি প্রি-ইনস্টল করা গুটেনবার্গ প্লাগইন সহ একটি প্লেগ্রাউন্ড এম্বেড করে এবং পোস্ট এডিটর খোলে:

```html
<iframe src="https://playground.wordpress.net/?plugin=gutenberg&url=/wp-admin/post-new.php&mode=seamless"> </iframe>
```

<!--
## Loading PHP.wasm extensions
-->

## PHP.wasm এক্সটেনশন লোড করা (Loading PHP.wasm extensions) {#loading-phpwasm-extensions}

<!--
Use `php-extension` to load an external PHP.wasm extension manifest before PHP
starts. This is useful for demos that need native extension performance, such
as the SQLite Database Integration plugin's `wp_mysql_parser` extension. You do
not need custom JavaScript for this — the Query API turns each parameter into a
runtime extension request before Playground boots.
-->

PHP চালু হওয়ার আগে একটি বাহ্যিক PHP.wasm এক্সটেনশন ম্যানিফেস্ট লোড করতে `php-extension` ব্যবহার করুন। এটি এমন ডেমোগুলোর জন্য কার্যকর যেগুলোতে নেটিভ এক্সটেনশনের কার্যক্ষমতা প্রয়োজন, যেমন SQLite Database Integration প্লাগইনের `wp_mysql_parser` এক্সটেনশন। এর জন্য আপনার কোনো কাস্টম JavaScript প্রয়োজন নেই — প্লেগ্রাউন্ড বুট হওয়ার আগেই কোয়েরি API প্রতিটি প্যারামিটারকে একটি রানটাইম এক্সটেনশন রিকোয়েস্টে রূপান্তরিত করে।

```text
https://playground.wordpress.net/?php=8.5&php-extension=https://wordpress.github.io/sqlite-database-integration/wp_mysql_parser-wasm-extension/latest/manifest.json
```

<!--
Use `/latest/manifest.json` for a quick demo. Use a pinned manifest from the
extension release page when you need a stable URL for tests or documentation.
-->

একটি দ্রুত ডেমোর জন্য `/latest/manifest.json` ব্যবহার করুন। পরীক্ষা বা ডকুমেন্টেশনের জন্য একটি স্থিতিশীল URL প্রয়োজন হলে এক্সটেনশন রিলিজ পেজ থেকে একটি পিন করা ম্যানিফেস্ট ব্যবহার করুন।

<!--
You can repeat `php-extension` to load multiple manifests:
-->

একাধিক ম্যানিফেস্ট লোড করার জন্য আপনি `php-extension` পুনরাবৃত্তি করতে পারেন:

```text
https://playground.wordpress.net/?php-extension=https://example.com/one/manifest.json&php-extension=https://example.com/two/manifest.json
```

<!--
The parameter accepts absolute, root-relative, and page-relative manifest URLs:
-->

এই প্যারামিটারটি অ্যাবসলিউট, রুট-রিলেটিভ এবং পেজ-রিলেটিভ ম্যানিফেস্ট URL গ্রহণ করে:

```text
?php-extension=https://cdn.example.com/wp_mysql_parser/manifest.json
?php-extension=/extensions/wp_mysql_parser/manifest.json
?php-extension=./extensions/wp_mysql_parser/manifest.json
```

<!--
Relative values are resolved against the current Playground page URL. The
manifest URL must use HTTP(S) once resolved. `file:` URLs are rejected in the
browser. For local CLI workflows, use
the [`--php-extension` flag](/developers/local-development/wp-playground-cli#loading-phpwasm-extensions)
instead.
-->

আপেক্ষিক (relative) মানগুলো বর্তমান প্লেগ্রাউন্ড পেজ URL-এর সাপেক্ষে নির্ধারিত (resolve) হয়। ম্যানিফেস্ট URL নির্ধারিত হওয়ার পরে অবশ্যই HTTP(S) ব্যবহার করতে হবে। ব্রাউজারে `file:` URL প্রত্যাখ্যাত হয়। লোকাল CLI ওয়ার্কফ্লোগুলোর ক্ষেত্রে, এর পরিবর্তে [`--php-extension` ফ্ল্যাগ](/developers/local-development/wp-playground-cli#loading-phpwasm-extensions) ব্যবহার করুন।

<div class="callout callout-info">

<!--
**CORS policy**
-->

**CORS নীতি (CORS policy)**

<!--
To import files from a URL, such as a site zip package or PHP extension
manifest and `.so` artifact, they must be served with the
`Access-Control-Allow-Origin` header set. For reference, see:
[Cross-Origin Resource Sharing (CORS)](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS#the_http_response_headers).
-->

কোনো URL থেকে ফাইল ইম্পোর্ট করার জন্য—যেমন সাইট জিপ (zip) প্যাকেজ বা PHP এক্সটেনশন ম্যানিফেস্ট এবং `.so` আর্টিফ্যাক্ট—সেগুলো অবশ্যই `Access-Control-Allow-Origin` হেডার সেট করে পরিবেশন করতে হবে। বিস্তারিত জানার জন্য দেখুন:
[Cross-Origin Resource Sharing (CORS)](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS#the_http_response_headers)।

</div>

<!--
## GitHub Export Options
-->

## GitHub এক্সপোর্ট অপশনসমূহ (GitHub Export Options) {#github-export-options}

<!--
The following additional query parameters may be used to pre-configure the GitHub export form:
-->

GitHub এক্সপোর্ট ফর্মটি পূর্ব-কনফিগার (pre-configure) করতে নিচের অতিরিক্ত কোয়েরি প্যারামিটারগুলো ব্যবহার করা যেতে পারে:

<!--
- `gh-ensure-auth`: If set to `yes`, Playground will display a modal to ensure the
  user is authenticated with GitHub before proceeding.
- `ghexport-repo-url`: The URL of the GitHub repository to export to.
- `ghexport-pr-action`: The action to take when exporting (create or update).
- `ghexport-playground-root`: The root directory in the Playground to export from.
- `ghexport-repo-root`: The root directory in the repository to export to.
- `ghexport-content-type`: The content type of the export (plugin, theme, wp-content, custom-paths).
- `ghexport-plugin`: Plugin path. When the content type is `plugin`, pre-select the plugin to export.
- `ghexport-theme`: Theme directory name. When the content type is `theme`, pre-select the theme to export.
- `ghexport-path`: A path relative to `ghexport-playground-root`. Can be provided multiple times. When the
  content type is `custom-paths`, it pre-populates the list of paths to export.
- `ghexport-commit-message`: The commit message to use when exporting.
- `ghexport-allow-include-zip`: Whether to offer an option to include a zip file in the GitHub
  export (yes, no). Optional. Defaults to `yes`.
-->

- `gh-ensure-auth`: `yes` হিসেবে সেট করা থাকলে, এগিয়ে যাওয়ার আগে ব্যবহারকারী GitHub-এ প্রমাণীকৃত (authenticated) কিনা তা নিশ্চিত করতে প্লেগ্রাউন্ড একটি মডেল (modal) প্রদর্শন করবে।
- `ghexport-repo-url`: যে GitHub রিপোজিটরিতে এক্সপোর্ট করা হবে তার URL।
- `ghexport-pr-action`: এক্সপোর্ট করার সময় সম্পাদনযোগ্য অ্যাকশন (`create` বা `update`)।
- `ghexport-playground-root`: এক্সপোর্ট করার জন্য প্লেগ্রাউন্ডের মূল (root) ডিরেক্টরি।
- `ghexport-repo-root`: রিপোজিটরির যে মূল ডিরেক্টরিতে এক্সপোর্ট করা হবে।
- `ghexport-content-type`: এক্সপোর্টের কন্টেন্ট টাইপ (`plugin`, `theme`, `wp-content`, `custom-paths`)।
- `ghexport-plugin`: প্লাগইন পাথ। কন্টেন্ট টাইপ `plugin` হলে, এক্সপোর্ট করার জন্য প্লাগইনটি আগে থেকেই সিলেক্ট করে রাখে।
- `ghexport-theme`: থিম ডিরেক্টরির নাম। কন্টেন্ট টাইপ `theme` হলে, এক্সপোর্ট করার জন্য থিমটি আগে থেকেই সিলেক্ট করে রাখে।
- `ghexport-path`: `ghexport-playground-root`-এর সাপেক্ষে একটি আপেক্ষিক পাথ। একাধিকবার প্রদান করা যেতে পারে। কন্টেন্ট টাইপ `custom-paths` হলে, এটি এক্সপোর্ট করার পাথগুলোর তালিকা আগে থেকেই পূরণ করে রাখে।
- `ghexport-commit-message`: এক্সপোর্ট করার সময় ব্যবহারের জন্য কমিট বার্তা।
- `ghexport-allow-include-zip`: GitHub এক্সপোর্টে কোনো জিপ (zip) ফাইল অন্তর্ভুক্ত করার বিকল্প দেওয়া হবে কিনা (`yes`, `no`)। ঐচ্ছিক। ডিফল্ট মান `yes`।
