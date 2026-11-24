---
title: ব্লুপ্রিন্ট বান্ডেল
slug: /blueprints/bundles
description: ব্লুপ্রিন্ট বান্ডেল সম্পর্কে জানুন, স্বয়ংসম্পূর্ণ প্যাকেজ যা একটি blueprint.json ফাইল এবং এর সমস্ত প্রয়োজনীয় রিসোর্স অন্তর্ভুক্ত করে।
---

<!--
# Blueprint Bundles
-->

# ব্লুপ্রিন্ট বান্ডেল

<!--
Blueprint bundles are self-contained packages that include a Blueprint declaration (`blueprint.json`) along with all the additional resources required to compile and run it. This makes it easier to distribute and share complete WordPress Playground setups.
-->

ব্লুপ্রিন্ট বান্ডেল হল স্বয়ংসম্পূর্ণ প্যাকেজ যা একটি ব্লুপ্রিন্ট ডিক্লারেশন (`blueprint.json`) এবং এটি কম্পাইল এবং চালানোর জন্য প্রয়োজনীয় সমস্ত অতিরিক্ত রিসোর্স অন্তর্ভুক্ত করে। এটি সম্পূর্ণ WordPress Playground সেটআপ বিতরণ এবং শেয়ার করা সহজ করে তোলে।

<!--
## What are Blueprint Bundles?
-->

## ব্লুপ্রিন্ট বান্ডেল কী?

<!--
A Blueprint bundle is a collection of files that includes:
-->

একটি ব্লুপ্রিন্ট বান্ডেল হল ফাইলের একটি সংগ্রহ যাতে অন্তর্ভুক্ত থাকে:

<!--
1. A `blueprint.json` file that defines the Blueprint configuration
2. Any additional resources referenced by the Blueprint (themes, plugins, content files, etc.)
-->

1. একটি `blueprint.json` ফাইল যা ব্লুপ্রিন্ট কনফিগারেশন সংজ্ঞায়িত করে
2. ব্লুপ্রিন্ট দ্বারা রেফারেন্স করা যেকোনো অতিরিক্ত রিসোর্স (থিম, প্লাগইন, কন্টেন্ট ফাইল, ইত্যাদি)

<!--
Blueprint bundles can be distributed in various formats:
-->

ব্লুপ্রিন্ট বান্ডেল বিভিন্ন ফরম্যাটে বিতরণ করা যেতে পারে:

<!--
- A ZIP file with a top-level `blueprint.json` file and additional resources
- A directory inside a git repository where `blueprint.json` resides alongside other resources
- A local directory on your computer
- An inline JavaScript object with the relevant files inlined
-->

-   একটি শীর্ষ-স্তরের `blueprint.json` ফাইল এবং অতিরিক্ত রিসোর্স সহ একটি ZIP ফাইল
-   একটি git রিপোজিটরির ভিতরে একটি ডিরেক্টরি যেখানে `blueprint.json` অন্যান্য রিসোর্সের পাশাপাশি থাকে
-   আপনার কম্পিউটারে একটি লোকাল ডিরেক্টরি
-   প্রাসঙ্গিক ফাইল ইনলাইন করা একটি ইনলাইন JavaScript অবজেক্ট

<!--
## Using Blueprint Bundles
-->

## ব্লুপ্রিন্ট বান্ডেল ব্যবহার করা

<!--
### On the Website
-->

### ওয়েবসাইটে

<!--
The WordPress Playground website supports Blueprint bundles through **New → Blueprint URL** in the Dock or through the `?blueprint-url=` query parameter. You can provide a URL to a ZIP file containing your Blueprint bundle:
-->

WordPress Playground ওয়েবসাইটে Dock-এর **New → Blueprint URL** থেকে অথবা `?blueprint-url=` কোয়েরি প্যারামিটার দিয়ে ব্লুপ্রিন্ট বান্ডেল লোড করতে পারেন। আপনার ব্লুপ্রিন্ট বান্ডেল যে ZIP ফাইলে আছে, সেটির URL দিন।

```
https://playground.wordpress.net/?blueprint-url=https://example.com/my-blueprint-bundle.zip
```

