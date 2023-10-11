import { PlaygroundClient } from '@wp-playground/client';
import { PlaygroundConfiguration } from './form';

export async function reloadWithNewConfiguration(
	playground: PlaygroundClient,
	config: PlaygroundConfiguration
) {
	if (
		config.resetSite &&
		(config.storage === 'opfs-browser' || config.storage === 'browser')
	) {
		await playground?.resetVirtualOpfs();
	}

	const url = new URL(window.location.toString());
	url.searchParams.set('php', config.php);
	url.searchParams.set('wp', config.wp);
	url.searchParams.set('storage', config.storage);
	url.searchParams.delete('php-extension');
	for (const extension of config.phpExtensions || []) {
		url.searchParams.append('php-extension', extension);
	}
	window.location.assign(url);
}
