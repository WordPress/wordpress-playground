---
title: লোকাল ডেভেলপমেন্ট
slug: /developers/local-development
---

<!--
## Local WordPress Development with Playground
-->

## প্লেগ্রাউন্ডের মাধ্যমে লোকাল ওয়ার্ডপ্রেস ডেভেলপমেন্ট

<!--
Playground offers various development environments to streamline setting up and managing WordPress sites.
-->

ওয়ার্ডপ্রেস সাইট সেটআপ এবং পরিচালনা সহজ ও সুবিধাজনক করতে প্লেগ্রাউন্ড বিভিন্ন ধরনের ডেভেলপমেন্ট এনভায়রনমেন্ট প্রদান করে।

<!--
For a quick start, use a [public Playground web instance](/web-instance) at https://playground.wordpress.net/. Alternatively, you can [host your own WordPress Playground](/developers/architecture/host-your-own-playground).
-->

দ্রুত শুরু করার জন্য, https://playground.wordpress.net/ এ একটি [পাবলিক প্লেগ্রাউন্ড ওয়েব ইনস্ট্যান্স](/web-instance) ব্যবহার করুন। বিকল্পভাবে, আপনি [আপনার নিজস্ব ওয়ার্ডপ্রেস প্লেগ্রাউন্ড হোস্ট](/developers/architecture/host-your-own-playground) করতে পারেন।

<!--
Playground also provides tools for local WordPress development, prioritizing ease of installation and usability:
-->

সহজ ইনস্টলেশন এবং ব্যবহারের সুবিধাকে অগ্রাধিকার দিয়ে প্লেগ্রাউন্ড লোকাল ওয়ার্ডপ্রেস ডেভেলপমেন্টের জন্য বেশ কিছু টুলও সরবরাহ করে:

<!--
-   **[@wp-playground/cli](/developers/local-development/wp-playground-cli):** A command-line tool to quickly launch a WordPress site from your terminal.
-   **[Visual Studio Code Extension](/developers/local-development/vscode-extension):** Integrates WordPress development directly into VS Code for a seamless experience within the popular editor.
-->

- **[@wp-playground/cli](/developers/local-development/wp-playground-cli):** আপনার টার্মিনাল থেকে দ্রুত একটি ওয়ার্ডপ্রেস সাইট চালু করার জন্য একটি কমান্ড-লাইন টুল।
- **[ভিজ্যুয়াল স্টুডিও কোড (VS Code) এক্সটেনশন](/developers/local-development/vscode-extension):** জনপ্রিয় এডিটরটির মধ্যে নিরবচ্ছিন্ন অভিজ্ঞতার জন্য সরাসরি VS Code-এর ভেতরেই ওয়ার্ডপ্রেস ডেভেলপমেন্টের সুবিধা যুক্ত করে।

<!--
For those needing more control, Playground offers tools for Node.js:
-->

যাঁদের আরও বেশি নিয়ন্ত্রণের প্রয়োজন, তাঁদের জন্য প্লেগ্রাউন্ড Node.js-এর জন্য টুলস সরবরাহ করে:

<!--
-   **[WordPress Playground in Node.js](/developers/local-development/php-wasm-node):** For low-level control over the WebAssembly PHP build, explore the [`@php-wasm/node` package](https://npmjs.org/@php-wasm/node), which includes the PHP WebAssembly runtime.
-->

- **[Node.js-এ ওয়ার্ডপ্রেস প্লেগ্রাউন্ড](/developers/local-development/php-wasm-node):** WebAssembly PHP বিল্ডের ওপর লো-লেভেল নিয়ন্ত্রণের জন্য [`@php-wasm/node` প্যাকেজটি](https://npmjs.org/@php-wasm/node) অন্বেষণ করুন, যার মধ্যে PHP WebAssembly রানটাইম অন্তর্ভুক্ত রয়েছে।
