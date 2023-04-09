import { asDOM } from './common';
import type { PlaygroundClient } from '../';

interface InstallPluginOptions {
	/**
	 * Whether to activate the plugin after installing it.
	 */
	activate?: boolean;
}

/**
 * Installs a WordPress plugin in the Playground.
 * Technically, it uses the same plugin upload form as a WordPress user
 * would, and then activates the plugin if needed.
 *
 * @param playground The playground client.
 * @param pluginZipFile The plugin zip file.
 * @param options Optional. Set `activate` to false if you don't want to activate the plugin.
 */
export async function installPlugin(
	playground: PlaygroundClient,
	pluginZipFile: File,
	options: InstallPluginOptions = {}
) {
	const activate = 'activate' in options ? options.activate : true;

	// Upload it to WordPress
	const pluginForm = await playground.request({
		url: '/wp-admin/plugin-install.php?tab=upload',
	});
	const pluginFormPage = asDOM(pluginForm);
	const pluginFormData = new FormData(
		pluginFormPage.querySelector('.wp-upload-form')! as HTMLFormElement
	) as any;
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const { pluginzip, ...postData } = Object.fromEntries(
		pluginFormData.entries()
	);

	const pluginInstalledResponse = await playground.request({
		url: '/wp-admin/update.php?action=upload-plugin',
		method: 'POST',
		formData: postData,
		files: { pluginzip: pluginZipFile },
	});

	// Activate if needed
	if (activate) {
		const pluginInstalledPage = asDOM(pluginInstalledResponse);
		const activateButtonHref = pluginInstalledPage
			.querySelector('#wpbody-content .button.button-primary')!
			.attributes.getNamedItem('href')!.value;
		const activatePluginUrl = new URL(
			activateButtonHref,
			await playground.pathToInternalUrl('/wp-admin/')
		).toString();
		await playground.request({
			url: activatePluginUrl,
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
	async function patchFile(
		path: string,
		callback: (contents: string) => string
	) {
		return await playground.writeFile(
			path,
			callback(await playground.readFileAsText(path))
		);
	}
	if (
		(await playground.isDir('/wordpress/wp-content/plugins/gutenberg')) &&
		!(await playground.fileExists('/wordpress/.gutenberg-patched'))
	) {
		await playground.writeFile('/wordpress/.gutenberg-patched', '1');
		await patchFile(
			`/wordpress/wp-content/plugins/gutenberg/build/block-editor/index.js`,
			(contents) =>
				contents.replace(
					/srcDoc:("[^"]+"|[^,]+)/g,
					'src:"/wp-includes/empty.html"'
				)
		);
		await patchFile(
			`/wordpress/wp-content/plugins/gutenberg/build/block-editor/index.min.js`,
			(contents) =>
				contents.replace(
					/srcDoc:("[^"]+"|[^,]+)/g,
					'src:"/wp-includes/empty.html"'
				)
		);
	}
}
