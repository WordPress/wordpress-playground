import { StepHandler } from '.';
import { asDOM } from './common';

export interface ActivatePluginStep {
	step: 'activatePlugin';
	plugin: string;
}

/**
 * Activates a WordPress plugin in the Playground.
 *
 * @param playground The playground client.
 * @param plugin The plugin slug.
 */
export const activatePlugin: StepHandler<ActivatePluginStep> = async (
	playground,
	{ plugin },
	progress
) => {
	progress?.tracker.setCaption(`Activating ${plugin}`);
	const pluginsPage = await asDOM(
		await playground.request({
			url: '/wp-admin/plugins.php',
		})
	);

	const link = pluginsPage.querySelector(
		`tr[data-slug="${plugin}"] a`
	)! as HTMLAnchorElement;
	const href = link.attributes.getNamedItem('href')!.value;

	await playground.request({
		url: '/wp-admin/' + href,
	});
};
