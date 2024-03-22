import { phpVar } from '@php-wasm/util';
import { StepHandler } from '.';

/**
 * @inheritDoc activateTheme
 * @example
 *
 * <code>
 * {
 * 		"step": "activateTheme",
 * 		"themeFolderName": "storefront"
 * }
 * </code>
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
	const docroot = await playground.documentRoot;
	await playground.run({
		code: `<?php
define( 'WP_ADMIN', true );
require_once( ${phpVar(docroot)}. "/wp-load.php" );

// Set current user to admin
set_current_user( get_users(array('role' => 'Administrator') )[0] );

switch_theme( ${phpVar(themeFolderName)} );
`,
	});
};
