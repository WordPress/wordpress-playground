---
slug: /developers/architecture/browser-iframe-rendering
---

<!--
# Iframe-based rendering
-->

# Iframe-ভিত্তিক রেন্ডারিং

<!--
To avoid page reloads, all the `PHPRequestHandler` responses must be rendered in an iframe. Remember, the entire setup only lives as long as the main `index.html`. We want to avoid reloading the main app at all costs.
-->

পেজ রিলোড এড়াতে `PHPRequestHandler`-এর সব রেসপন্স একটি iframe-এর ভেতরে রেন্ডার করতে হয়। মনে রাখবেন, পুরো সেটআপটি ততক্ষণই টিকে থাকে, যতক্ষণ মূল `index.html` খোলা থাকে। তাই মূল অ্যাপটি যেন কোনোভাবেই রিলোড না হয়, সেটিই আমাদের লক্ষ্য।

<!--
In our app example above, `index.php` renders the following HTML:
-->

ওপরের অ্যাপের উদাহরণে `index.php` নিচের HTML রেন্ডার করে:

```html
<a href="page.php">Go to page.php</a>
```

<!--
Imagine our `index.html` rendered it in a `<div>` instead of an `<iframe>`. As soon as you click on that link, the browser will try to navigate from `index.html` to `page.php`. However, `index.html` runs the entire PHP app, including the Worker Thread, the PHPRequestHandler, and the traffic control connecting them to the Service Worker. Navigating away from it would destroy the app.
-->

ধরুন আমাদের `index.html` এটিকে একটি `<iframe>`-এর বদলে একটি `<div>`-এর ভেতরে রেন্ডার করল। ওই লিংকে ক্লিক করার সাথে সাথেই ব্রাউজার `index.html` থেকে `page.php`-তে যাওয়ার চেষ্টা করবে। কিন্তু পুরো PHP অ্যাপটি চলে `index.html`-এর ভেতরেই: Worker Thread, PHPRequestHandler, আর এগুলোকে Service Worker-এর সাথে জুড়ে রাখা ট্রাফিক কন্ট্রোল—সবকিছু। তাই এই পেজ ছেড়ে অন্য পেজে গেলেই পুরো অ্যাপটি বন্ধ হয়ে যাবে।

<!--
Now, consider an iframe with the same link in it:
-->

এবার একই লিংকসহ একটি iframe-এর কথা ভাবুন:

```html
<iframe srcdoc='<a href="page.php">Go to page.php</a>'></iframe>
```

<!--
This time, click the link in the browser to load `page.php` **inside the iframe**. The top-level `index.html`, where the PHP application runs, remains unaffected. That's why iframes are crucial for the `@php-wasm/web` setup.
-->

এবার ব্রাউজারে লিংকটিতে ক্লিক করলে `page.php` **iframe-এর ভেতরে** লোড হয়। টপ-লেভেলের `index.html`, যেখানে PHP অ্যাপ্লিকেশনটি চলে, সেটি একদম ঠিকঠাক থাকে। এ কারণেই `@php-wasm/web` সেটআপের জন্য iframe এত গুরুত্বপূর্ণ।

<!--
<div class="callout callout-info">

**Crash reports**

Playground doesn't collect crash reports automatically. Instead, it prompts users to submit a crash report when an instance fails to run in the browser.

The report includes a log, description, and a URL, and users can modify it before submitting it.

The [Logger API](https://github.com/WordPress/wordpress-playground/blob/trunk/packages/playground/website/public/logger.php) handles it from there. This simple REST API validates the data and sends it to the **Making WordPress** [#playground-logs Slack channel](https://wordpress.slack.com/archives/C06Q5DCKZ3L).

</div>
-->

<div class="callout callout-info">

**ক্র্যাশ রিপোর্ট**

প্লেগ্রাউন্ড নিজে থেকে ক্র্যাশ রিপোর্ট নেয় না। বরং কোনো ইনস্ট্যান্স ব্রাউজারে চালু না হলে এটি ব্যবহারকারীকে একটি ক্র্যাশ রিপোর্ট পাঠাতে বলে।

রিপোর্টে একটি লগ, একটি বিবরণ আর একটি URL থাকে। পাঠানোর আগে ব্যবহারকারী চাইলে এটি এডিট করতে পারেন।

এরপর বাকি কাজ [Logger API](https://github.com/WordPress/wordpress-playground/blob/trunk/packages/playground/website/public/logger.php) সামলায়। এই ছোট্ট REST API ডেটা ভ্যালিডেট করে সেটি **Making WordPress**-এর [#playground-logs Slack চ্যানেলে](https://wordpress.slack.com/archives/C06Q5DCKZ3L) পাঠিয়ে দেয়।

</div>

<!--
## Iframes caveats

- `target="_top"` isn't handled yet, so clicking links with `target="_top"` will reload the page you’re working on.
- JavaScript popups originating in the `iframe` may not always display.
-->

## Iframe-এর কিছু ঝামেলা

- `target="_top"` এখনো হ্যান্ডেল করা হয় না, তাই `target="_top"` থাকা লিংকে ক্লিক করলে আপনি যে পেজে কাজ করছেন সেটি রিলোড হয়ে যাবে।
- `iframe` থেকে আসা JavaScript পপআপ সবসময় নাও দেখা যেতে পারে।
