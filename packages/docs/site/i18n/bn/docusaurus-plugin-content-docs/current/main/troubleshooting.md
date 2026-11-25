---
title: সমস্যা সমাধান
slug: /troubleshooting
description: বুট ফেইল, SQLite সমস্যা, ব্রাউজার স্টোরেজ এবং সংরক্ষিত প্লেগ্রাউন্ড পুনরুদ্ধার সহ সাধারণ ওয়ার্ডপ্রেস প্লেগ্রাউন্ড ওয়েবসাইট ত্রুটিগুলো নির্ণয় করুন।
---

<!--
# Troubleshooting WordPress Playground
-->

# ওয়ার্ডপ্রেস প্লেগ্রাউন্ড সমস্যা সমাধান

<!--
This page covers errors from the Playground website itself, saved Playgrounds,
browser storage, and WordPress boot. For Blueprint-specific errors, see
[Troubleshoot and debug Blueprints](/blueprints/troubleshoot-and-debug).
-->

এই পেজটি প্লেগ্রাউন্ড ওয়েবসাইট, সংরক্ষিত প্লেগ্রাউন্ড, ব্রাউজার স্টোরেজ এবং ওয়ার্ডপ্রেস বুট সংক্রান্ত ত্রুটিগুলো নিয়ে আলোচনা করে। ব্লুপ্রিন্ট-নির্দিষ্ট ত্রুটির জন্য, [ব্লুপ্রিন্ট সমস্যা সমাধান ও ডিবাগ করুন](/blueprints/troubleshoot-and-debug) দেখুন।

<!--
## Playground looks broken
-->

## প্লেগ্রাউন্ড ভেঙে যাওয়ার মতো দেখাচ্ছে

<!--
Try these first:
-->

প্রথমে এগুলো চেষ্টা করুন:

<!--
- Use the Playground **Refresh page** button instead of refreshing the browser tab. Browser refresh (Cmd+R or F5) starts the whole Playground app again.
- Open the same URL in a private window to rule out saved-site or browser-storage state.
- Disable browser extensions that block JavaScript, WebAssembly, storage, workers, or network requests.
- Check browser developer tools for Console and Network errors.
- If the URL includes `?site-slug=...`, try removing that query parameter to start a new autosaved Playground. Use `?storage=temp` when you need a truly temporary site.
-->

- ব্রাউজার ট্যাব রিফ্রেশ করার পরিবর্তে প্লেগ্রাউন্ডের **রিফ্রেশ পেজ** বাটন ব্যবহার করুন। ব্রাউজার রিফ্রেশ (Cmd+R বা F5) পুরো প্লেগ্রাউন্ড অ্যাপটি আবার শুরু করে।
- সংরক্ষিত-সাইট বা ব্রাউজার-স্টোরেজ স্টেট বাদ দিতে একই URL একটি প্রাইভেট উইন্ডোতে খুলুন।
- জাভাস্ক্রিপ্ট, ওয়েবঅ্যাসেম্বলি, স্টোরেজ, ওয়ার্কার বা নেটওয়ার্ক রিকোয়েস্ট ব্লক করে এমন ব্রাউজার এক্সটেনশনগুলো নিষ্ক্রিয় করুন।
- কনসোল এবং নেটওয়ার্ক ত্রুটির জন্য ব্রাউজার ডেভেলপার টুলস পরীক্ষা করুন।
- URL-এ যদি `?site-slug=...` থাকে, তবে একটি নতুন অটোসেভড প্লেগ্রাউন্ড শুরু করতে সেই কোয়েরি প্যারামিটারটি সরিয়ে ফেলার চেষ্টা করুন। সত্যিই অস্থায়ী সাইটের প্রয়োজন হলে `?storage=temp` ব্যবহার করুন।

<!--
## A clean site says the MySQL extension is missing
-->

## একটি ক্লিন সাইট বলছে MySQL এক্সটেনশন অনুপস্থিত

<!--
You may see a WordPress error page like this:
-->

