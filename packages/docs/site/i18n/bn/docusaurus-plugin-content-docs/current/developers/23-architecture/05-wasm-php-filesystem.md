---
slug: /developers/architecture/wasm-php-filesystem
---

<!--
# PHP Filesystem
-->

# PHP ফাইলসিস্টেম {#php-filesystem}

<!--
The PHP module has its own filesystem separate from your computer's filesystem. It is provided by [Emscripten's FS library](https://emscripten.org/docs/api_reference/Filesystem-API.html) and the default APIs is low-level and cumbersome to use. The `PHP` JavaScript class shipped with WordPress Playground wraps it with a more convenient higher-level API.
-->

PHP মডিউলের নিজস্ব একটি ফাইলসিস্টেম রয়েছে, যা আপনার কম্পিউটারের ফাইলসিস্টেম থেকে আলাদা। এটি [Emscripten-এর FS লাইব্রেরির](https://emscripten.org/docs/api_reference/Filesystem-API.html) মাধ্যমে সরবরাহ করা হয় এবং এর ডিফল্ট API-গুলো লো-লেভেলের ও ব্যবহার করা বেশ ঝামেলাপূর্ণ। ওয়ার্ডপ্রেস প্লেগ্রাউন্ডের সাথে থাকা `PHP` JavaScript ক্লাসটি এটিকে আরও সুবিধাজনক একটি হাই-লেভেল API দিয়ে র‍্যাপ করে।

<!--
In general, WordPress Playground uses an in-memory virtual filesystem.
-->

সাধারণত, ওয়ার্ডপ্রেস প্লেগ্রাউন্ড একটি ইন-মেমোরি ভার্চুয়াল ফাইলসিস্টেম ব্যবহার করে।

<!--
However, in Node.js, you can also mount a real directory from the host filesystem into the PHP filesystem.
-->

তবে Node.js-এ আপনি হোস্ট ফাইলসিস্টেম থেকে একটি প্রকৃত ডিরেক্টরিও PHP ফাইলসিস্টেমে মাউন্ট করতে পারেন।

<!--
Here's how to interact with the filesystem in WordPress Playground:
-->

ওয়ার্ডপ্রেস প্লেগ্রাউন্ডে ফাইলসিস্টেমের সাথে যেভাবে কাজ করবেন:

```js
// Recursively create a /var/www directory
php.mkdirTree('/var/www');

console.log(php.fileExists('/var/www/file.txt'));
// false

php.writeFile('/var/www/file.txt', 'Hello from the filesystem!');

console.log(php.fileExists('/var/www/file.txt'));
// true

console.log(php.readFile('/var/www/file.txt'));
// "Hello from the filesystem!

// Delete the file:
php.unlink('/var/www/file.txt');
```

<!--
For more details consult the BasePHP class directly – it has some great documentation strings.
-->

আরও বিস্তারিত জানতে সরাসরি BasePHP ক্লাসটি দেখুন – এতে চমৎকার কিছু ডকুমেন্টেশন স্ট্রিং রয়েছে।
