---
slug: /developers/apis/javascript-api/mount-data
---

# マウントデータ

<!--
# Mount data
-->

## ブラウザからディレクトリをマウントする

<!--
## Mount a directory from the browser
-->

ブラウザから Playground にディレクトリをマウントするには、`window.showDirectoryPicker` API を使用できます。この API を使用する前に、[ブラウザの互換性](https://developer.mozilla.org/ja/docs/Web/API/Window/showDirectoryPicker#%E3%83%96%E3%83%A9%E3%82%A6%E3%82%B6%E3%83%BC%E3%81%AE%E4%BA%92%E6%8F%9B%E6%80%A7)を確認してください。

<!--
You can mount a directory from the browser to Playground using the `window.showDirectoryPicker` API. Check the [Browser compatibility](https://developer.mozilla.org/en-US/docs/Web/API/Window/showDirectoryPicker#browser_compatibility) before using this API.
-->

```javascript
window.showDirectoryPicker().then(function (directoryHandle) {
	window.parent.postMessage({
		type: 'mount-directory-handle',
		directoryHandle,
		mountpoint: '/wordpress/wp-content/uploads/markdown/',
	});
});
```

## ブラウザの OPFS ストレージをマウントする

<!--
## Mount Browser's OPFS Storage
-->

ブラウザ内で利用可能な OPFS ストレージをマウントすることもできます。内部的には、PHP リクエストが処理されるたびに、メモリファイルシステムが OPFS に同期されます。WordPress のインストール時に 3000 個以上のファイルの同期が発生して起動プロセスが遅くなるのを防ぐため、以下に示すように、起動後に OPFS のマウントを遅延させることをお勧めします。

<!--
You can mount OPFS storage available within the browser as well. Under the hood, we sync the memory filesystem to OPFS at the end of every PHP request served. It's advisable to delay mounting of OPFS after boot as shown below, so that WordPress installation doesn't trigger a sync of over 3000 files slowing down the boot process.
-->

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

データの永続性に関する保証については、「ストレージの割り当て量と削除基準」（https://developer.mozilla.org/ja/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria）をご確認ください。

<!--
For persistence guarantees, check [Storage quotes and eviction criterias](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria).
-->