আপনি এই রকম একটি ওয়ার্ডপ্রেস এরর পেজ দেখতে পারেন:

```text
Your PHP installation appears to be missing the MySQL extension which is required by WordPress.
```

<!--
In Playground, this usually means WordPress did not load the SQLite integration
that lets WordPress run without MySQL. Playground runs WordPress in WebAssembly
and uses SQLite instead of a MySQL server.
-->

প্লেগ্রাউন্ডে, এর সাধারণ অর্থ হলো ওয়ার্ডপ্রেস SQLite ইন্টিগ্রেশন লোড করেনি, যা ওয়ার্ডপ্রেসকে MySQL ছাড়া চালাতে দেয়। প্লেগ্রাউন্ড ওয়ার্ডপ্রেসকে ওয়েবঅ্যাসেম্বলিতে চালায় এবং MySQL সার্ভারের পরিবর্তে SQLite ব্যবহার করে।

<!--
Try these steps:
-->

এই ধাপগুলো চেষ্টা করুন:

<!--
- Start a fresh Playground at https://playground.wordpress.net/ to confirm the public site can boot.
- If the URL includes a saved site, remove `?site-slug=...` and load a new Playground. Add `?storage=temp` only when you need an ephemeral site.
- If this happened after importing a ZIP, confirm the import did not include a custom `wp-content/db.php` that overrides Playground's SQLite setup.
- If this happened in the CLI, do not use `--skip-sqlite-setup` unless you provide your own database integration.
- If this happened with a Blueprint, see the [Blueprint troubleshooting page](/blueprints/troubleshoot-and-debug).
-->

- পাবলিক সাইটটি বুট করতে পারে কিনা নিশ্চিত করতে https://playground.wordpress.net/ এ একটি নতুন প্লেগ্রাউন্ড শুরু করুন।
- URL-এ যদি একটি সংরক্ষিত সাইট থাকে, তাহলে `?site-slug=...` সরিয়ে একটি নতুন প্লেগ্রাউন্ড লোড করুন। শুধুমাত্র ক্ষণস্থায়ী সাইটের প্রয়োজন হলে `?storage=temp` যোগ করুন।
- জিপ ইম্পোর্ট করার পর যদি এটি ঘটে থাকে, তবে নিশ্চিত করুন যে ইম্পোর্টে প্লেগ্রাউন্ডের SQLite সেটআপকে ওভাররাইড করে এমন কোনো কাস্টম `wp-content/db.php` অন্তর্ভুক্ত ছিল না।
- CLI-তে এটি ঘটলে, আপনি নিজের ডেটাবেস ইন্টিগ্রেশন প্রদান না করা পর্যন্ত `--skip-sqlite-setup` ব্যবহার করবেন না।
- ব্লুপ্রিন্ট দিয়ে এটি ঘটলে, [ব্লুপ্রিন্ট সমস্যা সমাধান পেজ](/blueprints/troubleshoot-and-debug) দেখুন।

<!--
If you are writing a Blueprint and need to add the SQLite integration plugin,
`plugins` goes at the top level:
-->

আপনি যদি একটি ব্লুপ্রিন্ট লিখছেন এবং SQLite ইন্টিগ্রেশন প্লাগইন যোগ করার প্রয়োজন হয়, তবে `plugins` টপ লেভেলে রাখুন:

```json
{
	"preferredVersions": {
		"php": "8.3",
		"wp": "latest"
	},
	"plugins": ["sqlite-database-integration"],
	"steps": [
		{
			"step": "login",
			"username": "admin"
		}
	]
}
```

<!--
## Error connecting to the SQLite database
-->

## SQLite ডেটাবেসে সংযোগ করতে ত্রুটি

<!--
This means Playground loaded the SQLite integration, but WordPress still could
not connect to the database.
-->

এর অর্থ হলো প্লেগ্রাউন্ড SQLite ইন্টিগ্রেশন লোড করেছে, কিন্তু ওয়ার্ডপ্রেস তবুও ডেটাবেসের সাথে সংযোগ করতে পারেনি।

<!--
Common causes:
-->

