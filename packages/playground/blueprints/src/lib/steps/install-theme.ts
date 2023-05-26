import { StepHandler } from '.';
import { zipNameToHumanName } from './common';
import { writeFile } from './client-methods';
import { activateTheme } from './activate-theme';
import { unzip } from './import-export';

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
	const zipFileName = themeZipFile.name.split('/').pop() || 'theme.zip';
	const zipNiceName = zipNameToHumanName(zipFileName);

	progress?.tracker.setCaption(`Installing the ${zipNiceName} theme`);
	try {
		// Extract to temporary folder so we can find theme folder name

		const tmpFolder = '/tmp/theme';
		const tmpZipPath = `/tmp/${zipFileName}`;

		if (await playground.isDir(tmpFolder)) {
			await playground.unlink(tmpFolder);
		}

		await writeFile(playground, {
			path: tmpZipPath,
			data: themeZipFile,
		});

		await unzip(playground, {
			zipPath: tmpZipPath,
			extractToPath: tmpFolder,
		});

		await playground.unlink(tmpZipPath);

		// Find extracted theme folder name

		const files = await playground.listFiles(tmpFolder);

		let themeFolderName;
		let tmpThemePath = '';

		for (const file of files) {
			tmpThemePath = `${tmpFolder}/${file}`;
			if (await playground.isDir(tmpThemePath)) {
				themeFolderName = file;
				break;
			}
		}

		if (!themeFolderName) {
			throw new Error(
				`The theme zip file should contain a folder with theme files inside, but the provided zip file (${zipFileName}) does not contain such a folder.`
			);
		}

		// Move it to site themes
		const rootPath = await playground.documentRoot;
		const themePath = `${rootPath}/wp-content/themes/${themeFolderName}`;

		await playground.mv(tmpThemePath, themePath);

		const activate = 'activate' in options ? options.activate : true;

		if (activate) {
			await activateTheme(
				playground,
				{
					themeFolderName,
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
