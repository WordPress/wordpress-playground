import { StepHandler } from '.';
import { zipNameToHumanName } from '../utils/zip-name-to-human-name';
import { flattenDirectory } from '../utils/flatten-directory';
import { activateTheme } from './activate-theme';
import { basename, joinPaths } from '@php-wasm/util';
import { writeFile } from '@php-wasm/universal';
import { unzipFiles } from '@wp-playground/stream-compression';

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
	/**
	 * @private
	 */
	files?: AsyncIterable<File>;
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
 * @param php The playground client.
 * @param themeZipFile The theme zip file.
 * @param options Optional. Set `activate` to false if you don't want to activate the theme.
 */
export const installTheme: StepHandler<InstallThemeStep<File>> = async (
	php,
	{ themeZipFile, files, options = {} },
	progress
) => {
	files = files || unzipFiles(themeZipFile.stream());
	const zipFileName = themeZipFile?.name.split('/').pop() || 'plugin.zip';
	const zipNiceName = zipNameToHumanName(zipFileName);
	const assetName = zipFileName.replace(/\.zip$/, '');

	progress?.tracker.setCaption(`Installing the ${zipNiceName} theme`);

	try {
		const extractTo = joinPaths(
			await php.documentRoot,
			'wp-content/themes',
			crypto.randomUUID()
		);
		for await (const file of files!) {
			await writeFile(php, extractTo, file);
		}
		const themePath = await flattenDirectory(php, extractTo, assetName);

		// Activate
		const activate = 'activate' in options ? options.activate : true;
		if (activate) {
			await activateTheme(
				php,
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