সাধারণ কারণগুলো:

<!--
- A saved Playground's browser storage is stale or incomplete.
- An imported site ZIP contains an incompatible database file or database drop-in.
- A mounted local directory is missing files that WordPress needs.
- Browser storage was cleared, evicted, or blocked.
-->

- একটি সংরক্ষিত প্লেগ্রাউন্ডের ব্রাউজার স্টোরেজ পুরানো বা অসম্পূর্ণ।
- একটি ইম্পোর্ট করা সাইট জিপ-এ একটি অসামঞ্জস্যপূর্ণ ডেটাবেস ফাইল বা ডেটাবেস ড্রপ-ইন রয়েছে।
- একটি মাউন্ট করা লোকাল ডিরেক্টরিতে ওয়ার্ডপ্রেসের প্রয়োজনীয় ফাইল অনুপস্থিত।
- ব্রাউজার স্টোরেজ মুছে ফেলা হয়েছে, বাদ দেওয়া হয়েছে বা ব্লক করা হয়েছে।

<!--
Recommended recovery:
-->

প্রস্তাবিত পুনরুদ্ধার:

<!--
1. Start a fresh Playground without `site-slug`.
2. If the fresh site works, the issue is tied to the saved site or imported archive.
3. Export accessible files from the broken saved site using **Files**, **Export**, or a local directory copy, if available.
4. Re-import the site into a new Playground, or rebuild it from its Blueprint.
-->

1. `site-slug` ছাড়া একটি নতুন প্লেগ্রাউন্ড শুরু করুন।
2. নতুন সাইটটি কাজ করলে, সমস্যাটি সংরক্ষিত সাইট বা ইম্পোর্ট করা আর্কাইভের সাথে সম্পর্কিত।
3. সম্ভব হলে **ফাইল**, **এক্সপোর্ট** বা একটি লোকাল ডিরেক্টরি কপি ব্যবহার করে ভেঙে যাওয়া সংরক্ষিত সাইট থেকে অ্যাক্সেসযোগ্য ফাইলগুলো এক্সপোর্ট করুন।
4. সাইটটি একটি নতুন প্লেগ্রাউন্ডে পুনরায় ইম্পোর্ট করুন, অথবা এর ব্লুপ্রিন্ট থেকে পুনরায় তৈরি করুন।

<!--
## NotAllowedError
-->

## NotAllowedError

<!--
`NotAllowedError` usually means the browser blocked an operation that requires
user permission or a supported browser context. In Playground, this often
relates to saved sites or local directory access.
-->

`NotAllowedError` সাধারণত বোঝায় যে ব্রাউজারটি এমন একটি অপারেশন ব্লক করেছে যার জন্য ব্যবহারকারীর অনুমতি বা একটি সমর্থিত ব্রাউজার কনটেক্সট প্রয়োজন। প্লেগ্রাউন্ডে, এটি প্রায়শই সংরক্ষিত সাইট বা লোকাল ডিরেক্টরি অ্যাক্সেসের সাথে সম্পর্কিত।

<!--
You may see this exact message:
-->

আপনি এই সঠিক বার্তাটি দেখতে পারেন:

```text
The request is not allowed by the user agent or the platform in the current context.
```

<!--
Try:
-->

চেষ্টা করুন:

<!--
- Open Playground in a normal top-level browser tab, not inside a restricted iframe.
- Reopen the site from **Your Playgrounds** in the Dock.
- If the site used a local directory, Playground cannot currently re-select the directory after its saved permission expires. The files remain on disk; use them directly or recreate the Playground from an exported ZIP or Blueprint, if available.
- Confirm the browser supports the file or storage API being used. Chrome and Edge generally have the broadest local directory support.
- Check whether private browsing mode, enterprise policy, or browser settings block storage access.
-->

