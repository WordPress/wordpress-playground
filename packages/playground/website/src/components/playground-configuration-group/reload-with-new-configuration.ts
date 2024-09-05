import { clearContentsFromMountDevice } from '@wp-playground/storage';
import { PlaygroundConfiguration } from './form';
import { logger } from '@php-wasm/logger';
import { MountDevice } from '@php-wasm/web';

export async function reloadWithNewConfiguration(
	config: PlaygroundConfiguration,
	mountDevice?: MountDevice
) {
	if (mountDevice && config.resetSite && config.storage === 'opfs') {
		try {
			await clearContentsFromMountDevice(mountDevice);
		} catch (error) {
			logger.error(error);
		}
	}

	const url = new URL(window.location.toString());
	url.searchParams.set('php', config.php);
	url.searchParams.set('wp', config.wp);
	url.searchParams.set('storage', config.storage);
	url.searchParams.delete('php-extension-bundle');
	if (!config.withExtensions) {
		url.searchParams.append('php-extension-bundle', 'light');
	}
	url.searchParams.delete('networking');
	if (config.withNetworking) {
		url.searchParams.set('networking', 'yes');
	}
	window.location.assign(url);
}
