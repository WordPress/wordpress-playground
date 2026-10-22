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
 * Origin for rendered WordPress pages and their service worker, not the PHP host.
 * PHP, OPFS, and user-picked directory handles stay on the app origin together.
 * A split-origin deployment sets this at build time; an untrusted URL parameter
 * must not choose where the HTTP connection sends requests or loads its helper.
 * Normal loopback website development uses the remote server's existing port;
 * custom development hosts and standalone remote development keep one origin.
 */
export const wordPressSiteUrl = import.meta.env['VITE_WORDPRESS_SITE_URL']
	? new URL(import.meta.env['VITE_WORDPRESS_SITE_URL']).origin
	: (developmentWordPressOrigin ??
		(playgroundUrl.hostname === 'playground.localhost'
			? playgroundOrigin.replace('://playground.', '://wp.playground.')
			: playgroundOrigin));
// Hardcoded in wp.js:
export const DOCROOT = '/wordpress';
