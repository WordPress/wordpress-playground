---
title: ওয়েব ইনস্ট্যান্স
slug: /web-instance
description: playground.wordpress.net-এর ওয়েব ইন্টারফেসে Dock, সংরক্ষণ, সেটিংস এবং সাইট টুল ব্যবহার করার বিস্তারিত নির্দেশিকা।
---

<!--
# WordPress Playground web instance
-->

# ওয়ার্ডপ্রেস প্লেগ্রাউন্ড ওয়েব ইনস্ট্যান্স

<!--
[https://playground.wordpress.net/](https://playground.wordpress.net/) runs
WordPress in your browser without a server. The page opens a Playground, shows
the WordPress site, and keeps the site tools in the **Dock**.
-->

[https://playground.wordpress.net/](https://playground.wordpress.net/) কোনো সার্ভার ছাড়াই
আপনার ব্রাউজারে ওয়ার্ডপ্রেস চালায়। পেজটি একটি Playground খোলে, ওয়ার্ডপ্রেস সাইটটি
দেখায় এবং সাইটের টুলগুলো **Dock**-এ রাখে।

<!--
![The Playground web instance with the Dock visible at the bottom of the page](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-overview.webp)
-->

![পেজের নিচে Dock-সহ Playground ওয়েব ইনস্ট্যান্স](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-overview.webp)

<!--
The Dock has an address field, a save status, layout controls, and destinations for creating, storing, inspecting, and exporting Playgrounds.
-->

Dock-এ একটি ঠিকানা ফিল্ড, সংরক্ষণের স্ট্যাটাস, লেআউট কন্ট্রোল এবং Playground তৈরি,
সংরক্ষণ, পরিদর্শন ও এক্সপোর্ট করার গন্তব্য রয়েছে।

<!--
## Customize Playground
-->

## Playground কাস্টমাইজ করুন

<!--
The Dock includes these destinations:
-->

Dock-এ নিচের গন্তব্যগুলো রয়েছে:

<!--
- **New**: Start from the Blueprint gallery, a public Blueprint URL, a new
  Blueprint, a pull request preview, a GitHub repository, or an imported `.zip`
  file.
- **Playgrounds**: Switch between recent and saved Playgrounds.
- **Blueprint**: View, edit, export, and run the current Blueprint.
- **Site Settings**: Configure WordPress version, PHP version, language,
  networking, and multisite.
- **Database**: Inspect or download the SQLite database and open database tools.
- **Files**: Browse and edit files in the WordPress filesystem.
- **Logs**: Inspect PHP errors, warnings, and notices.
- **Export**: Download a `.zip`, copy the original setup link, or export selected
  files to a GitHub pull request.
-->

- **New**: Blueprint gallery, পাবলিক Blueprint URL, নতুন Blueprint, পুল রিকোয়েস্ট
  প্রিভিউ, GitHub রিপোজিটরি অথবা ইম্পোর্ট করা `.zip` ফাইল থেকে শুরু করুন।
- **Playgrounds**: সাম্প্রতিক ও সংরক্ষিত Playground-গুলোর মধ্যে পরিবর্তন করুন।
- **Blueprint**: বর্তমান Blueprint দেখুন, সম্পাদনা করুন, এক্সপোর্ট করুন ও চালান।
- **Site Settings**: ওয়ার্ডপ্রেস সংস্করণ, PHP সংস্করণ, ভাষা, নেটওয়ার্কিং এবং
  মাল্টিসাইট কনফিগার করুন।
- **Database**: SQLite ডেটাবেস পরিদর্শন বা ডাউনলোড করুন এবং ডেটাবেস টুল খুলুন।
- **Files**: ওয়ার্ডপ্রেস ফাইলসিস্টেমের ফাইল ব্রাউজ ও সম্পাদনা করুন।
- **Logs**: PHP-এর ত্রুটি, সতর্কতা ও নোটিশ দেখুন।
- **Export**: `.zip` ডাউনলোড করুন, মূল সেটআপ লিংক কপি করুন অথবা নির্বাচিত ফাইল
  GitHub পুল রিকোয়েস্টে এক্সপোর্ট করুন।

<!--
## Navigate inside WordPress
-->

## ওয়ার্ডপ্রেসের ভেতরে নেভিগেট করুন

<!--
Use the Dock address field to open a path inside the current WordPress site.
For example, enter `/wp-admin/` to open the dashboard or
`/wp-admin/plugins.php` to open the Plugins screen. **Refresh page** reloads
the current WordPress path.
-->

বর্তমান ওয়ার্ডপ্রেস সাইটের কোনো পাথ খুলতে Dock-এর ঠিকানা ফিল্ড ব্যবহার করুন। যেমন,
ড্যাশবোর্ড খুলতে `/wp-admin/` অথবা Plugins স্ক্রিন খুলতে
`/wp-admin/plugins.php` লিখুন। **Refresh page** বর্তমান ওয়ার্ডপ্রেস পাথটি পুনরায়
লোড করে।

<!--
![The Refresh page button in the Dock](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/refresh-playground-button.webp)
-->

![Dock-এ Refresh page বোতাম](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/refresh-playground-button.webp)

<!--
You can also use the [Query Params API](/developers/apis/query-api/) to open Playground with a specific setup, such as a WordPress version, PHP version, plugin, theme, or Blueprint.
-->

নির্দিষ্ট ওয়ার্ডপ্রেস সংস্করণ, PHP সংস্করণ, প্লাগইন, থিম বা Blueprint-সহ Playground
খুলতে আপনি [Query Params API](/developers/apis/query-api/) ব্যবহার করতে পারেন।

<!--
## Understand the save status
-->

## সংরক্ষণের স্ট্যাটাস বুঝুন

<!--
The status next to the address field tells you how the current Playground is stored:
-->

ঠিকানা ফিল্ডের পাশের স্ট্যাটাসটি বর্তমান Playground কীভাবে সংরক্ষিত আছে তা জানায়:

<!--
- **Autosaved** means the Playground is stored in this browser and can be recovered from **Your Playgrounds**. Playground keeps up to five recent autosaves.
- **Saved** means the Playground was stored permanently in browser storage or saved to a local directory.
- **Unsaved** means the Playground has not been saved. Temporary Playgrounds, including `?storage=temp`, are lost when the tab is closed or refreshed.
-->

- **Autosaved** মানে Playground এই ব্রাউজারে সংরক্ষিত এবং **Your Playgrounds** থেকে
  ফিরিয়ে আনা যায়। Playground সর্বোচ্চ পাঁচটি সাম্প্রতিক autosave রাখে।
- **Saved** মানে Playground ব্রাউজার স্টোরেজে স্থায়ীভাবে রাখা হয়েছে অথবা একটি
  লোকাল ডিরেক্টরিতে সংরক্ষিত হয়েছে।
- **Unsaved** মানে Playground সংরক্ষিত হয়নি। `?storage=temp`-সহ অস্থায়ী Playground
  ট্যাব বন্ধ বা রিফ্রেশ করলে হারিয়ে যায়।

<!--
Click **Autosaved** or **Unsaved** to open **Store permanently**.
-->

**Store permanently** খুলতে **Autosaved** অথবা **Unsaved**-এ ক্লিক করুন।

<!--
![The Store permanently pane with a Playground name and the Save button](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/saving-playground.webp)
-->

![Playground নাম এবং Save বোতাম সহ Store permanently পেন](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/saving-playground.webp)

<!--
Store permanently can keep an autosaved Playground in browser storage so autosave pruning no longer removes it. In browsers that support the File System Access API, it can also save the Playground to a local directory.
-->

Store permanently একটি autosaved Playground-কে ব্রাউজার স্টোরেজে স্থায়ীভাবে রাখতে
পারে, যাতে পুরোনো autosave মুছে ফেলার সময় এটি বাদ না যায়। File System Access API
সমর্থিত ব্রাউজারে Playground একটি লোকাল ডিরেক্টরিতেও সংরক্ষণ করা যায়।

<!--
Browser storage still belongs to the browser. The browser may remove stored data when storage pressure or privacy settings require it. Export a ZIP when you need a portable backup.
-->

ব্রাউজার স্টোরেজ ব্রাউজারেরই অংশ। স্টোরেজের চাপ বা গোপনীয়তা সেটিংসের কারণে ব্রাউজার
সংরক্ষিত ডেটা সরিয়ে ফেলতে পারে। বহনযোগ্য ব্যাকআপের জন্য ZIP এক্সপোর্ট করুন।

<!--
## Start a Playground
-->

## একটি Playground শুরু করুন

<!--
Open **New Playground** from the Dock by clicking **New**. The pane contains
**Blueprint gallery**, **From a URL**, **Write a Blueprint**, **Preview a PR**,
**From GitHub**, and **Import zip**.
-->

Dock-এর **New**-এ ক্লিক করে **New Playground** খুলুন। পেনটিতে **Blueprint gallery**,
**From a URL**, **Write a Blueprint**, **Preview a PR**, **From GitHub** এবং
**Import zip** রয়েছে।

<!--
![The New Playground pane with the Blueprint gallery selected](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-new-playground.webp)
-->

![Blueprint gallery নির্বাচিত New Playground পেন](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-new-playground.webp)

<!--
The Blueprint gallery starts with **Vanilla WordPress**, which creates a clean
WordPress install. **From a URL** opens a public Blueprint URL. **Write a
Blueprint** opens an editor for a new Blueprint. **Import zip** restores a ZIP
exported from Playground.
-->

Blueprint gallery-র শুরুতে থাকা **Vanilla WordPress** একটি পরিষ্কার ওয়ার্ডপ্রেস
ইনস্টল তৈরি করে। **From a URL** পাবলিক Blueprint URL খোলে। **Write a Blueprint**
নতুন Blueprint-এর এডিটর খোলে। **Import zip** Playground থেকে এক্সপোর্ট করা ZIP
পুনরুদ্ধার করে।

<!--
![The New Playground pane with Import zip selected](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-new-playground-import-zip.webp)
-->

![Import zip নির্বাচিত New Playground পেন](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-new-playground-import-zip.webp)

<!--
## Return to recent and saved Playgrounds
-->

## সাম্প্রতিক ও সংরক্ষিত Playground-এ ফিরুন

<!--
Open **Your Playgrounds** from the Dock by clicking **Playgrounds**. It lists the current Playground, recent autosaves, and Playgrounds you saved permanently.
-->

Dock-এর **Playgrounds**-এ ক্লিক করে **Your Playgrounds** খুলুন। এতে বর্তমান
Playground, সাম্প্রতিক autosave এবং স্থায়ীভাবে সংরক্ষিত Playground-এর তালিকা থাকে।

<!--
![The Your Playgrounds pane with the current Playground](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/your-playgrounds.webp)
-->

![বর্তমান Playground-সহ Your Playgrounds পেন](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/your-playgrounds.webp)

<!--
Autosaved Playgrounds are recovery points. Playground retains up to five recent
autosaves. Use **Store permanently** to keep one as a saved Playground.
-->

Autosaved Playground হলো পুনরুদ্ধারের পয়েন্ট। Playground সর্বোচ্চ পাঁচটি সাম্প্রতিক
autosave রাখে। কোনোটি সংরক্ষিত Playground হিসেবে রাখতে **Store permanently** ব্যবহার
করুন।

<!--
## Change site settings
-->

## সাইট সেটিংস পরিবর্তন করুন

<!--
Open **Site Settings** to change runtime and WordPress setup options.
-->

রানটাইম ও ওয়ার্ডপ্রেস সেটআপের বিকল্প পরিবর্তন করতে **Site Settings** খুলুন।

<!--
![The Site Settings pane](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-site-settings.webp)
-->

![Site Settings পেন](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-site-settings.webp)

<!--
PHP version and networking can be applied to an existing stored Playground. WordPress version, language, and multisite change the WordPress installation itself, so they require a fresh Playground.
-->

বর্তমান সংরক্ষিত Playground-এ PHP সংস্করণ ও নেটওয়ার্কিং প্রয়োগ করা যায়। ওয়ার্ডপ্রেস
সংস্করণ, ভাষা ও মাল্টিসাইট ওয়ার্ডপ্রেস ইনস্টলেশন বদলায়, তাই এগুলোর জন্য নতুন Playground
প্রয়োজন।

<!--
Running an edited Blueprint keeps stored and autosaved Playgrounds. It discards a temporary Playground because the new run starts from a fresh setup.
-->

সম্পাদিত Blueprint চালালে সংরক্ষিত ও autosaved Playground অক্ষত থাকে। নতুন রানটি
একটি পরিষ্কার সেটআপ থেকে শুরু হওয়ায় অস্থায়ী Playground বাদ পড়ে।

<!--
## Inspect the current Blueprint
-->

## বর্তমান Blueprint পরিদর্শন করুন

<!--
Open **Blueprint** to view and edit the Blueprint for the current Playground.
-->

বর্তমান Playground-এর Blueprint দেখতে ও সম্পাদনা করতে **Blueprint** খুলুন।

<!--
![The Blueprint editor pane](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-current-blueprint.webp)
-->

![Blueprint editor পেন](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-current-blueprint.webp)

<!--
The editor can run the edited Blueprint in a new Playground. For a stored or autosaved Playground, the original Playground remains available in **Your Playgrounds**.
-->

এডিটরটি সম্পাদিত Blueprint নতুন Playground-এ চালাতে পারে। সংরক্ষিত বা autosaved
Playground হলে মূল Playground **Your Playgrounds**-এ পাওয়া যাবে।

<!--
## Inspect files, database, and logs
-->

## ফাইল, ডেটাবেস ও লগ পরিদর্শন করুন

<!--
Open **Files** to browse and edit the current Playground files.
-->

বর্তমান Playground-এর ফাইল ব্রাউজ ও সম্পাদনা করতে **Files** খুলুন।

<!--
![The Files pane with a WordPress file selected](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/files.webp)
-->

![একটি ওয়ার্ডপ্রেস ফাইল নির্বাচিত Files পেন](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/files.webp)

<!--
Open **Database** to use database tools or download the SQLite database.
-->

ডেটাবেস টুল ব্যবহার করতে বা SQLite ডেটাবেস ডাউনলোড করতে **Database** খুলুন।

<!--
![The Database pane](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/database.webp)
-->

![Database পেন](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/database.webp)

<!--
Open **Logs** to inspect PHP errors, warnings, and notices.
-->

PHP-এর ত্রুটি, সতর্কতা ও নোটিশ দেখতে **Logs** খুলুন।

<!--
![The PHP error log pane](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/logs.webp)
-->

![PHP error log পেন](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/logs.webp)

<!--
## Export and share {#playground-options-menu}
-->

## এক্সপোর্ট ও শেয়ার করুন {#playground-options-menu}

<!--
Open **Export** to download or share the current Playground.
-->

বর্তমান Playground ডাউনলোড বা শেয়ার করতে **Export** খুলুন।

<!--
![The Export pane with Download as .zip highlighted](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/export-playground.webp)
-->

![Download as .zip হাইলাইট করা Export পেন](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/export-playground.webp)

<!--
**Download as .zip** exports the current files, database, plugins, themes, uploads, and edits. The ZIP can be restored later with **New → Import zip**.
-->

**Download as .zip** বর্তমান ফাইল, ডেটাবেস, প্লাগইন, থিম, আপলোড ও সম্পাদনা এক্সপোর্ট
করে। ZIP-টি পরে **New → Import zip** দিয়ে পুনরুদ্ধার করা যায়।

<!--
**Copy original setup link** copies a link that recreates only the original
setup. It does not include edits made after the Playground started.
-->

**Copy original setup link** শুধু মূল সেটআপ পুনর্নির্মাণের একটি লিংক কপি করে। Playground
শুরু হওয়ার পরের সম্পাদনা এতে থাকে না।

<!--
**Export to GitHub** can create a pull request with selected files from the current Playground.
-->

**Export to GitHub** বর্তমান Playground থেকে নির্বাচিত ফাইল নিয়ে একটি পুল রিকোয়েস্ট
তৈরি করতে পারে।

<!--
## Change the Dock layout
-->

## Dock-এর লেআউট পরিবর্তন করুন

<!--
The Dock can be shown as a floating panel or full-width bar. Use **Full width** to switch layouts.
-->

Dock-কে ভাসমান প্যানেল বা পূর্ণ-প্রস্থের বার হিসেবে দেখানো যায়। লেআউট পরিবর্তন করতে
**Full width** ব্যবহার করুন।

<!--
| Floating                                                   | Full width                                                    |
| ---------------------------------------------------------- | ------------------------------------------------------------- |
| ![The default floating Dock](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-overview.webp) | ![The full-width Dock layout](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-full-width.webp) |
-->

| ভাসমান                                                                                                                                                         | পূর্ণ প্রস্থ                                                                                                                                                            |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ![ডিফল্ট ভাসমান Dock](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-overview.webp) | ![পূর্ণ-প্রস্থের Dock লেআউট](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-full-width.webp) |

<!--
Use **Hide tools** to collapse the Dock to its address field and save status.
Use **Show tools** to reopen the tool row.
-->

Dock-কে শুধু ঠিকানা ফিল্ড ও সংরক্ষণের স্ট্যাটাসে সংকুচিত করতে **Hide tools** ব্যবহার
করুন। টুলের সারি আবার খুলতে **Show tools** ব্যবহার করুন।

<!--
![The Playground with Dock tools hidden](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-hidden-tools.webp)
-->

![Dock-এর টুল লুকানো Playground](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-hidden-tools.webp)

<!--
You can drag the floating Dock on desktop. Drag it past the left or right edge
to fold it into a corner launcher, then click the launcher to restore the Dock.
-->

ডেস্কটপে ভাসমান Dock টেনে সরানো যায়। এটিকে বাম বা ডান প্রান্তের বাইরে টেনে কোণের
launcher-এ ভাঁজ করুন, তারপর Dock ফিরিয়ে আনতে launcher-এ ক্লিক করুন।

<!--
![The Dock folded into the corner launcher](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-corner-launcher.webp)
-->

![কোণের launcher-এ ভাঁজ করা Dock](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-corner-launcher.webp)

<!--
On narrow screens, the Dock uses a full-width mobile layout.
-->

সরু স্ক্রিনে Dock পূর্ণ-প্রস্থের মোবাইল লেআউট ব্যবহার করে।

<!--
![The Dock on a mobile viewport](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-mobile.webp)
-->

![মোবাইল ভিউপোর্টে Dock](https://raw.githubusercontent.com/WordPress/wordpress-playground/refs/heads/trunk/packages/docs/site/static/img/dock/dock-mobile.webp)

<div class="callout callout-warning">

<!--
The site at https://playground.wordpress.net is there to support the community, but there are no guarantees it will continue to work if the traffic grows significantly.
-->

https://playground.wordpress.net সাইটটি কমিউনিটিকে সহায়তা করার জন্য আছে, কিন্তু ট্রাফিক
উল্লেখযোগ্যভাবে বৃদ্ধি পেলে এটি কাজ চালিয়ে যাবে কিনা তার কোনো নিশ্চয়তা নেই।

<!--
If you need certain availability, you should [host your own WordPress Playground](/developers/architecture/host-your-own-playground).
-->

যদি আপনার নিশ্চিত প্রাপ্যতার প্রয়োজন হয়, তবে আপনার
[নিজস্ব ওয়ার্ডপ্রেস প্লেগ্রাউন্ড হোস্ট](/developers/architecture/host-your-own-playground)
করা উচিত।

</div>
