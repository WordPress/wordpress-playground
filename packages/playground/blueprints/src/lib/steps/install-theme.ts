import { StepHandler } from '.';
import { zipNameToHumanName } from './common';
import { installAsset } from './install-asset';
import { activateTheme } from './activate-theme';

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
	themeZipFile: ResourceType;
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
	{ themeZipFile, options = {} },
	progress
) => {
	const zipNiceName = zipNameToHumanName(themeZipFile.name);

	progress?.tracker.setCaption(`Installing the ${zipNiceName} theme`);

	try {
		const { assetFolderName } = await installAsset(playground, {
			type: 'theme',
			zipFile: themeZipFile,
		});

		// Activate

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
	} catch (error) {
		console.error(
			`Proceeding without the ${zipNiceName} theme. Could not install it in wp-admin. ` +
				`The original error was: ${error}`
		);
		console.error(error);
	}
};
