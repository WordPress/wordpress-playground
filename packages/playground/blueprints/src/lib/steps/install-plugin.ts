import { UniversalPHP } from '@php-wasm/universal';
import { StepHandler } from '.';
import { zipNameToHumanName } from './common';
import { writeFile } from './client-methods';
import { activatePlugin } from './activate-plugin';
import { unzip } from './import-export';

/**
 * @inheritDoc installPlugin
 * @hasRunnableExample
 * @needsLogin
 * @landingPage /wp-admin/plugins.php
 * @example
 *
 * <code>
 * {
 * 	    "step": "installPlugin",
 * 		"pluginZipFile": {
 * 			"resource": "wordpress.org/plugins",
 * 			"slug": "gutenberg"
 * 		},
 * 		"options": {
 * 			"activate": true
 * 		}
 * }
 * </code>
 */
export interface InstallPluginStep<ResourceType> {
	/**
	 * The step identifier.
	 */
	step: 'installPlugin';
	/**
	 * The plugin zip file to install.
	 */
	pluginZipFile: ResourceType;
	/**
	 * Optional installation options.
	 */
	options?: InstallPluginOptions;
}

export interface InstallPluginOptions {
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
export const installPlugin: StepHandler<InstallPluginStep<File>> = async (
	playground,
	{ pluginZipFile, options = {} },
	progress?
) => {
	const zipFileName = pluginZipFile.name.split('/').pop() || 'plugin.zip';
	const zipNiceName = zipNameToHumanName(zipFileName);

	progress?.tracker.setCaption(`Installing the ${zipNiceName} plugin`);
	try {
		// Extract to temporary folder so we can find plugin folder name

		const tmpFolder = '/tmp/plugin';
		const tmpZipPath = `/tmp/${zipFileName}`;

		if (await playground.isDir(tmpFolder)) {
			await playground.unlink(tmpFolder);
		}

		await writeFile(playground, {
			path: tmpZipPath,
			data: pluginZipFile,
		});

		await unzip(playground, {
			zipPath: tmpZipPath,
			extractToPath: tmpFolder,
		});

		await playground.unlink(tmpZipPath);

		// Find extracted plugin folder name

		const files = await playground.listFiles(tmpFolder);

		let pluginFolderName;
		let tmpPluginPath = '';

		for (const file of files) {
			tmpPluginPath = `${tmpFolder}/${file}`;
			if (await playground.isDir(tmpPluginPath)) {
				pluginFolderName = file;
				break;
			}
		}

		if (!pluginFolderName) {
			throw new Error(
				`The plugin zip file should contain a folder with plugin files inside, but the provided zip file (${zipFileName}) does not contain such a folder.`
			);
		}

		// Move it to site plugins
		const rootPath = await playground.documentRoot;
		const pluginPath = `${rootPath}/wp-content/plugins/${pluginFolderName}`;

		await playground.mv(tmpPluginPath, pluginPath);

		const activate = 'activate' in options ? options.activate : true;

		if (activate) {
			await activatePlugin(
				playground,
				{
					pluginPath,
				},
				progress
			);
		}

		await maybeApplyGutenbergPatch(playground);
	} catch (error) {
		console.error(
			`Proceeding without the ${zipNiceName} plugin. Could not install it in wp-admin. ` +
				`The original error was: ${error}`
		);
		console.error(error);
	}
};

async function maybeApplyGutenbergPatch(playground: UniversalPHP) {
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
		(await playground.isDir('/wordpress/wp-content/plugins/gutenberg')) &&
		!(await playground.fileExists('/wordpress/.gutenberg-patched'))
	) {
		await playground.writeFile('/wordpress/.gutenberg-patched', '1');
		await updateFile(
			playground,
			`/wordpress/wp-content/plugins/gutenberg/build/block-editor/index.js`,
			(contents) =>
				contents.replace(
					/srcDoc:("[^"]+"|[^,]+)/g,
					'src:"/wp-includes/empty.html"'
				)
		);
		await updateFile(
			playground,
			`/wordpress/wp-content/plugins/gutenberg/build/block-editor/index.min.js`,
			(contents) =>
				contents.replace(
					/srcDoc:("[^"]+"|[^,]+)/g,
					'src:"/wp-includes/empty.html"'
				)
		);
	}
}

async function updateFile(
	playground: UniversalPHP,
	path: string,
	callback: (contents: string) => string
) {
	return await playground.writeFile(
		path,
		callback(await playground.readFileAsText(path))
	);
}
