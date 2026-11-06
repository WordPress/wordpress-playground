---
slug: /blueprints/steps/resources
description: "রিসোর্স রেফারেন্স" এর জন্য একটি প্রযুক্তিগত রেফারেন্স। থিম, প্লাগইন এবং কন্টেন্টের জন্য বাহ্যিক ফাইল কীভাবে ব্যবহার করবেন তা শিখুন।
---

# রিসোর্স রেফারেন্স

"রিসোর্স রেফারেন্স" আপনাকে ব্লুপ্রিন্টে বাহ্যিক ফাইল ব্যবহার করতে দেয়

:::info
ব্লুপ্রিন্ট স্টেপ যেমন [`installPlugin`](/blueprints/steps#InstallPluginStep) বা [`installTheme`](/blueprints/steps#InstallThemeStep) এর জন্য ইনস্টল করার জন্য প্লাগইন বা থিমের একটি অবস্থান প্রয়োজন।

সেই অবস্থানটি থিম বা প্লাগইন ধারণকারী `.zip` ফাইলের [একটি `URL` রিসোর্স](#urlreference) হিসাবে সংজ্ঞায়িত করা যেতে পারে। এটি অফিসিয়াল WordPress ডিরেক্টরিতে প্রকাশিত সেই প্লাগইন/থিমগুলির জন্য একটি [`wordpress.org/plugins`](#corepluginreference) বা [`wordpress.org/themes`](#corethemereference) রিসোর্স হিসাবেও সংজ্ঞায়িত করা যেতে পারে।
:::

নিম্নলিখিত রিসোর্স রেফারেন্স উপলব্ধ:

import TOCInline from '@theme/TOCInline';

<TOCInline toc={toc} />

### URLReference

`URLReference` রিসোর্স একটি রিমোট সার্ভারে সংরক্ষিত ফাইল রেফারেন্স করতে ব্যবহৃত হয়। `URLReference` রিসোর্স নিম্নরূপ সংজ্ঞায়িত করা হয়:

```typescript
type URLReference = {
	resource: 'url';
	url: string;
};
```

`URLReference` রিসোর্স ব্যবহার করতে, আপনাকে ফাইলের URL প্রদান করতে হবে। উদাহরণস্বরূপ, একটি রিমোট সার্ভারে সংরক্ষিত "index.html" নামের একটি ফাইল রেফারেন্স করতে, আপনি নিম্নরূপ একটি `URLReference` তৈরি করতে পারেন:

```json
{
	"resource": "url",
	"url": "https://example.com/index.html"
}
```

রিসোর্স `url` টাইপ ব্লুপ্রিন্ট স্টেপ যেমন [`installPlugin`](/blueprints/steps#InstallPluginStep) বা
[`installTheme`](/blueprints/steps#InstallThemeStep) এর সাথে সত্যিই ভালভাবে কাজ করে।
এই স্টেপগুলির জন্য ইনস্টল করার জন্য প্লাগইন বা থিমের অবস্থান সংজ্ঞায়িত করতে একটি `ResourceType` প্রয়োজন।

একটি `"resource": "url"` দিয়ে আমরা একটি URL এর মাধ্যমে প্লাগইন/থিম ধারণকারী একটি `.zip` এর অবস্থান সংজ্ঞায়িত করতে পারি যা সরাসরি একটি GitHub রিপোতে নির্দেশ করতে পারে।

:::tip
Playground প্রজেক্ট একটি [GitHub Proxy](https://playground.wordpress.net/proxy) প্রদান করে যা আপনাকে আপনার প্লাগইন বা থিম ধারণকারী একটি রিপোজিটরি (বা এমনকি একটি রিপোর ভিতরে একটি ফোল্ডার) থেকে একটি `.zip` তৈরি করতে দেয়। এই টুলটি CORS সমস্যা এড়ানোর জন্য অন্যান্যদের মধ্যে খুব উপযোগী।
:::

### GitDirectoryReference

`GitDirectoryReference` রিসোর্স একটি Git রিপোজিটরির ভিতরে একটি ডিরেক্টরি রেফারেন্স করতে ব্যবহৃত হয়। এটি উপযোগী যখন একটি প্লাগইন বা থিম একটি রিপোর একটি সাবফোল্ডারে থাকে, বা যখন আপনি একটি নির্দিষ্ট ব্রাঞ্চ, ট্যাগ বা কমিট থেকে ইনস্টল করতে চান।

```typescript
type GitDirectoryReference = {
	resource: 'git:directory';
	url: string; // Repository URL (https://, ssh git@..., etc.)
	path?: string; // Optional subdirectory inside the repository
	ref?: string; // Branch, tag, or commit SHA (defaults to HEAD)
	refType?: 'branch' | 'tag' | 'commit'; // Hint for resolving the ref
	'.git'?: boolean; // Experimental: include a .git directory with fetched metadata
};
```

**উদাহরণ:**

```json
{
	"step": "installPlugin",
	"pluginData": {
		"resource": "git:directory",
		"url": "https://github.com/WordPress/block-development-examples",
		"ref": "HEAD",
		"path": "plugins/data-basics-59c8f8"
	},
	"options": {
		"activate": true,
		"targetFolderName": "data-basics"
	}
}
```

**নোট:**

- `ref` এর জন্য একটি ব্রাঞ্চ বা ট্যাগ নাম ব্যবহার করার সময়, আপনাকে অবশ্যই `refType` নির্দিষ্ট করতে হবে (যেমন `"refType": "branch"`)। এটি ছাড়া, শুধুমাত্র `HEAD` নির্ভরযোগ্যভাবে সমাধান করা হয়।
- Playground স্বয়ংক্রিয়ভাবে GitHub এবং GitLab এর মতো প্রদানকারী সনাক্ত করে।
- এটি CORS-প্রক্সিড ফেচ এবং স্পার্স চেকআউট পরিচালনা করে, তাই আপনি নির্দিষ্ট সাবডিরেক্টরি বা ব্রাঞ্চে নির্দেশ করে এমন URL ব্যবহার করতে পারেন।
- এই রিসোর্স [`installPlugin`](/blueprints/steps#InstallPluginStep) এবং [`installTheme`](/blueprints/steps#InstallThemeStep) এর মতো স্টেপের সাথে ব্যবহার করা যেতে পারে।
- নির্বাচিত ref এর একটি শ্যালো ক্লোন মিরর করে এমন প্যাকফাইল এবং refs ধারণকারী একটি `.git` ফোল্ডার অন্তর্ভুক্ত করতে `".git": true` সেট করুন।
- ফোল্ডারের নাম ডিফল্টভাবে URL থেকে উদ্ভূত হয় (যেমন `https-github-com-WordPress-block-development-examples-HEAD-at-plugins-data-basics-59c8f8`)। এটি ওভাররাইড করতে স্টেপে `options.targetFolderName` ব্যবহার করুন, যেমন উপরের উদাহরণে দেখানো হয়েছে।


### CoreThemeReference

_CoreThemeReference_ রিসোর্স WordPress কোর থিম রেফারেন্স করতে ব্যবহৃত হয়। _CoreThemeReference_ রিসোর্স নিম্নরূপ সংজ্ঞায়িত করা হয়:

```typescript
type CoreThemeReference = {
	resource: 'wordpress.org/themes';
	slug: string;
	version?: string;
};
```

_CoreThemeReference_ রিসোর্স ব্যবহার করতে, আপনাকে থিমের slug প্রদান করতে হবে। উদাহরণস্বরূপ, "Twenty Twenty-One" থিম রেফারেন্স করতে, আপনি নিম্নরূপ একটি _CoreThemeReference_ তৈরি করতে পারেন:

```json
{
	"resource": "wordpress.org/themes",
	"slug": "twentytwentyone"
}
```

### CorePluginReference

_CorePluginReference_ রিসোর্স WordPress কোর প্লাগইন রেফারেন্স করতে ব্যবহৃত হয়। _CorePluginReference_ রিসোর্স নিম্নরূপ সংজ্ঞায়িত করা হয়:

```typescript
type CorePluginReference = {
	resource: 'wordpress.org/plugins';
	slug: string;
	version?: string;
};
```

_CorePluginReference_ রিসোর্স ব্যবহার করতে, আপনাকে প্লাগইনের slug প্রদান করতে হবে। উদাহরণস্বরূপ, "Akismet" প্লাগইন রেফারেন্স করতে, আপনি নিম্নরূপ একটি _CorePluginReference_ তৈরি করতে পারেন:

```json
{
	"resource": "wordpress.org/plugins",
	"slug": "akismet"
}
```

### VFSReference

_VFSReference_ রিসোর্স একটি ভার্চুয়াল ফাইল সিস্টেম (VFS) এ সংরক্ষিত ফাইল রেফারেন্স করতে ব্যবহৃত হয়। VFS হল একটি ফাইল সিস্টেম যা মেমরিতে সংরক্ষিত থাকে এবং অপারেটিং সিস্টেমের ফাইল সিস্টেমের অংশ নয় এমন ফাইল সংরক্ষণ করতে ব্যবহার করা যেতে পারে। _VFSReference_ রিসোর্স নিম্নরূপ সংজ্ঞায়িত করা হয়:

```typescript
type VFSReference = {
	resource: 'vfs';
	path: string;
};
```

_VFSReference_ রিসোর্স ব্যবহার করতে, আপনাকে VFS-এ ফাইলের পাথ প্রদান করতে হবে। উদাহরণস্বরূপ, VFS-এর রুটে সংরক্ষিত "index.html" নামের একটি ফাইল রেফারেন্স করতে, আপনি নিম্নরূপ একটি _VFSReference_ তৈরি করতে পারেন:

```json
{
	"resource": "vfs",
	"path": "/index.html"
}
```

### LiteralReference

_LiteralReference_ রিসোর্স কোডে লিটারাল হিসাবে সংরক্ষিত ফাইল রেফারেন্স করতে ব্যবহৃত হয়। _LiteralReference_ রিসোর্স নিম্নরূপ সংজ্ঞায়িত করা হয়:

```typescript
type LiteralReference = {
	resource: 'literal';
	name: string;
	contents: string | Uint8Array;
};
```

_LiteralReference_ রিসোর্স ব্যবহার করতে, আপনাকে ফাইলের নাম এবং এর কন্টেন্ট প্রদান করতে হবে। উদাহরণস্বরূপ, "Hello, World!" টেক্সট ধারণকারী "index.html" নামের একটি ফাইল রেফারেন্স করতে, আপনি নিম্নরূপ একটি _LiteralReference_ তৈরি করতে পারেন:

```json
{
	"resource": "literal",
	"name": "index.html",
	"contents": "Hello, World!"
}
```

### BundledReference

`BundledReference` রিসোর্স ব্লুপ্রিন্টের সাথে বান্ডেল করা ফাইল রেফারেন্স করতে ব্যবহৃত হয়। এটি বিশেষভাবে স্বয়ংসম্পূর্ণ ব্লুপ্রিন্ট বান্ডেল তৈরি করার জন্য উপযোগী যা সমস্ত প্রয়োজনীয় রিসোর্স অন্তর্ভুক্ত করে। `BundledReference` রিসোর্স নিম্নরূপ সংজ্ঞায়িত করা হয়:

```typescript
type BundledReference = {
	resource: 'bundled';
	path: string;
};
```

`BundledReference` রিসোর্স ব্যবহার করতে, আপনাকে বান্ডেলের মধ্যে ফাইলের আপেক্ষিক পাথ প্রদান করতে হবে। উদাহরণস্বরূপ, ব্লুপ্রিন্টের সাথে বান্ডেল করা "plugin.php" নামের একটি ফাইল রেফারেন্স করতে, আপনি নিম্নরূপ একটি `BundledReference` তৈরি করতে পারেন:

```json
{
	"resource": "bundled",
	"path": "plugin.php"
}
```

ব্লুপ্রিন্ট বান্ডেল বিভিন্ন ফরম্যাটে বিতরণ করা যেতে পারে, যার মধ্যে রয়েছে:

- একটি শীর্ষ-স্তরের `blueprint.json` ফাইল সহ ZIP ফাইল
- একটি `blueprint.json` ফাইল এবং সম্পর্কিত রিসোর্স ধারণকারী ডিরেক্টরি
- রিমোট URL যেখানে ব্লুপ্রিন্ট এবং এর রিসোর্স একসাথে হোস্ট করা হয়

ব্লুপ্রিন্ট বান্ডেল সম্পর্কে আরও তথ্যের জন্য, [Blueprint Bundles](/blueprints/bundles) ডকুমেন্টেশন দেখুন।
