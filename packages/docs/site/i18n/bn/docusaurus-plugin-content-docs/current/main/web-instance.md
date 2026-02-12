---
title: ওয়েব ইনস্ট্যান্স
slug: /web-instance
description: playground.wordpress.net ওয়েব ইন্টারফেসের একটি বিস্তারিত নির্দেশিকা, যেখানে টুলবার, সেটিংস এবং ইনস্ট্যান্স ম্যানেজার নিয়ে আলোচনা করা হয়েছে।
---

<!--
# WordPress Playground web instance
-->

# ওয়ার্ডপ্রেস প্লেগ্রাউন্ড ওয়েব ইনস্ট্যান্স

<!--
[https://playground.wordpress.net/](https://playground.wordpress.net/) is a versatile web tool that allows developers to run WordPress in a browser without needing a server. This environment is particularly useful for testing plugins, themes, and other WordPress features quickly and efficiently.
-->

[https://playground.wordpress.net/](https://playground.wordpress.net/) একটি বহুমুখী ওয়েব টুল যা ডেভেলপারদের কোনো সার্ভার ছাড়াই ব্রাউজারে ওয়ার্ডপ্রেস চালানোর সুযোগ দেয়। এই পরিবেশটি প্লাগইন, থিম এবং অন্যান্য ওয়ার্ডপ্রেস ফিচার দ্রুত এবং দক্ষতার সাথে পরীক্ষা করার জন্য বিশেষভাবে কার্যকর।

<!--
Some key features:
-->

কিছু প্রধান বৈশিষ্ট্য:

<!--
-   **Browser-based**: No local server setup required.
-   **Instant Setup**: Run WordPress with a single click.
-   **Testing Environment**: Ideal for testing plugins and themes.
-->

- **ব্রাউজার-ভিত্তিক**: কোনো লোকাল সার্ভার সেটআপের প্রয়োজন নেই।
- **তাৎক্ষণিক সেটআপ**: এক ক্লিকেই ওয়ার্ডপ্রেস চালু করুন।
- **টেস্টিং এনভায়রনমেন্ট**: প্লাগইন এবং থিম পরীক্ষার জন্য আদর্শ।

<!--
The [Query Params API](/developers/apis/query-api/) allows you to directly load specific configurations into a Playground instance. This includes setting a particular WordPress version, theme, or plugin. You can also define more complex setups using blueprints (see [examples here](/quick-start-guide#try-a-block-a-theme-or-a-plugin)).
-->

[কোয়েরি প্যারামস API](/developers/apis/query-api/) আপনাকে সরাসরি একটি প্লেগ্রাউন্ড ইনস্ট্যান্সে নির্দিষ্ট কনফিগারেশন লোড করার অনুমতি দেয়। এর মধ্যে রয়েছে একটি নির্দিষ্ট ওয়ার্ডপ্রেস সংস্করণ, থিম বা প্লাগইন সেট করা। আপনি ব্লুপ্রিন্ট ব্যবহার করে আরও জটিল সেটআপও নির্ধারণ করতে পারেন ([উদাহরণ এখানে](/quick-start-guide#try-a-block-a-theme-or-a-plugin) দেখুন)।

<!--
From the Playground website, some toolbars are also available to customize your Playground instance and provide quick access to some resources and utilities.
-->

প্লেগ্রাউন্ড ওয়েবসাইট থেকে, আপনার প্লেগ্রাউন্ড ইনস্ট্যান্স কাস্টমাইজ করতে এবং কিছু রিসোর্স ও ইউটিলিটিতে দ্রুত অ্যাক্সেস পেতে কিছু টুলবারও উপলব্ধ।

<!--
![Playground Toolbar Snapshot](@site/static/img/about/playground-toolbar.webp)
-->

![প্লেগ্রাউন্ড টুলবার স্ন্যাপশট](@site/static/img/about/playground-toolbar.webp)

<!--
## Customize Playground
-->

## প্লেগ্রাউন্ড কাস্টমাইজ করুন

<!--
On the toolbar, you'll find:
-->

টুলবারে আপনি পাবেন:

<!--
-   **Playground Settings**: A panel for configuring your current instance, like PHP and WordPress versions.
-   **Playground Manager**: This panel lets you manage WordPress Playground instances, allowing you to save, import, and export them.
-->

- **প্লেগ্রাউন্ড সেটিংস**: আপনার বর্তমান ইনস্ট্যান্স কনফিগার করার জন্য একটি প্যানেল, যেমন PHP এবং ওয়ার্ডপ্রেস সংস্করণ।
- **প্লেগ্রাউন্ড ম্যানেজার**: এই প্যানেলটি আপনাকে ওয়ার্ডপ্রেস প্লেগ্রাউন্ড ইনস্ট্যান্সগুলো পরিচালনা করতে দেয়, যার মাধ্যমে আপনি সেগুলোকে সংরক্ষণ, ইম্পোর্ট এবং এক্সপোর্ট করতে পারেন।

<!--
### Playground Settings
-->

### প্লেগ্রাউন্ড সেটিংস

<!--
![snapshot of customize Playground window at Playground instance](@site/static/img/about/playground-settings-panel.webp)
-->

![প্লেগ্রাউন্ড ইনস্ট্যান্সে কাস্টমাইজ প্লেগ্রাউন্ড উইন্ডোর স্ন্যাপশট](@site/static/img/about/playground-settings-panel.webp)

<!--
The options available from the **Playground Settings Panel**, correspond to the following [Query API options](/developers/apis/query-api#available-options):
-->

**প্লেগ্রাউন্ড সেটিংস প্যানেল** থেকে উপলব্ধ বিকল্পগুলো নিম্নলিখিত [কোয়েরি API বিকল্পগুলোর](/developers/apis/query-api#available-options) সাথে সামঞ্জস্যপূর্ণ:

<!--
-   `language`: Sets the WordPress instance language.
-   `multisite`: Enables WordPress multisite support.
-   `networking`: Grants network access, allowing fetches from the WordPress plugin directory and internal WordPress APIs.
-   `php`: Specifies the PHP version for the instance.
-   `wp`: Defines the WordPress version.
-->

- `language`: ওয়ার্ডপ্রেস ইনস্ট্যান্সের ভাষা সেট করে।
- `multisite`: ওয়ার্ডপ্রেস মাল্টিসাইট সাপোর্ট চালু করে।
- `networking`: নেটওয়ার্ক অ্যাক্সেস প্রদান করে, যা ওয়ার্ডপ্রেস প্লাগইন ডিরেক্টরি এবং অভ্যন্তরীণ ওয়ার্ডপ্রেস API গুলো থেকে ডেটা নিয়ে আসার সুযোগ দেয়।
- `php`: ইনস্ট্যান্সের জন্য PHP সংস্করণ নির্দিষ্ট করে।
- `wp`: ওয়ার্ডপ্রেস সংস্করণ নির্ধারণ করে।

<!--
## Playground Manager
-->

## প্লেগ্রাউন্ড ম্যানেজার

<!--
![Playground settings panel allow users to manage multiple instances](@site/static/img/about/playground-dashboard.webp)
-->

![প্লেগ্রাউন্ড সেটিংস প্যানেল ব্যবহারকারীদের একাধিক ইনস্ট্যান্স পরিচালনা করতে দেয়](@site/static/img/about/playground-dashboard.webp)

<!--
This panel enables users to manage Playground instances. It displays a list of saved Playgrounds and provides access to the current Playground's settings, along with a **Save Button** to store your configurations locally in your browser for later reloading.
-->

এই প্যানেলটি ব্যবহারকারীদের প্লেগ্রাউন্ড ইনস্ট্যান্স পরিচালনা করতে সক্ষম করে। এটি সংরক্ষিত প্লেগ্রাউন্ডগুলোর একটি তালিকা প্রদর্শন করে এবং বর্তমান প্লেগ্রাউন্ডের সেটিংসে অ্যাক্সেস প্রদান করে, সাথে একটি **সেভ বাটন** থাকে যা আপনার কনফিগারেশনগুলো পরবর্তীতে পুনরায় লোড করার জন্য স্থানীয়ভাবে আপনার ব্রাউজারে সংরক্ষণ করে।

<!--
![Save Playground Button](@site/static/img/about/playground-dashboard-save.webp)
-->

![প্লেগ্রাউন্ড সেভ বাটন](@site/static/img/about/playground-dashboard-save.webp)

<!--
Once you click on save, an instance will be stored with a generated name to be revisited anytime. The Playground Manager also has options to export(Additional actions menu) and import(Import actions menu) WordPress Playground instances:
-->

আপনি সেভ-এ ক্লিক করলেই, একটি জেনারেটেড নাম সহ ইনস্ট্যান্সটি সংরক্ষিত হবে যা যেকোনো সময় পুনরায় দেখা যাবে। প্লেগ্রাউন্ড ম্যানেজারে ওয়ার্ডপ্রেস প্লেগ্রাউন্ড ইনস্ট্যান্স এক্সপোর্ট (অতিরিক্ত অ্যাকশন মেনু) এবং ইম্পোর্ট (ইম্পোর্ট অ্যাকশন মেনু) করার বিকল্পও রয়েছে:

<!--
### Additional actions menu
-->

### অতিরিক্ত অ্যাকশন মেনু

<!--
![Additional actions Menu](@site/static/img/about/playground-manager-additional-actions.webp)
-->

![অতিরিক্ত অ্যাকশন মেনু](@site/static/img/about/playground-manager-additional-actions.webp)

<!--
-   **Export Pull Request to GitHub**: This option allows you to export WordPress plugins, themes, and entire wp-content directories as pull requests to any public GitHub repository. Check [here](https://www.youtube.com/watch?v=gKrij8V3nK0&t=2488s) a demo of using this option.
-   **Download as .zip**: Creates a `.zip` file with the setup of the Playground instance, including any themes or plugins installed. This `.zip` won't include content and database changes.
-   **Report error**: If you have any issues with WordPress Playground, you can report them using the form available from this option. You can help resolve issues with Playground by sharing the error details with the development team behind Playground.
-   **View Blueprint**: This option will open the current blueprint used for the Playground instance in the [Blueprints Builder tool](https://playground.wordpress.net/builder/builder.html). From this tool, you'll be able to edit the blueprint online and run a new Playground instance with your edited version of the blueprint.
-->

- **গিটহাবে পুল রিকোয়েস্ট এক্সপোর্ট করুন**: এই বিকল্পটি আপনাকে যেকোনো পাবলিক গিটহাব রিপোজিটরিতে পুল রিকোয়েস্ট হিসেবে ওয়ার্ডপ্রেস প্লাগইন, থিম এবং সম্পূর্ণ wp-content ডিরেক্টরি এক্সপোর্ট করতে দেয়। এই বিকল্পটি ব্যবহারের একটি ডেমো [এখানে](https://www.youtube.com/watch?v=gKrij8V3nK0&t=2488s) দেখুন।
- **zip হিসেবে ডাউনলোড করুন**: এটি প্লেগ্রাউন্ড ইনস্ট্যান্সের সেটআপ সহ একটি `.zip` ফাইল তৈরি করে, যার মধ্যে ইনস্টল করা যেকোনো থিম বা প্লাগইন অন্তর্ভুক্ত থাকে। এই `.zip` ফাইলে কন্টেন্ট এবং ডাটাবেস পরিবর্তন অন্তর্ভুক্ত থাকবে না।
- **ইনস্ট্যান্স সম্পর্কে**: আপনি যদি ওয়ার্ডপ্রেস প্লেগ্রাউন্ড নিয়ে কোনো সমস্যায় পড়েন, তবে এই বিকল্প থেকে উপলব্ধ ফর্ম ব্যবহার করে তা রিপোর্ট করতে পারেন। আপনি প্লেগ্রাউন্ডের নেপথ্যে থাকা ডেভেলপমেন্ট টিমের সাথে ত্রুটির বিবরণ শেয়ার করে প্লেগ্রাউন্ডের সমস্যা সমাধানে সহায়তা করতে পারেন।
- **ব্লুপ্রিন্ট দেখুন**: এই বিকল্পটি প্লেগ্রাউন্ড ইনস্ট্যান্সের জন্য ব্যবহৃত বর্তমান ব্লুপ্রিন্টটি [ব্লুপ্রিন্ট বিল্ডার টুলে](https://playground.wordpress.net/builder/builder.html) খুলবে। এই টুল থেকে, আপনি অনলাইনে ব্লুপ্রিন্ট এডিট করতে পারবেন এবং আপনার ব্লুপ্রিন্টের এডিট করা সংস্করণ দিয়ে একটি নতুন প্লেগ্রাউন্ড ইনস্ট্যান্স চালাতে পারবেন।

<!--
<span id="edit-the-blueprint"></span>
-->

<span id="edit-the-blueprint"></span>

<!--
[![snapshot of Builder mode of WordPress Playground](@site/static/img/about/playground-blueprint-editor.webp)](https://playground.wordpress.net/builder/builder.html)
-->

[![ওয়ার্ডপ্রেস প্লেগ্রাউন্ডের বিল্ডার মোডের স্ন্যাপশট](@site/static/img/about/playground-blueprint-editor.webp)](https://playground.wordpress.net/builder/builder.html)

<!--
### Import actions menu
-->

### ইম্পোর্ট অ্যাকশন মেনু

<!--
![Import actions Menu](@site/static/img/about/playground-manager-import-actions.webp)
-->

![ইম্পোর্ট অ্যাকশন মেনু](@site/static/img/about/playground-manager-import-actions.webp)

<!--
-   **Import from .zip**: Allows you to recreate a Playground instance using any `.zip` file generated with the "Download as .zip" option.
-   **Preview a Gutenberg PR**: Allows testers to run branches from the Gutenberg repository to test pull requests instantly.
-   **Import from GitHub**: This option allows you to import plugins, themes, and wp-content directories directly from your public GitHub repositories. To enable this feature, connect your GitHub account with WordPress Playground.
-->

- **.zip থেকে ইম্পোর্ট করুন**: এটি আপনাকে "Download as .zip" বিকল্প দিয়ে জেনারেট করা যেকোনো `.zip` ফাইল ব্যবহার করে একটি প্লেগ্রাউন্ড ইনস্ট্যান্স পুনরায় তৈরি করতে দেয়।
- **গুটেনবার্গ পিআর প্রিভিউ করুন**: এটি টেস্টারদের গুটেনবার্গ রিপোজিটরি থেকে ব্রাঞ্চগুলো চালিয়ে তাৎক্ষণিকভাবে পুল রিকোয়েস্ট পরীক্ষা করার সুযোগ দেয়।
- **গিটহাব থেকে ইম্পোর্ট করুন**: এই বিকল্পটি আপনাকে সরাসরি আপনার পাবলিক গিটহাব রিপোজিটরি থেকে প্লাগইন, থিম এবং wp-content ডিরেক্টরি ইম্পোর্ট করতে দেয়। এই ফিচারটি চালু করতে, ওয়ার্ডপ্রেস প্লেগ্রাউন্ডের সাথে আপনার গিটহাব অ্যাকাউন্ট সংযুক্ত করুন।

<!--
:::caution
-->

:::সতর্কতা

<!--
The site at https://playground.wordpress.net is there to support the community, but there are no guarantees it will continue to work if the traffic grows significantly.
-->

https://playground.wordpress.net সাইটটি কমিউনিটিকে সহায়তা করার জন্য আছে, কিন্তু ট্রাফিক উল্লেখযোগ্যভাবে বৃদ্ধি পেলে এটি কাজ চালিয়ে যাবে কিনা তার কোনো নিশ্চয়তা নেই।

<!--
If you need certain availability, you should [host your own WordPress Playground](/developers/architecture/host-your-own-playground).
:::
-->

যদি আপনার নিশ্চিত প্রাপ্যতার প্রয়োজন হয়, তবে আপনার [নিজস্ব ওয়ার্ডপ্রেস প্লেগ্রাউন্ড হোস্ট](/developers/architecture/host-your-own-playground) করা উচিত।
:::
