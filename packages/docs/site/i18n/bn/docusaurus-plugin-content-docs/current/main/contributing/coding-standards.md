---
slug: /contributing/coding-standards
title: কোডিং নীতি
description: প্লেগ্রাউন্ডের জন্য কোডিং নীতির বিশদ বিবরণ, সহায়ক ত্রুটিগুলোর বার্তা, একটি ন্যূনতম পাবলিক API এবং ব্লুপ্রিন্টের উপর দৃষ্টি প্রদান করে।
---

<!--
# Coding principles
-->

# কোডিং নীতি

<!--
## Error messages
-->

## ত্রুটি বার্তা

<!--
A good error message informs the user of the following steps to take. Any ambiguity in errors thrown by Playground public APIs will prompt the developers to open issues.
-->

একটি ভাল ত্রুটি বার্তা ব্যবহারকারীকে নিম্নলিখিত পদক্ষেপগুলি সম্পর্কে অবহিত করে। প্লেগ্রাউন্ডের [Public APIs](/developers/apis/) দ্বারা প্রদত্ত ত্রুটিগুলিতে কোনও অস্পষ্টতা ডেভেলপারদের সমস্যাগুলি দেখতে উদ্বুদ্ধ করবে।

<!--
Consider a network error, for example—can we infer the type of error and display a relevant message summarizing the next steps?
-->

উদাহরণস্বরূপ, একটি নেটওয়ার্ক ত্রুটি বিবেচনা করুন - আমরা কি ত্রুটির ধরণটি অনুমান করতে পারি এবং পরবর্তী পদক্ষেপগুলির সংক্ষিপ্তসার সহ একটি প্রাসঙ্গিক বার্তা প্রদর্শন করতে পারি?

<!--
-   **Network error**: "Your internet connection twitched. Try to reload the page.
-   **404**: "Could not find the file".
-   **403**: "The server blocked access to the file".
-   **CORS**: clarify it's a browser security feature and add a link to a detailed explanation (on MDN or another reliable source). Suggest the user move their file somewhere else, like `raw.githubusercontent.com`, and link to a resource explaining how to set up CORS headers on their servers.
-->

-   **নেটওয়ার্ক ত্রুটি**: "আপনার ইন্টারনেট সংযোগটি বিকৃত হয়েছে। পৃষ্ঠাটি পুনরায় লোড করার চেষ্টা করুন।"
-   **৪০৪**: "ফাইলটি খুঁজে পাওয়া যাচ্ছে না".
-   **৪০৩**: "সার্ভার ফাইলটিতে অ্যাক্সেস ব্লক করেছে".
-   **CORS**: স্পষ্ট করুন যে এটি একটি ব্রাউজার সুরক্ষা বৈশিষ্ট্য এবং একটি বিস্তারিত ব্যাখ্যার লিঙ্ক যুক্ত করুন (MDN বা অন্য কোনও নির্ভরযোগ্য উৎসে)। ব্যবহারকারীকে তাদের ফাইল অন্য কোথাও সরানোর পরামর্শ দিন, যেমন `raw.githubusercontent.com`, এবং তাদের সার্ভারে CORS হেডার কীভাবে সেট আপ করবেন তা ব্যাখ্যা করে এমন একটি রিসোর্সের লিঙ্ক দিন।

<!--
We handle code formatting and linting automatically. Relax, type away, and let the machines do the work.
-->

আমরা কোড ফর্ম্যাটিং এবং লিন্টিং স্বয়ংক্রিয়ভাবে পরিচালনা করি। আরাম করুন, টাইপ করুন এবং মেশিনগুলিকে কাজ করতে দিন।

<!--
## Public API
-->

## পাবলিক API

<!--
Playground aims to keep the narrowest possible API scope.
-->

প্লেগ্রাউন্ডের লক্ষ্য হল সম্ভাব্য সবচেয়ে সংকীর্ণ API স্কোপ রাখা।

<!--
Public APIs are easy to add and hard to remove. It only takes one PR to introduce a new API, but it may take a thousand to remove it, especially if other projects have already consumed it.
-->

