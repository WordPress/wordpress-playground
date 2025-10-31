---
slug: /contributing/documentation
title: ডকুমেন্টেশন কন্ট্রিবিউশন
description: প্লেগ্রাউন্ড ডকুমেন্টেশনে কীভাবে কন্ট্রিবিউশন করবেন, ইস্যু খোলা থেকে পুল রিকোয়েস্ট জমা দেওয়া পর্যন্ত, এই গাইডে তা ধাপে ধাপে দেখানো হয়েছে।
---

<!--
# Documentation contributions
-->

# ডকুমেন্টেশন কন্ট্রিবিউশন

<!--
[WordPress Playground's documentation site](/) is maintained by volunteers like you, who'd love your help.
-->

[ওয়ার্ডপ্রেস প্লেগ্রাউন্ড ডকুমেন্টেশন সাইটটি](/) আপনার মতো ভলেন্টিয়ার দ্বারাই পরিচালিত, যারা আপনার সাহায্য পেলে খুশি হবে।

<!--
All documentation-related issues are labeled [`[Type] Documentation`](https://github.com/WordPress/wordpress-playground/issues?q=is%3Aissue%20state%3Aopen%20label%3A%22%5BType%5D%20Documentation%22) or [`[Type] Developer Documentation`](https://github.com/WordPress/wordpress-playground/issues?q=is%3Aissue%20state%3Aopen%20label%3A%22%5BType%5D%20Developer%20Documentation%22) in the [WordPress/wordpress-playground](https://github.com/WordPress/wordpress-playground) repository. Browse the list of open issues to find one you'd like to work on. Alternatively, if you believe something is missing from the current documentation, open an issue to discuss your suggestion.
-->

সমস্ত ডকুমেন্টেশন-সম্পর্কিত ইস্যুগুলো লেবেল করা থাকে [`[Type] Documentation`](https://github.com/WordPress/wordpress-playground/issues?q=is%3Aissue%20state%3Aopen%20label%3A%22%5BType%5D%20Documentation%22) অথবা [`[Type] Developer Documentation`](https://github.com/WordPress/wordpress-playground/issues?q=is%3Aissue%20state%3Aopen%20label%3A%22%5BType%5D%20Developer%20Documentation%22) ও [WordPress/wordpress-playground](https://github.com/WordPress/wordpress-playground) রিপোজিটরিতে। খোলা ইস্যুগুলোর তালিকা ব্রাউজ করে আপনার পছন্দের একটি নিয়ে কাজ শুরু করুন। বিকল্পভাবে, যদি আপনি মনে করেন বর্তমান ডকুমেন্টেশনে কিছু অনুপস্থিত আছে, তাহলে আপনার প্রস্তাব নিয়ে আলোচনা করতে একটি নতুন ইস্যু খুলুন।

<!--
## How can I contribute?
-->

## আমি কিভাবে কন্টিবিউট করতে পারি?

<!--
You can contribute by [opening an issue in the project repository](https://github.com/WordPress/wordpress-playground/issues/new) and describing what you'd like to add or change.
-->

আপনি [প্রজেক্ট রিপোজিটরিতে একটি ইস্যু খুলে](https://github.com/WordPress/wordpress-playground/issues/new) এবং আপনি কী যোগ করতে বা পরিবর্তন করতে চান তা বর্ণনা করে কন্টিবিউট করতে পারেন।

<!--
If you feel up to it, write the content in the issue description, and the project contributors will take care of the rest.
-->

যদি আপনার মনে হয়, তাহলে ইস্যুর বিবরণে কনটেন্টটি লিখে দিন এবং প্রকল্পের প্রজেক্ট কনট্রিবিউটররা বাকিটা দেখবে ।

<!--
Would you like to see the documentation in your language? Check the [Translation section](/contributing/translations).
-->

আপনি কি আপনার ভাষায় ডকুমেন্টেশন দেখতে চান? চেক করুন [ট্রান্সলেশন সেকশন](/contributing/translations)।

<!--
### Forking the repo, edit files locally and opening Pull Requests
-->

### রিপোটি ফর্ক করুন, ফাইলগুলো লোকালি এডিট করুন এবং একটি পুল রিকোয়েস্ট দিন

<!--
If you are familiar with markdown, you can [fork](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/working-with-forks/fork-a-repo) the `wordpress-playground` repo and propose changes and new documentation pages by submitting a Pull Request.
-->

আপনি যদি মার্কডাউনের সাথে পরিচিত হন, তুমি [রিপোটি ফর্ক করে](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/working-with-forks/fork-a-repo) `wordpress-playground` এ একটি পুল রিকোয়েস্ট জমা দিয়ে পরিবর্তন এবং নতুন ডকুমেন্টেশন পেজের প্রস্তাব করুন।

<!--
The process of creating a branch to open new PRs with translated pages on the [WordPress/wordpress-playground](https://github.com/WordPress/wordpress-playground) repository is the same than contributing to other WordPress repositories such as gutenberg:
https://developer.wordpress.org/block-editor/contributors/code/git-workflow/
-->

রিপোজিটরিতে ট্রান্সলেট পেজগুলি নিয়ে নতুন পুল খোলার জন্য একটি ব্রাঞ্চ তৈরির প্রক্রিয়া [WordPress/wordpress-playground](https://github.com/WordPress/wordpress-playground) গুটেনবার্গের মতো অন্যান্য ওয়ার্ডপ্রেস রিপোজিটরিতে অবদান রাখার প্রক্রিয়ার মতো একই রকম:
https://developer.wordpress.org/block-editor/contributors/code/git-workflow/

<!--
The documentation files (`.md` files) are stored in Playground's GitHub repository, [under `/packages/docs/site/docs`](https://github.com/WordPress/wordpress-playground/tree/trunk/packages/docs/site/docs) for English and [`/packages/docs/site/i18n`](https://github.com/WordPress/wordpress-playground/tree/trunk/packages/docs/site/i18n) for other languages.
-->

ডকুমেন্টেশন ফাইলগুলো (`.md` ফাইলগুলো) প্লেগ্রাউন্ডের গিটহাব রিপোজিটরিতে সংরক্ষণ করা হয়, [under `/packages/docs/site/docs`](https://github.com/WordPress/wordpress-playground/tree/trunk/packages/docs/site/docs) ইংরেজির জন্য এবং [`/packages/docs/site/i18n`](https://github.com/WordPress/wordpress-playground/tree/trunk/packages/docs/site/i18n) অন্যান্য ভাষার জন্য।

<!--
### Edit in the browser
-->

### ব্রাউজারে এডিট করুন

<!--
If logged in GitHub, you can also edit existing files (or add new ones) and submit a PR directly from the GitHub UI:
-->

আপনি যদি গিটহাব এ লগইন করে থাকেন, তাহলে সরাসরি গিটহাব ইউআই থেকেই বিদ্যমান ফাইল এডিট করতে (বা নতুন ফাইল যোগ করতে) এবং একটি পুল রিকোয়েস্ট জমা দিতে পারবেন:

<!--
1. Find the page you'd like to edit or the directory of the chapter you'd like to add a new page to.
2. Click the **Add Files** button to add a new file, or click on an existing file and then click the pencil icon to edit it.
3. GitHub will ask you to fork the repository and create a new branch with your changes.
4. An editor will open where you can make the changes.
5. When you're done, click the **Commit Changes** button and submit a Pull Request.
-->

1. যে পেজটি আপনি এডিট করতে চান সেটি খুঁজে নিন, অথবা যে অধ্যায়ের মধ্যে নতুন পেজ যোগ করতে চান, সেই ডিরেক্টরিটি সিলেক্ট করুন।
2. নতুন ফাইল যোগ করতে **এড ফাইল** বাটনে ক্লিক করুন, অথবা কোনো বিদ্যমান ফাইলে ক্লিক করে তারপর এডিট করতে পেন্সিল আইকনে ক্লিক করুন।
3. গিটহাব  আপনাকে রিপোজিটরিটি ফোর্ক করতে এবং আপনার পরিবর্তনগুলি দিয়ে একটি নতুন ব্রাঞ্চ তৈরি করতে বলবে।
4. একটি এডিটর খুলবে যেখানে আপনি পরিবর্তনগুলি করতে পারবেন।
5. আপনার কাজ শেষ হলে, **কমিট পরিবর্তন** বাটনে ক্লিক করুন এবং একটি পুল রিকোয়েস্ট সাবমিট করুন।

<!--
That's it! You've just contributed to the WordPress Playground documentation.
-->

এটাই! আপনি মাত্রই ওয়ার্ডপ্রেস প্লেগ্রাউন্ড ডকুমেন্টেশনে কন্টিবিউট করেছেন।

<!--
This approach means you don't need to clone the repository, set up a local development environment, or run any commands.
-->

এই পদ্ধতিতে আপনাকে রিপোজিটরি ক্লোন করতে হবে না, লোকাল ডেভেলপমেন্ট এনভায়রনমেন্ট সেটআপ করতে হবে না, কিংবা কোনো কমান্ড চালাতেও হবে না।

<!--
The downside is that you won't be able to preview your changes. Keep reading to learn how to review your changes before submitting a Pull Request.
-->

খারাপ দিক হল আপনি আপনার পরিবর্তনগুলি প্রিভিউ করতে পারবেন না। পুল রিকোয়েস্ট জমা দেওয়ার আগে আপনার পরিবর্তনগুলি কীভাবে পর্যালোচনা করবেন তা জানতে পড়তে থাকুন।

<!--
### Local preview
-->

### লোকাল প্রিভিউ

<!--
Clone the repository and navigate to the directory on your device. Now run the following commands:
-->

রিপোজিটরিটি ক্লোন করুন এবং আপনার ডিভাইসের ডিরেক্টরিতে নেভিগেট করুন। এখন নিম্নলিখিত কমান্ডগুলি চালান:

```bash
npm install
npm run build:docs
npm run dev:docs
```
<!--
The documentation site opens in a new browser tab and refreshes automatically with each change. Continue to edit the relevant file in your code editor and test the changes in real-time.
-->

ডকুমেন্টেশন সাইটটি একটি নতুন ব্রাউজার ট্যাবে খোলে এবং প্রতিটি পরিবর্তনের সাথে স্বয়ংক্রিয়ভাবে রিফ্রেশ হয়। আপনার কোড এডিটরে প্রাসঙ্গিক ফাইলটি এডিট করা চালিয়ে যান এবং রিয়েল-টাইমে পরিবর্তনগুলি পরীক্ষা করুন।