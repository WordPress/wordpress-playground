---
title: আর্কিটেকচার
slug: /developers/architecture
---

<!--
# Architecture overview
-->

# আর্কিটেকচার ওভারভিউ

<!--
WordPress Playground consists of the following high-level components:
-->

ওয়ার্ডপ্রেস প্লেগ্রাউন্ড নিম্নলিখিত উচ্চ-স্তরের উপাদানগুলো নিয়ে গঠিত:

<!--
- [WordPress](/developers/architecture/wordpress)
- [WebAssembly PHP](/developers/architecture/wasm-php-overview)
- [Browser bindings](/developers/architecture/browser-concepts)
- [PHP.wasm packages](/developers/architecture/php-wasm-packages) for the shared
  API, platform bindings, and version-specific binaries
- [Public API](/developers/apis/)
-->

- [ওয়ার্ডপ্রেস](/developers/architecture/wordpress)
- [WebAssembly PHP](/developers/architecture/wasm-php-overview)
- [ব্রাউজার বাইন্ডিং](/developers/architecture/browser-concepts)
- শেয়ার্ড API, প্ল্যাটফর্ম বাইন্ডিং এবং নির্দিষ্ট ভার্সনের বাইনারির জন্য [PHP.wasm প্যাকেজ](/developers/architecture/php-wasm-packages)
- [পাবলিক API](/developers/apis/)

<!--
Visit each section to learn more about the specific parts of the architecture.
-->

আর্কিটেকচারের নির্দিষ্ট অংশগুলো সম্পর্কে আরও বিস্তারিত জানতে প্রতিটি বিভাগে যান।

<!--
## Tooling
-->

## টুলিং

<!--
### NX: building packages and projects
-->

### NX: প্যাকেজ এবং প্রজেক্ট বিল্ড করা

<!--
WordPress Playground uses [NX](https://nx.dev/), a build system designed for monorepos.
-->

ওয়ার্ডপ্রেস প্লেগ্রাউন্ড [NX](https://nx.dev/) ব্যবহার করে, যা মনোরেপোর জন্য তৈরি একটি বিল্ড সিস্টেম।

<!--
The dependencies between Playground packages and projects [are too complex](https://github.com/WordPress/wordpress-playground/pull/151) for a bundler like Webpack, and NX handles this complexity much better:
![Dependency graph](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dependencies.webp)
-->

প্লেগ্রাউন্ডের প্যাকেজ এবং প্রজেক্টগুলোর মধ্যকার ডিপেন্ডেন্সি ওয়েবপ্যাকের (Webpack) মতো বান্ডলারের জন্য [অত্যধিক জটিল](https://github.com/WordPress/wordpress-playground/pull/151), এবং NX এই জটিলতা অনেক দক্ষতার সাথে পরিচালনা করে:
![Dependency graph](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dependencies.webp)

<!--
To learn more, head over to the [NX developer docs](https://nx.dev/getting-started/intro).
-->

আরও বিস্তারিত জানতে, [NX ডেভেলপার ডকস](https://nx.dev/getting-started/intro) দেখুন।

<!--
### Lerna: publishing packages and projects
-->

### Lerna: প্যাকেজ এবং প্রজেক্ট পাবলিশ করা

<!--
WordPress Playground includes several NPM packages, a VS Code extension, WordPress plugins, a web app, and other GitHub releases, all managed across two monorepos: the main [wordpress-playground](https://github.com/WordPress/wordpress-playground) and [Playground Tools](https://github.com/WordPress/playground-tools/).
-->

ওয়ার্ডপ্রেস প্লেগ্রাউন্ডে বেশ কয়েকটি NPM প্যাকেজ, একটি VS Code এক্সটেনশন, ওয়ার্ডপ্রেস প্লাগইন, একটি ওয়েব অ্যাপ এবং অন্যান্য GitHub রিলিজ অন্তর্ভুক্ত রয়েছে, যা দুটি মনোরেপোতে পরিচালিত হয়: প্রধান [wordpress-playground](https://github.com/WordPress/wordpress-playground) এবং [Playground Tools](https://github.com/WordPress/playground-tools/)।

<!--
We use [Lerna](https://lerna.js.org) to build, manage, and publish all JavaScript/TypeScript packages. Lerna handles everything simultaneously: it increments the version number, sets a new tag, and publishes the modified packages to `npm`.
-->

সমস্ত JavaScript/TypeScript প্যাকেজ বিল্ড, পরিচালনা এবং পাবলিশ করতে আমরা [Lerna](https://lerna.js.org) ব্যবহার করি। লার্না (Lerna) একই সাথে সবকিছু সম্পন্ন করে: এটি ভার্সন নম্বর বৃদ্ধি করে, একটি নতুন ট্যাগ সেট করে এবং পরিবর্তিত প্যাকেজগুলো `npm`-এ প্রকাশ করে।

<!--
The published packages share the same version number, so when updating a single package, Lerna bumps the version number of all dependent packages.
-->

প্রকাশিত প্যাকেজগুলো একই ভার্সন নম্বর শেয়ার করে, তাই একটি প্যাকেজ আপডেট করার সময় লার্না সমস্ত নির্ভরশীল প্যাকেজের ভার্সন নম্বরও বৃদ্ধি করে।
