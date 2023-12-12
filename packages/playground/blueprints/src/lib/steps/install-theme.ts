import { StepHandler } from '.';
import { zipNameToHumanName } from './common';
import { installAsset } from './install-asset';
import { activateTheme } from './activate-theme';
import { basename } from '@php-wasm/util';
import { fileEntries } from '../zip';
import { FileEntry } from '@php-wasm/universal';

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
 * 			"activate": true
 * 		}
 * }
 * </code>
 */
export interface InstallThemeStep<ResourceType> {
	/**
	 * The step identifier.
	 */
	step: 'installTheme';
	/**
	 * The theme zip file to install.
	 */
	themeZipFile?: ResourceType;
	files?: AsyncIterable<FileEntry>;
	/**
	 * Optional installation options.
	 */
	options?: {
		/**
		 * Whether to activate the theme after installing it.
		 */
		activate?: boolean;
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
export const installTheme: StepHandler<InstallThemeStep<File>> = async (
	playground,
	{ themeZipFile, files, options = {} },
	progress
) => {
	if (!files && themeZipFile) {
		files = fileEntries(themeZipFile.stream());
	}
	const zipFileName = themeZipFile?.name.split('/').pop() || 'plugin.zip';
	const zipNiceName = zipNameToHumanName(zipFileName);
	const defaultAssetName = zipFileName.replace(/\.zip$/, '');

	progress?.tracker.setCaption(`Installing the ${zipNiceName} theme`);

	try {
		const themePath = await installAsset(playground, {
			files: files!,
			defaultAssetName,
			targetPath: `${await playground.documentRoot}/wp-content/themes`,
		});

		// Activate

		const activate = 'activate' in options ? options.activate : true;

		if (activate) {
			await activateTheme(
				playground,
				{
					themeFolderName: basename(themePath),
				},
				progress
			);
		}
	} catch (error) {
		console.error(
			`Proceeding without the ${zipNiceName} theme. Could not install it in wp-admin. ` +
				`The original error was: ${error}`
		);
		console.error(error);
	}
};
