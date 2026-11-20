---
title: ব্লুপ্রিন্ট বান্ডেল
slug: /blueprints/bundles
description: ব্লুপ্রিন্ট বান্ডেল সম্পর্কে জানুন, স্বয়ংসম্পূর্ণ প্যাকেজ যা একটি blueprint.json ফাইল এবং এর সমস্ত প্রয়োজনীয় রিসোর্স অন্তর্ভুক্ত করে।
---

# ব্লুপ্রিন্ট বান্ডেল

ব্লুপ্রিন্ট বান্ডেল হল স্বয়ংসম্পূর্ণ প্যাকেজ যা একটি ব্লুপ্রিন্ট ডিক্লারেশন (`blueprint.json`) এবং এটি কম্পাইল এবং চালানোর জন্য প্রয়োজনীয় সমস্ত অতিরিক্ত রিসোর্স অন্তর্ভুক্ত করে। এটি সম্পূর্ণ WordPress Playground সেটআপ বিতরণ এবং শেয়ার করা সহজ করে তোলে।

## ব্লুপ্রিন্ট বান্ডেল কী?

একটি ব্লুপ্রিন্ট বান্ডেল হল ফাইলের একটি সংগ্রহ যাতে অন্তর্ভুক্ত থাকে:

1. একটি `blueprint.json` ফাইল যা ব্লুপ্রিন্ট কনফিগারেশন সংজ্ঞায়িত করে
2. ব্লুপ্রিন্ট দ্বারা রেফারেন্স করা যেকোনো অতিরিক্ত রিসোর্স (থিম, প্লাগইন, কন্টেন্ট ফাইল, ইত্যাদি)

ব্লুপ্রিন্ট বান্ডেল বিভিন্ন ফরম্যাটে বিতরণ করা যেতে পারে:

-   একটি শীর্ষ-স্তরের `blueprint.json` ফাইল এবং অতিরিক্ত রিসোর্স সহ একটি ZIP ফাইল
-   একটি git রিপোজিটরির ভিতরে একটি ডিরেক্টরি যেখানে `blueprint.json` অন্যান্য রিসোর্সের পাশাপাশি থাকে
-   আপনার কম্পিউটারে একটি লোকাল ডিরেক্টরি
-   প্রাসঙ্গিক ফাইল ইনলাইন করা একটি ইনলাইন JavaScript অবজেক্ট

## ব্লুপ্রিন্ট বান্ডেল ব্যবহার করা

### ওয়েবসাইটে

WordPress Playground ওয়েবসাইট `?blueprint-url=` কোয়েরি প্যারামিটারের মাধ্যমে ব্লুপ্রিন্ট বান্ডেল সমর্থন করে। আপনি আপনার ব্লুপ্রিন্ট বান্ডেল ধারণকারী একটি ZIP ফাইলের একটি URL প্রদান করতে পারেন:

```
https://playground.wordpress.net/?blueprint-url=https://example.com/my-blueprint-bundle.zip
```

ZIP ফাইলে রুট লেভেলে একটি `blueprint.json` ফাইল থাকা উচিত, ব্লুপ্রিন্ট দ্বারা রেফারেন্স করা যেকোনো অতিরিক্ত রিসোর্স সহ।

### CLI-তে

Playground CLI `--blueprint=` অপশনের মাধ্যমে ব্লুপ্রিন্ট বান্ডেল সমর্থন করে। আপনি প্রদান করতে পারেন:

