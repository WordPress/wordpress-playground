import {
	ProgressObserver,
	cloneResponseMonitorProgress,
} from '@php-wasm/progress';
import type { PlaygroundClient } from '../';

import { installTheme } from './install-theme';
import { zipNameToHumanName } from './common';

/**
 * Downloads and installs a theme from the WordPress.org theme directory.
 * Under the hood, it downloads the themes through a proxy endpoint
 * and installs then one after another using the installTheme function.
 *
 * @see installPlugin
 * @param playground The playground client.
 * @param themeZipName The theme zip file name. For example, set this parameter
 *                     to "twentytwentythree.1.1.zip" to download the Twenty Twenty Three theme
 *                     from https://downloads.wordpress.org/theme/twentytwentythree.1.1.zip.
 *
 * @param maxProgress Optional. The maximum progress value to use. Defaults to 100.
 * @param progress Optional. The progress observer that will be notified of the progress.
 */
export async function installThemeFromDirectory(
	playground: PlaygroundClient,
	themeZipName: string,
	progressBudget = 100,
	progress?: ProgressObserver
) {
	// Download the theme file
	let response = await fetch('/plugin-proxy?theme=' + themeZipName);
	if (progress) {
		response = cloneResponseMonitorProgress(
			response,
			progress.partialObserver(
				progressBudget / 2,
				`Installing ${zipNameToHumanName(themeZipName)} theme...`
			)
		);
		progress.slowlyIncrementBy(progressBudget / 2);
	}

	if (response.status === 200) {
		const themeFile = new File([await response.blob()], themeZipName);

		try {
			await installTheme(playground, themeFile);
		} catch (error) {
			console.error(
				`Proceeding without the ${themeZipName} theme. Could not install it in wp-admin. ` +
					`The original error was: ${error}`
			);
			console.error(error);
		}
	} else {
		console.error(
			`Proceeding without the ${themeZipName} theme. Could not download the zip bundle from https://downloads.wordpress.org/themes/${themeZipName} – ` +
				`Is the file name correct?`
		);
	}
}
