---
title: প্লেগ্রাউন্ড সিএলআই দিয়ে পিএইচপিইউনিট (PHPUnit) চালানো
slug: /guides/phpunit-testing
description: প্লেগ্রাউন্ড সিএলআই ব্যবহার করে ওয়ার্ডপ্রেস প্লাগইন এবং থিমের জন্য পিএইচপিইউনিট পরীক্ষা চালান — কোনো ডাটাবেজের প্রয়োজন নেই, প্রতিটি রানেই একটি পরিচ্ছন্ন এনভায়রনমেন্ট।
sidebar_class_name: navbar-build-item
---

<!--
The [Playground CLI](/developers/local-development/wp-playground-cli) includes a `php` subcommand that runs PHP scripts directly inside the Playground environment. By mounting your plugin or theme into the Playground filesystem, you can run PHPUnit without a local database. Every run starts with a clean WordPress installation, so tests are fully isolated.
-->

[প্লেগ্রাউন্ড সিএলআই](/developers/local-development/wp-playground-cli)-তে একটি `php` সাবকমান্ড রয়েছে, যা সরাসরি প্লেগ্রাউন্ড এনভায়রনমেন্টের ভেতরে পিএইচপি স্ক্রিপ্ট চালায়। আপনার প্লাগইন বা থিম প্লেগ্রাউন্ডের ফাইলসিস্টেমে মাউন্ট করে, আপনি কোনো লোকাল ডাটাবেজ ছাড়াই পিএইচপিইউনিট (PHPUnit) চালাতে পারেন। প্রতিটি রান একটি পরিচ্ছন্ন ওয়ার্ডপ্রেস ইনস্টলেশন দিয়ে শুরু হয়, যার ফলে পরীক্ষাগুলো সম্পূর্ণ আইসোলেটেড থাকে।

<div class="callout callout-info">

<!--
This guide assumes your plugin or theme has PHPUnit installed via Composer (`composer require --dev phpunit/phpunit`). The `vendor/bin/phpunit` path used below assumes a standard Composer setup.
-->

এই নির্দেশিকায় ধরে নেওয়া হয়েছে যে আপনার প্লাগইন বা থিমে কম্পোজার (Composer)-এর মাধ্যমে পিএইচপিইউনিট ইনস্টল করা আছে (`composer require --dev phpunit/phpunit`)। নিচে ব্যবহৃত `vendor/bin/phpunit` পাথটি একটি স্ট্যান্ডার্ড কম্পোজার সেটআপকে নির্দেশ করে।

</div>

<!--
## Running tests
-->

## পরীক্ষা চালানো

<!--
From your plugin or theme directory, run the following command. Replace `themes/THEME_NAME` with the path to your plugin or theme:
-->

আপনার প্লাগইন বা থিম ডিরেক্টরি থেকে নিচের কমান্ডটি চালান। `themes/THEME_NAME`-কে আপনার প্লাগইন বা থিমের পাথ দিয়ে প্রতিস্থাপন করুন:

```bash
npx @wp-playground/cli@latest php \
  --auto-mount \
  -- \
  /wordpress/wp-content/themes/THEME_NAME/vendor/bin/phpunit \
  -c /wordpress/wp-content/themes/THEME_NAME/phpunit.xml.dist
```

<!--
The `--auto-mount` flag detects whether the current directory is a plugin, theme, or WordPress installation and mounts it at the correct path under `/wordpress/wp-content/`. The `--` separates CLI flags from arguments passed to the PHP interpreter, and you can pass any arguments supported by your PHPUnit configuration.
-->

`--auto-mount` ফ্ল্যাগটি বর্তমান ডিরেক্টরিটি প্লাগইন, থিম নাকি ওয়ার্ডপ্রেস ইনস্টলেশন তা শনাক্ত করে এবং `/wordpress/wp-content/`-এর অধীনে সঠিক পাথে এটি মাউন্ট করে। `--` সিএলআই ফ্ল্যাগগুলোকে পিএইচপি ইন্টারপ্রেটারে পাঠানো আর্গুমেন্ট থেকে পৃথক করে, এবং আপনি আপনার পিএইচপিইউনিট কনফিগারেশন সমর্থিত যেকোনো আর্গুমেন্ট পাস করতে পারেন।

<!--
For a plugin, the path would use `plugins/` instead:
-->

প্লাগইনের ক্ষেত্রে, পাথটিতে পরিবর্তে `plugins/` ব্যবহার করা হবে:

```bash
npx @wp-playground/cli@latest php \
  --auto-mount \
  -- \
  /wordpress/wp-content/plugins/MY_PLUGIN/vendor/bin/phpunit \
  -c /wordpress/wp-content/plugins/MY_PLUGIN/phpunit.xml.dist
```

<!--
You can also use `--mount` to explicitly map a local directory to a path inside the Playground filesystem:
-->

প্লেগ্রাউন্ড ফাইলসিস্টেমের ভিতরের কোনো পাথে লোকাল ডিরেক্টরি স্পষ্টভাবে ম্যাপ করার জন্য আপনি `--mount` ব্যবহার করতে পারেন:

```bash
npx @wp-playground/cli@latest php \
  --mount=.:/wordpress/wp-content/plugins/MY_PLUGIN \
  -- \
  /wordpress/wp-content/plugins/MY_PLUGIN/vendor/bin/phpunit \
  -c /wordpress/wp-content/plugins/MY_PLUGIN/phpunit.xml.dist
```

<!--
## Choosing PHP and WordPress versions
-->

## পিএইচপি এবং ওয়ার্ডপ্রেস সংস্করণ নির্বাচন করা

<!--
Use the `--php` and `--wp` flags to test against specific versions:
-->

নির্দিষ্ট সংস্করণের সাথে পরীক্ষা চালাতে `--php` এবং `--wp` ফ্ল্যাগ ব্যবহার করুন:

```bash
npx @wp-playground/cli@latest php \
  --auto-mount \
  --php=8.1 \
  --wp=6.5 \
  -- \
  /wordpress/wp-content/plugins/MY_PLUGIN/vendor/bin/phpunit \
  -c /wordpress/wp-content/plugins/MY_PLUGIN/phpunit.xml.dist
```

<!--
Supported PHP versions range from 7.4 to 8.5. For WordPress, you can use a specific version number, `latest`, `nightly`, or `beta`.
-->

সমর্থিত পিএইচপি সংস্করণগুলো ৭.৪ থেকে ৮.৫ পর্যন্ত। ওয়ার্ডপ্রেসের জন্য, আপনি একটি নির্দিষ্ট সংস্করণ নম্বর, `latest`, `nightly` অথবা `beta` ব্যবহার করতে পারেন।

<!--
## Next steps

- [Playground CLI documentation](/developers/local-development/wp-playground-cli) — full CLI reference and configuration options
- [E2E Testing with Playwright](/guides/e2e-testing-with-playwright) — browser-based end-to-end testing for WordPress plugins and themes
-->

## পরবর্তী পদক্ষেপ

- [প্লেগ্রাউন্ড সিএলআই ডকুমেন্টেশন](/developers/local-development/wp-playground-cli) — সম্পূর্ণ সিএলআই রেফারেন্স এবং কনফিগারেশন অপশন
- [প্লেরাইটের সাথে এন্ড-টু-এন্ড (E2E) টেস্টিং](/guides/e2e-testing-with-playwright) — ওয়ার্ডপ্রেস প্লাগইন এবং থিমগুলোর জন্য ব্রাউজার-ভিত্তিক এন্ড-টু-এন্ড টেস্টিং
