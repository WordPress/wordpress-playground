import { exposeAPI } from '@php-wasm/universal';
import type { PlaygroundAPIClient } from '@wp-playground/client';
import { opfsSiteStorage } from './state/opfs/opfs-site-storage';

export function bootPlaygroundAPI() {
	const [setAPIReady, , api] = exposeAPI<PlaygroundAPIClient, unknown>({
		async exportSavedSiteAsZip(slug, options) {
			if (!opfsSiteStorage) {
				throw new Error(
					'OPFS site storage is unavailable in this context.'
				);
			}
			return await opfsSiteStorage.exportSavedSiteAsZip(slug, options);
		},
	});
	setAPIReady();
	return api;
}
