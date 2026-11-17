import { isParentOf, joinPaths } from '@php-wasm/util';

/**
 * Use the PHP runtime's release directory, which may differ from the controlling
 * service worker's release. For example, combine /releases/A/ and wp-6.8 into
 * releases/A/wp-6.8 so an older tab keeps downloading its own WordPress files.
 */
export function runtimeStaticAssetsDirectory(details: {
	staticAssetsDirectory?: string;
	releaseBase?: string;
}): string | undefined {
	// The helper iframe may have already added /releases/A/. Do not add it again.
	if (
		details.staticAssetsDirectory &&
		isParentOf('/releases', joinPaths('/', details.staticAssetsDirectory))
	) {
		return details.staticAssetsDirectory;
	}

	// PRE_RELEASE_ASSETS_COMPAT: older root-only production runtimes omit releaseBase.
	// Portable builds explicitly use '/'; preserve that layout when retiring this fallback.
	return details.staticAssetsDirectory
		? joinPaths(
				'.',
				details.releaseBase ?? '/',
				details.staticAssetsDirectory
			)
		: undefined;
}

/**
 * /releases/A/wp-6.8 exists on both hosts, so use the worker's own host.
 * Unprefixed paths such as /wp-6.8 use the app host: portable builds still need
 * this layout, as do tabs opened before release directories were introduced.
 */
export function wordPressStaticAssetOrigin(
	directory: string,
	workerOrigin: string,
	appOrigin: string
): string {
	return isParentOf('/releases', joinPaths('/', directory))
		? workerOrigin
		: appOrigin;
}
