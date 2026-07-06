/**
 * Storage for blueprint bundles alongside persisted sites.
 *
 * When a temporary site is persisted, its blueprint bundle (including
 * blueprint.json and all bundled resources) is copied to the site's
 * storage directory under a `blueprint-bundle` subdirectory.
 */

import {
	OpfsFilesystemBackend,
	copyFilesystem,
	type TraversableFilesystemBackend,
} from '@wp-playground/storage';
import { joinPaths } from '@php-wasm/util';
import { getDirectoryPathForSlug } from './opfs-site-path';

export const BUNDLE_DIR_NAME = 'blueprint-bundle';

/**
 * Get the OPFS path for a site's blueprint bundle directory.
 */
function getBundlePath(siteSlug: string): string {
	return getBundlePathForSitePath(getDirectoryPathForSlug(siteSlug));
}

/**
 * Check if a site has a persisted blueprint bundle.
 */
export async function hasBlueprintBundle(siteSlug: string): Promise<boolean> {
	try {
		const backend = await OpfsFilesystemBackend.fromPath(
			getBundlePath(siteSlug)
		);
		const files = await backend.listFiles('/');
		return files.length > 0;
	} catch {
		return false;
	}
}

/**
 * Copy files from a source filesystem to a site's blueprint bundle storage.
 */
export async function persistBlueprintBundle(
	siteSlug: string,
	source: TraversableFilesystemBackend
): Promise<void> {
	const destination = await OpfsFilesystemBackend.fromPath(
		getBundlePath(siteSlug),
		true
	);
	await copyFilesystem(source, destination);
}

/**
 * Delete a site's blueprint bundle.
 */
export async function deleteBlueprintBundle(siteSlug: string): Promise<void> {
	try {
		const backend = await OpfsFilesystemBackend.fromPath(
			getBundlePath(siteSlug)
		);
		await backend.clear();
	} catch {
		// Bundle doesn't exist, nothing to delete
	}
}

/**
 * Load a site's persisted blueprint bundle as a filesystem backend.
 * Returns an OpfsFilesystemBackend that can be used as a BlueprintBundle.
 */
export async function loadPersistedBlueprintBundle(
	siteSlug: string
): Promise<OpfsFilesystemBackend> {
	return OpfsFilesystemBackend.fromPath(getBundlePath(siteSlug));
}

/**
 * Load a persisted blueprint bundle from an already-resolved OPFS site path.
 *
 * This is used when a saved site's directory name is the legacy lossy form, so
 * recomputing the path from the slug would point at the newer encoded location.
 */
export async function loadPersistedBlueprintBundleFromPath(
	sitePath: string
): Promise<OpfsFilesystemBackend> {
	return OpfsFilesystemBackend.fromPath(getBundlePathForSitePath(sitePath));
}

function getBundlePathForSitePath(sitePath: string): string {
	return joinPaths(sitePath, BUNDLE_DIR_NAME);
}
