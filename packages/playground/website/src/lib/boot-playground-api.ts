import { exposeAPI } from '@php-wasm/universal';
import type { PlaygroundAPIClient } from '@wp-playground/client';
import { opfsSiteStorage } from './state/opfs/opfs-site-storage';

export function bootPlaygroundAPI(appOrigin: string) {
	// Only the app may ask this document to read its saved sites. The endpoint
	// also checks event.source, so an app-origin message from another window is rejected.
	const [setAPIReady, , api] = exposeAPI<PlaygroundAPIClient, unknown>(
		{
			async exportSavedSiteAsZip(slug, options) {
				if (!opfsSiteStorage) {
					throw new Error(
						'OPFS site storage is unavailable in this context.'
					);
				}
				return await opfsSiteStorage.exportSavedSiteAsZip(
					slug,
					options
				);
			},
		},
		undefined,
		undefined,
		appOrigin
	);
	setAPIReady();
	return api;
}
