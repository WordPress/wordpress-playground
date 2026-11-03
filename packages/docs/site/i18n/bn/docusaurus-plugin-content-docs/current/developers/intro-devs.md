---
title: ওয়ার্ডপ্রেস প্লেগ্রাউন্ড ডেভেলপার ডকস
slug: /developers/
id: intro
---

<!--
# Developers Docs
-->

# ডেভেলপার ডকস

<!--
Hi! Welcome to WordPress Playground Developer documentation.
-->

হ্যালো! ওয়ার্ডপ্রেস প্লেগ্রাউন্ড ডেভেলপার ডকুমেন্টেশনে স্বাগতম।

<!--
<p class="docs-hubs">The WordPress Playground documentation is distributed across four separate hubs (subsites):</p>
-->

<p class="docs-hubs">ওয়ার্ডপ্রেস প্লেগ্রাউন্ড ডকুমেন্টেশন চারটি পৃথক হাবে (সাবসাইট) বিভক্ত:</p>

<!--
- [**Documentation**](/) – Introduction to WP Playground, starter guides and your entry point to WP Playground Docs.
- [**Blueprints**](/blueprints) – Blueprints are JSON files for setting up your WordPress Playground instance. Learn about their possibilities from the Blueprints docs hub.
- 👉 [**Developers**](/developers) (you're here) – WordPress Playground was created as a programmable tool. Discover all the things you can do with it from your code in this Developers docs hub.
- [**API Reference**](/api) – All the APIs exposed by WordPress Playground
-->

- [**ডকুমেন্টেশন**](/) – WP প্লেগ্রাউন্ড-এর ভূমিকা, স্টার্টার গাইড এবং WP প্লেগ্রাউন্ড ডকসে আপনার প্রবেশের মাধ্যম।
- [**ব্লুপ্রিন্ট**](/blueprints) – ব্লুপ্রিন্ট হলো আপনার ওয়ার্ডপ্রেস প্লেগ্রাউন্ড ইনস্ট্যান্স সেটআপ করার জন্য JSON ফাইল। ব্লুপ্রিন্ট ডকস হাব থেকে এদের সম্ভাবনা সম্পর্কে জানুন।
- 👉 [**ডেভেলপার**](/developers) (আপনি এখানে আছেন) – ওয়ার্ডপ্রেস প্লেগ্রাউন্ড একটি প্রোগ্রামেবল টুল হিসেবে তৈরি করা হয়েছে। এই ডেভেলপার ডকস হাব থেকে আপনার কোড দিয়ে প্লেগ্রাউন্ডে যা যা করতে পারবেন তা আবিষ্কার করুন।
- [**API রেফারেন্স**](/api) – ওয়ার্ডপ্রেস প্লেগ্রাউন্ড দ্বারা প্রকাশিত সমস্ত API

<!--
## Navigating the Developers documentation hub
-->

## ডেভেলপার ডকুমেন্টেশন হাব ব্রাউজ করা

<!--
This docs hub is focused on Developers info and is divided into the following major sections:
-->

এই ডকস হাবটি মূলত ডেভেলপার তথ্যের উপর আলোকপাত করে এবং নিম্নলিখিত প্রধান বিভাগগুলোতে বিভক্ত:

<!--
- [Quick Start Guide for Developers](https://developer.wordpress.org/playground/developers/build-an-app/): Begin your development journey with Playground by exploring some examples of what you can achieve using Playground APIs.

- [Local Development](/developers/local-development): Discover the tools provided by Playground to streamline the process of setting up and managing WordPress sites and build your apps.

- [Playground APIs](/developers/apis): Explore the main APIs exposed by WordPress Playground to interact with the Playground: [Query API](/developers/apis/query-api/), [Blueprints](/blueprints/), [Javascript API](/developers/apis/javascript-api/)

- [Architecture](/developers/architecture): The specifics of WordPress Playground's architecture, including its various components and tools.

- [Limitations](/developers/limitations/): Learn more about the current limitations of WordPress Playground, which include disabled network connections, browser persistence and recovery constraints, iframe quirks, PHP function execution requirements, and partial WP-CLI support.
-->

- [ডেভেলপারদের জন্য কুইক স্টার্ট গাইড](https://developer.wordpress.org/playground/developers/build-an-app/): প্লেগ্রাউন্ড API ব্যবহার করে কী কী তৈরি করা যায় তার কিছু উদাহরণ দেখে প্লেগ্রাউন্ডের সাথে আপনার ডেভেলপমেন্ট যাত্রা শুরু করুন।

- [লোকাল ডেভেলপমেন্ট](/developers/local-development): ওয়ার্ডপ্রেস সাইট সেটআপ ও পরিচালনা করা এবং আপনার অ্যাপ তৈরির প্রক্রিয়া সহজ করতে প্লেগ্রাউন্ড দ্বারা প্রদত্ত টুলগুলো সম্পর্কে জানুন।

- [প্লেগ্রাউন্ড API](/developers/apis): প্লেগ্রাউন্ডের সাথে ইন্টারঅ্যাক্ট করার জন্য ওয়ার্ডপ্রেস প্লেগ্রাউন্ড দ্বারা প্রকাশিত প্রধান API গুলো অন্বেষণ করুন: [Query API](/developers/apis/query-api/), [Blueprints](/blueprints/), [Javascript API](/developers/apis/javascript-api/)

- [আর্কিটেকচার](/developers/architecture): বিভিন্ন উপাদান এবং টুলসহ ওয়ার্ডপ্রেস প্লেগ্রাউন্ডের স্থাপত্যের বিশদ বিবরণ।

- [সীমাবদ্ধতা](/developers/limitations/): ওয়ার্ডপ্রেস প্লেগ্রাউন্ডের বর্তমান সীমাবদ্ধতা সম্পর্কে আরও জানুন, যার মধ্যে রয়েছে অক্ষম নেটওয়ার্ক সংযোগ, ব্রাউজার পারসিস্টেন্স ও রিকভারি সীমাবদ্ধতা, iframe সীমাবদ্ধতা, PHP ফাংশন এক্সিকিউশন প্রয়োজনীয়তা এবং আংশিক WP-CLI সাপোর্ট।
