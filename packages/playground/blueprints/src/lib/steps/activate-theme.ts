import { StepHandler } from '.';

export interface ActivateThemeStep {
	step: 'activateTheme';
	themeFolderName: string;
}

/**
 * Activates a WordPress theme in the Playground.
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
	const wpLoadPath = `${playground.documentRoot}/wp-load.php`;
	if (!playground.fileExists(wpLoadPath)) {
		throw new Error(
			`Required WordPress file does not exist: ${wpLoadPath}`
		);
	}
	await playground.run({
		code: `<?php
      require_once( '${wpLoadPath}' );
      switch_theme( '${themeFolderName}' );
      `,
	});
};
