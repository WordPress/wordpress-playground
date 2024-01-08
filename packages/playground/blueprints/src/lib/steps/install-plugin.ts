import { UniversalPHP } from '@php-wasm/universal';
import { StepHandler } from '.';
import { installAsset } from './install-asset';
import { activatePlugin } from './activate-plugin';
import { makeEditorFrameControlled } from './apply-wordpress-patches';
import { zipNameToHumanName } from '../utils/zip-name-to-human-name';

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
		const { assetFolderPath } = await installAsset(playground, {
			zipFile: pluginZipFile,
			targetPath: `${await playground.documentRoot}/wp-content/plugins`,
		});

		// Activate

		const activate = 'activate' in options ? options.activate : true;

		if (activate) {
			await activatePlugin(
				playground,
				{
					pluginPath: assetFolderPath,
					pluginName: zipNiceName,
				},
				progress
			);
		}

		await applyGutenbergPatchOnce(playground);
	} catch (error) {
		console.error(
			`Proceeding without the ${zipNiceName} plugin. Could not install it in wp-admin. ` +
				`The original error was: ${error}`
		);
		console.error(error);
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
