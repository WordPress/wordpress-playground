const devServerOrigins = new Set([
	'http://127.0.0.1:5400',
	'http://localhost:5400',
	'http://127.0.0.1:5401',
	'http://localhost:5401',
	'https://playground.test',
]);

export function isDevServer(url: URL) {
	return (
		devServerOrigins.has(url.origin) ||
		isOriginIsolationPrototype(url) ||
		url.pathname.startsWith('/website-server/')
	);
}

/** Local-only full-app subdomain experiment; never enabled on deployed hosts. */
export function isOriginIsolationPrototype(url: URL) {
	return url.hostname.endsWith('.playground.localhost');
}
