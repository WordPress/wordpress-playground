---
slug: /blueprints/steps/resources
description: '"রিসোর্স রেফারেন্স" এর জন্য একটি প্রযুক্তিগত রেফারেন্স। থিম, প্লাগইন এবং কন্টেন্টের জন্য বাহ্যিক ফাইল কীভাবে ব্যবহার করবেন তা শিখুন।'
---

<!--
# Resources References
-->

# রিসোর্স রেফারেন্স

<!--
"Resource References" allow you use external files in Blueprints
-->

"রিসোর্স রেফারেন্স" আপনাকে ব্লুপ্রিন্টে বাহ্যিক ফাইল ব্যবহার করতে দেয়

:::info

<!--
Blueprint steps such as [`installPlugin`](/blueprints/steps) or [`installTheme`](/blueprints/steps) require a location of the plugin or theme to be installed.
-->

ব্লুপ্রিন্ট স্টেপ যেমন [`installPlugin`](/blueprints/steps#InstallPluginStep) বা [`installTheme`](/blueprints/steps#InstallThemeStep) এর জন্য ইনস্টল করার জন্য প্লাগইন বা থিমের একটি অবস্থান প্রয়োজন।

<!--
That location can be defined as [a `URL` resource](#urlreference) of the `.zip` file containing the theme or plugin. It can also be defined as a [`wordpress.org/plugins`](#corepluginreference) or [`wordpress.org/themes`](#corethemereference) resource for those plugins/themes published in the official WordPress directories.
-->

সেই অবস্থানটি থিম বা প্লাগইন ধারণকারী `.zip` ফাইলের [একটি `URL` রিসোর্স](#urlreference) হিসাবে সংজ্ঞায়িত করা যেতে পারে। এটি অফিসিয়াল WordPress ডিরেক্টরিতে প্রকাশিত সেই প্লাগইন/থিমগুলির জন্য একটি [`wordpress.org/plugins`](#corepluginreference) বা [`wordpress.org/themes`](#corethemereference) রিসোর্স হিসাবেও সংজ্ঞায়িত করা যেতে পারে।

:::

<!--
The following resource references are available:
-->

নিম্নলিখিত রিসোর্স রেফারেন্স উপলব্ধ:

import TOCInline from '@theme/TOCInline';

<TOCInline toc={toc} />

### URLReference

<!--
The `URLReference` resource is used to reference files that are stored on a remote server. The `URLReference` resource is defined as follows:
-->

`URLReference` রিসোর্স একটি রিমোট সার্ভারে সংরক্ষিত ফাইল রেফারেন্স করতে ব্যবহৃত হয়। `URLReference` রিসোর্স নিম্নরূপ সংজ্ঞায়িত করা হয়:

```typescript
type URLReference = {
	resource: 'url';
	url: string;
};
```

<!--
To use the `URLReference` resource, you need to provide the URL of the file. For example, to reference a file named "index.html" that is stored on a remote server, you can create a `URLReference` as follows:
-->

`URLReference` রিসোর্স ব্যবহার করতে, আপনাকে ফাইলের URL প্রদান করতে হবে। উদাহরণস্বরূপ, একটি রিমোট সার্ভারে সংরক্ষিত "index.html" নামের একটি ফাইল রেফারেন্স করতে, আপনি নিম্নরূপ একটি `URLReference` তৈরি করতে পারেন:

```json
{
	"resource": "url",
	"url": "https://example.com/index.html"
}
```

<!--
The `url` resource works with Blueprint steps such as [`installPlugin`](/blueprints/steps) or
[`installTheme`](/blueprints/steps).
These steps require a `ResourceType` to define the location of the plugin or the theme to install.
-->

রিসোর্স `url` টাইপ ব্লুপ্রিন্ট স্টেপ যেমন [`installPlugin`](/blueprints/steps#InstallPluginStep) বা
[`installTheme`](/blueprints/steps#InstallThemeStep) এর সাথে সত্যিই ভালভাবে কাজ করে।
এই স্টেপগুলির জন্য ইনস্টল করার জন্য প্লাগইন বা থিমের অবস্থান সংজ্ঞায়িত করতে একটি `ResourceType` প্রয়োজন।

<!--
With a `"resource": "url"` we can define the location of a `.zip` containing the plugin/theme. Use this for built ZIP artifacts hosted on a publicly accessible URL that does not require authentication, such as a release asset. CI artifact direct-download URLs can work, but they are often short-lived or restricted.
-->

`"resource": "url"` দিয়ে প্লাগইন বা থিমের `.zip` ফাইলের ঠিকানা দেওয়া যায়। রিলিজ অ্যাসেটের মতো প্রস্তুত ZIP ফাইলের জন্য এমন একটি পাবলিক URL ব্যবহার করুন, যেখানে লগ ইন করতে হয় না। CI অ্যাসেটের সরাসরি ডাউনলোড URL কাজ করতে পারে, তবে সেগুলোর মেয়াদ প্রায়ই কম থাকে বা অ্যাক্সেস সীমিত থাকে।

<!--
For source code stored in a Git repository, prefer [`git:directory`](/blueprints/steps/resources#gitdirectoryreference). It can fetch a repository subdirectory from a branch, tag, or commit without requiring a ZIP archive.
-->

সোর্স কোড Git রিপোজিটরিতে থাকলে [`git:directory`](/blueprints/steps/resources#gitdirectoryreference) ব্যবহার করুন। এটি ZIP আর্কাইভ ছাড়াই কোনো ব্রাঞ্চ, ট্যাগ বা কমিট থেকে রিপোজিটরির একটি সাবডিরেক্টরি আনতে পারে।

<!--
Before using a `url` resource, verify that the URL:
-->

`url` রিসোর্স ব্যবহার করার আগে নিশ্চিত করুন যে URL-টি নিচের শর্তগুলো পূরণ করে।

<!--
- Downloads the file directly. It must not return an HTML page, redirect warning, login page, repository file viewer, or proxy error page.
- Is available without cookies, authentication, a VPN, or a temporary browser session.
- Sends CORS headers that allow Playground to fetch it.
- Points to the expected file type. `installPlugin` and `installTheme` need a plugin or theme ZIP archive unless you use another resource type.
- Will remain available. Temporary tunnel URLs, draft release assets, and short-lived CI artifacts can expire.
- Is a real ZIP archive when the step expects a ZIP. Very small downloads often mean the server returned an HTML error page instead of the archive.
-->

- URL থেকে সরাসরি ফাইল ডাউনলোড হয়। সেটি কোনো HTML পেজ, রিডাইরেক্ট সতর্কতা, লগইন পেজ, রিপোজিটরির ফাইল দেখার পেজ বা প্রক্সির ত্রুটির পেজ দেখায় না।
- কুকি, লগইন, VPN বা অস্থায়ী ব্রাউজার সেশন ছাড়াই ফাইলটি পাওয়া যায়।
- সার্ভার এমন CORS হেডার পাঠায়, যা Playground-কে ফাইলটি আনতে দেয়।
- URL-টি সঠিক ধরনের ফাইলে নিয়ে যায়। অন্য ধরনের রিসোর্স ব্যবহার না করলে, `installPlugin` ও `installTheme`-এর জন্য প্লাগইন বা থিমের ZIP আর্কাইভ প্রয়োজন।
- URL-টি চালু থাকবে। অস্থায়ী টানেলের URL, খসড়া রিলিজের অ্যাসেট এবং স্বল্পমেয়াদি CI অ্যাসেটের মেয়াদ শেষ হয়ে যেতে পারে।
- স্টেপটির জন্য ZIP প্রয়োজন হলে ডাউনলোড করা ফাইলটি সত্যিই একটি ZIP আর্কাইভ। ফাইলটি অস্বাভাবিক ছোট হলে সার্ভার হয়তো আর্কাইভের বদলে একটি HTML ত্রুটির পেজ পাঠিয়েছে।

<!--
For GitHub source code, do not point `url` at a repository page or a generated
ZIP from a branch when you can use `git:directory`. Use `url` for built ZIP
artifacts and `git:directory` for source directories.
-->

GitHub-এ থাকা সোর্স কোডের জন্য `git:directory` ব্যবহার করতে পারলে `url`-এ রিপোজিটরির পেজ বা কোনো ব্রাঞ্চ থেকে তৈরি ZIP-এর লিংক দেবেন না। প্রস্তুত ZIP ফাইলের জন্য `url` এবং সোর্স ডিরেক্টরির জন্য `git:directory` ব্যবহার করুন।

<!--
#### Hosting URL resources on Amazon S3
-->

#### Amazon S3-তে URL রিসোর্স হোস্ট করা {#hosting-url-resources-on-amazon-s3}

<!--
Amazon S3 can host Blueprint files, Blueprint bundles, plugin ZIP files, and
theme ZIP files when the objects are public and CORS is configured for
Playground requests. Use the object URL in the `url` resource. Replace
`BUCKET_NAME` with the bucket name and `REGION` with the
[AWS Region code](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/using-regions-availability-zones.html)
for the bucket:
-->

অবজেক্টগুলো সবার জন্য উন্মুক্ত থাকলে এবং Playground-এর রিকোয়েস্টের জন্য CORS কনফিগার করা থাকলে, Amazon S3-তে ব্লুপ্রিন্ট ফাইল, ব্লুপ্রিন্ট বান্ডেল, প্লাগইনের ZIP এবং থিমের ZIP হোস্ট করা যায়। `url` রিসোর্সে অবজেক্টের URL দিন। `BUCKET_NAME`-এর জায়গায় বাকেটের নাম এবং `REGION`-এর জায়গায় বাকেটের [AWS রিজিয়ন কোড](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/using-regions-availability-zones.html) দিন।

```json
{
	"resource": "url",
	"url": "https://BUCKET_NAME.s3.REGION.amazonaws.com/plugins/example-plugin.zip"
}
```

<!--
Prefer bucket names without dots when using HTTPS S3 object URLs. Bucket names
with dots can cause certificate errors in virtual-hosted S3 URLs. If you already
have a bucket name with dots, review the
[Amazon S3 virtual hosting documentation](https://docs.aws.amazon.com/AmazonS3/latest/userguide/VirtualHosting.html)
and use a URL format that works for your bucket, such as a path-style URL if it
is supported for your setup:
-->

HTTPS দিয়ে S3 অবজেক্টের URL ব্যবহার করলে বাকেটের নামের মধ্যে ডট না রাখাই ভালো। ডট থাকলে ভার্চুয়াল হোস্টভিত্তিক S3 URL-এ সার্টিফিকেট ত্রুটি হতে পারে। আপনার বাকেটের নামে ডট থাকলে [Amazon S3 ভার্চুয়াল হোস্টিং ডকুমেন্টেশন](https://docs.aws.amazon.com/AmazonS3/latest/userguide/VirtualHosting.html) দেখুন এবং আপনার সেটআপে কাজ করে এমন URL ফরম্যাট ব্যবহার করুন। আপনার সেটআপে সমর্থন থাকলে পাথভিত্তিক URL ব্যবহার করতে পারেন।

```text
https://s3.REGION.amazonaws.com/BUCKET_NAME/plugins/example-plugin.zip
```

<!--
For a public S3 bucket, allow read access to the objects that Playground needs
to download. Scope the policy to the prefixes you use for Playground assets,
and replace `BUCKET_NAME` with the bucket name:
-->

পাবলিক S3 বাকেটে Playground-এর ডাউনলোড করার জন্য প্রয়োজনীয় অবজেক্টগুলো পড়ার অনুমতি দিন। পলিসিটি শুধু Playground অ্যাসেটের জন্য ব্যবহৃত প্রিফিক্সগুলোতে প্রয়োগ করুন এবং `BUCKET_NAME`-এর জায়গায় বাকেটের নাম দিন।

```json
{
	"Version": "2012-10-17",
	"Statement": [
		{
			"Sid": "AllowPublicReadForPlaygroundAssets",
			"Effect": "Allow",
			"Principal": "*",
			"Action": "s3:GetObject",
			"Resource": ["arn:aws:s3:::BUCKET_NAME/blueprints/*", "arn:aws:s3:::BUCKET_NAME/plugins/*", "arn:aws:s3:::BUCKET_NAME/themes/*"]
		}
	]
}
```

<!--
Two [Amazon S3 Block Public Access](https://docs.aws.amazon.com/AmazonS3/latest/userguide/access-control-block-public-access.html)
settings must be off for this policy to work: `BlockPublicPolicy`, because S3
rejects attempts to add a public bucket policy while it is on, and
`RestrictPublicBuckets`, because while it is on only AWS service principals and
authorized users in your account can read a bucket with a public policy. The ACL
settings, `BlockPublicAcls` and `IgnorePublicAcls`, can stay on, because this
setup uses a bucket policy, not ACLs. S3 applies the most restrictive
combination of the bucket, account, and organization settings, so an
account-level or organization-level setting can still block access when the
bucket allows it. Only allow public access for objects that are intended to be
downloadable by anyone with the URL.
-->

পলিসিটি কাজ করতে [Amazon S3 Block Public Access](https://docs.aws.amazon.com/AmazonS3/latest/userguide/access-control-block-public-access.html)-এর দুটি সেটিংস বন্ধ রাখতে হবে। `BlockPublicPolicy` চালু থাকলে S3 পাবলিক বাকেট পলিসি যোগ করার অনুরোধ প্রত্যাখ্যান করে। `RestrictPublicBuckets` চালু থাকলে পাবলিক পলিসি থাকা বাকেটটি শুধু AWS সার্ভিস প্রিন্সিপাল এবং আপনার অ্যাকাউন্টের অনুমোদিত ব্যবহারকারীরা পড়তে পারেন। এখানে ACL-এর বদলে বাকেট পলিসি ব্যবহার করা হয়েছে, তাই `BlockPublicAcls` ও `IgnorePublicAcls` চালু রাখা যায়। S3 বাকেট, অ্যাকাউন্ট ও সংস্থার সেটিংসের মধ্যে সবচেয়ে কঠোর বিধিনিষেধ প্রয়োগ করে। ফলে বাকেটের সেটিংস অনুমতি দিলেও অ্যাকাউন্ট বা সংস্থার সেটিংস অ্যাক্সেস আটকে দিতে পারে। কেবল যে অবজেক্টগুলো URL জানা যে কেউ ডাউনলোড করতে পারবে বলে ঠিক করেছেন, সেগুলোর জন্যই পাবলিক অ্যাক্সেস দিন।

<!--
Configure CORS so the Playground website can fetch those objects. The following
S3 CORS configuration allows `GET` and `HEAD` requests from
`https://playground.wordpress.net`:
-->

Playground ওয়েবসাইট যাতে ওই অবজেক্টগুলো আনতে পারে, সে জন্য CORS কনফিগার করুন। নিচের S3 CORS কনফিগারেশন `https://playground.wordpress.net` থেকে `GET` ও `HEAD` রিকোয়েস্টের অনুমতি দেয়।

```json
[
	{
		"AllowedHeaders": ["*"],
		"AllowedMethods": ["GET", "HEAD"],
		"AllowedOrigins": ["https://playground.wordpress.net"],
		"ExposeHeaders": [],
		"MaxAgeSeconds": 3000
	}
]
```

<!--
`AllowedOrigins` only controls which websites can read the objects from a
browser. It does not make the objects private: anyone with the URL can still
download them with other clients, such as `curl`. If you run your own
Playground instance, add the origin it is served from to `AllowedOrigins`.
Use `AllowedOrigins: ["*"]` only when the objects are intended to be fetched
from any website. See the Amazon S3 documentation for
[bucket policies](https://docs.aws.amazon.com/AmazonS3/latest/userguide/WebsiteAccessPermissionsReqd.html)
and [CORS configuration](https://docs.aws.amazon.com/AmazonS3/latest/userguide/enabling-cors-examples.html).
-->

`AllowedOrigins` শুধু নিয়ন্ত্রণ করে কোন ওয়েবসাইটগুলো ব্রাউজার থেকে অবজেক্ট পড়তে পারবে। এটি অবজেক্টগুলোকে ব্যক্তিগত করে না। URL জানা যে কেউ `curl`-এর মতো অন্য ক্লায়েন্ট দিয়ে সেগুলো ডাউনলোড করতে পারবেন। নিজের Playground ইনস্ট্যান্স চালালে যে অরিজিন থেকে সেটি পরিবেশন করা হয়, সেটি `AllowedOrigins`-এ যোগ করুন। যেকোনো ওয়েবসাইট থেকে অবজেক্ট আনার সুযোগ দেওয়ার উদ্দেশ্য থাকলেই শুধু `AllowedOrigins: ["*"]` ব্যবহার করুন। Amazon S3-এর [বাকেট পলিসি](https://docs.aws.amazon.com/AmazonS3/latest/userguide/WebsiteAccessPermissionsReqd.html) ও [CORS কনফিগারেশন](https://docs.aws.amazon.com/AmazonS3/latest/userguide/enabling-cors-examples.html) ডকুমেন্টেশন দেখুন।

<!--
Here is a Blueprint that installs a plugin ZIP hosted on S3:
-->

এই ব্লুপ্রিন্টটি S3-তে হোস্ট করা একটি প্লাগইনের ZIP ইনস্টল করে।

```json
{
	"$schema": "https://playground.wordpress.net/blueprint-schema.json",
	"landingPage": "/wp-admin/plugins.php",
	"preferredVersions": {
		"php": "8.3",
		"wp": "latest"
	},
	"steps": [
		{
			"step": "login",
			"username": "admin",
			"password": "password"
		},
		{
			"step": "installPlugin",
			"pluginData": {
				"resource": "url",
				"url": "https://BUCKET_NAME.s3.REGION.amazonaws.com/plugins/example-plugin.zip"
			},
			"options": {
				"activate": true
			}
		}
	]
}
```

<!--
Use the same `url` resource shape with `installTheme` and `themeData`:
-->

`installTheme` ও `themeData`-এর ক্ষেত্রেও `url` রিসোর্সের একই কাঠামো ব্যবহার করুন।

```json
{
	"step": "installTheme",
	"themeData": {
		"resource": "url",
		"url": "https://BUCKET_NAME.s3.REGION.amazonaws.com/themes/example-theme.zip"
	},
	"options": {
		"activate": true
	}
}
```

<!--
For loading a Blueprint JSON file or Blueprint bundle from S3, pass the object
URL to `?blueprint-url=`:
-->

S3 থেকে ব্লুপ্রিন্ট JSON ফাইল বা ব্লুপ্রিন্ট বান্ডেল লোড করতে `?blueprint-url=` প্যারামিটারে অবজেক্টের URL দিন।

```text
https://playground.wordpress.net/?blueprint-url=https://BUCKET_NAME.s3.REGION.amazonaws.com/blueprints/example-blueprint.json
```

### GitDirectoryReference

<!--
The `GitDirectoryReference` resource is used to reference a directory inside a Git repository. This is useful when a plugin or theme lives in a subfolder of a repo, or when you want to install from a specific branch, tag, or commit.
-->

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

<!--
**Example:**
-->

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

<!--
**Notes:**
-->

**নোট:**

<!--
- When using a branch or tag name for `ref`, you must specify `refType` (e.g. `"refType": "branch"`). Without it, only `HEAD` is reliably resolved.
- Playground automatically detects providers like GitHub and GitLab.
- Repository URLs may include or omit a trailing `.git` suffix. Extra trailing slashes are ignored.
- It handles CORS-proxied fetches and sparse checkouts, so you can use URLs that point to specific subdirectories or branches.
- This resource can be used with steps like [`installPlugin`](/blueprints/steps) and [`installTheme`](/blueprints/steps).
- Set `".git": true` to include a `.git` folder containing packfiles and refs so Git-aware tooling can detect the checkout. This currently mirrors a shallow clone of the selected ref.
- The folder name is derived from the URL by default (e.g. `https-github-com-WordPress-block-development-examples-HEAD-at-plugins-data-basics-59c8f8`). Use `options.targetFolderName` in the step to override it, as shown in the example above.
-->

- `ref` এর জন্য একটি ব্রাঞ্চ বা ট্যাগ নাম ব্যবহার করার সময়, আপনাকে অবশ্যই `refType` নির্দিষ্ট করতে হবে (যেমন `"refType": "branch"`)। এটি ছাড়া, শুধুমাত্র `HEAD` নির্ভরযোগ্যভাবে সমাধান করা হয়।
- Playground স্বয়ংক্রিয়ভাবে GitHub এবং GitLab এর মতো প্রদানকারী সনাক্ত করে।
- রিপোজিটরির URL-এর শেষে `.git` থাকলেও চলবে, না থাকলেও চলবে। শেষে অতিরিক্ত স্ল্যাশ থাকলে সেগুলো উপেক্ষা করা হয়।
- এটি CORS-প্রক্সিড ফেচ এবং স্পার্স চেকআউট পরিচালনা করে, তাই আপনি নির্দিষ্ট সাবডিরেক্টরি বা ব্রাঞ্চে নির্দেশ করে এমন URL ব্যবহার করতে পারেন।
- এই রিসোর্স [`installPlugin`](/blueprints/steps#InstallPluginStep) এবং [`installTheme`](/blueprints/steps#InstallThemeStep) এর মতো স্টেপের সাথে ব্যবহার করা যেতে পারে।
- `".git": true` দিলে প্যাকফাইল ও রেফসহ একটি `.git` ফোল্ডার যোগ হয়। এতে Git সমর্থন করে এমন টুলগুলো চেকআউটটি শনাক্ত করতে পারে। বর্তমানে এটি নির্বাচিত রেফের একটি শ্যালো ক্লোনের অনুরূপ।
- ফোল্ডারের নাম ডিফল্টভাবে URL থেকে উদ্ভূত হয় (যেমন `https-github-com-WordPress-block-development-examples-HEAD-at-plugins-data-basics-59c8f8`)। এটি ওভাররাইড করতে স্টেপে `options.targetFolderName` ব্যবহার করুন, যেমন উপরের উদাহরণে দেখানো হয়েছে।

### CoreThemeReference

<!--
The _CoreThemeReference_ resource is used to reference WordPress core themes. The _CoreThemeReference_ resource is defined as follows:
-->

_CoreThemeReference_ রিসোর্স WordPress কোর থিম রেফারেন্স করতে ব্যবহৃত হয়। _CoreThemeReference_ রিসোর্স নিম্নরূপ সংজ্ঞায়িত করা হয়:

```typescript
type CoreThemeReference = {
	resource: 'wordpress.org/themes';
	slug: string;
	version?: string;
};
```

<!--
To use the _CoreThemeReference_ resource, you need to provide the slug of the theme. For example, to reference the "Twenty Twenty-One" theme, you can create a _CoreThemeReference_ as follows:
-->

_CoreThemeReference_ রিসোর্স ব্যবহার করতে, আপনাকে থিমের slug প্রদান করতে হবে। উদাহরণস্বরূপ, "Twenty Twenty-One" থিম রেফারেন্স করতে, আপনি নিম্নরূপ একটি _CoreThemeReference_ তৈরি করতে পারেন:

```json
{
	"resource": "wordpress.org/themes",
	"slug": "twentytwentyone"
}
```

### CorePluginReference

<!--
The _CorePluginReference_ resource is used to reference WordPress core plugins. The _CorePluginReference_ resource is defined as follows:
-->

_CorePluginReference_ রিসোর্স WordPress কোর প্লাগইন রেফারেন্স করতে ব্যবহৃত হয়। _CorePluginReference_ রিসোর্স নিম্নরূপ সংজ্ঞায়িত করা হয়:

```typescript
type CorePluginReference = {
	resource: 'wordpress.org/plugins';
	slug: string;
	version?: string;
};
```

<!--
To use the _CorePluginReference_ resource, you need to provide the slug of the plugin. For example, to reference the "Akismet" plugin, you can create a _CorePluginReference_ as follows:
-->

_CorePluginReference_ রিসোর্স ব্যবহার করতে, আপনাকে প্লাগইনের slug প্রদান করতে হবে। উদাহরণস্বরূপ, "Akismet" প্লাগইন রেফারেন্স করতে, আপনি নিম্নরূপ একটি _CorePluginReference_ তৈরি করতে পারেন:

```json
{
	"resource": "wordpress.org/plugins",
	"slug": "akismet"
}
```

### VFSReference

<!--
The _VFSReference_ resource is used to reference files that are stored in a virtual file system (VFS). The VFS is a file system that is stored in memory and can be used to store files that are not part of the file system of the operating system. The _VFSReference_ resource is defined as follows:
-->

_VFSReference_ রিসোর্স একটি ভার্চুয়াল ফাইল সিস্টেম (VFS) এ সংরক্ষিত ফাইল রেফারেন্স করতে ব্যবহৃত হয়। VFS হল একটি ফাইল সিস্টেম যা মেমরিতে সংরক্ষিত থাকে এবং অপারেটিং সিস্টেমের ফাইল সিস্টেমের অংশ নয় এমন ফাইল সংরক্ষণ করতে ব্যবহার করা যেতে পারে। _VFSReference_ রিসোর্স নিম্নরূপ সংজ্ঞায়িত করা হয়:

```typescript
type VFSReference = {
	resource: 'vfs';
	path: string;
};
```

<!--
To use the _VFSReference_ resource, you need to provide the path to the file in the VFS. For example, to reference a file named "index.html" that is stored in the root of the VFS, you can create a _VFSReference_ as follows:
-->

_VFSReference_ রিসোর্স ব্যবহার করতে, আপনাকে VFS-এ ফাইলের পাথ প্রদান করতে হবে। উদাহরণস্বরূপ, VFS-এর রুটে সংরক্ষিত "index.html" নামের একটি ফাইল রেফারেন্স করতে, আপনি নিম্নরূপ একটি _VFSReference_ তৈরি করতে পারেন:

```json
{
	"resource": "vfs",
	"path": "/index.html"
}
```

### LiteralReference

<!--
The _LiteralReference_ resource is used to reference files that are stored as literals in the code. The _LiteralReference_ resource is defined as follows:
-->

_LiteralReference_ রিসোর্স কোডে লিটারাল হিসাবে সংরক্ষিত ফাইল রেফারেন্স করতে ব্যবহৃত হয়। _LiteralReference_ রিসোর্স নিম্নরূপ সংজ্ঞায়িত করা হয়:

```typescript
type LiteralReference = {
	resource: 'literal';
	name: string;
	contents: string | Uint8Array;
};
```

<!--
To use the _LiteralReference_ resource, you need to provide the name of the file and its contents. For example, to reference a file named "index.html" that contains the text "Hello, World!", you can create a _LiteralReference_ as follows:
-->

_LiteralReference_ রিসোর্স ব্যবহার করতে, আপনাকে ফাইলের নাম এবং এর কন্টেন্ট প্রদান করতে হবে। উদাহরণস্বরূপ, "Hello, World!" টেক্সট ধারণকারী "index.html" নামের একটি ফাইল রেফারেন্স করতে, আপনি নিম্নরূপ একটি _LiteralReference_ তৈরি করতে পারেন:

```json
{
	"resource": "literal",
	"name": "index.html",
	"contents": "Hello, World!"
}
```

### BundledReference

<!--
The `BundledReference` resource is used to reference files that are bundled with the Blueprint itself. This is particularly useful for creating self-contained Blueprint bundles that include all necessary resources. The `BundledReference` resource is defined as follows:
-->

`BundledReference` রিসোর্স ব্লুপ্রিন্টের সাথে বান্ডেল করা ফাইল রেফারেন্স করতে ব্যবহৃত হয়। এটি বিশেষভাবে স্বয়ংসম্পূর্ণ ব্লুপ্রিন্ট বান্ডেল তৈরি করার জন্য উপযোগী যা সমস্ত প্রয়োজনীয় রিসোর্স অন্তর্ভুক্ত করে। `BundledReference` রিসোর্স নিম্নরূপ সংজ্ঞায়িত করা হয়:

```typescript
type BundledReference = {
	resource: 'bundled';
	path: string;
};
```

<!--
To use the `BundledReference` resource, you need to provide the relative path to the file within the bundle. For example, to reference a file named "plugin.php" that is bundled with the Blueprint, you can create a `BundledReference` as follows:
-->

`BundledReference` রিসোর্স ব্যবহার করতে, আপনাকে বান্ডেলের মধ্যে ফাইলের আপেক্ষিক পাথ প্রদান করতে হবে। উদাহরণস্বরূপ, ব্লুপ্রিন্টের সাথে বান্ডেল করা "plugin.php" নামের একটি ফাইল রেফারেন্স করতে, আপনি নিম্নরূপ একটি `BundledReference` তৈরি করতে পারেন:

```json
{
	"resource": "bundled",
	"path": "plugin.php"
}
```

<!--
Blueprint bundles can be distributed in various formats, including:
-->

ব্লুপ্রিন্ট বান্ডেল বিভিন্ন ফরম্যাটে বিতরণ করা যেতে পারে, যার মধ্যে রয়েছে:

<!--
- ZIP files with a top-level `blueprint.json` file
- Directories containing a `blueprint.json` file and related resources
- Remote URLs where the Blueprint and its resources are hosted together
-->

- একটি শীর্ষ-স্তরের `blueprint.json` ফাইল সহ ZIP ফাইল
- একটি `blueprint.json` ফাইল এবং সম্পর্কিত রিসোর্স ধারণকারী ডিরেক্টরি
- রিমোট URL যেখানে ব্লুপ্রিন্ট এবং এর রিসোর্স একসাথে হোস্ট করা হয়

<!--
For more information on Blueprint bundles, see the [Blueprint Bundles](/blueprints/bundles) documentation.
-->

ব্লুপ্রিন্ট বান্ডেল সম্পর্কে আরও তথ্যের জন্য, [Blueprint Bundles](/blueprints/bundles) ডকুমেন্টেশন দেখুন।