- প্লেগ্রাউন্ড একটি সাধারণ টপ-লেভেল ব্রাউজার ট্যাবে খুলুন, সীমাবদ্ধ iframe-এর ভিতরে নয়।
- ডকে **আপনার প্লেগ্রাউন্ডগুলো** থেকে সাইটটি আবার খুলুন।
- সাইটটি যদি একটি লোকাল ডিরেক্টরি ব্যবহার করে, তবে সংরক্ষিত অনুমতি মেয়াদ শেষ হওয়ার পরে প্লেগ্রাউন্ড বর্তমানে ডিরেক্টরিটি পুনরায় নির্বাচন করতে পারে না। ফাইলগুলো ডিস্কেই থাকে; সেগুলো সরাসরি ব্যবহার করুন বা সম্ভব হলে একটি এক্সপোর্ট করা জিপ বা ব্লুপ্রিন্ট থেকে প্লেগ্রাউন্ডটি পুনরায় তৈরি করুন।
- ব্রাউজারটি ব্যবহৃত ফাইল বা স্টোরেজ API সমর্থন করে কিনা নিশ্চিত করুন। ক্রোম এবং এজ সাধারণত সবচেয়ে বিস্তৃত লোকাল ডিরেক্টরি সাপোর্ট রাখে।
- প্রাইভেট ব্রাউজিং মোড, এন্টারপ্রাইজ পলিসি বা ব্রাউজার সেটিংস স্টোরেজ অ্যাক্সেস ব্লক করছে কিনা তা পরীক্ষা করুন।

<!--
## NoModificationAllowedError
-->

## NoModificationAllowedError

<!--
`NoModificationAllowedError` means the browser or filesystem refused a write.
This can happen when a saved local directory became read-only, permission was
lost, or browser storage is unavailable.
-->

`NoModificationAllowedError` মানে ব্রাউজার বা ফাইলসিস্টেম একটি রাইট প্রত্যাখ্যান করেছে। এটি ঘটতে পারে যখন একটি সংরক্ষিত লোকাল ডিরেক্টরি রিড-অনলি হয়ে যায়, অনুমতি হারিয়ে যায় বা ব্রাউজার স্টোরেজ অনুপলব্ধ থাকে।

<!--
You may see this exact message:
-->

আপনি এই সঠিক বার্তাটি দেখতে পারেন:

```text
An attempt was made to write to a file or directory which could not be modified due to the state of the underlying filesystem.
```

<!--
Try:
-->

চেষ্টা করুন:

<!--
- If the Playground still opens, use **Export → Download as .zip** before starting over.
- Check that the target folder still exists and is writable.
- Avoid system-protected folders or synced folders that temporarily lock files.
- Start a fresh Playground with `?storage=temp` if you only need a temporary test site.
- Use [Playground CLI](/developers/local-development/wp-playground-cli) for local development that needs reliable filesystem persistence.
-->

- প্লেগ্রাউন্ড যদি এখনও খোলে, তবে আবার শুরু করার আগে **এক্সপোর্ট → .zip হিসেবে ডাউনলোড করুন** ব্যবহার করুন।
- লক্ষ্য ফোল্ডারটি এখনও বিদ্যমান এবং রাইটযোগ্য কিনা পরীক্ষা করুন।
- সিস্টেম-সুরক্ষিত ফোল্ডার বা সিঙ্ক করা ফোল্ডার এড়িয়ে চলুন যা সাময়িকভাবে ফাইল লক করে।
- শুধুমাত্র একটি অস্থায়ী টেস্ট সাইটের প্রয়োজন হলে `?storage=temp` দিয়ে একটি নতুন প্লেগ্রাউন্ড শুরু করুন।
- নির্ভরযোগ্য ফাইলসিস্টেম পার্সিস্টেন্স প্রয়োজন এমন লোকাল ডেভেলপমেন্টের জন্য [প্লেগ্রাউন্ড CLI](/developers/local-development/wp-playground-cli) ব্যবহার করুন।

<!--
## Saved Playground cannot reload
-->

## সংরক্ষিত প্লেগ্রাউন্ড পুনরায় লোড হচ্ছে না

<!--
Saved Playgrounds are stored in browser storage or in a local directory you
selected. They are not hosted on a remote server.
-->

