import { StepHandler } from '.';
import { InstallAssetOptions, installAsset } from './install-asset';
import { activateTheme } from './activate-theme';
import { Directory } from '../resources';
import { importThemeStarterContent } from './import-theme-starter-content';
import { zipNameToHumanName } from '../utils/zip-name-to-human-name';
import { writeFiles } from '@php-wasm/universal';
import { joinPaths, randomString } from '@php-wasm/util';

/**
 * @inheritDoc installTheme
 * @hasRunnableExample
 * @needsLogin
 * @example
 *
 * <code>
 * {
 * 		"step": "installTheme",
 * 		"themeZipFile": {
 * 			"resource": "wordpress.org/themes",
 * 			"slug": "pendant"
 * 		},
 * 		"options": {
 * 			"activate": true,
 * 			"importStarterContent": true
 * 		}
 * }
 * </code>
 */
export interface InstallThemeStep<FileResource, DirectoryResource>
	extends Pick<InstallAssetOptions, 'ifAlreadyInstalled'> {
	/**
	 * The step identifier.
	 */
	step: 'installTheme';
	/**
	 * The theme zip file to install.
	 */
	themeZipFile: FileResource;
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
	themeDirectoryRoot?: DirectoryResource;
	/**
	 * Optional installation options.
	 */
	options?: {
		/**
		 * Whether to activate the theme after installing it.
		 */
		activate?: boolean;
		/**
		 * Whether to import the theme's starter content after installing it.
		 */
		importStarterContent?: boolean;
	};
}

export interface InstallThemeOptions {
	/**
	 * Whether to activate the theme after installing it.
	 */
	activate?: boolean;
}

/**
 * Installs a WordPress theme in the Playground.
 *
 * @param playground The playground client.
 * @param themeZipFile The theme zip file.
 * @param options Optional. Set `activate` to false if you don't want to activate the theme.
 */
export const installTheme: StepHandler<
	InstallThemeStep<File, Directory>
> = async (
	playground,
	{ themeZipFile, themeDirectoryRoot, ifAlreadyInstalled, options = {} },
	progress
) => {
	let assetFolderName = '';
	let zipNiceName = '';
	if (themeDirectoryRoot) {
		zipNiceName = themeDirectoryRoot.name;
		progress?.tracker.setCaption(`Installing the ${zipNiceName} plugin`);

		const pluginDirectoryPath = joinPaths(
			await playground.documentRoot,
			'wp-content',
			'plugins',
			themeDirectoryRoot.name + '-' + randomString(10, '')
		);
		await writeFiles(
			playground,
			pluginDirectoryPath,
			themeDirectoryRoot.files,
			{
				rmRoot: true,
			}
		);
		assetFolderName = zipNiceName;
	} else if (themeZipFile) {
		const zipNiceName = zipNameToHumanName(themeZipFile.name);
		progress?.tracker.setCaption(`Installing the ${zipNiceName} theme`);
		const assetResult = await installAsset(playground, {
			ifAlreadyInstalled,
			zipFile: themeZipFile,
			targetPath: `${await playground.documentRoot}/wp-content/themes`,
		});
		assetFolderName = assetResult.assetFolderName;
	}

	const activate = 'activate' in options ? options.activate : true;
	if (activate) {
		await activateTheme(
			playground,
			{
				themeFolderName: assetFolderName,
			},
			progress
		);
	}

	const importStarterContent =
		'importStarterContent' in options
			? options.importStarterContent
			: false;
	if (importStarterContent) {
		await importThemeStarterContent(
			playground,
			{
				themeSlug: assetFolderName,
			},
			progress
		);
	}
};
