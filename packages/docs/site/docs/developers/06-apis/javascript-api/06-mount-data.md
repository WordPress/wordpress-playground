---
slug: /developers/apis/javascript-api/mount-data
---

# Mount data

## Mount a directory from the browser

You can mount a directory from the browser to Playground using the `window.showDirectoryPicker` API. Check the [Browser compatibility](https://developer.mozilla.org/en-US/docs/Web/API/Window/showDirectoryPicker#browser_compatibility) before using this API.

```javascript
window.showDirectoryPicker().then(function (directoryHandle) {
	window.parent.postMessage({
		type: 'mount-directory-handle',
		directoryHandle,
		mountpoint: '/wordpress/wp-content/uploads/markdown/',
	});
});
```

## Mount Browser's OPFS Storage

You can mount OPFS storage available within the browser as well. Under the hood, we sync the memory filesystem to OPFS at the end of every PHP request served. It's advisable to delay mounting of OPFS after boot as shown below, so that WordPress installation doesn't trigger a sync of over 3000 files slowing down the boot process.

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

	const client = await startPlaygroundWeb( {
		iframe: document.getElementById('wp'),
		remoteUrl: 'https://playground.wordpress.net/remote.html',
		blueprint: blueprint,
		shouldInstallWordPress: ! hasWordPressSiteInOPFS,
		mounts: hasWordPressSiteInOPFS ? [ mountDescriptor ] : [],
	} );

	if ( ! hasWordPressSiteInOPFS ) {
		await client.mountOpfs( mountDescriptor );
	}

	await client.isReady();
	return client;
} catch ( error ) {
	// handle error here
}
```

For persistence guarantees, check [Storage quotes and eviction criterias](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria).