পাবলিক API যোগ করা সহজ এবং অপসারণ করা কঠিন। একটি নতুন API প্রবর্তন করতে কেবল একটি PR লাগে, তবে এটি অপসারণ করতে এক হাজার লাগতে পারে, বিশেষ করে যদি অন্যান্য প্রকল্প ইতিমধ্যে এটি ব্যবহার করে থাকে।

<!--
-   Don't expose unnecessary functions, classes, constants, or other components.
-->

-   অপ্রয়োজনীয় ফাংশন, ক্লাস, ধ্রুবক, বা অন্যান্য উপাদান প্রকাশ করবেন না।

<!--
## Blueprints
-->

## ব্লুপ্রিন্ট

<!--
Blueprints are the primary way to interact with Playground. These JSON files describe a set of steps that Playground executes in order.
-->

[ব্লুপ্রিন্ট](/blueprints/getting-started) হল প্লেগ্রাউন্ডের সাথে ইন্টারঅ্যাক্ট করার প্রাথমিক উপায়। এই JSON ফাইলগুলি প্লেগ্রাউন্ড ক্রমানুসারে সম্পাদন করে এমন ধাপগুলির একটি সেট বর্ণনা করে।

<!--
### Guidelines
-->

### নির্দেশিকা

<!--
Blueprint steps should be **concise and focused**. They should do one thing and do it well.
-->

ব্লুপ্রিন্টের ধাপগুলি **সংক্ষিপ্ত এবং কেন্দ্রীভূত** হওয়া উচিত। এগুলি একটি কাজ করা উচিত এবং ভালভাবে করা উচিত।

<!--
-   If you need to create a new step, try refactoring an existing one first.
-   If that's not enough, ensure the new step delivers a new capability. Don't replicate the functionality of existing steps.
-   Assume the step would be called more than once.
-   Assume it would run in a specific order.
-   Add unit tests to verify that.
-->

-   যদি আপনার একটি নতুন ধাপ তৈরি করার প্রয়োজন হয়, তাহলে প্রথমে বিদ্যমান ধাপটি পুনর্নির্মাণের চেষ্টা করুন।
-   যদি এটি যথেষ্ট না হয়, তাহলে নিশ্চিত করুন যে নতুন ধাপটি একটি নতুন ক্ষমতা প্রদান করে। বিদ্যমান ধাপগুলির কার্যকারিতা কপি করবেন না।
-   ধরে নিন যে ধাপটি একাধিকবার কল করা হবে।
-   ধরে নিন এটি একটি নির্দিষ্ট ক্রমে চলবে।
-   এটি যাচাই করার জন্য ইউনিট পরীক্ষা যোগ করুন।

<!--
Blueprints should be **intuitive and straightforward**.
-->

ব্লুপ্রিন্টগুলি **স্বজ্ঞাত এবং সরল** হওয়া উচিত।

<!--
-   Don't require arguments that can be optional.
-   Use plain argument. For example, `slug` instead of `path`.
-   Define constants in virtual JSON files—don't modify PHP files.
-   Define a TypeScript type for the Blueprint. That's how Playground generates its JSON schema.
-   Write a function to handle a Blueprint step. Accept the argument of the type you defined.
-   Provide a usage example in the doc string. It's automatically reflected in the docs.
-->

-   ঐচ্ছিক হতে পারে এমন আর্গুমেন্টের প্রয়োজন নেই।
-   প্লেইন আর্গুমেন্ট ব্যবহার করুন। উদাহরণস্বরূপ, `path` এর পরিবর্তে `slug`।
-   ভার্চুয়াল JSON ফাইলগুলিতে কন্সটেন্ট সংজ্ঞায়িত করুন—PHP ফাইলগুলি পরিবর্তন করবেন না।
-   ব্লুপ্রিন্টের জন্য একটি টাইপস্ক্রিপ্ট টাইপ সংজ্ঞায়িত করুন। এভাবেই প্লেগ্রাউন্ড তার JSON স্কিমা তৈরি করে।
-   ব্লুপ্রিন্ট ধাপ পরিচালনা করার জন্য একটি ফাংশন লিখুন। আপনার সংজ্ঞায়িত ধরণের আর্গুমেন্ট গ্রহণ করুন।
-   ডক স্ট্রিংয়ে একটি ব্যবহারের উদাহরণ দিন। এটি স্বয়ংক্রিয়ভাবে ডক্সে প্রতিফলিত হয়।
