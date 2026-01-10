---
slug: /contributing/translations
title: অনুবাদ কন্ট্রিবিউশন
description: প্লেগ্রাউন্ড ডকুমেন্টেশন কীভাবে অনুবাদ করবেন, ফাইল স্ট্রাকচার, লোকাল টেস্টিং এবং রিভিউ প্রক্রিয়া সহ জানুন।
---

<!--
# Contributions to translations
-->

# অনুবাদ কন্ট্রিবিউশন

<!--
Help make WordPress Playground accessible to a global audience by translating its documentation. This guide provides everything you need to know to get started. Contributing translations follows the same workflow as any other documentation change. You can either fork the [WordPress/wordpress-playground](https://github.com/WordPress/wordpress-playground) repository and create a pull request (PR) with your changes or edit pages directly using the GitHub UI.
-->

ওয়ার্ডপ্রেস প্লেগ্রাউন্ডের ডকুমেন্টেশন অনুবাদ করে বিশ্বব্যাপী দর্শকদের কাছে এটি সহজলভ্য করতে সাহায্য করুন। এই গাইড শুরু করার জন্য আপনার প্রয়োজনীয় সবকিছু প্রদান করে। অনুবাদ কন্ট্রিবিউশন অন্য যেকোনো ডকুমেন্টেশন পরিবর্তনের মতো একই ওয়ার্কফ্লো অনুসরণ করে। আপনি হয় [WordPress/wordpress-playground](https://github.com/WordPress/wordpress-playground) রিপোজিটরি ফর্ক করে আপনার পরিবর্তন সহ একটি পুল রিকোয়েস্ট (PR) তৈরি করতে পারেন অথবা গিটহাব UI ব্যবহার করে সরাসরি পেজ এডিট করতে পারেন।

<!--
:::info
For a detailed guide on the contribution workflow (forking, creating PRs, etc.), please see our [documentation contribution guide](/contributing/documentation#how-can-i-contribute)
:::
-->

:::তথ্য
কন্ট্রিবিউশন ওয়ার্কফ্লো (ফর্কিং, PR তৈরি ইত্যাদি) সম্পর্কে বিস্তারিত গাইডের জন্য, অনুগ্রহ করে আমাদের [ডকুমেন্টেশন কন্ট্রিবিউশন গাইড](/contributing/documentation#how-can-i-contribute) দেখুন
:::

<!--
## How Translations Work
-->

## অনুবাদ কীভাবে কাজ করে

<!--
Playground's documentation site is built with Docusaurus, which handles the internationalization (i18n) features.
-->

প্লেগ্রাউন্ডের ডকুমেন্টেশন সাইট Docusaurus দিয়ে তৈরি, যা ইন্টারন্যাশনালাইজেশন (i18n) ফিচার হ্যান্ডেল করে।

<!--
:::info
To learn more about how Docusaurus manages translations, see the [Internationalization section](https://docusaurus.io/docs/i18n/introduction) of the official Docusaurus documentation.
:::
-->

:::তথ্য
Docusaurus কীভাবে অনুবাদ ম্যানেজ করে সে সম্পর্কে আরো জানতে, অফিসিয়াল Docusaurus ডকুমেন্টেশনের [ইন্টারন্যাশনালাইজেশন সেকশন](https://docusaurus.io/docs/i18n/introduction) দেখুন।
:::

<!--
### Configuration
-->

### কনফিগারেশন

<!--
Available languages are defined in the `packages/docs/site/docusaurus.config.js` file. For example:
-->

সহজলভ্য ভাষাগুলো `packages/docs/site/docusaurus.config.js` ফাইলে সংজ্ঞায়িত করা হয়। উদাহরণস্বরূপ:

```
i18n: {
  defaultLocale: 'en',
  path: 'i18n',
  locales: ['en', 'fr'],
  localeConfigs: {
	en: {
		label: 'English',
		path: 'en',
	},
	fr: {
		label: 'French',
		path: 'fr',
	},
  },
}
```

<!--
### File Structure
-->

### ফাইল স্ট্রাকচার

<!--
All translated documentation pages are located within the `packages/docs/site/i18n/` directory, organized by language code.
-->

সমস্ত অনুবাদিত ডকুমেন্টেশন পেজ `packages/docs/site/i18n/` ডিরেক্টরির মধ্যে অবস্থিত, ভাষা কোড অনুযায়ী সাজানো।

<!--
For a language to work correctly, its file structure must mirror the original English documentation found in `packages/docs/site/docs`.
-->

একটি ভাষা সঠিকভাবে কাজ করার জন্য, এর ফাইল স্ট্রাকচার অবশ্যই `packages/docs/site/docs`-এ পাওয়া মূল ইংরেজি ডকুমেন্টেশনের মতো হতে হবে।

<!--
For example, the Spanish (es) translation for `docs/main/intro.md` must be placed at:
packages`/docs/site/i18n/es/docusaurus-plugin-content-docs/current/main/intro.md`.
-->

উদাহরণস্বরূপ, `docs/main/intro.md`-এর স্প্যানিশ (es) অনুবাদ অবশ্যই এখানে রাখতে হবে:
`packages/docs/site/i18n/es/docusaurus-plugin-content-docs/current/main/intro.md`।

<!--
If a translated file does not exist for a specific language, Docusaurus will automatically fall back to the English version of that page.
-->

যদি কোনো নির্দিষ্ট ভাষার জন্য অনুবাদিত ফাইল না থাকে, Docusaurus স্বয়ংক্রিয়ভাবে সেই পেজের ইংরেজি ভার্সনে ফলব্যাক করবে।

<!--
### Generating Translation Files
-->

### অনুবাদ ফাইল জেনারেট করা

<!--
When adding a new language, you can generate the necessary JSON files for UI strings (like button labels and navigation items) by running the following command from the `packages/docs/site` directory:
-->

একটি নতুন ভাষা যোগ করার সময়, আপনি `packages/docs/site` ডিরেক্টরি থেকে নিম্নলিখিত কমান্ড চালিয়ে UI স্ট্রিংগুলোর (যেমন বাটন লেবেল এবং নেভিগেশন আইটেম) জন্য প্রয়োজনীয় JSON ফাইল জেনারেট করতে পারেন:

```bash
npm run write-translations -- --locale <LANGUAGE_CODE>
```

<!--
With the proper i18n `docusaurus.config.js` configuration and files under `i18n` when running `npm run build:docs` from the root of the project, specific folders under `dist` for each language will be created.
-->

সঠিক i18n `docusaurus.config.js` কনফিগারেশন এবং `i18n`-এর অধীনে ফাইল থাকলে, প্রজেক্টের রুট থেকে `npm run build:docs` চালালে প্রতিটি ভাষার জন্য `dist`-এর অধীনে নির্দিষ্ট ফোল্ডার তৈরি হবে।

<!--
## Testing Translations Locally
-->

## লোকালি অনুবাদ টেস্ট করা

<!--
To preview your changes for an existing language:
-->

একটি বিদ্যমান ভাষার জন্য আপনার পরিবর্তন প্রিভিউ করতে:

<!--
1. Modify or add a translated file in the appropriate language directory, such as `packages/docs/site/i18n/es/docusaurus-plugin-content-docs/current/`.
2. From the `/packages/docs/site` directory, run the local development server for your target language. For example, to test Spanish (es):
-->

1. উপযুক্ত ভাষা ডিরেক্টরিতে একটি অনুবাদিত ফাইল মডিফাই বা যোগ করুন, যেমন `packages/docs/site/i18n/es/docusaurus-plugin-content-docs/current/`।
2. `/packages/docs/site` ডিরেক্টরি থেকে, আপনার টার্গেট ভাষার জন্য লোকাল ডেভেলপমেন্ট সার্ভার চালান। উদাহরণস্বরূপ, স্প্যানিশ (es) টেস্ট করতে:

```bash

npm run dev -- --locale es

```

<!--
## The Language Switcher
-->

## ভাষা সুইচার

<!--
The language switcher is a dropdown menu that allows users to select their preferred language.
-->

ভাষা সুইচার হলো একটি ড্রপডাউন মেনু যা ইউজারদের তাদের পছন্দের ভাষা সিলেক্ট করতে দেয়।

![Documentation Language Switcher](@site/static/img/contributing/language-switcher-docs.webp)

<!--
### Making a language publicly available on the Language Switcher
-->

### ভাষা সুইচারে একটি ভাষা পাবলিকলি উপলব্ধ করা

<!--
We recommend only adding a language to the switcher when a significant portion of the documentation has been translated. This avoids a poor user experience where switching to a new language results in seeing mostly untranslated English content.
-->

আমরা শুধুমাত্র তখনই সুইচারে একটি ভাষা যোগ করার পরামর্শ দিই যখন ডকুমেন্টেশনের একটি উল্লেখযোগ্য অংশ অনুবাদ করা হয়েছে। এটি একটি দুর্বল ইউজার এক্সপেরিয়েন্স এড়িয়ে যায় যেখানে নতুন ভাষায় সুইচ করলে বেশিরভাগ অনুবাদহীন ইংরেজি কনটেন্ট দেখা যায়।

<!--
As a guideline, a language should be made publicly available in the switcher only when the entire "Documentation" hub is translated, including these key sections:
-->

একটি গাইডলাইন হিসেবে, একটি ভাষা শুধুমাত্র তখনই সুইচারে পাবলিকলি উপলব্ধ করা উচিত যখন সম্পূর্ণ "ডকুমেন্টেশন" হাব অনুবাদ করা হয়, এই মূল সেকশনগুলো সহ:

<!--
-   [Quick Start Guide](https://wordpress.github.io/wordpress-playground/quick-start-guide)
-   [Playground web instance](https://wordpress.github.io/wordpress-playground/web-instance)
-   [About Playground](https://wordpress.github.io/wordpress-playground/about)
-   [Guides](https://wordpress.github.io/wordpress-playground/guides)
-   [Contributing](https://wordpress.github.io/wordpress-playground/contributing)
-   [Links and Resources](https://wordpress.github.io/wordpress-playground/resources)
-->

-   [দ্রুত শুরু গাইড](https://wordpress.github.io/wordpress-playground/quick-start-guide)
-   [প্লেগ্রাউন্ড ওয়েব ইন্সট্যান্স](https://wordpress.github.io/wordpress-playground/web-instance)
-   [প্লেগ্রাউন্ড সম্পর্কে](https://wordpress.github.io/wordpress-playground/about)
-   [গাইড](https://wordpress.github.io/wordpress-playground/guides)
-   [কন্ট্রিবিউটিং](https://wordpress.github.io/wordpress-playground/contributing)
-   [লিঙ্ক এবং রিসোর্স](https://wordpress.github.io/wordpress-playground/resources)

<!--
All languages are available once the i18n setup for a language is complete and the correct file structure is in place under `i18n`.
-->

একটি ভাষার জন্য i18n সেটআপ সম্পূর্ণ হলে এবং `i18n`-এর অধীনে সঠিক ফাইল স্ট্রাকচার থাকলে সমস্ত ভাষা উপলব্ধ হয়।

<!--
-   https://wordpress.github.io/wordpress-playground/
-   https://wordpress.github.io/wordpress-playground/es/
-   https://wordpress.github.io/wordpress-playground/fr/
-->

-   https://wordpress.github.io/wordpress-playground/
-   https://wordpress.github.io/wordpress-playground/es/
-   https://wordpress.github.io/wordpress-playground/fr/

<!--
Assuming the `fr` language is the first language with the Documentation hub pages (Quick Start Guide, Playground web instance, About Playground, Guides,... ) completely translated to French, the `docusaurus.config.js` should look like this in that branch so `npm run build:docs` properly generate the `fr` subsite and only displays the french language in the `localeDropdown` language switcher.
-->

ধরে নিই `fr` ভাষা হলো প্রথম ভাষা যেখানে ডকুমেন্টেশন হাব পেজগুলো (দ্রুত শুরু গাইড, প্লেগ্রাউন্ড ওয়েব ইন্সট্যান্স, প্লেগ্রাউন্ড সম্পর্কে, গাইড,...) সম্পূর্ণ ফ্রেঞ্চে অনুবাদ করা হয়েছে, সেই ব্রাঞ্চে `docusaurus.config.js` এভাবে দেখতে হবে যাতে `npm run build:docs` সঠিকভাবে `fr` সাবসাইট জেনারেট করে এবং `localeDropdown` ভাষা সুইচারে শুধুমাত্র ফ্রেঞ্চ ভাষা দেখায়।

```
  {
    "i18n": {
      "defaultLocale": "en",
      "path": "i18n",
      "locales": [
        "en",
        "fr"
      ],
      "localeConfigs": {
        "en": {
          "label": "English",
          "path": "en"
        },
        "fr": {
          "label": "French",
          "path": "fr"
        }
      }
    }
  },
  {
    "type": "localeDropdown",
    "position": "right"
  }
```

<!--
## Translation Workflow
-->

## অনুবাদ ওয়ার্কফ্লো

<!--
Follow these steps to translate a page:
-->

একটি পেজ অনুবাদ করতে এই স্টেপগুলো অনুসরণ করুন:

<!--
1. **Check for an Existing Translation Issue**: First, [search the repository issues](https://github.com/WordPress/wordpress-playground/issues?q=is%3Aissue%20state%3Aopen%20%5Btranslation%5D%20progress) to see if a tracking issue for your desired language already exists. If it does, comment on the issue to claim the page(s) you would like to translate.
2. **Create a New Translation Issue**: If no issue exists, please create a new one to track the translation progress for the language. You can model it after issue [#2202](https://github.com/WordPress/wordpress-playground/issues/2202) and use the markdown checklist below to track progress.
3. **Translate the File**:
-->

1. **বিদ্যমান অনুবাদ ইস্যু চেক করুন**: প্রথমে, [রিপোজিটরি ইস্যু সার্চ করুন](https://github.com/WordPress/wordpress-playground/issues?q=is%3Aissue%20state%3Aopen%20%5Btranslation%5D%20progress) দেখতে আপনার কাঙ্ক্ষিত ভাষার জন্য একটি ট্র্যাকিং ইস্যু ইতিমধ্যে আছে কিনা। যদি থাকে, আপনি যে পেজ(গুলো) অনুবাদ করতে চান সেগুলো ক্লেইম করতে ইস্যুতে কমেন্ট করুন।
2. **একটি নতুন অনুবাদ ইস্যু তৈরি করুন**: যদি কোনো ইস্যু না থাকে, ভাষার জন্য অনুবাদ অগ্রগতি ট্র্যাক করতে একটি নতুন তৈরি করুন। আপনি ইস্যু [#2202](https://github.com/WordPress/wordpress-playground/issues/2202) অনুসরণ করতে পারেন এবং অগ্রগতি ট্র্যাক করতে নীচের মার্কডাউন চেকলিস্ট ব্যবহার করুন।
3. **ফাইল অনুবাদ করুন**:

<!--
-   Check if you have the latest version of the documentation
-   Copy the original .md file from `packages/docs/site/docs/...` to the corresponding path in the language directory (e.g., `packages/docs/site/i18n/<LANGUAGE_CODE>/...`). It is crucial to replicate the original file structure.
-   Translate the content of the new file, keeping the original content commented out `<!-- English Content -->`.
-   The assets are listed at `packages/docs/site/static/img/` only place assets inside the translation folder when it requires localized content.
-   Once the translations are ready, check if the docs build script is running properly `npm run build:docs`.
-->

-   আপনার কাছে ডকুমেন্টেশনের সর্বশেষ ভার্সন আছে কিনা চেক করুন
-   মূল .md ফাইল `packages/docs/site/docs/...` থেকে ভাষা ডিরেক্টরিতে সংশ্লিষ্ট পাথে কপি করুন (যেমন, `packages/docs/site/i18n/<LANGUAGE_CODE>/...`)। মূল ফাইল স্ট্রাকচার রেপ্লিকেট করা অত্যন্ত গুরুত্বপূর্ণ।
-   নতুন ফাইলের কনটেন্ট অনুবাদ করুন, মূল কনটেন্ট কমেন্ট আউট রেখে `<!-- English Content -->`।
-   অ্যাসেটগুলো `packages/docs/site/static/img/`-তে তালিকাভুক্ত, শুধুমাত্র লোকালাইজড কনটেন্ট প্রয়োজন হলে অনুবাদ ফোল্ডারে অ্যাসেট রাখুন।
-   অনুবাদ রেডি হলে, ডক্স বিল্ড স্ক্রিপ্ট সঠিকভাবে চলছে কিনা চেক করুন `npm run build:docs`।

<!--
4. **Create a pull request with your changes**
-->

4. **আপনার পরিবর্তন সহ একটি পুল রিকোয়েস্ট তৈরি করুন**

<!--
-   Add a prefix to the title `[i18n]` to help to identify the translations
-   Describe the pages that you translated
-   Request a review at `#playground` or `#polyglots` at `wordpress.slack.com`
-->

-   অনুবাদ চিহ্নিত করতে সাহায্য করতে টাইটেলে `[i18n]` প্রিফিক্স যোগ করুন
-   আপনি যে পেজগুলো অনুবাদ করেছেন সেগুলো বর্ণনা করুন
-   `wordpress.slack.com`-এ `#playground` বা `#polyglots`-এ রিভিউ রিকোয়েস্ট করুন

<!--
:::info
We highly recommend submitting pull requests with a small number of translated pages. This approach simplifies the review process and allows for a more gradual and manageable integration of your work.
:::
-->

:::তথ্য
আমরা অল্প সংখ্যক অনুবাদিত পেজ সহ পুল রিকোয়েস্ট জমা দেওয়ার জোর সুপারিশ করি। এই পদ্ধতি রিভিউ প্রক্রিয়া সহজ করে এবং আপনার কাজের আরো ধীরে ধীরে এবং ম্যানেজেবল ইন্টিগ্রেশনের সুযোগ দেয়।
:::

<!--
### Translation Tracking Template
-->

### অনুবাদ ট্র্যাকিং টেমপ্লেট

<!--
You can use the following markdown in your tracking issue:
-->

আপনি আপনার ট্র্যাকিং ইস্যুতে নিম্নলিখিত মার্কডাউন ব্যবহার করতে পারেন:

```
## Remaining translation pages

<details open>
<summary><h3>Main</h3></summary>

- about
  - [ ] build.md #2291
  - [ ] index.md #2282
  - [ ] launch.md #2292
  - [ ] test.md #2302
- contributing
  - [ ] code.md #2218
  - [ ] coding-standards.md #2219
  - [ ] contributor-day.md #2246
  - [ ] contributor-badge.md
  - [ ] documentation.md #2271
  - [ ] translations.md #2201
- guides
  - [ ] for-plugin-developers.md #2210
  - [ ] for-theme-developers.md #2211
  - [ ] index.md #2209
  - [ ] providing-content-for-your-demo.md #2213
  - [ ] wordpress-native-ios-app.md #2214
- [ ] intro.md #2198
- [ ] quick-start-guide.md #2204
- [ ] resources.md #2207
- [ ] web-instance.md #2208

</details>

<details open>
<summary><h3>Blueprints</h3></summary>

- blueprints
  - [ ] 01-index.md #2305
  - [ ] 02-using-blueprints.md #2330
  - [ ] 03-data-format.md #2340
   - [ ] 04-resources.md #2352
   - [ ] 05-steps-shorthands.md  #2386
  - [ ] 05-steps.md  #2386
  - [ ] 06-bundles.md #2438
   - [ ] 07-json-api-and-function-api.md #2438
   - [ ] 08-examples.md #2474
   - [ ] 09-troubleshoot-and-debug-blueprints.md #2474
   - [ ] intro.md #2489
   - tutorial
       - [ ] 01-what-are-blueprints-what-you-can-do-with-them.md #2511
       - [ ] 02-how-to-load-run-blueprints.md #2526
       - [ ] 03-build-your-first-blueprint.md
       - [ ] index.md #2511
</details>

<details open>
<summary><h3>Developers</h3></summary>

- [ ] developers
   - [ ] 03-build-an-app
      - [ ] 01-index.md
   - [ ] 05-local-development
      - [ ] 01-wp-now.md
      - [ ] 02-vscode-extension.md
      - [ ] 03-php-wasm-node.md
      - [ ] intro.md
   - [ ] 06-apis
      - [ ] 01-index.md
      - [ ] javascript-api
         - [ ] 01-index.md
         - [ ] 02-index-html-vs-remote-html.md
         - [ ] 03-playground-api-client.md
         - [ ] 04-blueprint-json-in-api-client.md
         - [ ] 05-blueprint-functions-in-api-client.md
         - [ ] 06-mount-data.md
      - [ ] query-api
          - [ ] 01-index.md
   - [ ] 23-architecture
      - [ ] 01-index.md
      - [ ] 02-wasm-php-overview.md
      - [ ] 03-wasm-php-compiling.md
      - [ ] 04-wasm-php-javascript-module.md
      - [ ] 05-wasm-php-filesystem.md
      - [ ] 07-wasm-asyncify.md
      - [ ] 08-browser-concepts.md
      - [ ] 09-browser-tab-orchestrates-execution.md
      - [ ] 10-browser-iframe-rendering.md
      - [ ] 11-browser-php-worker-threads.md
      - [ ] 12-browser-service-workers.md
      - [ ] 13-browser-scopes.md
      - [ ] 14-browser-cross-process-communication.md
      - [ ] 15-wordpress.md
      - [ ] 16-wordpress-database.md
      - [ ] 17-browser-wordpress.md
      - [ ] 18-host-your-own-playground.md
   - [ ] 24-limitations
      - [ ] 01-index.md
   - [ ] intro-devs.md
</details>
```

<!--
### Translating with the GitHub Web Interface
-->

### গিটহাব ওয়েব ইন্টারফেস দিয়ে অনুবাদ করা

<!--
If you prefer not to use developer tools, you can easily contribute translations directly on the GitHub website. All you need is a free GitHub account.
-->

আপনি যদি ডেভেলপার টুল ব্যবহার করতে না চান, আপনি সহজেই গিটহাব ওয়েবসাইটে সরাসরি অনুবাদ কন্ট্রিবিউট করতে পারেন। আপনার শুধু একটি ফ্রি গিটহাব অ্যাকাউন্ট দরকার।

<!--
This guide will show you how to both update an existing translation and add a brand-new one.
-->

এই গাইড আপনাকে দেখাবে কীভাবে একটি বিদ্যমান অনুবাদ আপডেট করবেন এবং একটি সম্পূর্ণ নতুন যোগ করবেন।

---

<!--
#### Updating an Existing Translation
-->

#### বিদ্যমান অনুবাদ আপডেট করা

<!--
1.  **Navigate to the file.** Go to the repository and find the file you want to update. Translation files are located in a folder named after their language code. For example, all French translations are in `packages/docs/site/i18n/fr/docusaurus-plugin-content-docs/current/`.
-->

1.  **ফাইলে নেভিগেট করুন।** রিপোজিটরিতে যান এবং আপনি যে ফাইল আপডেট করতে চান সেটি খুঁজুন। অনুবাদ ফাইলগুলো তাদের ভাষা কোডের নামে একটি ফোল্ডারে অবস্থিত। উদাহরণস্বরূপ, সমস্ত ফ্রেঞ্চ অনুবাদ `packages/docs/site/i18n/fr/docusaurus-plugin-content-docs/current/`-এ আছে।

<!--
2.  **Open the editor.** Select the file you wish to edit and click the pencil icon (**Edit this file**) in the upper right corner.
-->

2.  **এডিটর ওপেন করুন।** আপনি যে ফাইল এডিট করতে চান সেটি সিলেক্ট করুন এবং উপরের ডান কোণে পেন্সিল আইকনে (**Edit this file**) ক্লিক করুন।
    ![Editing existing translation](@site/static/img/contributing/editing-translations.webp)

<!--
3.  **Fork the repository.** GitHub will automatically prompt you to **Fork this repository**. This creates a personal copy for you to edit safely. Click the button to proceed.
-->

3.  **রিপোজিটরি ফর্ক করুন।** গিটহাব স্বয়ংক্রিয়ভাবে আপনাকে **Fork this repository** করতে বলবে। এটি আপনার জন্য নিরাপদে এডিট করার জন্য একটি পার্সোনাল কপি তৈরি করে। এগিয়ে যেতে বাটনে ক্লিক করুন।

<!--
4.  **Make your changes.** The editor will open in your browser. Update the text with your improved translations.
-->

4.  **আপনার পরিবর্তন করুন।** এডিটর আপনার ব্রাউজারে ওপেন হবে। আপনার উন্নত অনুবাদ দিয়ে টেক্সট আপডেট করুন।

<!--
5.  **Propose your changes.** Once you are finished, scroll to the bottom of the page. Add a brief title and description of your changes (e.g., "Fixing typos in French translation") and click the **Propose changes** button.
-->

5.  **আপনার পরিবর্তন প্রস্তাব করুন।** আপনার কাজ শেষ হলে, পেজের নিচে স্ক্রল করুন। আপনার পরিবর্তনের একটি সংক্ষিপ্ত টাইটেল এবং বিবরণ যোগ করুন (যেমন, "ফ্রেঞ্চ অনুবাদে টাইপো ঠিক করা") এবং **Propose changes** বাটনে ক্লিক করুন।

<!--
6.  **Create a Pull Request.** On the next screen, click the **Create pull request** button. This will submit your changes to the project maintainers for review.
-->

6.  **একটি পুল রিকোয়েস্ট তৈরি করুন।** পরবর্তী স্ক্রিনে, **Create pull request** বাটনে ক্লিক করুন। এটি রিভিউয়ের জন্য প্রজেক্ট মেইনটেইনারদের কাছে আপনার পরিবর্তন জমা দেবে।

---

<!--
#### Adding a New Translation
-->

#### একটি নতুন অনুবাদ যোগ করা

<!--
1.  **Determine the correct file path.** The new file's path and name must mirror the original English file.

    -   **English original:** `packages/docs/site/docs/main/contributing/documentation.md`
    -   **French translation:** `packages/docs/site/i18n/fr/docusaurus-plugin-content-docs/current/main/contributing/documentation.md`
-->

1.  **সঠিক ফাইল পাথ নির্ধারণ করুন।** নতুন ফাইলের পাথ এবং নাম অবশ্যই মূল ইংরেজি ফাইলের মতো হতে হবে।

    -   **ইংরেজি মূল:** `packages/docs/site/docs/main/contributing/documentation.md`
    -   **ফ্রেঞ্চ অনুবাদ:** `packages/docs/site/i18n/fr/docusaurus-plugin-content-docs/current/main/contributing/documentation.md`

<!--
2.  **Create the new file.** Navigate to the correct language folder (e.g., `/packages/docs/site/i18n/fr/docusaurus-plugin-content-docs/current/`). Click **Add file** > **Create new file**.
-->

2.  **নতুন ফাইল তৈরি করুন।** সঠিক ভাষা ফোল্ডারে নেভিগেট করুন (যেমন, `/packages/docs/site/i18n/fr/docusaurus-plugin-content-docs/current/`)। ক্লিক করুন **Add file** > **Create new file**।
    ![Creating a new translation](@site/static/img/contributing/adding-file-github-ui.webp)

<!--
    -   **Pro Tip:** In the filename box, you can create new folders by typing the folder name followed by a `/`. For example, typing `main/contributing/documentation.md` will create the `main` and `contributing` folders automatically.
-->

    -   **প্রো টিপ:** ফাইলনেম বক্সে, আপনি ফোল্ডার নাম টাইপ করে তার পরে `/` দিয়ে নতুন ফোল্ডার তৈরি করতে পারেন। উদাহরণস্বরূপ, `main/contributing/documentation.md` টাইপ করলে স্বয়ংক্রিয়ভাবে `main` এবং `contributing` ফোল্ডার তৈরি হবে।

<!--
3.  **Fork the repository.** Just like before, GitHub will prompt you to **Fork this repository**. Click the button to create your personal copy.
-->

3.  **রিপোজিটরি ফর্ক করুন।** আগের মতোই, গিটহাব আপনাকে **Fork this repository** করতে বলবে। আপনার পার্সোনাল কপি তৈরি করতে বাটনে ক্লিক করুন।

<!--
4.  **Add the translated content.** The editor will open with an empty file. For the convenience of reviewers, please copy the content from the original English file and paste it into your new file, wrapping it in comment tags. Add your translation below it.
-->

4.  **অনুবাদিত কনটেন্ট যোগ করুন।** এডিটর একটি খালি ফাইল নিয়ে ওপেন হবে। রিভিউয়ারদের সুবিধার জন্য, অনুগ্রহ করে মূল ইংরেজি ফাইল থেকে কনটেন্ট কপি করুন এবং এটি আপনার নতুন ফাইলে পেস্ট করুন, কমেন্ট ট্যাগে র‍্যাপ করে। এর নিচে আপনার অনুবাদ যোগ করুন।

    ```markdown
    <!--
    This is the original English content.
    It helps reviewers understand the context of the translation.
    -->

    Ceci est le contenu traduit en français.
    ```

    ![GitHub UI Editor](@site/static/img/contributing/editor-github-ui.webp)

<!--
5.  **Commit the new file.** When you are done, scroll to the bottom. Add a title for your new file (e.g., "Add French translation for documentation.md") and click the **Commit new file** button.
-->

5.  **নতুন ফাইল কমিট করুন।** আপনার কাজ শেষ হলে, নিচে স্ক্রল করুন। আপনার নতুন ফাইলের জন্য একটি টাইটেল যোগ করুন (যেমন, "Add French translation for documentation.md") এবং **Commit new file** বাটনে ক্লিক করুন।

<!--
6.  **Create a Pull Request.** On the next screen, click **Create pull request** to submit your new translation for review.
-->

6.  **একটি পুল রিকোয়েস্ট তৈরি করুন।** পরবর্তী স্ক্রিনে, রিভিউয়ের জন্য আপনার নতুন অনুবাদ জমা দিতে **Create pull request** ক্লিক করুন।

<!--
## Review Process
-->

## রিভিউ প্রক্রিয়া

<!--
To simplify the review process, please keep the original English text as a comment directly above the translated content.
-->

রিভিউ প্রক্রিয়া সহজ করতে, অনুগ্রহ করে অনুবাদিত কনটেন্টের ঠিক উপরে মূল ইংরেজি টেক্সট কমেন্ট হিসেবে রাখুন।

```
<!--
👋 Hi! Welcome to WordPress Playground documentation.

Playground is an online tool to experiment and learn about WordPress. This site (Documentation) is where you will find all the information you need to start using Playground.
-->

👋 Olá! Bem vindo a documentação oficial do WordPress Playground.

WordPress Playground é uma ferramenta online onde podes testar e aprender mais sobre o WordPress. Nesta página(Documentação) irá encontrar todas as informações necessárias para começar a trabalhar com o Playground.
```

<!--
:::info
This practice also helps the maintenance team identify outdated translations. When the original English content is updated, we can search the codebase for the old text (now in comments) and flag the corresponding translation for review.
:::
-->

:::তথ্য
এই অভ্যাসটি মেইনটেন্যান্স টিমকে পুরনো অনুবাদ চিহ্নিত করতেও সাহায্য করে। যখন মূল ইংরেজি কনটেন্ট আপডেট করা হয়, আমরা কোডবেসে পুরনো টেক্সট (এখন কমেন্টে) সার্চ করতে পারি এবং রিভিউয়ের জন্য সংশ্লিষ্ট অনুবাদ ফ্ল্যাগ করতে পারি।
:::

<!--
To find a reviewer fluent in the language of your PR, you can post a request on the [Make WordPress Polyglots blog](https://make.wordpress.org/polyglots/). Be sure to include the locale tag (e.g., #ja for Japanese) to notify the appropriate General Translation Editors (GTEs).
-->

আপনার PR-এর ভাষায় দক্ষ একজন রিভিউয়ার খুঁজে পেতে, আপনি [Make WordPress Polyglots ব্লগে](https://make.wordpress.org/polyglots/) একটি রিকোয়েস্ট পোস্ট করতে পারেন। উপযুক্ত জেনারেল ট্রান্সলেশন এডিটরদের (GTEs) নোটিফাই করতে লোকেল ট্যাগ (যেমন, জাপানিজের জন্য #ja) অন্তর্ভুক্ত করতে ভুলবেন না।

<!--
When the PR is merged, the translated version of that page should appear under `https://wordpress.github.io/wordpress-playground/{%LANGUAGE%}`, if you are contributing for the first time request your [Contributor Badge](/contributing/contributor-badge).
-->

যখন PR মার্জ হয়, সেই পেজের অনুবাদিত ভার্সন `https://wordpress.github.io/wordpress-playground/{%LANGUAGE%}`-এর অধীনে দেখা যাবে, আপনি যদি প্রথমবার কন্ট্রিবিউট করছেন তাহলে আপনার [কন্ট্রিবিউটর ব্যাজ](/contributing/contributor-badge) রিকোয়েস্ট করুন।
