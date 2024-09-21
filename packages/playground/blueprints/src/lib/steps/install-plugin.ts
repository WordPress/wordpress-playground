import { StepHandler } from '.';
import { InstallAssetOptions, installAsset } from './install-asset';
import { activatePlugin } from './activate-plugin';
import { zipNameToHumanName } from '../utils/zip-name-to-human-name';
import { FileTree } from '../resources';
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
 * 		"pluginZipFile": {
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
 * 		"pluginDirectory": {
 * 			"resource": "git-directory",
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
	 * The directory containing the plugin files. The plugin
	 * file structure must start at the root without nesting.
	 *
	 * Good structure:
	 *
	 * 	    /index.php
	 *
	 * Bad structure:
	 *
	 * 	    /plugin/index.php
	 */
	pluginDirectory: DirectoryResource;
	/**
	 * The plugin zip file to install.
	 */
	pluginZipFile: FileResource;
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
export const installPlugin: StepHandler<
	InstallPluginStep<File, FileTree>
> = async (
	playground,
	{ pluginZipFile, pluginDirectory, ifAlreadyInstalled, options = {} },
	progress?
) => {
	let assetFolderPath = '';
	let zipNiceName = '';
	if (pluginDirectory) {
		const pluginDirectoryPath = joinPaths(
			await playground.documentRoot,
			'wp-content',
			'plugins',
			randomString()
		);
		await writeFiles(playground, pluginDirectoryPath, pluginDirectory, {
			rmRoot: true,
		});
		assetFolderPath = pluginDirectoryPath;
		zipNiceName = 'Plugin...'; // @TODO: Use human name of plugin
	} else {
		const zipFileName = pluginZipFile.name.split('/').pop() || 'plugin.zip';
		zipNiceName = zipNameToHumanName(zipFileName);

		progress?.tracker.setCaption(`Installing the ${zipNiceName} plugin`);
		const assetResult = await installAsset(playground, {
			ifAlreadyInstalled,
			zipFile: pluginZipFile,
			targetPath: `${await playground.documentRoot}/wp-content/plugins`,
		});
		assetFolderPath = assetResult.assetFolderPath;
		zipNiceName = assetResult.assetFolderName;
	}

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
};
