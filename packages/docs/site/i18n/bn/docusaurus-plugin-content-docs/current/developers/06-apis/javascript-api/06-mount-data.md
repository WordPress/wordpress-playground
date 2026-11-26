---
slug: /developers/apis/javascript-api/mount-data
---

<!--
# Mount data
-->

# ডেটা মাউন্ট করা (Mount data) {#mount-data}

<!--
## Mount a directory from the browser
-->

## ব্রাউজার থেকে একটি ডিরেক্টরি মাউন্ট করা (Mount a directory from the browser) {#mount-a-directory-from-the-browser}

<!--
You can mount a directory from the browser to Playground using the `window.showDirectoryPicker` API. Check the [Browser compatibility](https://developer.mozilla.org/en-US/docs/Web/API/Window/showDirectoryPicker#browser_compatibility) before using this API.
-->

আপনি `window.showDirectoryPicker` API ব্যবহার করে ব্রাউজার থেকে প্লেগ্রাউন্ডে একটি ডিরেক্টরি মাউন্ট করতে পারেন। এই API ব্যবহার করার আগে [ব্রাউজার সামঞ্জস্যতা (Browser compatibility)](https://developer.mozilla.org/en-US/docs/Web/API/Window/showDirectoryPicker#browser_compatibility) দেখে নিন।

```javascript
window.showDirectoryPicker().then(function (directoryHandle) {
	window.parent.postMessage({
		type: 'mount-directory-handle',
		directoryHandle,
		mountpoint: '/wordpress/wp-content/uploads/markdown/',
	});
});
```

<!--
## Mount Browser's OPFS Storage
-->

## ব্রাউজারের OPFS স্টোরেজ মাউন্ট করা (Mount Browser's OPFS Storage) {#mount-browsers-opfs-storage}

<!--
You can mount OPFS storage available within the browser as well. Under the hood, we sync the memory filesystem to OPFS at the end of every PHP request served. It's advisable to delay mounting of OPFS after boot as shown below, so that WordPress installation doesn't trigger a sync of over 3000 files slowing down the boot process.
-->

আপনি একইভাবে ব্রাউজারে উপলব্ধ OPFS স্টোরেজও মাউন্ট করতে পারেন। পর্দার আড়ালে (under the hood), পরিবেশিত প্রতিটি PHP রিকোয়েস্টের শেষে মেমোরি ফাইলসিস্টেমকে OPFS-এ সিঙ্ক (sync) করা হয়। নিচে প্রদর্শিত পদ্ধতি অনুযায়ী সিস্টেম বুট হওয়ার পর OPFS মাউন্ট করার পরামর্শ দেওয়া হচ্ছে, যাতে ওয়ার্ডপ্রেস ইনস্টলেশন ৩০০০-এর বেশি ফাইলের সিঙ্ক ট্রিগার করে বুট প্রক্রিয়াকে ধীরগতির না করে দেয়।

```javascript
const hasWordPressSiteInOPFS = false; // roll your logic to track this
const blueprint = {
	preferredVersions: {
		php: '8.4',
		wp: 'latest',
	},
	features: {
		networking: true,
	},
	login: true,
	steps: [], // add steps
};

try {
	const mountDescriptor: MountDescriptor = {
		device: {
			type: 'opfs',
			path: `my-unique-prefix/my-site`,
		},
		mountpoint: '/wordpress',
		initialSyncDirection: hasWordPressSiteInOPFS ? 'opfs-to-memfs' : 'memfs-to-opfs',
	};

	const client = await startPlaygroundWeb({
		iframe: document.getElementById('wp'),
		remoteUrl: 'https://playground.wordpress.net/remote.html',
		blueprint: blueprint,
		shouldInstallWordPress: !hasWordPressSiteInOPFS,
		mounts: hasWordPressSiteInOPFS ? [mountDescriptor] : [],
	});

	if (!hasWordPressSiteInOPFS) {
		await client.mountOpfs(mountDescriptor);
	}

	await client.isReady();
	return client;
} catch (error) {
	// handle error here
}
```

<!--
For persistence guarantees, check [Storage quotes and eviction criterias](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria).
-->

স্টোরেজের স্থায়িত্ব নিশ্চিতকরণের (persistence guarantees) জন্য, [স্টোরেজ কোটা এবং এভিকশন নীতি (Storage quotes and eviction criterias)](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria) দেখুন।
