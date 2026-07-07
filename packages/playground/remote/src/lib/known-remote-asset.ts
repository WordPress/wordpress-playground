import { joinPaths } from '@php-wasm/util';
import { applyRewriteRules } from '@php-wasm/universal';
import { wordPressRewriteRules } from '@wp-playground/wordpress';

/**
 * Describes the WordPress build currently served inside a Playground scope.
 *
 * ## Static assets in minified WordPress builds
 *
 * Playground boots faster by shipping minified WordPress builds without many
 * CSS files, JS files, images, fonts, and other static assets. Each minified
 * build includes a `wordpress-remote-asset-paths` file that lists the assets
 * removed from the in-memory WordPress filesystem.
 *
 * The service worker can use that list to recognize requests that would
 * otherwise go through PHP, produce a 404, and only then fall back to the
 * remote static assets directory.
 */
export type WPModuleDetails = {
	/**
	 * Directory on the Playground.WordPress.net static host that matches the
	 * loaded WordPress version, e.g. `wp-6.8`.
	 */
	staticAssetsDirectory?: string;
	/**
	 * Site-relative paths removed from the minified WordPress filesystem.
	 *
	 * Entries are normalized to begin with `/`, matching request paths after
	 * WordPress rewrite rules are applied.
	 */
	remoteAssetPaths?: string[];
	/**
	 * Service-worker-only membership cache derived from `remoteAssetPaths`.
	 */
	remoteAssetPathSet?: Set<string>;
};

/**
 * Returns a remote static asset URL for a known minified-build asset.
 *
 * ## Why this exists
 *
 * Requests for assets listed in `wordpress-remote-asset-paths` are guaranteed
 * to be absent from the minified WordPress filesystem. Without this shortcut,
 * the service worker would forward the request to PHP first, wait for a PHP
 * 404, and only then fetch the file from the static assets directory.
 *
 * ## Path matching
 *
 * WordPress may request pretty URLs or index routes that need to pass through
 * the same rewrite rules used by the PHP request handler. Apply those rewrite
 * rules before checking `remoteAssetPaths` so both paths are compared in the
 * same shape.
 *
 * ## Safety
 *
 * Only paths explicitly listed in `remoteAssetPaths` are rewritten. Unlisted
 * files still go through PHP, preserving behavior for dynamic routes and files
 * created or modified by the user. The root path is rejected even if an empty
 * line or malformed entry made it into the asset list.
 */
export function resolveKnownRemoteAssetUrl(
	unscopedUrl: URL,
	details: WPModuleDetails
) {
	const { staticAssetsDirectory, remoteAssetPaths } = details;
	if (!staticAssetsDirectory || !remoteAssetPaths?.length) {
		return undefined;
	}

	const siteRelativePath = applyRewriteRules(
		unscopedUrl.pathname,
		wordPressRewriteRules
	);
	const normalizedPath = joinPaths('/', siteRelativePath);
	if (
		normalizedPath === '/' ||
		!hasRemoteAssetPath(details, normalizedPath)
	) {
		return undefined;
	}

	const remoteAssetUrl = new URL(unscopedUrl);
	remoteAssetUrl.pathname = joinPaths(
		'/',
		staticAssetsDirectory,
		normalizedPath.substring(1)
	);
	return remoteAssetUrl;
}

function hasRemoteAssetPath(
	{ remoteAssetPaths, remoteAssetPathSet }: WPModuleDetails,
	normalizedPath: string
) {
	return (
		remoteAssetPathSet?.has(normalizedPath) ??
		remoteAssetPaths?.includes(normalizedPath) ??
		false
	);
}
