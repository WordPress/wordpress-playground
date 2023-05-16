import { StepHandler } from '.';
import { asDOM } from './common';

export interface ActivateThemeStep {
	step: 'activateTheme';
	themeFolderName: string;
}

/**
 * Activates a WordPress theme in the Playground.
 *
 * @param playground The playground client.
 * @param theme The theme slug.
 */
export const activateTheme: StepHandler<ActivateThemeStep> = async (
	playground,
	{ themeFolderName },
	progress
) => {
	progress?.tracker.setCaption(`Activating ${themeFolderName}`);
	const themesPage = asDOM(
		await playground.request({
			url: '/wp-admin/themes.php',
		})
	);

	const link = themesPage.querySelector(
		`a[href*="action=activate&stylesheet=${themeFolderName}"]`
	)! as HTMLAnchorElement;
	const href = link.attributes.getNamedItem('href')!.value;

	await playground.request({
		url: href,
	});
};
