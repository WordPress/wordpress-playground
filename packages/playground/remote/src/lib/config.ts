/// <reference types="vite/client" />
import { getWordPressDevelopmentOrigin } from './dev-server';
import { getReleaseRoot } from '@wp-playground/common';
import { joinPaths } from '@php-wasm/util';

const moduleUrl = new URL((import.meta || {}).url);
const playgroundUrl = new URL('/', moduleUrl);
// The built local preview uses the same files on both hostnames and on the upgrade-test port.
if (playgroundUrl.hostname === 'wpsandbox.wordpress.localhost') {
	playgroundUrl.hostname = 'playground.wordpress.localhost';
}
/**
 * Canonical app origin. Production builds configure it explicitly because the same
 * modules are served on the sandbox too. Unconfigured standalone builds derive it
 * from their module URL; the local two-host preview recognizes its fixed host pair.
 */
export const playgroundOrigin =
	import.meta.env['VITE_PLAYGROUND_APP_ORIGIN'] || playgroundUrl.origin;
/** Static downloads use the executing origin, with immutable release URLs in WP Cloud builds. */
export const assetBaseUrl =
	getReleaseRoot(moduleUrl) ?? new URL('/', moduleUrl);

/** Resolve bundled root-relative URLs inside the running immutable release. */
export function resolveAssetUrl(path: string): URL {
	const url = new URL(path, assetBaseUrl);
	if (
		getReleaseRoot(assetBaseUrl) &&
		url.origin === assetBaseUrl.origin &&
		!getReleaseRoot(url)
	) {
		url.pathname = joinPaths(assetBaseUrl.pathname, url.pathname);
	}
	return url;
}
const developmentWordPressOrigin = import.meta.env.DEV
	? getWordPressDevelopmentOrigin(playgroundUrl)
	: undefined;
const previewWordPressUrl = new URL(playgroundUrl);
previewWordPressUrl.hostname = 'wpsandbox.wordpress.localhost';
/**
 * Render every WordPress page on the build-configured sandbox, regardless of
 * feature flags. PHP, OPFS, and picked directory handles stay on the app origin.
 * For example, playground.wordpress.net runs PHP while wpsandbox.wordpress.net
 * serves its WordPress pages. Query parameters must not move those pages back
 * onto the app origin, where their scripts could directly read saved files.
 * Loopback development offers the remote server's existing port; standalone and
 * custom hosts without a configured sandbox keep one origin.
 */
export const wordPressSiteUrl = import.meta.env['VITE_WORDPRESS_SITE_URL']
	? new URL(import.meta.env['VITE_WORDPRESS_SITE_URL']).origin
	: (developmentWordPressOrigin ??
		(playgroundUrl.hostname === 'playground.wordpress.localhost'
			? previewWordPressUrl.origin
			: playgroundOrigin));

// Hardcoded in wp.js:
export const DOCROOT = '/wordpress';