সংরক্ষিত প্লেগ্রাউন্ডগুলো ব্রাউজার স্টোরেজে বা আপনার নির্বাচিত একটি লোকাল ডিরেক্টরিতে সংরক্ষিত থাকে। এগুলো কোনো রিমোট সার্ভারে হোস্ট করা হয় না।

<!--
If a saved Playground cannot reload:
-->

যদি একটি সংরক্ষিত প্লেগ্রাউন্ড পুনরায় লোড না হয়:

<!--
- Confirm you are using the same browser and browser profile where it was saved.
- Check whether browser data was cleared or storage was disabled.
- If the site was saved to a local directory, confirm the directory still exists and has not moved.
- If the URL includes `?site-slug=...`, remove it to start a fresh autosaved Playground.
- Recreate the saved site from its original Blueprint or import ZIP if storage was lost.
-->

- নিশ্চিত করুন যে আপনি একই ব্রাউজার এবং ব্রাউজার প্রোফাইল ব্যবহার করছেন যেখানে এটি সংরক্ষিত হয়েছিল।
- ব্রাউজার ডেটা মুছে ফেলা হয়েছে বা স্টোরেজ নিষ্ক্রিয় করা হয়েছে কিনা পরীক্ষা করুন।
- সাইটটি যদি একটি লোকাল ডিরেক্টরিতে সংরক্ষিত থাকে, তবে নিশ্চিত করুন যে ডিরেক্টরিটি এখনও বিদ্যমান এবং স্থানান্তরিত হয়নি।
- URL-এ যদি `?site-slug=...` থাকে, তবে একটি নতুন অটোসেভড প্লেগ্রাউন্ড শুরু করতে এটি সরিয়ে ফেলুন।
- স্টোরেজ হারিয়ে গেলে মূল ব্লুপ্রিন্ট বা ইম্পোর্ট জিপ থেকে সংরক্ষিত সাইটটি পুনরায় তৈরি করুন।

<!--
## Browser storage and persistence
-->

## ব্রাউজার স্টোরেজ এবং পার্সিস্টেন্স

<!--
New Playgrounds are autosaved when browser storage and saving are available. Open **Your Playgrounds** in the Dock to recover recent autosaves or saved Playgrounds. Playground keeps up to five recent autosaves.
-->

ব্রাউজার স্টোরেজ এবং সেভিং উপলব্ধ থাকলে নতুন প্লেগ্রাউন্ডগুলো অটোসেভ হয়। সাম্প্রতিক অটোসেভ বা সংরক্ষিত প্লেগ্রাউন্ড পুনরুদ্ধার করতে ডকে **আপনার প্লেগ্রাউন্ডগুলো** খুলুন। প্লেগ্রাউন্ড সর্বোচ্চ পাঁচটি সাম্প্রতিক অটোসেভ রাখে।

<!--
Click the **Autosaved** or **Unsaved** status in the Dock to open the storage
choices. Select **Save in browser storage**, or select **Save in a local
directory** and choose a directory dedicated to that Playground before
clicking **Save**. Matching files in the directory may be overwritten. Use
**Export** to download a portable ZIP. A browser refresh can recover a stored
or autosaved Playground, but `?storage=temp` creates a temporary Playground
that is discarded on refresh or tab close.
-->

স্টোরেজ বিকল্পগুলো খুলতে ডকের **অটোসেভড** বা **আনসেভড** স্ট্যাটাসে ক্লিক করুন। **ব্রাউজার স্টোরেজে সংরক্ষণ করুন** নির্বাচন করুন, অথবা **একটি লোকাল ডিরেক্টরিতে সংরক্ষণ করুন** নির্বাচন করে **সংরক্ষণ করুন** ক্লিক করার আগে সেই প্লেগ্রাউন্ডের জন্য নিবেদিত একটি ডিরেক্টরি বেছে নিন। ডিরেক্টরিতে মিলে যাওয়া ফাইলগুলো ওভাররাইট হতে পারে। একটি পোর্টেবল জিপ ডাউনলোড করতে **এক্সপোর্ট** ব্যবহার করুন। ব্রাউজার রিফ্রেশ একটি সংরক্ষিত বা অটোসেভড প্লেগ্রাউন্ড পুনরুদ্ধার করতে পারে, কিন্তু `?storage=temp` একটি অস্থায়ী প্লেগ্রাউন্ড তৈরি করে যা রিফ্রেশ বা ট্যাব বন্ধ করার সময় বাদ দেওয়া হয়।

