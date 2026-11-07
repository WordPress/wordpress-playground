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

Xdebug হলো PHP-এর একটি ডিবাগিং এক্সটেনশন, যার মাধ্যমে আপনি ব্রেকপয়েন্ট সেট করতে, ভেরিয়েবল পরীক্ষা করতে এবং কোড ধাপে ধাপে চালিয়ে দেখতে পারেন। ওয়ার্ডপ্রেস প্লেগ্রাউন্ডের WebAssembly-তে কম্পাইল করা PHP-তে Xdebug অন্তর্ভুক্ত রয়েছে, তাই আপনি সরাসরি আপনার ব্রাউজার বা IDE-তে চলা ওয়ার্ডপ্রেস কোড ডিবাগ করতে পারেন।

<!--
## Why Xdebug matters for PHP WASM
-->

## PHP WASM-এর জন্য Xdebug কেন গুরুত্বপূর্ণ

<!--
Debugging PHP code in WebAssembly is different from debugging traditional PHP. Without Xdebug, you're limited to `var_dump()` and `error_log()` statements. Xdebug gives you a proper debugger with breakpoints, variable inspection, and call stack navigation—the same tools you'd use when debugging PHP on a regular server.
-->

WebAssembly-তে PHP কোড ডিবাগ করা প্রচলিত PHP ডিবাগ করার চেয়ে আলাদা। Xdebug ছাড়া আপনি শুধু `var_dump()` এবং `error_log()` স্টেটমেন্টের মধ্যেই সীমাবদ্ধ থাকেন। Xdebug আপনাকে ব্রেকপয়েন্ট, ভেরিয়েবল পরীক্ষা এবং কল স্ট্যাক নেভিগেশনসহ একটি পূর্ণাঙ্গ ডিবাগার দেয়—সাধারণ সার্ভারে PHP ডিবাগ করার সময় আপনি ঠিক এই টুলগুলোই ব্যবহার করতেন।

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

আপনি যা ডিবাগ করতে শিখবেন:

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

ওয়ার্ডপ্রেস প্লেগ্রাউন্ড Xdebug দিয়ে ডিবাগ করার দুটি উপায় সাপোর্ট করে:

<!--
**Chrome DevTools**: Debug directly in your browser without any IDE setup. Great for quick debugging sessions or when you want to see everything in one place.
-->

**Chrome DevTools**: কোনো IDE সেটআপ ছাড়াই সরাসরি আপনার ব্রাউজারে ডিবাগ করুন। দ্রুত ডিবাগিং সেশনের জন্য, অথবা সবকিছু এক জায়গায় দেখতে চাইলে এটি দারুণ।

<!--
**IDE integration**: Use VSCode or PhpStorm with full IDE features, including code navigation, project-wide search, and advanced breakpoint conditions. Better for complex debugging scenarios.
-->

**IDE ইন্টিগ্রেশন**: কোড নেভিগেশন, পুরো প্রজেক্টজুড়ে সার্চ এবং অ্যাডভান্সড ব্রেকপয়েন্ট কন্ডিশনসহ IDE-এর সব ফিচার নিয়ে VSCode বা PhpStorm ব্যবহার করুন। জটিল ডিবাগিং পরিস্থিতির জন্য এটি বেশি উপযোগী।

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
- ওয়ার্ডপ্রেস প্লাগইন ডেভেলপমেন্ট সম্পর্কে প্রাথমিক ধারণা

<!--
**Next**: [Getting Started with Xdebug →](/developers/xdebug/xdebug-getting-started)
-->

**পরবর্তী**: [Xdebug দিয়ে শুরু করা →](/developers/xdebug/xdebug-getting-started)
