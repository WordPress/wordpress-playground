---
title: এটি কীভাবে কাজ করে?
description: ব্রাউজারে WordPress চালানোর জন্য ওয়ার্ডপ্রেস প্লেগ্রাউন্ড কীভাবে SQLite ও MySQL-থেকে-SQLite ট্রান্সলেশন লেয়ার ব্যবহার করে তা জানুন।
---

<!--
## Database is supported via MySQL\<\-\>SQLite translation layer
-->

## MySQL\<\-\>SQLite ট্রান্সলেশন লেয়ারের মাধ্যমে ডেটাবেস সমর্থিত {#database-is-supported-via-mysql-sqlite-translation-layer}

<!--
WordPress requires MySQL. However, there isn't a WebAssembly version of MySQL you could run in the browser. WordPress Playground therefore ships PHP with the [native SQLite driver](https://www.php.net/manual/en/ref.pdo-sqlite.php) and leans on SQLite.
-->

WordPress চালানোর জন্য MySQL প্রয়োজন। তবে ব্রাউজারে চালানোর মতো MySQL-এর কোনো WebAssembly সংস্করণ নেই। তাই ওয়ার্ডপ্রেস প্লেগ্রাউন্ড PHP-এর সাথে [নেটিভ SQLite ড্রাইভার](https://www.php.net/manual/en/ref.pdo-sqlite.php) যুক্ত করে সরবরাহ করে এবং SQLite-এর ওপর নির্ভর করে।

<!--
But how can WordPress run on a different database?
-->

কিন্তু একটি ভিন্ন ডেটাবেসে WordPress কীভাবে চলতে পারে?

<!--
Behind the scenes, the official [SQLite Database Integration](https://github.com/WordPress/sqlite-database-integration) plugin intercepts all MySQL queries and rewrites them in SQLite dialect. The 2.0 release ships [a new WordPress Playground-informed translation layer](https://github.com/WordPress/sqlite-database-integration/pull/9) that allows WordPress on SQLite to pass 99% of the WordPress unit test suite.
-->

নেপথ্যে, অফিসিয়াল [SQLite Database Integration](https://github.com/WordPress/sqlite-database-integration) প্লাগইনটি সব MySQL কোয়েরি ইন্টারসেপ্ট করে এবং সেগুলোকে SQLite ডায়ালেক্টে পুনরায় লিখে দেয়। এর 2.0 রিলিজে [WordPress Playground-এর অভিজ্ঞতা থেকে তৈরি একটি নতুন ট্রান্সলেশন লেয়ার](https://github.com/WordPress/sqlite-database-integration/pull/9) যুক্ত করা হয়েছে, যা SQLite-এ চলা WordPress-কে WordPress ইউনিট টেস্ট স্যুটের 99% পরীক্ষায় উত্তীর্ণ হতে সাহায্য করে।