<!--
The ZIP file should contain a `blueprint.json` file at the root level, along with any additional resources referenced by the Blueprint.
-->

ZIP ফাইলে রুট লেভেলে একটি `blueprint.json` ফাইল থাকা উচিত, ব্লুপ্রিন্ট দ্বারা রেফারেন্স করা যেকোনো অতিরিক্ত রিসোর্স সহ।

<!--
### In the CLI
-->

### CLI-তে

<!--
The Playground CLI supports Blueprint bundles through the `--blueprint=` option. You can provide:
-->

Playground CLI `--blueprint=` অপশনের মাধ্যমে ব্লুপ্রিন্ট বান্ডেল সমর্থন করে। আপনি প্রদান করতে পারেন:

<!--
- A path to a local directory containing a Blueprint bundle
- A path to a local ZIP file containing a Blueprint bundle
- A URL to a remote Blueprint bundle (http:// or https://)
-->

-   একটি ব্লুপ্রিন্ট বান্ডেল ধারণকারী একটি লোকাল ডিরেক্টরির পাথ
-   একটি ব্লুপ্রিন্ট বান্ডেল ধারণকারী একটি লোকাল ZIP ফাইলের পাথ
-   একটি রিমোট ব্লুপ্রিন্ট বান্ডেলের একটি URL (http:// বা https://)

<!--
For example:
-->

উদাহরণস্বরূপ:

```bash
# একটি লোকাল ZIP ফাইল ব্যবহার করে
npx @wp-playground/cli --blueprint=./my-blueprint.zip server

# একটি রিমোট URL ব্যবহার করে
npx @wp-playground/cli --blueprint=https://example.com/my-blueprint.zip server

# একটি লোকাল ডিরেক্টরি ব্যবহার করে
npx @wp-playground/cli --blueprint=./my-blueprint-directory server
```

<!--
By default, the CLI restricts access to local files for security reasons. If your Blueprint needs to access files in the same parent directory, you need to explicitly grant permission using the `--blueprint-may-read-adjacent-files` flag:
-->

ডিফল্টভাবে, CLI নিরাপত্তার কারণে লোকাল ফাইলে অ্যাক্সেস সীমাবদ্ধ করে। আপনার ব্লুপ্রিন্টের একই প্যারেন্ট ডিরেক্টরিতে ফাইল অ্যাক্সেস করার প্রয়োজন হলে, আপনাকে `--blueprint-may-read-adjacent-files` ফ্ল্যাগ ব্যবহার করে স্পষ্টভাবে অনুমতি দিতে হবে:

```bash
npx @wp-playground/cli --blueprint=./my-blueprint.json --blueprint-may-read-adjacent-files server
```

<!--
## Creating Blueprint Bundles
-->

## ব্লুপ্রিন্ট বান্ডেল তৈরি করা

<!--
### Basic Structure
-->

### মৌলিক কাঠামো

<!--
A basic Blueprint bundle might look like this:
-->

একটি মৌলিক ব্লুপ্রিন্ট বান্ডেল এরকম দেখতে পারে:

```
my-blueprint-bundle/
├── blueprint.json
├── theme.zip
├── plugin.zip
└── content/
    └── sample-content.wxr
```

<!--
### Example Blueprint with Bundled Resources
-->

### বান্ডেল করা রিসোর্স সহ উদাহরণ ব্লুপ্রিন্ট

<!--
Here's an example of a `blueprint.json` file that references bundled resources:
-->

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

<!--
In this example, the Blueprint references several bundled resources:
-->

এই উদাহরণে, ব্লুপ্রিন্ট বেশ কয়েকটি বান্ডেল করা রিসোর্স রেফারেন্স করে:

<!--
- A text file at `/bundled-text-file.txt`
- A theme ZIP file at `/theme.zip`
- A plugin ZIP file at `/plugin.zip`
- A WXR content file at `/content/sample-content.wxr`
-->

-   `/bundled-text-file.txt` এ একটি টেক্সট ফাইল
-   `/theme.zip` এ একটি থিম ZIP ফাইল
-   `/plugin.zip` এ একটি প্লাগইন ZIP ফাইল
-   `/content/sample-content.wxr` এ একটি WXR কন্টেন্ট ফাইল

<!--
### Creating a ZIP Bundle
-->

### একটি ZIP বান্ডেল তৈরি করা

<!--
To create a ZIP bundle, simply create a directory with your `blueprint.json` and all required resources, then zip it up:
-->

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

<!--
## ZIP File Structure Flexibility
-->

## ZIP ফাইলের সমর্থিত কাঠামো {#zip-file-structure-flexibility}

<!--
Blueprint bundles support `blueprint.json` at two locations within a ZIP file:
-->

ব্লুপ্রিন্ট বান্ডেলের ZIP ফাইলের দুটি অবস্থানে `blueprint.json` রাখা যায়।

<!--
1. **Root level** (standard): `blueprint.json` sits directly at the ZIP root
2. **One directory deep**: `blueprint.json` sits inside a single top-level directory
-->

1. **রুট লেভেলে** (প্রচলিত কাঠামো)। `blueprint.json` সরাসরি ZIP ফাইলের রুটে থাকে।
2. **এক স্তর ভেতরে**। `blueprint.json` একটি শীর্ষ-স্তরের ডিরেক্টরির ভেতরে থাকে।

<!--
This means ZIP files created with macOS's right-click "Compress" feature (which wraps contents in a folder) work automatically. The `__MACOSX` metadata directory is ignored during detection.
-->

macOS-এ ডান ক্লিক করে **Compress** বেছে নিলে ফাইলগুলো একটি ফোল্ডারের ভেতরে রেখে ZIP তৈরি হয়। এই ZIP ফাইলগুলোও সরাসরি কাজ করে। `blueprint.json` খোঁজার সময় `__MACOSX` মেটাডেটা ডিরেক্টরিটি উপেক্ষা করা হয়।

<!--
**Example: Both of these ZIP structures work:**
-->

**উদাহরণ। নিচের দুটি ZIP কাঠামোই কাজ করে।**

```
# Structure A (root level)
my-bundle.zip/
├── blueprint.json
├── theme.zip
└── plugin.zip

# Structure B (one directory deep — macOS-style)
my-bundle.zip/
├── my-bundle/
│   ├── blueprint.json
│   ├── theme.zip
│   └── plugin.zip
└── __MACOSX/         ← ignored
```

<!--
If multiple top-level directories contain a `blueprint.json`, Playground returns an error to avoid ambiguity.
-->

একাধিক শীর্ষ-স্তরের ডিরেক্টরিতে `blueprint.json` থাকলে কোনটি ব্যবহার করতে হবে তা নির্ধারণ করা যায় না, তাই Playground একটি ত্রুটি দেখায়।

<!--
## Troubleshooting
-->

## ট্রাবলশুটিং

<!--
If you encounter issues with Blueprint bundles:
-->

আপনি ব্লুপ্রিন্ট বান্ডেলের সাথে সমস্যার সম্মুখীন হলে:

<!--
1. Ensure your `blueprint.json` file is at the root level of your ZIP file or inside a single top-level directory
2. Check that all paths in your bundled resource references are correct
3. Verify that your ZIP file is properly formatted
4. When using the CLI, check if you need the `--blueprint-may-read-adjacent-files` flag
5. Ensure all required resources are included in the bundle
-->

1. নিশ্চিত করুন যে `blueprint.json` ফাইলটি ZIP ফাইলের রুট লেভেলে অথবা একটি শীর্ষ-স্তরের ডিরেক্টরির ভেতরে আছে।
2. পরীক্ষা করুন যে আপনার বান্ডেল করা রিসোর্স রেফারেন্সের সমস্ত পাথ সঠিক
3. যাচাই করুন যে আপনার ZIP ফাইল সঠিকভাবে ফরম্যাট করা হয়েছে
4. CLI ব্যবহার করার সময়, পরীক্ষা করুন যে আপনার `--blueprint-may-read-adjacent-files` ফ্ল্যাগ প্রয়োজন কিনা
5. নিশ্চিত করুন যে সমস্ত প্রয়োজনীয় রিসোর্স বান্ডেলে অন্তর্ভুক্ত আছে
