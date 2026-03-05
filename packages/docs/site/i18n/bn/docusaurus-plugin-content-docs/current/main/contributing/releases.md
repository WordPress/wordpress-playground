---
slug: /contributing/releases
title: প্যাকেজ রিলিজ
description: কীভাবে প্লেগ্রাউন্ড প্যাকেজগুলো npm-এ রিলিজ করা হয় এবং নতুন প্যাকেজ যোগ করার সময় কী করতে হবে।
---

<!--
# Releasing packages
-->

# প্যাকেজ রিলিজ

<!--
Playground publishes its packages to npm using automated CI workflows. This page explains how the release process works and what you need to know when adding new packages.
-->

প্লেগ্রাউন্ড অটোমেটেড CI ওয়ার্কফ্লো ব্যবহার করে npm-এ এর প্যাকেজগুলো পাবলিশ করে। এই পেজে রিলিজ প্রসেস কীভাবে কাজ করে এবং নতুন প্যাকেজ যোগ করার সময় আপনাকে কী জানতে হবে তা ব্যাখ্যা করা হয়েছে।

<!--
## Automated releases
-->

## অটোমেটেড রিলিজ

<!--
The npm packages are published automatically every Monday via GitHub Actions, or manually by maintainers using the workflow dispatch. The workflow bumps versions using [Lerna](https://lerna.js.org/), tags the release, and publishes all public packages to npm.
-->

npm প্যাকেজগুলো প্রতি সোমবার GitHub Actions-এর মাধ্যমে অটোমেটিক্যালি পাবলিশ হয়, অথবা মেইনটেইনাররা ওয়ার্কফ্লো ডিসপ্যাচ ব্যবহার করে ম্যানুয়ালি পাবলিশ করতে পারেন। ওয়ার্কফ্লো [Lerna](https://lerna.js.org/) ব্যবহার করে ভার্সন বাম্প করে, রিলিজ ট্যাগ করে এবং সমস্ত পাবলিক প্যাকেজ npm-এ পাবলিশ করে।

<!--
The CI authenticates with npm using [OpenID Connect (OIDC) trusted publishing](https://docs.npmjs.com/generating-provenance-statements#publishing-packages-with-provenance-via-github-actions). This is more secure than using long-lived npm tokens because it generates short-lived credentials for each workflow run and ties package provenance directly to the GitHub repository.
-->

CI, npm-এর সাথে [OpenID Connect (OIDC) ট্রাস্টেড পাবলিশিং](https://docs.npmjs.com/generating-provenance-statements#publishing-packages-with-provenance-via-github-actions) ব্যবহার করে অথেন্টিকেট করে। এটি দীর্ঘমেয়াদী npm টোকেন ব্যবহার করার চেয়ে বেশি সিকিউর কারণ এটি প্রতিটি ওয়ার্কফ্লো রানের জন্য সংক্ষিপ্ত সময়ের ক্রেডেনশিয়াল জেনারেট করে এবং প্যাকেজ প্রভেনেন্স সরাসরি গিটহাব রিপোজিটরির সাথে সংযুক্ত করে।

<!--
## Adding a new package
-->

## নতুন প্যাকেজ যোগ করা

<!--
When you add a new npm package to the monorepo, the automated release workflow won't be able to publish it on the first run. This is an npm security feature: OIDC trusted publishing only works for packages that already exist and have been configured to trust the GitHub repository.
-->

যখন আপনি মনোরিপোতে একটি নতুন npm প্যাকেজ যোগ করেন, অটোমেটেড রিলিজ ওয়ার্কফ্লো প্রথম রানে এটি পাবলিশ করতে পারবে না। এটি একটি npm সিকিউরিটি ফিচার: OIDC ট্রাস্টেড পাবলিশিং শুধুমাত্র সেই প্যাকেজগুলোর জন্য কাজ করে যেগুলো ইতিমধ্যে বিদ্যমান এবং গিটহাব রিপোজিটরিকে ট্রাস্ট করার জন্য কনফিগার করা হয়েছে।

<!--
Here's what you need to do:
-->

আপনাকে যা করতে হবে তা এখানে দেওয়া হলো:

<!--
### 1. Publish the package manually
-->

### ১. প্যাকেজটি ম্যানুয়ালি পাবলিশ করুন

<!--
First, authenticate with npm on your local machine:
-->

প্রথমে, আপনার লোকাল মেশিনে npm-এর সাথে অথেন্টিকেট করুন:

```bash
npm login
```

<!--
Then publish the package for the first time:
-->

তারপর প্রথমবারের জন্য প্যাকেজটি পাবলিশ করুন:

```bash
cd packages/your-new-package
npm publish --access public
```

<!--
This creates the package on the npm registry under your account.
-->

এটি আপনার অ্যাকাউন্টের অধীনে npm রেজিস্ট্রিতে প্যাকেজটি তৈরি করে।

<!--
### 2. Configure trusted publishing
-->

### ২. ট্রাস্টেড পাবলিশিং কনফিগার করুন

<!--
After the initial publish, go to the package's settings on npmjs.com and set up OIDC trusted publishing:
-->

ইনিশিয়াল পাবলিশের পরে, npmjs.com-এ প্যাকেজের সেটিংসে যান এবং OIDC ট্রাস্টেড পাবলিশিং সেট আপ করুন:

<!--
1. Navigate to your package on [npmjs.com](https://www.npmjs.com)
2. Go to **Settings** → **Configure Trusted Publishers**
3. Add a new trusted publisher with these settings:
    - **Repository owner**: `WordPress`
    - **Repository name**: `wordpress-playground`
    - **Workflow filename**: `publish-npm-packages.yml`
    - **Environment**: `npm`
-->

1. [npmjs.com](https://www.npmjs.com)-এ আপনার প্যাকেজে নেভিগেট করুন
2. **Settings** → **Configure Trusted Publishers**-এ যান
3. এই সেটিংস দিয়ে একটি নতুন ট্রাস্টেড পাবলিশার যোগ করুন:
    - **Repository owner**: `WordPress`
    - **Repository name**: `wordpress-playground`
    - **Workflow filename**: `publish-npm-packages.yml`
    - **Environment**: `npm`

![Setting up OIDC trusted publishing on npm](/img/php-wasm-node-oidc.webp)

<!--
### 3. Transfer ownership (if needed)
-->

### ৩. ওনারশিপ ট্রান্সফার করুন (প্রয়োজনে)

<!--
If you published under your personal account, transfer the package to the `@aspect` organization or ensure the appropriate team has publish access.
-->

আপনি যদি আপনার পার্সোনাল অ্যাকাউন্টের অধীনে পাবলিশ করে থাকেন, প্যাকেজটি `@aspect` অর্গানাইজেশনে ট্রান্সফার করুন অথবা নিশ্চিত করুন যে উপযুক্ত টিমের পাবলিশ অ্যাক্সেস আছে।

<!--
Once configured, subsequent releases will work automatically through the CI workflow.
-->

কনফিগার করা হয়ে গেলে, পরবর্তী রিলিজগুলো CI ওয়ার্কফ্লোর মাধ্যমে অটোমেটিক্যালি কাজ করবে।

<!--
## Why OIDC can't publish new packages
-->

## কেন OIDC নতুন প্যাকেজ পাবলিশ করতে পারে না

<!--
npm's OIDC implementation requires the package to already exist before a trusted publisher can be configured. This is a chicken-and-egg situation by design—it prevents someone from hijacking a package name through a GitHub workflow before the legitimate owner can claim it.
-->

npm-এর OIDC ইমপ্লিমেন্টেশনের জন্য ট্রাস্টেড পাবলিশার কনফিগার করার আগে প্যাকেজটি আগে থেকেই বিদ্যমান থাকতে হবে। এটি ডিজাইন অনুযায়ী একটি চিরন্তন সমস্যা—এটি বৈধ মালিক দাবি করার আগে কাউকে গিটহাব ওয়ার্কফ্লোর মাধ্যমে প্যাকেজের নাম হাইজ্যাক করা থেকে রক্ষা করে।

<!--
The manual first publish establishes ownership, and trusted publishing then provides secure, token-free authentication for all future releases.
-->

ম্যানুয়াল প্রথম পাবলিশ ওনারশিপ প্রতিষ্ঠা করে এবং ট্রাস্টেড পাবলিশিং তারপর ভবিষ্যতের সমস্ত রিলিজের জন্য সিকিউর, টোকেন-মুক্ত অথেন্টিকেশন প্রদান করে।
