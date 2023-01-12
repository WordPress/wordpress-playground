import type { SpawnedWorkerThread } from 'src/php-wasm-browser/index';

export async function login(
	workerThread: SpawnedWorkerThread,
	user = 'admin',
	password = 'password'
) {
	await workerThread.HTTPRequest({
		absoluteUrl: workerThread.pathToInternalUrl('/wp-login.php'),
	});

	await workerThread.HTTPRequest({
		absoluteUrl: workerThread.pathToInternalUrl('/wp-login.php'),
		method: 'POST',
		headers: {
			'content-type': 'application/x-www-form-urlencoded',
		},
		body: new URLSearchParams({
			log: user,
			pwd: password,
			rememberme: 'forever',
		}).toString(),
	});
}

export async function installPlugin(
	workerThread: SpawnedWorkerThread,
	pluginZipFile: File,
	options: any = {}
) {
	const activate = 'activate' in options ? options.activate : true;

	// Upload it to WordPress
	const pluginForm = await workerThread.HTTPRequest({
		absoluteUrl: workerThread.pathToInternalUrl(
			'/wp-admin/plugin-install.php?tab=upload'
		),
	});
	const pluginFormPage = new DOMParser().parseFromString(
		pluginForm.text,
		'text/html'
	);
	const pluginFormData = new FormData(
		pluginFormPage.querySelector('.wp-upload-form')! as HTMLFormElement
	) as any;
	const { pluginzip, ...postData } = Object.fromEntries(
		pluginFormData.entries()
	);

	const pluginInstalledResponse = await workerThread.HTTPRequest({
		absoluteUrl: workerThread.pathToInternalUrl(
			'/wp-admin/update.php?action=upload-plugin'
		),
		method: 'POST',
		headers: {
			'content-type': 'application/x-www-form-urlencoded',
		},
		body: new URLSearchParams(postData).toString(),
		files: { pluginzip: pluginZipFile },
	});

	// Activate if needed
	if (activate) {
		const pluginInstalledPage = new DOMParser().parseFromString(
			pluginInstalledResponse.text,
			'text/html'
		)!;
		const activateButtonHref = pluginInstalledPage
			.querySelector('#wpbody-content .button.button-primary')!
			.attributes.getNamedItem('href')!.value;
		const activatePluginUrl = new URL(
			activateButtonHref,
			workerThread.pathToInternalUrl('/wp-admin/')
		).toString();
		await workerThread.HTTPRequest({
			absoluteUrl: activatePluginUrl,
		});
	}

	/**
	 * Pair the site editor's nested iframe to the Service Worker.
	 *
	 * Without the patch below, the site editor initiates network requests that
	 * aren't routed through the service worker. That's a known browser issue:
	 *
	 * * https://bugs.chromium.org/p/chromium/issues/detail?id=880768
	 * * https://bugzilla.mozilla.org/show_bug.cgi?id=1293277
	 * * https://github.com/w3c/ServiceWorker/issues/765
	 *
	 * The problem with iframes using srcDoc and src="about:blank" as they
	 * fail to inherit the root site's service worker.
	 *
	 * Gutenberg loads the site editor using <iframe srcDoc="<!doctype html">
	 * to force the standards mode and not the quirks mode:
	 *
	 * https://github.com/WordPress/gutenberg/pull/38855
	 *
	 * This commit patches the site editor to achieve the same result via
	 * <iframe src="/doctype.html"> and a doctype.html file containing just
	 * `<!doctype html>`. This allows the iframe to inherit the service worker
	 * and correctly load all the css, js, fonts, images, and other assets.
	 *
	 * Ideally this issue would be fixed directly in Gutenberg and the patch
	 * below would be removed.
	 *
	 * See https://github.com/WordPress/wordpress-playground/issues/42 for more details
	 */
	if (
		(await workerThread.isDir('/wordpress/wp-content/plugins/gutenberg')) &&
		!(await workerThread.fileExists('/wordpress/.gutenberg-patched'))
	) {
		async function patchFile(path, callback) {
			return await workerThread.writeFile(
				path,
				callback(await workerThread.readFile(path))
			);
		}
		await workerThread.writeFile('/wordpress/.gutenberg-patched', '1');
		await patchFile(
			`/wordpress/wp-content/plugins/gutenberg/build/block-editor/index.js`,
			(contents) =>
				contents.replace(
					/srcDoc:"[^"]+"/g,
					'src:"/wp-includes/empty.html"'
				)
		);
		await patchFile(
			`/wordpress/wp-content/plugins/gutenberg/build/block-editor/index.min.js`,
			(contents) =>
				contents.replace(
					/srcDoc:"[^"]+"/g,
					'src:"/wp-includes/empty.html"'
				)
		);
	}
}

export async function installTheme(
	workerThread: SpawnedWorkerThread,
	themeZipFile: File,
	options: any = {}
) {
	const activate = 'activate' in options ? options.activate : true;

	// Upload it to WordPress
	const themeForm = await workerThread.HTTPRequest({
		absoluteUrl: workerThread.pathToInternalUrl(
			'/wp-admin/theme-install.php'
		),
	});
	const themeFormPage = new DOMParser().parseFromString(
		themeForm.text,
		'text/html'
	);
	const themeFormData = new FormData(
		themeFormPage.querySelector('.wp-upload-form')! as HTMLFormElement
	) as any;
	const { themezip, ...postData } = Object.fromEntries(
		themeFormData.entries()
	);

	const themeInstalledResponse = await workerThread.HTTPRequest({
		absoluteUrl: workerThread.pathToInternalUrl(
			'/wp-admin/update.php?action=upload-theme'
		),
		method: 'POST',
		headers: {
			'content-type': 'application/x-www-form-urlencoded',
		},
		body: postData,
		files: { themezip: themeZipFile },
	});

	// Activate if needed
	if (activate) {
		const themeInstalledPage = new DOMParser().parseFromString(
			themeInstalledResponse.text,
			'text/html'
		)!;

		const messageContainer = themeInstalledPage.querySelector(
			'#wpbody-content > .wrap'
		);
		if (
			messageContainer?.textContent?.includes(
				'Theme installation failed.'
			)
		) {
			console.error(messageContainer?.textContent);
			return;
		}

		const activateButton = themeInstalledPage.querySelector(
			'#wpbody-content .activatelink, ' +
				'.update-from-upload-actions .button.button-primary'
		);
		if (!activateButton) {
			console.error('The "activate" button was not found.');
			return;
		}

		const activateButtonHref =
			activateButton.attributes.getNamedItem('href')!.value;
		const activateThemeUrl = new URL(
			activateButtonHref,
			workerThread.pathToInternalUrl('/wp-admin/')
		).toString();
		await workerThread.HTTPRequest({
			absoluteUrl: activateThemeUrl,
		});
	}
}
