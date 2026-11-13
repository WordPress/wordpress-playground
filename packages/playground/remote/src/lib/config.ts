/// <reference types="vite/client" />
import { getWordPressDevelopmentOrigin } from './dev-server';

const playgroundUrl = new URL('/', (import.meta || {}).url);
/**
 * App origin. Builds deployed to WP Cloud configure it explicitly because both
 * hostnames serve the same release files, so the WordPress-origin helper and
 * worker load this module from the WordPress host. Other builds take it from the
 * loaded module URL rather than the current document.
 */
export const playgroundOrigin =
	import.meta.env['VITE_PLAYGROUND_APP_ORIGIN'] || playgroundUrl.origin;
/**
 * Public directory of the running static release, such as /releases/<id>/, or /
 * for builds served from the web root. Asset URLs already include it; code that
 * builds root-relative URLs for release files must add it.
 */
export const releaseBase: string = import.meta.env.PROD
	? import.meta.env.BASE_URL
	: '/';
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
