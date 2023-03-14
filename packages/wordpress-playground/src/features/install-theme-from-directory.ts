
import {
    ProgressObserver,
	cloneResponseMonitorProgress,
} from '@wordpress/php-wasm';

import { installTheme } from './install-theme';
import { PlaygroundAPI } from 'src/boot-playground';
import { zipNameToHumanName } from './common';

export async function installThemeFromDirectory(
    playground: PlaygroundAPI,
    themeZipName: string,
    progressBudget = 0,
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
        const themeFile = new File(
            [await response.blob()],
            themeZipName
        );

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
