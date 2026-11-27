---
title: WordPress সমর্থন
slug: /developers/architecture/wordpress
description: SQLite, ব্রাউজার বিল্ড এবং Node.js ফাইল সিস্টেম মাউন্টিংয়ের মাধ্যমে ওয়ার্ডপ্রেস প্লেগ্রাউন্ড কীভাবে PHP WebAssembly-তে WordPress চালায় তা জানুন।
---

<!--
# WordPress support
-->

# WordPress সমর্থন {#wordpress-support}

<!--
WordPress, as a PHP application, can run on PHP WebAssembly. However, there are a few caveats.
-->

একটি PHP অ্যাপ্লিকেশন হিসেবে WordPress, PHP WebAssembly-তে চলতে পারে। তবে এক্ষেত্রে কিছু সীমাবদ্ধতা ও ব্যতিক্রম রয়েছে।

<!--
## SQLite
-->

## SQLite {#sqlite}

<!--
First, WordPress requires MySQL. However, there isn't a WebAssembly version of MySQL you could run in the browser. WordPress Playground, therefore, ships PHP with the [native SQLite driver](https://www.php.net/manual/en/ref.pdo-sqlite.php) and leans on SQLite.

But how can WordPress run on a different database?

Behind the scenes, the official [SQLite Database Integration](https://github.com/WordPress/sqlite-database-integration) plugin intercepts all MySQL queries and rewrites them in SQLite dialect. The x.0 release ships [a new WordPress Playground-informed translation layer](https://github.com/WordPress/sqlite-database-integration/pull/9) that allows WordPress on SQLite to pass 99% of the WordPress unit test suite.
-->

প্রথমত, WordPress চালানোর জন্য MySQL প্রয়োজন। কিন্তু ব্রাউজারে চালানোর মতো MySQL-এর কোনো WebAssembly সংস্করণ নেই। তাই ওয়ার্ডপ্রেস প্লেগ্রাউন্ড PHP-এর সাথে [নেটিভ SQLite ড্রাইভার](https://www.php.net/manual/en/ref.pdo-sqlite.php) যুক্ত করে সরবরাহ করে এবং SQLite-এর ওপর নির্ভর করে।

কিন্তু একটি ভিন্ন ডেটাবেসে WordPress কীভাবে চলতে পারে?

নেপথ্যে, অফিসিয়াল [SQLite Database Integration](https://github.com/WordPress/sqlite-database-integration) প্লাগইনটি সব MySQL কোয়েরি ইন্টারসেপ্ট করে এবং সেগুলোকে SQLite ডায়ালেক্টে পুনরায় লিখে দেয়। এর x.0 রিলিজে [WordPress Playground-এর অভিজ্ঞতা থেকে তৈরি একটি নতুন ট্রান্সলেশন লেয়ার](https://github.com/WordPress/sqlite-database-integration/pull/9) যুক্ত করা হয়েছে, যা SQLite-এ চলা WordPress-কে WordPress ইউনিট টেস্ট স্যুটের 99% পরীক্ষায় উত্তীর্ণ হতে সাহায্য করে।

<!--
## WordPress in the browser
-->

## ব্রাউজারে WordPress {#wordpress-in-the-browser}

<!--
You can use any WordPress build in the browser. For convenience and to reduce the data transfer size, WordPress Playground ships a few [minified WordPress releases](https://github.com/WordPress/wordpress-playground/tree/trunk/packages/playground/wordpress-builds) that you can use in the browser.
-->

আপনি ব্রাউজারে যেকোনো WordPress বিল্ড ব্যবহার করতে পারেন। সুবিধার জন্য এবং ডেটা স্থানান্তরের আকার কমাতে, ওয়ার্ডপ্রেস প্লেগ্রাউন্ড কয়েকটি [মিনিফায়েড WordPress রিলিজ](https://github.com/WordPress/wordpress-playground/tree/trunk/packages/playground/wordpress-builds) সরবরাহ করে যা আপনি ব্রাউজারে ব্যবহার করতে পারেন।

<!--
## WordPress in Node.js
-->

## Node.js-এ WordPress {#wordpress-in-nodejs}

<!--
In Node.js, you'll typically want to [mount WordPress](/developers/architecture/wasm-php-filesystem) from a disk directory.
-->

Node.js-এ আপনি সাধারণত একটি ডিস্ক ডিরেক্টরি থেকে [WordPress মাউন্ট](/developers/architecture/wasm-php-filesystem) করতে চাইবেন।
