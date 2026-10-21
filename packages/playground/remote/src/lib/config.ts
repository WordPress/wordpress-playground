/// <reference types="vite/client" />
const playgroundUrl = new URL('/', (import.meta || {}).url);
export const playgroundOrigin = playgroundUrl.origin;
// PHP and handles stay on the app origin; only rendered pages move.
// Staging builds set this at build time, never from an untrusted URL parameter.
export const wordPressSiteUrl = import.meta.env['VITE_WORDPRESS_SITE_URL']
	? new URL(import.meta.env['VITE_WORDPRESS_SITE_URL']).origin
	: playgroundOrigin;
// Hardcoded in wp.js:
export const DOCROOT = '/wordpress';
