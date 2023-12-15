import { UniversalPHP, writeFile } from '@php-wasm/universal';
import { StepHandler } from '.';
import { zipNameToHumanName } from '../utils/zip-name-to-human-name';
import { activatePlugin } from './activate-plugin';
import { makeEditorFrameControlled } from './apply-wordpress-patches';
import { joinPaths } from '@php-wasm/util';
import { flattenDirectory } from '../utils/flatten-directory';
import { unzipFiles } from '@wp-playground/stream-compression';

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
	/**
	 * @private
	 */
	files?: AsyncIterable<File>;
}

export interface InstallPluginOptions {
	/**
	 * Whether to activate the plugin after installing it.
	 */
	activate?: boolean;
}

/**
 * Installs a WordPress plugin in the Playground.
 *
 * @param php The playground client.
 * @param pluginZipFile The plugin zip file.
 * @param options Optional. Set `activate` to false if you don't want to activate the plugin.
 */
export const installPlugin: StepHandler<InstallPluginStep<File>> = async (
	php,
	{ pluginZipFile, files, options = {} },
	progress?
) => {
	files = files || unzipFiles(pluginZipFile.stream());
	const zipFileName = pluginZipFile?.name.split('/').pop() || 'plugin.zip';
	const zipNiceName = zipNameToHumanName(zipFileName);
	const assetName = zipFileName.replace(/\.zip$/, '');

	progress?.tracker.setCaption(`Installing the ${zipNiceName} plugin`);
	try {
		const extractTo = joinPaths(
			await php.documentRoot,
			'wp-content/plugins',
			crypto.randomUUID()
		);
		for await (const file of files!) {
			await writeFile(php, extractTo, file);
		}
		const pluginPath = await flattenDirectory(php, extractTo, assetName);

		// Activate
		const activate = 'activate' in options ? options.activate : true;
		if (activate) {
			await activatePlugin(
				php,
				{
					pluginPath,
					pluginName: zipNiceName,
				},
				progress
			);
		}

		await applyGutenbergPatchOnce(php);
	} catch (error) {
		console.error(
			`Proceeding without the ${zipNiceName} plugin. Could not install it in wp-admin. ` +
				`The original error was: ${error}`
		);
		console.trace(error);
	}
};

async function applyGutenbergPatchOnce(playground: UniversalPHP) {
	/**
	 * Ensures the block editor iframe is controlled by the playground
	 * service worker. Tl;dr it must use a HTTP URL as its src, not a
	 * data URL, blob URL, or a srcDoc like it does by default.
	 *
	 * @see https://github.com/WordPress/wordpress-playground/pull/668
	 */

	if (
		(await playground.isDir('/wordpress/wp-content/plugins/gutenberg')) &&
		!(await playground.fileExists('/wordpress/.gutenberg-patched'))
	) {
		await playground.writeFile('/wordpress/.gutenberg-patched', '1');
		await makeEditorFrameControlled(playground, '/wordpress', [
			`/wordpress/wp-content/plugins/gutenberg/build/block-editor/index.js`,
			`/wordpress/wp-content/plugins/gutenberg/build/block-editor/index.min.js`,
		]);
	}
}
