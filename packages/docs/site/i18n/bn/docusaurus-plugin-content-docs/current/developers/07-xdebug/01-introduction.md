---
title: ওয়ার্ডপ্রেস প্লেগ্রাউন্ডে Xdebug দিয়ে ডিবাগিং
slug: /developers/xdebug/introduction
description: Xdebug, Chrome DevTools এবং IDE ইন্টিগ্রেশন ব্যবহার করে ওয়ার্ডপ্রেস প্লেগ্রাউন্ডের ভেতরে WebAssembly-তে চলা PHP কোড ডিবাগ করুন।
---

<!--
# Debugging with Xdebug in WordPress Playground
-->

# ওয়ার্ডপ্রেস প্লেগ্রাউন্ডে Xdebug দিয়ে ডিবাগিং

<!--
Xdebug is a debugging extension for PHP that lets you set breakpoints, inspect variables, and step through your code. WordPress Playground includes Xdebug in its WebAssembly-compiled PHP, so you can debug WordPress code running directly in your browser or IDE.
-->

Xdebug হলো PHP-এর একটি ডিবাগিং এক্সটেনশন, এটি দিয়ে আপনি ব্রেকপয়েন্ট বসাতে, ভেরিয়েবলের মান দেখতে আর কোড ধাপে ধাপে চালিয়ে দেখতে পারেন। ওয়ার্ডপ্রেস প্লেগ্রাউন্ডের WebAssembly-তে কম্পাইল করা PHP-তে Xdebug আগে থেকেই আছে। তাই ব্রাউজারে বা IDE-তে চলা ওয়ার্ডপ্রেস কোড সরাসরি ডিবাগ করতে পারবেন।

<!--
## Why Xdebug matters for PHP WASM
-->

## PHP WASM-এর জন্য Xdebug কেন গুরুত্বপূর্ণ

<!--
Debugging PHP code in WebAssembly is different from debugging traditional PHP. Without Xdebug, you're limited to `var_dump()` and `error_log()` statements. Xdebug gives you a proper debugger with breakpoints, variable inspection, and call stack navigation—the same tools you'd use when debugging PHP on a regular server.
-->

WebAssembly-তে PHP ডিবাগ করা সাধারণ PHP ডিবাগ করার মতো নয়। Xdebug না থাকলে আপনার হাতে শুধু `var_dump()` আর `error_log()` থাকে। Xdebug দিলে পান একটি আসল ডিবাগার: ব্রেকপয়েন্ট, ভেরিয়েবলের মান দেখা, কল স্ট্যাক ঘুরে দেখা—সাধারণ সার্ভারে PHP ডিবাগ করতে যে টুলগুলো ব্যবহার করেন, ঠিক সেগুলোই।

<!--
## XDebug on WordPress Playground
-->

## ওয়ার্ডপ্রেস প্লেগ্রাউন্ডে XDebug

<!--
For a quick start, check the [getting started with Xdebug guide](/developers/xdebug/xdebug-getting-started)
-->

দ্রুত শুরু করতে [Xdebug দিয়ে শুরু করার গাইডটি](/developers/xdebug/xdebug-getting-started) দেখুন।

<!--
You'll learn to debug:

- Form processing logic
- Input validation
- WordPress hooks and filters
-->

যা যা ডিবাগ করা শিখবেন:

- ফর্ম প্রসেসিং লজিক
- ইনপুট ভ্যালিডেশন
- ওয়ার্ডপ্রেস হুক এবং ফিল্টার

<!--
## Two debugging approaches
-->

## ডিবাগিংয়ের দুটি পদ্ধতি

<!--
WordPress Playground supports two ways to debug with Xdebug:
-->

ওয়ার্ডপ্রেস প্লেগ্রাউন্ডে Xdebug দিয়ে দুইভাবে ডিবাগ করা যায়:

<!--
**Chrome DevTools**: Debug directly in your browser without any IDE setup. Great for quick debugging sessions or when you want to see everything in one place.
-->

**Chrome DevTools**: কোনো IDE সেটআপ ছাড়াই সরাসরি আপনার ব্রাউজারে ডিবাগ করুন। ঝটপট কিছু ডিবাগ করতে, বা সবকিছু এক জায়গায় দেখতে চাইলে এটি দারুণ কাজের।

<!--
**IDE integration**: Use VSCode or PhpStorm with full IDE features, including code navigation, project-wide search, and advanced breakpoint conditions. Better for complex debugging scenarios.
-->

**IDE ইন্টিগ্রেশন**: কোড নেভিগেশন, পুরো প্রজেক্টজুড়ে সার্চ এবং অ্যাডভান্সড ব্রেকপয়েন্ট কন্ডিশনসহ IDE-এর সব ফিচারসহ VSCode বা PhpStorm ব্যবহার করুন। জটিল সমস্যা ডিবাগ করতে এটিই ভালো।

<!--
## What you'll need

- Node.js installed
- Chrome or Chromium browser (for DevTools debugging)
- Visual Studio Code or PhpStorm (for IDE debugging, optional)
- Basic familiarity with WordPress plugin development
-->

## আপনার যা লাগবে

- ইনস্টল করা Node.js
- Chrome বা Chromium ব্রাউজার (DevTools দিয়ে ডিবাগিংয়ের জন্য)
- Visual Studio Code বা PhpStorm (IDE দিয়ে ডিবাগিংয়ের জন্য, ঐচ্ছিক)
- ওয়ার্ডপ্রেস প্লাগইন ডেভেলপমেন্টের বেসিক ধারণা

<!--
**Next**: [Getting Started with Xdebug →](/developers/xdebug/xdebug-getting-started)
-->

**পরবর্তী**: [Xdebug দিয়ে শুরু করা →](/developers/xdebug/xdebug-getting-started)
