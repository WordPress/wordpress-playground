import { removeURLScope } from '@php-wasm/scopes';

/**
 * Maps a navigation URL to the path shown in the address bar.
 *
 * PHP-served redirects go through `/index.php?playground-redirection-handler`
 * with the real destination in the `next` parameter. Showing that machinery
 * would read as noise; the destination is what the user navigated to.
 */
export function getDisplayedSitePath(url: string): string {
	let parsedUrl: URL;
	try {
		parsedUrl = new URL(url, 'https://playground.internal');
	} catch {
		return url;
	}
	if (!parsedUrl.searchParams.has('playground-redirection-handler')) {
		return url;
	}
	const next = parsedUrl.searchParams.get('next');
	if (!next) {
		return url;
	}
	let nextUrl: URL;
	try {
		nextUrl = new URL(next, parsedUrl);
	} catch {
		return url;
	}
	const unscopedUrl = removeURLScope(nextUrl);
	return (
		(unscopedUrl.pathname || '/') + unscopedUrl.search + unscopedUrl.hash
	);
}
