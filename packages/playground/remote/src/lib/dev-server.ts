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
		url.pathname.startsWith('/website-server/')
	);
}
