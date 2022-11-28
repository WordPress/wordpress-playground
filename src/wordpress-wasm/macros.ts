import type { SpawnedWorkerThread } from "src/php-wasm-browser/index";

export async function login(
	workerThread,
	user = 'admin',
	password = 'password'
) {
	await workerThread.HTTPRequest({
		path: workerThread.pathToInternalUrl('/wp-login.php'),
	});

	await workerThread.HTTPRequest({
		path: workerThread.pathToInternalUrl('/wp-login.php'),
		method: 'POST',
		_POST: {
			log: user,
			pwd: password,
			rememberme: 'forever',
		},
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
		path: workerThread.pathToInternalUrl(
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
		path: workerThread.pathToInternalUrl(
			'/wp-admin/update.php?action=upload-plugin'
		),
		method: 'POST',
		_POST: postData,
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
			path: activatePluginUrl,
		});
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
		path: workerThread.pathToInternalUrl('/wp-admin/theme-install.php'),
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
		path: workerThread.pathToInternalUrl(
			'/wp-admin/update.php?action=upload-theme'
		),
		method: 'POST',
		_POST: postData,
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
			path: activateThemeUrl,
		});
	}
}
