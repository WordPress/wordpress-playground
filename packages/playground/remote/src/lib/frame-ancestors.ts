/**
 * Allow declared external embedders, never the untrusted WordPress origin.
 * CSP checks every ancestor, so an external intermediary cannot hide WordPress.
 * Referrer-free plain iframes must declare their embedder-origin in the URL.
 */
export function getFrameAncestors(
	url: URL,
	referrer: string,
	wordPressOrigin: string
): string {
	const wordPressHostname = new URL(wordPressOrigin).hostname;
	const origins = new Set<string>();
	for (const value of [
		...url.searchParams.getAll('embedder-origin'),
		referrer,
	]) {
		try {
			const candidate = new URL(value);
			const origin = candidate.origin;
			if (
				!/^https?:\/\//.test(origin) ||
				/[\s,;'*]/.test(origin) ||
				// CSP permits HTTP sources to match HTTPS. Exclude the WordPress host
				// on every scheme and port rather than checking exact origin strings.
				candidate.hostname === wordPressHostname ||
				origin === url.origin
			) {
				continue;
			}
			origins.add(origin);
		} catch {
			// Invalid and opaque origins cannot grant permission to frame root documents.
		}
	}
	return ["frame-ancestors 'self'", ...origins].join(' ');
}
