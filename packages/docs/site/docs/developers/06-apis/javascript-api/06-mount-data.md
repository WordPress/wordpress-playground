---
title: Mount data
slug: /developers/apis/javascript-api/mount-data
description: Mount a local folder in WordPress Playground and save your site to the browser’s OPFS storage so you can restore it after reloading.
---

# Mount data

The examples on this page use a [self-hosted Playground](/developers/architecture/host-your-own-playground). Save each example as an HTML file next to `remote.html` and serve it from the same origin over HTTPS or on localhost. Both examples load the client bundled with that Playground build.

## Mount a directory from the browser

Call `window.showDirectoryPicker()` from a user action, such as a button click. Pass the returned handle to `client.mountOpfs()` with a `local-fs` device. The `opfs-to-memfs` direction copies the selected folder's existing files into Playground on mount. Playground then syncs its changes back to the folder, so request read and write access when opening the picker.

Open the example directly in a browser that [supports the directory picker](https://developer.mozilla.org/en-US/docs/Web/API/Window/showDirectoryPicker#browser_compatibility). Browsers restrict directory handles to the origin that obtained them. A handle picked on your own domain cannot be sent to an iframe at `https://playground.wordpress.net/remote.html`. The client handles communication with the iframe when you call `mountOpfs()`.

```html
<!doctype html>
<button id="mount-folder" type="button" disabled>Mount a folder</button>
<pre id="mounted-files"></pre>
<iframe id="wp" title="WordPress Playground" width="100%" height="500"></iframe>

<script type="module">
	import { startPlaygroundWeb } from './client/index.js';

	const client = await startPlaygroundWeb({
		iframe: document.getElementById('wp'),
		remoteUrl: new URL('./remote.html', location.href).href,
	});
	const button = document.getElementById('mount-folder');
	const output = document.getElementById('mounted-files');
	const mountpoint = '/wordpress/wp-content/uploads/markdown';

	button.disabled = false;
	button.addEventListener('click', async () => {
		button.disabled = true;
		try {
			const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
			await client.mountOpfs({
				device: { type: 'local-fs', handle },
				mountpoint,
				initialSyncDirection: 'opfs-to-memfs',
			});
		} catch (error) {
			button.disabled = false;
			if (error.name !== 'AbortError') {
				output.textContent = error.message;
			}
			return;
		}
		const files = await client.listFiles(mountpoint);
		output.textContent = files.join('\n') || 'This folder is empty.';
	});
</script>
```

## Mount browser's OPFS storage

The Origin Private File System (OPFS) is browser-managed file storage scoped to an origin. Playground can use it to keep WordPress files, plugins, and the SQLite database across page reloads. The browser manages this storage without a folder picker. Clearing the site's browser data also clears its OPFS files. See the browser's [storage quotas and eviction criteria](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria).

On the first visit, let Playground install WordPress in memory, then mount OPFS with `memfs-to-opfs` to copy the site into browser storage. The example creates a marker in the OPFS directory after `flushOpfs()` completes. On later visits, it checks for that marker and passes the same directory in `mounts` with `opfs-to-memfs`, so Playground loads the existing site during startup.

```html
<!doctype html>
<p id="storage-status" role="status">Starting WordPress…</p>
<iframe id="wp" title="WordPress Playground" width="100%" height="500"></iframe>

<script type="module">
	import { startPlaygroundWeb } from './client/index.js';

	const siteName = 'mount-data-example-site';
	const opfsRoot = await navigator.storage.getDirectory();
	const savedDirectory = await opfsRoot.getDirectoryHandle(siteName, { create: true });
	const readyFile = '.initial-save-complete';
	let hasSavedSite;

	try {
		await savedDirectory.getFileHandle(readyFile);
		hasSavedSite = true;
	} catch (error) {
		if (error.name !== 'NotFoundError') {
			throw error;
		}
		hasSavedSite = false;
	}

	const mount = {
		device: { type: 'opfs', path: siteName },
		mountpoint: '/wordpress',
		initialSyncDirection: hasSavedSite ? 'opfs-to-memfs' : 'memfs-to-opfs',
	};
	const client = await startPlaygroundWeb({
		iframe: document.getElementById('wp'),
		remoteUrl: new URL('./remote.html', location.href).href,
		scope: siteName,
		blueprint: { login: true, landingPage: '/wp-admin/' },
		mounts: hasSavedSite ? [mount] : [],
		wordpressInstallMode: hasSavedSite
			? 'install-from-existing-files-if-needed'
			: 'download-and-install',
	});

	if (!hasSavedSite) {
		await client.mountOpfs(mount);
		await client.flushOpfs(mount.mountpoint);
		await savedDirectory.getFileHandle(readyFile, { create: true });
	}

	document.getElementById('storage-status').textContent = 'WordPress is using browser storage.';
</script>
```

Once the page says **WordPress is using browser storage**, publish a post in WordPress and reload the embedding page. Open **Posts** to see the saved post. Playground syncs changes as it serves PHP requests. Call `await client.flushOpfs('/wordpress')` when your application needs to wait for pending writes to reach OPFS before continuing.

In a cross-origin embed, Playground opens the OPFS path from the runtime iframe's browser storage. The marker check above uses the embedding page's storage, so it requires both pages to share an origin.
