import { StepHandler } from '.';
import { InstallAssetOptions, installAsset } from './install-asset';
import { activatePlugin } from './activate-plugin';
import { zipNameToHumanName } from '../utils/zip-name-to-human-name';
import { Directory } from '../resources';
import { joinPaths, randomString } from '@php-wasm/util';
import { writeFiles } from '@php-wasm/universal';

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
 * 		"pluginData": {
 * 			"resource": "wordpress.org/plugins",
 * 			"slug": "gutenberg"
 * 		},
 * 		"options": {
 * 			"activate": true
 * 		}
 * }
 * </code>
 *
 * @example
 *
 * <code>
 * {
 * 	    "step": "installPlugin",
 * 		"pluginData": {
 * 			"resource": "git:directory",
 * 			"url": "https://github.com/wordpress/wordpress-playground.git",
 *          "ref": "HEAD",
 *          "path": "wp-content/plugins/hello-dolly"
 * 		},
 * 		"options": {
 * 			"activate": true
 * 		}
 * }
 * </code>
 */
export interface InstallPluginStep<FileResource, DirectoryResource>
	extends Pick<InstallAssetOptions, 'ifAlreadyInstalled'> {
	/**
	 * The step identifier.
	 */
	step: 'installPlugin';
	/**
	 * The plugin files to install. It can be either a plugin zip file, or a
	 * directory containing all the plugin files at its root.
	 */
	pluginData?: FileResource | DirectoryResource;
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
 * @param pluginData The plugin zip file.
 * @param options Optional. Set `activate` to false if you don't want to activate the plugin.
 */
export const installPlugin: StepHandler<
	InstallPluginStep<File, Directory>
> = async (
	playground,
	{ pluginData, ifAlreadyInstalled, options = {} },
	progress?
) => {
	let assetFolderPath = '';
	let assetNiceName = '';
	if (pluginData instanceof File) {
		// @TODO: Consider validating whether this is a zip file?
		const zipFileName = pluginData.name.split('/').pop() || 'plugin.zip';
		assetNiceName = zipNameToHumanName(zipFileName);

		progress?.tracker.setCaption(`Installing the ${assetNiceName} plugin`);
		const assetResult = await installAsset(playground, {
			ifAlreadyInstalled,
			zipFile: pluginData,
			targetPath: `${await playground.documentRoot}/wp-content/plugins`,
		});
		assetFolderPath = assetResult.assetFolderPath;
		assetNiceName = assetResult.assetFolderName;
	} else if (pluginData) {
		assetNiceName = pluginData.name;
		progress?.tracker.setCaption(`Installing the ${assetNiceName} plugin`);

		const pluginDirectoryPath = joinPaths(
			await playground.documentRoot,
			'wp-content',
			'plugins',
			pluginData.name + '-' + randomString(10, '')
		);
		await writeFiles(playground, pluginDirectoryPath, pluginData.files, {
			rmRoot: true,
		});
		assetFolderPath = pluginDirectoryPath;
	}

	// Activate
	const activate = 'activate' in options ? options.activate : true;

	if (activate) {
		await activatePlugin(
			playground,
			{
				pluginPath: assetFolderPath,
				pluginName: assetNiceName,
			},
			progress
		);
	}
};
