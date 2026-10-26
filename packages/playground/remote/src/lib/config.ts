/// <reference types="vite/client" />
import { getWordPressDevelopmentOrigin } from './dev-server';
import { selectWordPressOrigin } from './wordpress-origin';

const playgroundUrl = new URL('/', (import.meta || {}).url);
/**
 * App origin, taken from the loaded module URL rather than the current document.
 * The WordPress-origin helper also imports this code from the app host, so using
 * location.origin there would incorrectly identify the WordPress host as the app.
 */
export const playgroundOrigin = playgroundUrl.origin;
const developmentWordPressOrigin = import.meta.env.DEV
	? getWordPressDevelopmentOrigin(playgroundUrl)
	: undefined;
/**
 * Fixed sandbox origin available to ?reprint sessions. The flag selects this
 * origin; its value must never supply a hostname. Normal sessions keep WordPress
 * on the app origin. PHP, OPFS, and directory handles stay there in both modes.
 * Loopback development offers the remote server's existing port; standalone and
 * custom hosts without a configured sandbox keep one origin.
 */
export const wordPressSandboxOrigin = import.meta.env['VITE_WORDPRESS_SITE_URL']
	? new URL(import.meta.env['VITE_WORDPRESS_SITE_URL']).origin
	: (developmentWordPressOrigin ??
		(playgroundUrl.hostname === 'playground.localhost'
			? playgroundOrigin.replace('://playground.', '://wp.playground.')
			: playgroundOrigin));

/**
 * Select once for this document. remote.html sends its choice in PHP boot options.
 * Helper and thumbnail documents already on the sandbox origin keep
 * that origin even though ordinary WordPress URLs do not contain the flag.
 * Service workers route by their own origin, never by a tab's startup flag.
 */
export const wordPressSiteUrl = selectWordPressOrigin(
	new URL(globalThis.location?.href ?? playgroundUrl),
	playgroundOrigin,
	wordPressSandboxOrigin
);
// Hardcoded in wp.js:
export const DOCROOT = '/wordpress';
