import { StepHandler } from '.';
import { logger } from '@php-wasm/logger';

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

	const themeFolderPath = `${docroot}/wp-content/themes/${themeFolderName}`;
	if (!(await playground.fileExists(themeFolderPath))) {
		throw new Error(`
			Couldn't activate theme ${themeFolderName}.
			Theme not found at the provided theme path: ${themeFolderPath}.
			Check the theme path to ensure it's correct.
			If the theme is not installed, you can install it using the installTheme step.
			More info can be found in the Blueprint documentation: https://wordpress.github.io/wordpress-playground/blueprints-api/steps/#ActivateThemeStep
		`);
	}
	const result = await playground.run({
		code: `<?php
			define( 'WP_ADMIN', true );
			require_once( getenv('docroot') . "/wp-load.php" );

			// Set current user to admin
			wp_set_current_user( get_users(array('role' => 'Administrator') )[0]->ID );

			switch_theme( getenv('themeFolderName') );

			if( wp_get_theme()->get_stylesheet() !== getenv('themeFolderName') ) {
				throw new Exception( 'Theme ' . getenv('themeFolderName') . ' could not be activated.' );				
			}
			die('Theme activated successfully');
		`,
		env: {
			docroot,
			themeFolderName,
		},
	});
	if (result.text !== 'Theme activated successfully') {
		logger.debug(result);
		throw new Error(
			`Theme ${themeFolderName} could not be activated – WordPress exited with no error. ` +
				`Sometimes, when $_SERVER or site options are not configured correctly, ` +
				`WordPress exits early with a 301 redirect. ` +
				`Inspect the "debug" logs in the console for more details`
		);
	}
};