-   একটি ব্লুপ্রিন্ট বান্ডেল ধারণকারী একটি লোকাল ডিরেক্টরির পাথ
-   একটি ব্লুপ্রিন্ট বান্ডেল ধারণকারী একটি লোকাল ZIP ফাইলের পাথ
-   একটি রিমোট ব্লুপ্রিন্ট বান্ডেলের একটি URL (http:// বা https://)

উদাহরণস্বরূপ:

```bash
# একটি লোকাল ZIP ফাইল ব্যবহার করে
npx @wp-playground/cli --blueprint=./my-blueprint.zip server

# একটি রিমোট URL ব্যবহার করে
npx @wp-playground/cli --blueprint=https://example.com/my-blueprint.zip server

# একটি লোকাল ডিরেক্টরি ব্যবহার করে
npx @wp-playground/cli --blueprint=./my-blueprint-directory server
```

ডিফল্টভাবে, CLI নিরাপত্তার কারণে লোকাল ফাইলে অ্যাক্সেস সীমাবদ্ধ করে। আপনার ব্লুপ্রিন্টের একই প্যারেন্ট ডিরেক্টরিতে ফাইল অ্যাক্সেস করার প্রয়োজন হলে, আপনাকে `--blueprint-may-read-adjacent-files` ফ্ল্যাগ ব্যবহার করে স্পষ্টভাবে অনুমতি দিতে হবে:

```bash
npx @wp-playground/cli --blueprint=./my-blueprint.json --blueprint-may-read-adjacent-files server
```

## ব্লুপ্রিন্ট বান্ডেল তৈরি করা

### মৌলিক কাঠামো

একটি মৌলিক ব্লুপ্রিন্ট বান্ডেল এরকম দেখতে পারে:

```
my-blueprint-bundle/
├── blueprint.json
├── theme.zip
├── plugin.zip
└── content/
    └── sample-content.wxr
```

### বান্ডেল করা রিসোর্স সহ উদাহরণ ব্লুপ্রিন্ট

এখানে একটি `blueprint.json` ফাইলের একটি উদাহরণ যা বান্ডেল করা রিসোর্স রেফারেন্স করে:


```json
{
	"landingPage": "/my-file.txt",
	"steps": [
		{
			"step": "writeFile",
			"path": "/wordpress/my-file.txt",
			"data": {
				"resource": "bundled",
				"path": "/bundled-text-file.txt"
			}
		},
		{
			"step": "installTheme",
			"themeData": {
				"resource": "bundled",
				"path": "/theme.zip"
			}
		},
		{
			"step": "installPlugin",
			"pluginData": {
				"resource": "bundled",
				"path": "/plugin.zip"
			}
		},
		{
			"step": "importWxr",
			"file": {
				"resource": "bundled",
				"path": "/content/sample-content.wxr"
			}
		}
	]
}
```

এই উদাহরণে, ব্লুপ্রিন্ট বেশ কয়েকটি বান্ডেল করা রিসোর্স রেফারেন্স করে:

-   `/bundled-text-file.txt` এ একটি টেক্সট ফাইল
-   `/theme.zip` এ একটি থিম ZIP ফাইল
-   `/plugin.zip` এ একটি প্লাগইন ZIP ফাইল
-   `/content/sample-content.wxr` এ একটি WXR কন্টেন্ট ফাইল

### একটি ZIP বান্ডেল তৈরি করা

একটি ZIP বান্ডেল তৈরি করতে, আপনার `blueprint.json` এবং সমস্ত প্রয়োজনীয় রিসোর্স সহ একটি ডিরেক্টরি তৈরি করুন, তারপর এটি জিপ করুন:

```bash
# আপনার বান্ডেলের জন্য একটি ডিরেক্টরি তৈরি করুন
mkdir my-blueprint-bundle
cd my-blueprint-bundle

# আপনার blueprint.json তৈরি করুন এবং রিসোর্স যোগ করুন
# ...

# এটি জিপ করুন
zip -r ../my-blueprint-bundle.zip .
```

## ট্রাবলশুটিং

আপনি ব্লুপ্রিন্ট বান্ডেলের সাথে সমস্যার সম্মুখীন হলে:

1. নিশ্চিত করুন যে আপনার `blueprint.json` ফাইল আপনার ZIP ফাইলের রুট লেভেলে আছে
2. পরীক্ষা করুন যে আপনার বান্ডেল করা রিসোর্স রেফারেন্সের সমস্ত পাথ সঠিক
3. যাচাই করুন যে আপনার ZIP ফাইল সঠিকভাবে ফরম্যাট করা হয়েছে
4. CLI ব্যবহার করার সময়, পরীক্ষা করুন যে আপনার `--blueprint-may-read-adjacent-files` ফ্ল্যাগ প্রয়োজন কিনা
5. নিশ্চিত করুন যে সমস্ত প্রয়োজনীয় রিসোর্স বান্ডেলে অন্তর্ভুক্ত আছে
