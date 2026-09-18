import type { StepHandler } from '.';
import type { InstallAssetOptions } from './install-asset';
import { installAsset } from './install-asset';
import { activateTheme } from './activate-theme';
import type { Directory } from '../v1/resources';
import { importThemeStarterContent } from './import-theme-starter-content';
import { zipNameToHumanName } from '../utils/zip-name-to-human-name';
import { writeFiles } from '@php-wasm/universal';
import { basename, joinPaths } from '@php-wasm/util';
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
export interface InstallThemeStep<FileResource, DirectoryResource> extends Pick<
	InstallAssetOptions,
	'ifAlreadyInstalled'
> {
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
	 * @deprecated. Use 'themeData' instead.
	 */
	themeZipFile?: FileResource;
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
	 * Whether to import the theme's starter content after installing it.
	 */
	importStarterContent?: boolean;
	/**
	 * Whether installation, activation, or starter-content failures should
	 * abort the Blueprint.
	 */
	onError?: 'skip-theme' | 'throw';
	/**
	 * The name of the folder to install the theme to. Defaults to guessing from themeData
	 */
	targetFolderName?: string;
	/**
	 * Human-readable theme name for the progress caption and skip warning.
	 */
	humanReadableName?: string;
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

	const onError = options.onError ?? 'throw';
	let assetNiceName = '';
	const progressName = () => options.humanReadableName || assetNiceName;
	try {
		const targetFolderName =
			'targetFolderName' in options ? options.targetFolderName : '';
		let assetFolderName = '';
		if (themeData instanceof File) {
			// @TODO: Consider validating whether this is a zip file?
			const zipFileName = themeData.name.split('/').pop() || 'theme.zip';
			assetNiceName = zipNameToHumanName(zipFileName);

			progress?.tracker.setCaption(
				`Installing the ${progressName()} theme`
			);
			const assetResult = await installAsset(playground, {
				ifAlreadyInstalled,
				zipFile: themeData,
				targetPath: `${await playground.documentRoot}/wp-content/themes`,
				targetFolderName: targetFolderName,
			});
			assetFolderName = assetResult.assetFolderName;
		} else {
			assetNiceName = themeData.name;
			assetFolderName = targetFolderName || assetNiceName;
			if (
				!assetFolderName ||
				basename(assetFolderName) !== assetFolderName
			) {
				throw new Error(
					'Theme folder name must be a single directory name.'
				);
			}

			progress?.tracker.setCaption(
				`Installing the ${progressName()} theme`
			);
			const themeDirectoryPath = joinPaths(
				await playground.documentRoot,
				'wp-content',
				'themes',
				assetFolderName
			);
			let shouldWriteThemeFiles = true;
			/**
			 * Directory themes are written directly instead of going through
			 * `installAsset()`, so apply the same `ifAlreadyInstalled` rule here.
			 */
			if (await playground.fileExists(themeDirectoryPath)) {
				if (!(await playground.isDir(themeDirectoryPath))) {
					throw new Error(
						`Cannot install theme ${assetFolderName} to ${themeDirectoryPath} because a file with the same name already exists. Note it's a file, not a directory! Is this by mistake?`
					);
				}
				if ((ifAlreadyInstalled ?? 'overwrite') === 'skip') {
					shouldWriteThemeFiles = false;
				} else if (ifAlreadyInstalled === 'error') {
					throw new Error(
						`Cannot install theme ${assetFolderName} to ${themeDirectoryPath} because it already exists and ` +
							`the ifAlreadyInstalled option was set to ${ifAlreadyInstalled}`
					);
				}
			}
			if (shouldWriteThemeFiles) {
				await writeFiles(
					playground,
					themeDirectoryPath,
					themeData.files,
					{
						rmRoot: true,
					}
				);
			}
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
	} catch (error) {
		if (onError === 'skip-theme') {
			const skippedThemeName = progressName() || 'unknown theme';
			logger.warn(
				`Skipping theme installation for ${skippedThemeName} after failure: ${
					error instanceof Error ? error.message : String(error)
				}`
			);
			return;
		}
		throw error;
	}
};
