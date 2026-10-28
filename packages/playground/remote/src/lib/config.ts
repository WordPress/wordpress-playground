/// <reference types="vite/client" />
import { getWordPressDevelopmentOrigin } from './dev-server';

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
		(playgroundUrl.hostname === 'playground.localhost'
			? playgroundOrigin.replace('://playground.', '://wp.playground.')
			: playgroundOrigin));

// Hardcoded in wp.js:
export const DOCROOT = '/wordpress';
