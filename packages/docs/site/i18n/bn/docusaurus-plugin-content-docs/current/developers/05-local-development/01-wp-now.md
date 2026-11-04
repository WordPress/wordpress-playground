---
title: wp-now
slug: /developers/local-development/wp-now
orphan: true
---

<!--
<div class="callout callout-warning">

**Package deprecated**

The NPM package @wp-now/wp-now is deprecated and won't receive updates in the future. To use a command-line tool in your developer workflow, use the NPM package `@wp-playground/cli`.

</div>
-->

<div class="callout callout-warning">

**প্যাকেজটি অপ্রচলিত (Deprecated)**

`@wp-now/wp-now` এনপিএম প্যাকেজটি বাতিল করা হয়েছে এবং ভবিষ্যতে আর কোনো আপডেট পাবে না। আপনার ডেভেলপার ওয়ার্কফ্লোতে কমান্ড-লাইন টুল ব্যবহার করতে `@wp-playground/cli` এনপিএম প্যাকেজটি ব্যবহার করুন।

</div>

<!--
# wp-now NPM package
-->

# wp-now এনপিএম (NPM) প্যাকেজ

<!--
[`@wp-now/wp-now`](https://www.npmjs.com/package/@wp-now/wp-now) is deprecated.
Use [Playground CLI](/developers/local-development/wp-playground-cli) instead.
It uses the same WordPress Playground runtime and is maintained in the main
WordPress Playground repository.
-->

[`@wp-now/wp-now`](https://www.npmjs.com/package/@wp-now/wp-now) বাতিল করা হয়েছে। এর পরিবর্তে [Playground CLI](/developers/local-development/wp-playground-cli) ব্যবহার করুন। এটি একই ওয়ার্ডপ্রেস প্লেগ্রাউন্ড রানটাইম ব্যবহার করে এবং মূল ওয়ার্ডপ্রেস প্লেগ্রাউন্ড রেপোজিটরিতে রক্ষণাবেক্ষণ করা হয়।

<!--
## Migrate to Playground CLI
-->

## প্লেগ্রাউন্ড সিএলআই-তে (Playground CLI) মাইগ্রেশন

<!--
The familiar wp-now workflow maps to the Playground CLI `start` command:
-->

পরিচিত wp-now ওয়ার্কফ্লোটি Playground CLI-এর `start` কমান্ডের সাথে এভাবে মানানসই:

| wp-now                                                  | Playground CLI                                                     |
| ------------------------------------------------------- | ------------------------------------------------------------------ |
| `npx @wp-now/wp-now start`                              | `npx @wp-playground/cli@latest start`                              |
| `npx @wp-now/wp-now start --path=./plugin`              | `cd ./plugin && npx @wp-playground/cli@latest start`               |
| `npx @wp-now/wp-now start --wp=6.8 --php=8.3`           | `npx @wp-playground/cli@latest start --wp=6.8 --php=8.3`           |
| `npx @wp-now/wp-now start --blueprint=./blueprint.json` | `npx @wp-playground/cli@latest start --blueprint=./blueprint.json` |
| `npx @wp-now/wp-now start --skip-browser`               | `npx @wp-playground/cli@latest start --skip-browser`               |
| `npx @wp-now/wp-now start --reset`                      | `npx @wp-playground/cli@latest start --reset`                      |

<!--
`@wp-playground/cli start` automatically detects whether the selected directory
is a plugin, theme, `wp-content` directory, or WordPress installation. When it
manages the WordPress root directory, it persists the site in
`~/.wordpress-playground/sites/<path-hash>/`. If the selected directory is a full
WordPress installation, that directory becomes the persistent store instead.
-->

`@wp-playground/cli start` স্বয়ংক্রিয়ভাবে শনাক্ত করে যে নির্বাচিত ডিরেক্টরিটি একটি প্লাগইন, থিম, `wp-content` ডিরেক্টরি নাকি পূর্ণাঙ্গ ওয়ার্ডপ্রেস ইনস্টলেশন। যখন এটি ওয়ার্ডপ্রেস রুট ডিরেক্টরি পরিচালনা করে, তখন এটি সাইটটিকে `~/.wordpress-playground/sites/<path-hash>/` পাথে সংরক্ষণ করে। যদি নির্বাচিত ডিরেক্টরিটি একটি সম্পূর্ণ ওয়ার্ডপ্রেস ইনস্টলেশন হয়, তবে সেই ডিরেক্টরিটিই সরাসরি স্থায়ী স্টোর হিসেবে কাজ করে।

<!--
For manual mounts, automation, or CI workflows, use the lower-level
`@wp-playground/cli server` command. See the
[Playground CLI documentation](/developers/local-development/wp-playground-cli)
for details.
-->

ম্যানুয়াল মাউন্ট, অটোমেশন বা সিআই (CI) ওয়ার্কফ্লোর জন্য লো-লেভেল `@wp-playground/cli server` কমান্ড ব্যবহার করুন। বিস্তারিত তথ্যের জন্য [Playground CLI ডকুমেন্টেশন](/developers/local-development/wp-playground-cli) দেখুন।
