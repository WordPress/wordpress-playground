import { StepHandler } from '.';

/**
 * @inheritDoc activateTheme
 */
export interface ActivateThemeStep {
	step: 'activateTheme';
	/**
	 * The name of the theme folder inside wp-content/themes/
	 */
	themeFolderName: string;
}

/**
 * Activates a WordPress theme (if it's installed).
 *
 * @param playground The playground client.
 * @param themeFolderName The theme folder name.
 */
export const activateTheme: StepHandler<ActivateThemeStep> = async (
	playground,
	{ themeFolderName },
	progress
) => {
	progress?.tracker.setCaption(`Activating ${themeFolderName}`);
	const wpLoadPath = `${await playground.documentRoot}/wp-load.php`;
	if (!playground.fileExists(wpLoadPath)) {
		throw new Error(
			`Required WordPress file does not exist: ${wpLoadPath}`
		);
	}
	await playground.run({
		code: `<?php
define( 'WP_ADMIN', true );
require_once( '${wpLoadPath}' );
switch_theme( '${themeFolderName}' );
`,
	});
};
