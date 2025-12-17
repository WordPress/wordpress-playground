/**
 * Permission utilities for the WordPress Playground DevTools extension.
 *
 * Handles checking and requesting host permissions for domains that aren't
 * in the default allowlist.
 */

/**
 * Check if we have permission to access a given URL.
 */
export async function hasPermissionForUrl(url: string): Promise<boolean> {
	try {
		return await chrome.permissions.contains({
			origins: [getOriginPattern(url)],
		});
	} catch {
		return false;
	}
}

/**
 * Request permission to access a given URL.
 * Returns true if permission was granted, false otherwise.
 */
export async function requestPermissionForUrl(url: string): Promise<boolean> {
	try {
		return await chrome.permissions.request({
			origins: [getOriginPattern(url)],
		});
	} catch {
		return false;
	}
}

/**
 * Convert a URL to an origin pattern suitable for the permissions API.
 * e.g., "https://example.com/page" -> "https://example.com/*"
 */
function getOriginPattern(url: string): string {
	try {
		const urlObj = new URL(url);
		return `${urlObj.protocol}//${urlObj.host}/*`;
	} catch {
		// If URL parsing fails, return a pattern that won't match anything
		return url;
	}
}

/**
 * Check if a URL matches the default allowlist in manifest.json.
 */
export function isAllowlistedUrl(url: string): boolean {
	const allowlist = [
		'playground.wordpress.net',
		'developer.wordpress.org',
		'developer.woocommerce.com',
		'developer.wordpress.com',
		'wordpress.org',
		'localhost',
		'127.0.0.1',
	];

	try {
		const urlObj = new URL(url);
		const hostname = urlObj.hostname;
		return allowlist.some(
			(allowed) =>
				hostname === allowed || hostname.endsWith('.' + allowed)
		);
	} catch {
		return false;
	}
}
