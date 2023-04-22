import { UniversalPHP } from '@php-wasm/web';
import { asDOM } from './common';

/**
 * Activates a WordPress plugin in the Playground.
 *
 * @param playground The playground client.
 * @param plugin The plugin slug.
 */
export async function activatePlugin(
	playground: UniversalPHP,
	plugin: string
) {
	const pluginsPage = asDOM(
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
}
