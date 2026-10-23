// eslint-disable-next-line @nx/enforce-module-boundaries
import {
	remoteDevServerPort,
	websiteDevServerPort,
} from '../../../build-config';

/** Local aliases shared by origin selection and the remote Vite host checks. */
export const localDevelopmentHostnames = new Set(['127.0.0.1', 'localhost']);

/**
 * Map the normal website dev origin to the existing remote server's HTTP port.
 *
 * For example, http://127.0.0.1:5400 uses WordPress on :4400. Keep PHP and its
 * handles on :5400; only rendered pages and their HTTP helper use the other port.
 * Do not rewrite standalone remote, Personal WP, preview, HTTPS, or tunnel URLs:
 * those servers have different routing or cannot expose the local remote port.
 * Call only in development; production origins still come from the build setting.
 */
export function getWordPressDevelopmentOrigin(app: URL): string | undefined {
	if (
		app.protocol !== 'http:' ||
		!localDevelopmentHostnames.has(app.hostname) ||
		app.port !== String(websiteDevServerPort)
	) {
		return undefined;
	}
	const wordpress = new URL(app);
	wordpress.port = String(remoteDevServerPort);
	return wordpress.origin;
}

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
