import { joinPaths } from '@php-wasm/util';

const EMBEDDED_SITES_OPFS_ROOT_PATH = '/embedded-sites';

/**
 * Returns the canonical OPFS path for a site managed by an embedding application.
 *
 * Both the Playground runtime mount and lightweight storage APIs should derive
 * the site path from the same opaque storage key.
 */
export function getEmbeddedSiteOpfsPath(storageKey: string) {
	return joinPaths(
		EMBEDDED_SITES_OPFS_ROOT_PATH,
		`site-${encodeURIComponent(storageKey)}`
	);
}
