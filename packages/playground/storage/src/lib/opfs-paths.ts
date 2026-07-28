import { joinPaths } from '@php-wasm/util';

/**
 * Root directory for sites managed by the Playground site manager.
 */
export const OPFS_SITES_ROOT_PATH = '/sites';

/**
 * Root directory for sites persisted directly by embedding applications.
 */
export const OPFS_EMBEDDED_SITES_ROOT_PATH = '/embedded-sites';

export function getEmbeddedSiteOpfsPath(storageKey: string) {
	return joinPaths(
		OPFS_EMBEDDED_SITES_ROOT_PATH,
		`site-${encodeURIComponent(storageKey)}`
	);
}
