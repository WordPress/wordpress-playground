import type { PlaygroundClient } from '../';
import { asDOM } from './common';

export async function activatePlugin(
	playground: PlaygroundClient,
	plugin: string
) {
	const pluginsPage = asDOM(
		await playground.request({
			relativeUrl: '/wp-admin/plugins.php',
		})
	);

	const link = pluginsPage.querySelector(
		`tr[data-slug="${plugin}"] a`
	)! as HTMLAnchorElement;
	const href = link.attributes.getNamedItem('href')!.value;

	await playground.request({
		relativeUrl: '/wp-admin/' + href,
	});
}
