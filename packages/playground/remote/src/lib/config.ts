/// <reference types="vite/client" />
const playgroundUrl = new URL('/', (import.meta || {}).url);
/**
 * App origin, taken from the loaded module URL rather than the current document.
 * The WordPress-origin helper also imports this code from the app host, so using
 * location.origin there would incorrectly identify the WordPress host as the app.
 */
export const playgroundOrigin = playgroundUrl.origin;
/**
 * Origin for rendered WordPress pages and their service worker, not the PHP host.
 * PHP, OPFS, and user-picked directory handles stay on the app origin together.
 * A split-origin deployment sets this at build time; an untrusted URL parameter
 * must not choose where the HTTP connection sends requests or loads its helper.
 */
export const wordPressSiteUrl = import.meta.env['VITE_WORDPRESS_SITE_URL']
	? new URL(import.meta.env['VITE_WORDPRESS_SITE_URL']).origin
	: playgroundOrigin;
// Hardcoded in wp.js:
export const DOCROOT = '/wordpress';
