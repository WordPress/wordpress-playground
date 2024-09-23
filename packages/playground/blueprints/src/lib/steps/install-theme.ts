import { StepHandler } from '.';
import { InstallAssetOptions, installAsset } from './install-asset';
import { activateTheme } from './activate-theme';
import { Directory } from '../resources';
import { importThemeStarterContent } from './import-theme-starter-content';
import { zipNameToHumanName } from '../utils/zip-name-to-human-name';
import { writeFiles } from '@php-wasm/universal';
import { joinPaths, randomString } from '@php-wasm/util';
import { logger } from '@php-wasm/logger';

/**
 * @inheritDoc installTheme
 * @hasRunnableExample
 * @needsLogin
 * @example
 *
 * <code>
 * {
 * 		"step": "installTheme",
 * 		"themeData": {
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
	 * The theme files to install. It can be either a theme zip file, or a
	 * directory containing all the theme files at its root.
	 */
	themeData: FileResource | DirectoryResource;
	/**
	 * @deprecated. Use `themeData` instead.
	 */
	themeZipFile?: FileResource;
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
	{ themeData, themeZipFile, ifAlreadyInstalled, options = {} },
	progress
) => {
	if (themeZipFile) {
		themeData = themeZipFile;
		logger.warn(
			'The "themeZipFile" option is deprecated. Use "themeData" instead.'
		);
	}

	let assetFolderName = '';
	let assetNiceName = '';
	if (themeData instanceof File) {
		// @TODO: Consider validating whether this is a zip file?
		const zipNiceName = zipNameToHumanName(themeData.name);
		progress?.tracker.setCaption(`Installing the ${zipNiceName} theme`);
		const assetResult = await installAsset(playground, {
			ifAlreadyInstalled,
			zipFile: themeData,
			targetPath: `${await playground.documentRoot}/wp-content/themes`,
		});
		assetFolderName = assetResult.assetFolderName;
	} else {
		assetNiceName = themeData.name;
		progress?.tracker.setCaption(`Installing the ${assetNiceName} plugin`);

		const pluginDirectoryPath = joinPaths(
			await playground.documentRoot,
			'wp-content',
			'plugins',
			themeData.name + '-' + randomString(10, '')
		);
		await writeFiles(playground, pluginDirectoryPath, themeData.files, {
			rmRoot: true,
		});
		assetFolderName = assetNiceName;
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
