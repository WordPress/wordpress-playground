---
slug: /contributing/code
title: কোড কন্ট্রিবিউশন
description: কোড কন্ট্রিবিউশনের জন্য একটি গাইড, যেখানে রিপো ফর্ক করা, লোকাল এনভায়রনমেন্ট সেটআপ করা এবং পুল রিকোয়েস্ট জমা দেওয়ার বিষয়ে আলোচনা করা হয়েছে।
---

<!--
# Code contributions
-->

# কোড কন্ট্রিবিউশন

<!--
Like all WordPress projects, Playground uses GitHub to manage code and track issues. The main repository is at [https://github.com/WordPress/wordpress-playground](https://github.com/WordPress/wordpress-playground) and the Playground Tools repository is at [https://github.com/WordPress/playground-tools/](https://github.com/WordPress/playground-tools/).
-->

সমস্ত ওয়ার্ডপ্রেস প্রজেক্টের মতো, প্লেগ্রাউন্ড কোড ম্যানেজ এবং ইস্যু ট্র্যাক করতে গিটহাব ব্যবহার করে। মেইন রিপোজিটরি হলো [https://github.com/WordPress/wordpress-playground](https://github.com/WordPress/wordpress-playground) এবং প্লেগ্রাউন্ড টুলস রিপোজিটরি হলো [https://github.com/WordPress/playground-tools/](https://github.com/WordPress/playground-tools/)।

<!--
:::info Contribute to Playground Tools

This guide includes links to the main repository, but all the steps and options apply for both. If you're interested in the plugins or [local development](/developers/local-development/) tools—start there.

:::
-->

:::info প্লেগ্রাউন্ড টুলসে কন্ট্রিবিউট করুন

এই গাইডে মেইন রিপোজিটরির লিঙ্ক রয়েছে, তবে সমস্ত স্টেপস এবং অপশন উভয়ের জন্য প্রযোজ্য। আপনি যদি প্লাগইন বা [লোকাল ডেভেলপমেন্ট](/developers/local-development/) টুলসে ইন্টারেস্টেড হন—সেখান থেকে শুরু করুন।

:::

<!--
Browse [the list of open issues](https://github.com/wordpress/wordpress-playground/issues) to find what to work on. The [`Good First Issue`](https://github.com/wordpress/wordpress-playground/issues?q=is%3Aopen+is%3Aissue+label%3A%22Good+First+Issue%22) label is a recommended starting point for first-time contributors.
-->

কী নিয়ে কাজ করবেন তা খুঁজতে [ওপেন ইস্যুগুলির তালিকা](https://github.com/wordpress/wordpress-playground/issues) ব্রাউজ করুন। আপনি যেহেতু প্রথমবার কন্ট্রিবিউট করছেন, [`Good First Issue`](https://github.com/wordpress/wordpress-playground/issues?q=is%3Aopen+is%3Aissue+label%3A%22Good+First+Issue%22) লেবেলযুক্ত ইস্যুগুলো দিয়ে শুরু করতে পারেন।

<!--
Be sure to review the following resources before you begin:

-   [Coding principles](/contributing/coding-standards)
-   [Architecture](/developers/architecture)
-   [Vision and Philosophy](https://github.com/WordPress/wordpress-playground/issues/472)
-   [WordPress Playground Roadmap](https://github.com/WordPress/wordpress-playground/issues/525)
-->

শুরু করার আগে নিম্নলিখিত রিসোর্সগুলি রিভিউ করতে ভুলবেন না:

-   [কোডিং প্রিন্সিপলস](/contributing/coding-standards)
-   [আর্কিটেকচার](/developers/architecture)
-   [ভিশন এবং ফিলোসফি](https://github.com/WordPress/wordpress-playground/issues/472)
-   [ওয়ার্ডপ্রেস প্লেগ্রাউন্ড রোডম্যাপ](https://github.com/WordPress/wordpress-playground/issues/525)

<!--
## Contribute Pull Requests
-->

## পুল রিকোয়েস্ট কন্ট্রিবিউট করুন

<!--
[Fork the Playground repository](https://github.com/WordPress/wordpress-playground/fork) and clone it to your local machine. To do that, copy and paste these commands into your terminal:
-->

[প্লেগ্রাউন্ড রিপোজিটরি ফর্ক করুন](https://github.com/WordPress/wordpress-playground/fork) এবং এটি আপনার লোকাল মেশিনে ক্লোন করুন। এটি করতে, এই কমান্ডগুলি আপনার টার্মিনালে কপি এবং পেস্ট করুন:

```bash
git clone -b trunk --single-branch --depth 1 --recurse-submodules

# আপনার গিটহাব ইউজারনেম দিয়ে `YOUR-GITHUB-USERNAME` রিপ্লেস করুন:
git@github.com:YOUR-GITHUB-USERNAME/wordpress-playground.git
cd wordpress-playground
npm install
```

<!--
Create a branch, make changes, and test it locally by running the following command:
-->

একটি ব্রাঞ্চ ক্রিয়েট করুন, চেঞ্জ করুন এবং নিম্নলিখিত কমান্ড রান করে লোকালি এটি টেস্ট করুন:

```bash
npm run dev
```

<!--
Playground will open in a new browser tab and refresh automatically with each change.
-->

প্লেগ্রাউন্ড একটি নতুন ব্রাউজার ট্যাবে ওপেন হবে এবং প্রতিটি চেঞ্জের সাথে অটোমেটিক্যালি রিফ্রেশ হবে।

<!--
:::tip Troubleshooting: File watcher limit on Linux

On Linux, you might see an error like `ENOSPC: System limit for number of file watchers reached` when running `npm run dev`. This happens because the Playground repository has more files than the default system limit allows to watch.

To fix this, first check your current limit:
-->

:::tip ট্রাবলশুটিং: Linux-এ ফাইল ওয়াচার লিমিট

Linux-এ, `npm run dev` রান করার সময় আপনি `ENOSPC: System limit for number of file watchers reached` এর মতো একটি এরর দেখতে পারেন। এটি হয় কারণ প্লেগ্রাউন্ড রিপোজিটরিতে ডিফল্ট সিস্টেম লিমিটের চেয়ে বেশি ফাইল রয়েছে যা ওয়াচ করার অনুমতি দেয়।

এটি ফিক্স করতে, প্রথমে আপনার বর্তমান লিমিট চেক করুন:

```bash
cat /proc/sys/fs/inotify/max_user_watches
```

<!--
If it's around 65,536 or lower, increase it by running:
-->

যদি এটি 65,536 বা তার কাছাকাছি বা কম হয়, নিম্নলিখিত কমান্ড রান করে এটি বাড়ান:

```bash
sudo sysctl fs.inotify.max_user_watches=131070
sudo sysctl -p
```

<!--
Then try `npm run dev` again. This is a common issue on Debian, Ubuntu, and other Linux distributions.

:::
-->

তারপর আবার `npm run dev` ট্রাই করুন। এটি Debian, Ubuntu এবং অন্যান্য Linux ডিস্ট্রিবিউশনে একটি কমন ইস্যু।

:::

<!--
When your'e ready, commit the changes and submit a Pull Request.
-->

যখন আপনি রেডি, চেঞ্জগুলো কমিট করুন এবং একটি পুল রিকোয়েস্ট সাবমিট করুন।

<!--
:::info Formatting

We handle code formatting and linting automatically. Relax, type away, and let the machines do the work.

:::
-->

:::info ফরম্যাটিং

আমরা কোড ফরম্যাটিং এবং লিন্টিং অটোমেটিক্যালি হ্যান্ডেল করি। রিল্যাক্স করুন, টাইপ করুন এবং মেশিনগুলোকে কাজ করতে দিন।

:::

<!--
### Running a local Multisite
-->

### লোকাল মাল্টিসাইট রান করা

<!--
WordPress Multisite has a few [restrictions when run locally](https://developer.wordpress.org/advanced-administration/multisite/prepare-network/#restrictions). If you plan to test a Multisite network using Playground's `enableMultisite` step, make sure you either change `wp-now`'s default port or set a local test domain running via HTTPS.
-->

ওয়ার্ডপ্রেস মাল্টিসাইট-এর লোকালি রান করার সময় কিছু [রেস্ট্রিকশন](https://developer.wordpress.org/advanced-administration/multisite/prepare-network/#restrictions) রয়েছে। আপনি যদি প্লেগ্রাউন্ড-এর `enableMultisite` স্টেপ ব্যবহার করে একটি মাল্টিসাইট নেটওয়ার্ক টেস্ট করার প্ল্যান করেন, নিশ্চিত করুন যে আপনি হয় `wp-now`-এর ডিফল্ট পোর্ট চেঞ্জ করেছেন অথবা HTTPS-এর মাধ্যমে একটি লোকাল টেস্ট ডোমেইন সেট করেছেন।

<!--
To change `wp-now`'s default port to the one supported by WordPress Multisite, run it using the `--port=80` flag:
-->

ওয়ার্ডপ্রেস মাল্টিসাইট দ্বারা সাপোর্টেড পোর্টে `wp-now`-এর ডিফল্ট পোর্ট চেঞ্জ করতে, এটি `--port=80` ফ্ল্যাগ ব্যবহার করে রান করুন:

```bash
npx @wp-now/wp-now start --port=80
```

<!--
There are a few ways to set up a local test domain, including editing your `hosts` file. If you're unsure how to do that, we suggest installing [Laravel Valet](https://laravel.com/docs/11.x/valet) and then running the following command:
-->

একটি লোকাল টেস্ট ডোমেইন সেট আপ করার বিভিন্ন উপায় রয়েছে, যার মধ্যে আপনার `hosts` ফাইল এডিট করা অন্তর্ভুক্ত। আপনি যদি এটি কীভাবে করবেন তা নিশ্চিত না হন, আমরা [Laravel Valet](https://laravel.com/docs/11.x/valet) ইন্সটল করার সাজেস্ট করি এবং তারপর নিম্নলিখিত কমান্ড রান করুন:

```bash
valet proxy playground.test http://127.0.0.1:5400 --secure
```

<!--
Your dev server is now available on https://playground.test.
-->

আপনার ডেভ সার্ভার এখন https://playground.test-এ অ্যাভেইলেবল।

<!--
## Debugging
-->

## ডিবাগিং

<!--
### Use VS Code and Chrome
-->

### VS Code এবং Chrome ব্যবহার করুন

<!--
If you're using VS Code and have Chrome installed, you can debug Playground in the code editor:

-   Open the project folder in VS Code.
-   Select Run > Start Debugging from the main menu or press `F5`/`fn`+`F5`.
-->

আপনি যদি VS Code ব্যবহার করেন এবং Chrome ইন্সটল করা থাকে, আপনি কোড এডিটরে প্লেগ্রাউন্ড ডিবাগ করতে পারেন:

-   VS Code-এ প্রজেক্ট ফোল্ডার ওপেন করুন।
-   মেইন মেনু থেকে Run > Start Debugging সিলেক্ট করুন অথবা `F5`/`fn`+`F5` প্রেস করুন।

<!--
### Debugging PHP
-->

### PHP ডিবাগিং

<!--
Playground logs PHP errors in the browser console after every PHP request.
-->

প্লেগ্রাউন্ড প্রতিটি PHP রিকোয়েস্টের পরে ব্রাউজার কনসোলে PHP এরর লগ করে।
