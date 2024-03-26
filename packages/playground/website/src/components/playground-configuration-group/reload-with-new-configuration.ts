import { PlaygroundClient } from '@wp-playground/client';
import { PlaygroundConfiguration } from './form';

export async function reloadWithNewConfiguration(
	config: PlaygroundConfiguration,
	playground?: PlaygroundClient
) {
	if (playground && config.resetSite && config.storage === 'browser') {
		try {
			await playground?.resetVirtualOpfs();
		} catch (error) {
			console.error(error);
		}
	}

	const url = new URL(window.location.toString());
	url.searchParams.set('php', config.php);
	url.searchParams.set('wp', config.wp);
	url.searchParams.set('storage', config.storage);
	url.searchParams.delete('php-extension-bundle');
	if (config.withExtensions) {
		url.searchParams.append('php-extension-bundle', 'kitchen-sink');
	}
	url.searchParams.delete('networking');
	if (config.withNetworking) {
		url.searchParams.set('networking', 'yes');
	}
	window.location.assign(url);
}
