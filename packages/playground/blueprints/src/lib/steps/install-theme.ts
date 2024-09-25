import { StepHandler } from '.';
import { InstallAssetOptions, installAsset } from './install-asset';
import { activateTheme } from './activate-theme';
import { importThemeStarterContent } from './import-theme-starter-content';
import { zipNameToHumanName } from '../utils/zip-name-to-human-name';

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
export interface InstallThemeStep<ResourceType>
	extends Pick<InstallAssetOptions, 'ifAlreadyInstalled'> {
	/**
	 * The step identifier.
	 */
	step: 'installTheme';
	/**
	 * The theme zip file to install.
	 */
	themeZipFile: ResourceType;
	/**
	 * Optional installation options.
	 */
	options?: InstallThemeOptions;
}

export interface InstallThemeOptions {
	/**
	 * Whether to activate the theme after installing it.
	 */
	activate?: boolean;
	/**
	 * The name of the folder to install the theme to. Defaults to guessing from themeZipFile
	 */
	targetSlug?: string;
}

/**
 * Installs a WordPress theme in the Playground.
 *
 * @param playground The playground client.
 * @param themeZipFile The theme zip file.
 * @param options Optional. Set `activate` to false if you don't want to activate the theme.
 */
export const installTheme: StepHandler<InstallThemeStep<File>> = async (
	playground,
	{ themeZipFile, ifAlreadyInstalled, options = {} },
	progress
) => {
	const zipNiceName = zipNameToHumanName(themeZipFile.name);
	const targetSlug = 'targetSlug' in options ? options.targetSlug : '';

	progress?.tracker.setCaption(`Installing the ${zipNiceName} theme`);
	const { assetFolderName } = await installAsset(playground, {
		ifAlreadyInstalled,
		zipFile: themeZipFile,
		targetPath: `${await playground.documentRoot}/wp-content/themes`,
		targetSlug: targetSlug
	});

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
