---
slug: /blueprints/steps/resources
description: रिसोर्स रेफ़रेंस की तकनीकी जानकारी। थीम, प्लगइन और कंटेंट के लिए बाहरी फ़ाइलें इस्तेमाल करना सीखें।
---

<!-- # Resources References -->

# रिसोर्स रेफ़रेंस

<!-- "Resource References" allow you to use external files in Blueprints. -->

"रिसोर्स रेफ़रेंस" की मदद से आप ब्लूप्रिंट में बाहरी फ़ाइलें इस्तेमाल कर सकते हैं।

<div class="callout callout-info">

<!-- Blueprint steps such as [`installPlugin`](/blueprints/steps) or [`installTheme`](/blueprints/steps) require a location of the plugin or theme to be installed. -->

[`installPlugin`](/blueprints/steps) या [`installTheme`](/blueprints/steps) जैसे ब्लूप्रिंट स्टेप के लिए उस प्लगइन या थीम की लोकेशन ज़रूरी होती है, जिसे इंस्टॉल करना है।

<!-- That location can be defined as [a `URL` resource](#urlreference) of the `.zip` file containing the theme or plugin. It can also be defined as a [`wordpress.org/plugins`](#corepluginreference) or [`wordpress.org/themes`](#corethemereference) resource for those plugins/themes published in the official WordPress directories. -->

यह लोकेशन थीम या प्लगइन वाली `.zip` फ़ाइल के [`URL` रिसोर्स](#urlreference) के रूप में दी जा सकती है। आधिकारिक WordPress डायरेक्टरी में प्रकाशित प्लगइन या थीम के लिए इसे [`wordpress.org/plugins`](#corepluginreference) या [`wordpress.org/themes`](#corethemereference) रिसोर्स के रूप में भी दिया जा सकता है।

</div>

<!-- The following resource references are available: -->

ये रिसोर्स रेफ़रेंस उपलब्ध हैं:

import TOCInline from '@theme/TOCInline';

<TOCInline toc={toc} />

<!-- ### URLReference -->

### URLReference {#urlreference}

<!-- The `URLReference` resource is used to reference files that are stored on a remote server. The `URLReference` resource is defined as follows: -->

`URLReference` रिसोर्स का इस्तेमाल किसी रिमोट सर्वर पर रखी फ़ाइलों का हवाला देने के लिए होता है। `URLReference` रिसोर्स की परिभाषा यह है:

```typescript
type URLReference = {
	resource: 'url';
	url: string;
};
```

<!-- To use the `URLReference` resource, you need to provide the URL of the file. For example, to reference a file named "index.html" that is stored on a remote server, you can create a `URLReference` as follows: -->

`URLReference` रिसोर्स इस्तेमाल करने के लिए आपको फ़ाइल का URL देना होगा। उदाहरण के लिए, किसी रिमोट सर्वर पर रखी "index.html" नाम की फ़ाइल के लिए आप `URLReference` इस तरह बना सकते हैं:

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

`url` रिसोर्स [`installPlugin`](/blueprints/steps) या [`installTheme`](/blueprints/steps) जैसे ब्लूप्रिंट स्टेप के साथ काम करता है। इन स्टेप को इंस्टॉल किए जाने वाले प्लगइन या थीम की लोकेशन बताने के लिए एक `ResourceType` चाहिए।

<!-- With a `"resource": "url"` we can define the location of a `.zip` containing the plugin/theme. Use this for built ZIP artifacts hosted on a publicly accessible URL that does not require authentication, such as a release asset. CI artifact direct-download URLs can work, but they are often short-lived or restricted. -->

`"resource": "url"` से हम प्लगइन या थीम वाली `.zip` फ़ाइल की लोकेशन बता सकते हैं। इसे ऐसे बिल्ट ZIP आर्टिफ़ैक्ट के लिए इस्तेमाल करें, जो किसी सार्वजनिक URL पर होस्ट हों और जिनके लिए लॉगिन की ज़रूरत न हो, जैसे कोई रिलीज़ एसेट। CI आर्टिफ़ैक्ट के सीधे डाउनलोड वाले URL काम कर सकते हैं, लेकिन वे अक्सर कम समय के लिए होते हैं या उन पर पाबंदियाँ होती हैं।

<!-- For source code stored in a Git repository, prefer [`git:directory`](/blueprints/steps/resources#gitdirectoryreference). It can fetch a repository subdirectory from a branch, tag, or commit without requiring a ZIP archive. -->

Git रिपॉज़िटरी में रखे सोर्स कोड के लिए [`git:directory`](/blueprints/steps/resources#gitdirectoryreference) बेहतर है। यह किसी ब्रांच, टैग या कमिट से रिपॉज़िटरी की सबडायरेक्टरी ला सकता है, और इसके लिए ZIP आर्काइव की ज़रूरत नहीं होती।

<!-- Before using a `url` resource, verify that the URL: -->

`url` रिसोर्स इस्तेमाल करने से पहले जाँच लें कि URL:

<!--
- Downloads the file directly. It must not return an HTML page, redirect warning, login page, repository file viewer, or proxy error page.
- Is available without cookies, authentication, a VPN, or a temporary browser session.
- Sends CORS headers that allow Playground to fetch it.
- Points to the expected file type. `installPlugin` and `installTheme` need a plugin or theme ZIP archive unless you use another resource type.
- Will remain available. Temporary tunnel URLs, draft release assets, and short-lived CI artifacts can expire.
- Is a real ZIP archive when the step expects a ZIP. Very small downloads often mean the server returned an HTML error page instead of the archive.
-->

- फ़ाइल सीधे डाउनलोड करता है। उसे HTML पेज, रीडायरेक्ट चेतावनी, लॉगिन पेज, रिपॉज़िटरी का फ़ाइल व्यूअर या प्रॉक्सी एरर पेज नहीं लौटाना चाहिए।
- कुकी, लॉगिन, VPN या किसी अस्थायी ब्राउज़र सेशन के बिना उपलब्ध है।
- ऐसे CORS हेडर भेजता है, जिनसे Playground उसे फ़ेच कर सके।
- सही तरह की फ़ाइल की ओर इशारा करता है। जब तक आप कोई दूसरा रिसोर्स टाइप इस्तेमाल न करें, `installPlugin` और `installTheme` को प्लगइन या थीम का ZIP आर्काइव चाहिए।
- आगे भी उपलब्ध रहेगा। अस्थायी टनल URL, ड्राफ़्ट रिलीज़ एसेट और कम समय वाले CI आर्टिफ़ैक्ट एक्सपायर हो सकते हैं।
- जब स्टेप को ZIP चाहिए, तब असली ZIP आर्काइव है। बहुत छोटे डाउनलोड का मतलब अक्सर यह होता है कि सर्वर ने आर्काइव की जगह HTML एरर पेज लौटाया है।

<!--
For GitHub source code, do not point `url` at a repository page or a generated
ZIP from a branch when you can use `git:directory`. Use `url` for built ZIP
artifacts and `git:directory` for source directories.
-->

GitHub के सोर्स कोड के लिए, जब आप `git:directory` इस्तेमाल कर सकते हों, तो `url` को किसी रिपॉज़िटरी पेज या किसी ब्रांच से बने ZIP की ओर न ले जाएँ। बिल्ट ZIP आर्टिफ़ैक्ट के लिए `url` और सोर्स डायरेक्टरी के लिए `git:directory` इस्तेमाल करें।

<!-- #### Hosting URL resources on Amazon S3 -->

#### Amazon S3 पर URL रिसोर्स होस्ट करना {#hosting-url-resources-on-amazon-s3}

<!--
Amazon S3 can host Blueprint files, Blueprint bundles, plugin ZIP files, and
theme ZIP files when the objects are public and CORS is configured for
Playground requests. Use the object URL in the `url` resource. Replace
`BUCKET_NAME` with the bucket name and `REGION` with the
[AWS Region code](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/using-regions-availability-zones.html)
for the bucket:
-->

जब ऑब्जेक्ट सार्वजनिक हों और Playground की रिक्वेस्ट के लिए CORS कॉन्फ़िगर हो, तो Amazon S3 पर ब्लूप्रिंट फ़ाइलें, ब्लूप्रिंट बंडल, प्लगइन ZIP फ़ाइलें और थीम ZIP फ़ाइलें होस्ट की जा सकती हैं। `url` रिसोर्स में ऑब्जेक्ट का URL इस्तेमाल करें। `BUCKET_NAME` की जगह बकेट का नाम और `REGION` की जगह बकेट का [AWS Region कोड](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/using-regions-availability-zones.html) लिखें:

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

HTTPS वाले S3 ऑब्जेक्ट URL के लिए ऐसे बकेट नाम बेहतर हैं, जिनमें बिंदु (dot) न हो। बिंदु वाले बकेट नाम से virtual-hosted S3 URL में सर्टिफ़िकेट एरर आ सकते हैं। अगर आपके पास पहले से बिंदु वाला बकेट नाम है, तो [Amazon S3 वर्चुअल होस्टिंग डॉक्यूमेंटेशन](https://docs.aws.amazon.com/AmazonS3/latest/userguide/VirtualHosting.html) देखें और ऐसा URL फ़ॉर्मेट इस्तेमाल करें जो आपके बकेट के लिए काम करे, जैसे path-style URL, अगर आपके सेटअप में वह सपोर्ट होता हो:

```text
https://s3.REGION.amazonaws.com/BUCKET_NAME/plugins/example-plugin.zip
```

<!--
For a public S3 bucket, allow read access to the objects that Playground needs
to download. Scope the policy to the prefixes you use for Playground assets,
and replace `BUCKET_NAME` with the bucket name:
-->

सार्वजनिक S3 बकेट के लिए, उन ऑब्जेक्ट को पढ़ने की अनुमति दें जिन्हें Playground को डाउनलोड करना है। पॉलिसी को सिर्फ़ उन प्रीफ़िक्स तक सीमित रखें जो आप Playground एसेट के लिए इस्तेमाल करते हैं, और `BUCKET_NAME` की जगह बकेट का नाम लिखें:

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

इस पॉलिसी के काम करने के लिए [Amazon S3 Block Public Access](https://docs.aws.amazon.com/AmazonS3/latest/userguide/access-control-block-public-access.html) की दो सेटिंग बंद होनी चाहिए: `BlockPublicPolicy`, क्योंकि इसके चालू रहते S3 सार्वजनिक बकेट पॉलिसी जोड़ने की कोशिश को रोक देता है, और `RestrictPublicBuckets`, क्योंकि इसके चालू रहते सार्वजनिक पॉलिसी वाले बकेट को सिर्फ़ AWS सर्विस प्रिंसिपल और आपके अकाउंट के अधिकृत उपयोगकर्ता ही पढ़ सकते हैं। ACL सेटिंग, यानी `BlockPublicAcls` और `IgnorePublicAcls`, चालू रह सकती हैं, क्योंकि यह सेटअप ACL नहीं, बल्कि बकेट पॉलिसी इस्तेमाल करता है। S3 बकेट, अकाउंट और ऑर्गनाइज़ेशन की सेटिंग में से सबसे सख्त मेल लागू करता है, इसलिए बकेट के अनुमति देने पर भी अकाउंट लेवल या ऑर्गनाइज़ेशन लेवल की कोई सेटिंग पहुँच रोक सकती है। सार्वजनिक पहुँच सिर्फ़ उन्हीं ऑब्जेक्ट के लिए दें, जिन्हें आप URL वाले किसी भी व्यक्ति के लिए डाउनलोड करने लायक रखना चाहते हैं।

<!--
Configure CORS so the Playground website can fetch those objects. The following
S3 CORS configuration allows `GET` and `HEAD` requests from
`https://playground.wordpress.net`:
-->

CORS कॉन्फ़िगर करें, ताकि Playground वेबसाइट उन ऑब्जेक्ट को फ़ेच कर सके। नीचे दिया गया S3 CORS कॉन्फ़िगरेशन `https://playground.wordpress.net` से `GET` और `HEAD` रिक्वेस्ट की अनुमति देता है:

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

`AllowedOrigins` सिर्फ़ यह तय करता है कि कौन सी वेबसाइट ब्राउज़र से ऑब्जेक्ट पढ़ सकती हैं। इससे ऑब्जेक्ट निजी नहीं हो जाते: URL वाला कोई भी व्यक्ति उन्हें `curl` जैसे दूसरे क्लाइंट से अब भी डाउनलोड कर सकता है। अगर आप अपना खुद का Playground इंस्टेंस चलाते हैं, तो जिस ऑरिजिन से वह सर्व होता है, उसे `AllowedOrigins` में जोड़ें। `AllowedOrigins: ["*"]` तभी इस्तेमाल करें, जब ऑब्जेक्ट किसी भी वेबसाइट से फ़ेच किए जाने के लिए हों। [बकेट पॉलिसी](https://docs.aws.amazon.com/AmazonS3/latest/userguide/WebsiteAccessPermissionsReqd.html) और [CORS कॉन्फ़िगरेशन](https://docs.aws.amazon.com/AmazonS3/latest/userguide/enabling-cors-examples.html) के लिए Amazon S3 का डॉक्यूमेंटेशन देखें।

<!-- Here is a Blueprint that installs a plugin ZIP hosted on S3: -->

यहाँ एक ब्लूप्रिंट है, जो S3 पर होस्ट किया गया प्लगइन ZIP इंस्टॉल करता है:

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

<!-- Use the same `url` resource shape with `installTheme` and `themeData`: -->

`installTheme` और `themeData` के साथ भी `url` रिसोर्स का यही रूप इस्तेमाल करें:

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

S3 से ब्लूप्रिंट JSON फ़ाइल या ब्लूप्रिंट बंडल लोड करने के लिए ऑब्जेक्ट का URL `?blueprint-url=` में दें:

```text
https://playground.wordpress.net/?blueprint-url=https://BUCKET_NAME.s3.REGION.amazonaws.com/blueprints/example-blueprint.json
```

<!-- ### GitDirectoryReference -->

### GitDirectoryReference {#gitdirectoryreference}

<!-- The `GitDirectoryReference` resource is used to reference a directory inside a Git repository. This is useful when a plugin or theme lives in a subfolder of a repo, or when you want to install from a specific branch, tag, or commit. -->

`GitDirectoryReference` रिसोर्स का इस्तेमाल किसी Git रिपॉज़िटरी के अंदर की डायरेक्टरी का हवाला देने के लिए होता है। यह तब काम आता है जब कोई प्लगइन या थीम किसी रिपॉज़िटरी के सबफ़ोल्डर में हो, या जब आप किसी खास ब्रांच, टैग या कमिट से इंस्टॉल करना चाहते हों।

```typescript
type GitDirectoryReference = {
	resource: 'git:directory';
	url: string; // Repository URL (https://, ssh git@..., etc.)
	path?: string; // Optional subdirectory inside the repository
	ref: string; // Branch, tag, or commit SHA, for example "HEAD"
	refType?: 'branch' | 'tag' | 'commit'; // Hint for resolving the ref
	'.git'?: boolean; // Experimental: include a .git directory with fetched metadata
};
```

<!-- **Example:** -->

**उदाहरण:**

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

<!-- **Notes:** -->

**नोट:**

<!--
- When using a branch or tag name for `ref`, you must specify `refType` (e.g. `"refType": "branch"`). Without it, only `HEAD` is reliably resolved.
- Playground automatically detects providers like GitHub and GitLab.
- Repository URLs may include or omit a trailing `.git` suffix. Extra trailing slashes are ignored.
- It handles CORS-proxied fetches and sparse checkouts, so you can use URLs that point to specific subdirectories or branches.
- This resource can be used with steps like [`installPlugin`](/blueprints/steps) and [`installTheme`](/blueprints/steps).
- Set `".git": true` to include a `.git` folder containing packfiles and refs so Git-aware tooling can detect the checkout. This currently mirrors a shallow clone of the selected ref.
- The folder name is derived from the URL by default (e.g. `https-github-com-WordPress-block-development-examples-HEAD-at-plugins-data-basics-59c8f8`). Use `options.targetFolderName` in the step to override it, as shown in the example above.
-->

- `ref` के लिए ब्रांच या टैग का नाम इस्तेमाल करते समय आपको `refType` बताना होगा (जैसे `"refType": "branch"`)। इसके बिना सिर्फ़ `HEAD` ही भरोसे के साथ रिज़ॉल्व होता है।
- Playground, GitHub और GitLab जैसे प्रोवाइडर अपने आप पहचान लेता है।
- रिपॉज़िटरी URL के आखिर में `.git` हो भी सकता है और नहीं भी। आखिर में लगे फ़ालतू स्लैश अनदेखे कर दिए जाते हैं।
- यह CORS प्रॉक्सी से होने वाले फ़ेच और sparse checkout संभालता है, इसलिए आप ऐसे URL इस्तेमाल कर सकते हैं जो खास सबडायरेक्टरी या ब्रांच की ओर इशारा करते हों।
- यह रिसोर्स [`installPlugin`](/blueprints/steps) और [`installTheme`](/blueprints/steps) जैसे स्टेप के साथ इस्तेमाल किया जा सकता है।
- `".git": true` सेट करने पर packfile और ref वाला एक `.git` फ़ोल्डर शामिल हो जाता है, ताकि Git को समझने वाले टूल चेकआउट को पहचान सकें। फ़िलहाल यह चुने गए ref का shallow clone बनाता है।
- फ़ोल्डर का नाम डिफ़ॉल्ट रूप से URL से बनता है (जैसे `https-github-com-WordPress-block-development-examples-HEAD-at-plugins-data-basics-59c8f8`)। इसे बदलने के लिए स्टेप में `options.targetFolderName` इस्तेमाल करें, जैसा ऊपर के उदाहरण में दिखाया गया है।

<!-- ### CoreThemeReference -->

### CoreThemeReference {#corethemereference}

<!-- The _CoreThemeReference_ resource is used to reference WordPress core themes. The _CoreThemeReference_ resource is defined as follows: -->

_CoreThemeReference_ रिसोर्स का इस्तेमाल WordPress कोर थीम का हवाला देने के लिए होता है। _CoreThemeReference_ रिसोर्स की परिभाषा यह है:

```typescript
type CoreThemeReference = {
	resource: 'wordpress.org/themes';
	slug: string;
};
```

<!-- To use the _CoreThemeReference_ resource, you need to provide the slug of the theme. For example, to reference the "Twenty Twenty-One" theme, you can create a _CoreThemeReference_ as follows: -->

_CoreThemeReference_ रिसोर्स इस्तेमाल करने के लिए आपको थीम का स्लग देना होगा। उदाहरण के लिए, "Twenty Twenty-One" थीम के लिए आप _CoreThemeReference_ इस तरह बना सकते हैं:

```json
{
	"resource": "wordpress.org/themes",
	"slug": "twentytwentyone"
}
```

<!-- ### CorePluginReference -->

### CorePluginReference {#corepluginreference}

<!-- The _CorePluginReference_ resource is used to reference WordPress core plugins. The _CorePluginReference_ resource is defined as follows: -->

_CorePluginReference_ रिसोर्स का इस्तेमाल WordPress कोर प्लगइन का हवाला देने के लिए होता है। _CorePluginReference_ रिसोर्स की परिभाषा यह है:

```typescript
type CorePluginReference = {
	resource: 'wordpress.org/plugins';
	slug: string;
};
```

<!-- To use the _CorePluginReference_ resource, you need to provide the slug of the plugin. For example, to reference the "Akismet" plugin, you can create a _CorePluginReference_ as follows: -->

_CorePluginReference_ रिसोर्स इस्तेमाल करने के लिए आपको प्लगइन का स्लग देना होगा। उदाहरण के लिए, "Akismet" प्लगइन के लिए आप _CorePluginReference_ इस तरह बना सकते हैं:

```json
{
	"resource": "wordpress.org/plugins",
	"slug": "akismet"
}
```

<!-- ### VFSReference -->

### VFSReference {#vfsreference}

<!-- The _VFSReference_ resource is used to reference files that are stored in a virtual file system (VFS). The VFS is a file system that is stored in memory and can be used to store files that are not part of the file system of the operating system. The _VFSReference_ resource is defined as follows: -->

_VFSReference_ रिसोर्स का इस्तेमाल वर्चुअल फ़ाइल सिस्टम (VFS) में रखी फ़ाइलों का हवाला देने के लिए होता है। VFS एक ऐसा फ़ाइल सिस्टम है जो मेमोरी में रहता है, और उसमें ऐसी फ़ाइलें रखी जा सकती हैं जो ऑपरेटिंग सिस्टम के फ़ाइल सिस्टम का हिस्सा नहीं हैं। _VFSReference_ रिसोर्स की परिभाषा यह है:

```typescript
type VFSReference = {
	resource: 'vfs';
	path: string;
};
```

<!-- To use the _VFSReference_ resource, you need to provide the path to the file in the VFS. For example, to reference a file named "index.html" that is stored in the root of the VFS, you can create a _VFSReference_ as follows: -->

_VFSReference_ रिसोर्स इस्तेमाल करने के लिए आपको VFS में फ़ाइल का पाथ देना होगा। उदाहरण के लिए, VFS के रूट में रखी "index.html" नाम की फ़ाइल के लिए आप _VFSReference_ इस तरह बना सकते हैं:

```json
{
	"resource": "vfs",
	"path": "/index.html"
}
```

<!-- ### LiteralReference -->

### LiteralReference {#literalreference}

<!-- The _LiteralReference_ resource is used to reference files that are stored as literals in the code. The _LiteralReference_ resource is defined as follows: -->

_LiteralReference_ रिसोर्स का इस्तेमाल उन फ़ाइलों का हवाला देने के लिए होता है जो कोड में लिटरल के रूप में रखी होती हैं। _LiteralReference_ रिसोर्स की परिभाषा यह है:

```typescript
type LiteralReference = {
	resource: 'literal';
	name: string;
	contents: string | Uint8Array;
};
```

<!-- To use the _LiteralReference_ resource, you need to provide the name of the file and its contents. For example, to reference a file named "index.html" that contains the text "Hello, World!", you can create a _LiteralReference_ as follows: -->

_LiteralReference_ रिसोर्स इस्तेमाल करने के लिए आपको फ़ाइल का नाम और उसका कंटेंट देना होगा। उदाहरण के लिए, "Hello, World!" टेक्स्ट वाली "index.html" नाम की फ़ाइल के लिए आप _LiteralReference_ इस तरह बना सकते हैं:

```json
{
	"resource": "literal",
	"name": "index.html",
	"contents": "Hello, World!"
}
```

<!-- ### BundledReference -->

### BundledReference {#bundledreference}

<!-- The `BundledReference` resource is used to reference files that are bundled with the Blueprint itself. This is particularly useful for creating self-contained Blueprint bundles that include all necessary resources. The `BundledReference` resource is defined as follows: -->

`BundledReference` रिसोर्स का इस्तेमाल उन फ़ाइलों का हवाला देने के लिए होता है जो ब्लूप्रिंट के साथ ही बंडल की गई हों। यह खास तौर पर ऐसे ब्लूप्रिंट बंडल बनाने में काम आता है, जो अपने आप में पूरे हों और जिनमें सभी ज़रूरी रिसोर्स शामिल हों। `BundledReference` रिसोर्स की परिभाषा यह है:

```typescript
type BundledReference = {
	resource: 'bundled';
	path: string;
};
```

<!-- To use the `BundledReference` resource, you need to provide the relative path to the file within the bundle. For example, to reference a file named "plugin.php" that is bundled with the Blueprint, you can create a `BundledReference` as follows: -->

`BundledReference` रिसोर्स इस्तेमाल करने के लिए आपको बंडल के अंदर फ़ाइल का रिलेटिव पाथ देना होगा। उदाहरण के लिए, ब्लूप्रिंट के साथ बंडल की गई "plugin.php" नाम की फ़ाइल के लिए आप `BundledReference` इस तरह बना सकते हैं:

```json
{
	"resource": "bundled",
	"path": "plugin.php"
}
```

<!-- Blueprint bundles can be distributed in various formats, including: -->

ब्लूप्रिंट बंडल कई फ़ॉर्मेट में बाँटे जा सकते हैं, जैसे:

<!--
- ZIP files with a top-level `blueprint.json` file
- Directories containing a `blueprint.json` file and related resources
- Remote URLs where the Blueprint and its resources are hosted together
-->

- ऐसी ZIP फ़ाइलें, जिनके सबसे ऊपरी लेवल पर `blueprint.json` फ़ाइल हो
- ऐसी डायरेक्टरी, जिनमें एक `blueprint.json` फ़ाइल और उससे जुड़े रिसोर्स हों
- रिमोट URL, जहाँ ब्लूप्रिंट और उसके रिसोर्स एक साथ होस्ट हों

<!-- For more information on Blueprint bundles, see the [Blueprint Bundles](/blueprints/bundles) documentation. -->

ब्लूप्रिंट बंडल के बारे में ज़्यादा जानकारी के लिए [ब्लूप्रिंट बंडल](/blueprints/bundles) डॉक्यूमेंटेशन देखें।