<!--
For longer-running local development, prefer the [Playground CLI](/developers/local-development/wp-playground-cli), which persists site files on disk.
-->

দীর্ঘমেয়াদী লোকাল ডেভেলপমেন্টের জন্য, [প্লেগ্রাউন্ড CLI](/developers/local-development/wp-playground-cli) ব্যবহার করা ভালো, যা সাইট ফাইলগুলো ডিস্কে সংরক্ষণ করে।

<!--
See [the Dock guide](/web-instance) for the current Dock destinations and export workflow.
-->

বর্তমান ডক ডেস্টিনেশন এবং এক্সপোর্ট ওয়ার্কফ্লোর জন্য [ডক গাইড](/web-instance) দেখুন।

<!--
## When to start fresh
-->

## কখন নতুন করে শুরু করবেন

<!--
Start a fresh Playground when:
-->

নিম্নলিখিত পরিস্থিতিতে একটি নতুন প্লেগ্রাউন্ড শুরু করুন:

<!--
- You only need to test whether the public Playground site is working.
- The URL points to a saved `site-slug` that no longer loads.
- You are debugging whether an error comes from Playground itself or from a plugin, theme, Blueprint, or imported site.
- Browser storage or local directory access is suspected to be broken.
-->

- আপনি শুধুমাত্র পাবলিক প্লেগ্রাউন্ড সাইটটি কাজ করছে কিনা তা পরীক্ষা করতে চান।
- URL-টি এমন একটি সংরক্ষিত `site-slug`-এর দিকে নির্দেশ করে যা আর লোড হচ্ছে না।
- আপনি ডিবাগ করছেন যে ত্রুটিটি প্লেগ্রাউন্ড থেকেই আসছে নাকি কোনো প্লাগইন, থিম, ব্লুপ্রিন্ট বা ইম্পোর্ট করা সাইট থেকে।
- ব্রাউজার স্টোরেজ বা লোকাল ডিরেক্টরি অ্যাক্সেস ভেঙে গেছে বলে সন্দেহ করা হচ্ছে।

<!--
Use this URL for a clean site:
-->

একটি ক্লিন সাইটের জন্য এই URL ব্যবহার করুন:

```text
https://playground.wordpress.net/
```

<!--
## Report a Playground issue
-->

## প্লেগ্রাউন্ড সমস্যা রিপোর্ট করুন

<!--
If the problem reproduces on a fresh Playground, please
[open an issue](https://github.com/WordPress/wordpress-playground/issues) and
include:
-->

সমস্যাটি যদি একটি নতুন প্লেগ্রাউন্ডেও ঘটে, তাহলে অনুগ্রহ করে [একটি ইস্যু খুলুন](https://github.com/WordPress/wordpress-playground/issues) এবং অন্তর্ভুক্ত করুন:

<!--
- The full Playground URL.
- The browser and operating system.
- Whether you used a saved site, imported ZIP, Blueprint, local directory, or CLI.
- The exact error name and message.
- Console and Network details from browser developer tools.
-->

- সম্পূর্ণ প্লেগ্রাউন্ড URL।
- ব্রাউজার এবং অপারেটিং সিস্টেম।
- আপনি একটি সংরক্ষিত সাইট, ইম্পোর্ট করা জিপ, ব্লুপ্রিন্ট, লোকাল ডিরেক্টরি বা CLI ব্যবহার করেছেন কিনা।
- সঠিক ত্রুটির নাম এবং বার্তা।
- ব্রাউজার ডেভেলপার টুলস থেকে কনসোল এবং নেটওয়ার্কের বিবরণ।
