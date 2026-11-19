import { createServer, request } from 'node:http';
import type { IncomingHttpHeaders } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Connect, ViteDevServer } from 'vite';
import { wordPressFrameDevPlugin } from '../../vite.wordpress-frame';

describe('WordPress development HTTP routing', () => {
	let middleware: Connect.NextHandleFunction;
	const server = createServer((req, res) => {
		middleware(req, res, () => {
			res.setHeader('X-Routed-Path', req.url!);
			res.end('Vite app source');
		});
	});
	let port: number;

	beforeAll(async () => {
		const plugin = wordPressFrameDevPlugin(
			'http://127.0.0.1:5400',
			'http://127.0.0.1:4400'
		);
		// Install the real routing hook, then send real HTTP requests through it.
		const configure = plugin.configureServer as (
			server: ViteDevServer
		) => void;
		configure({
			middlewares: {
				/** Capture the routing hook; the HTTP server supplies real request state. */
				use(handler: Connect.NextHandleFunction) {
					middleware = handler;
				},
			},
		} as ViteDevServer);
		await new Promise<void>((resolve) =>
			server.listen(0, '127.0.0.1', resolve)
		);
		port = (server.address() as AddressInfo).port;
	});

	afterAll(async () => {
		server.closeAllConnections();
		await new Promise<void>((resolve, reject) =>
			server.close((error) => (error ? reject(error) : resolve()))
		);
	});

	it('allows app-proxied modules but refuses them on the WordPress port', async () => {
		for (const path of [
			'/remote.html',
			'/api.html',
			'/src/lib/config.ts',
		]) {
			const app = await get(path, '127.0.0.1:5400');
			expect(app).toMatchObject({ status: 200, body: 'Vite app source' });
			const wordpress = await get(path, '127.0.0.1:4400');
			expect(wordpress).toMatchObject({ status: 404, body: 'Not found' });
			expect(wordpress.headers['x-content-type-options']).toBe('nosniff');
		}
	});

	// Scoped top-level navigations must reach the trusted app wrapper. A missing
	// destination or an iframe request must not redirect and create nested wrappers.
	// The two host branches independently decide whether to rewrite or redirect.
	it.each(['127.0.0.1', 'localhost'])(
		'routes scoped document navigations through the app on %s',
		async (host) => {
			const path =
				'/scope:abc/wp-admin/?preview=true&preview_nonce=a%2Bb';
			const headers = { 'Sec-Fetch-Dest': 'document' };
			const app = await get(path, `${host}:5400`, headers);
			expect(app.status).toBe(200);
			expect(app.headers['x-routed-path']).toBe('/wordpress-popup.html');
			const wordpress = await get(path, `${host}:4400`, headers);
			expect(wordpress.status).toBe(302);
			expect(wordpress.headers.location).toBe(
				`http://${host}:5400${path}`
			);
			expect(wordpress.headers['cache-control']).toBe('no-store');
		}
	);

	it.each([undefined, 'iframe', 'empty', 'script'])(
		'rejects scoped requests with destination %s on both ports',
		async (destination) => {
			const headers = destination
				? { 'Sec-Fetch-Dest': destination }
				: {};
			for (const port of [5400, 4400]) {
				const response = await get(
					'/scope:abc/index.php',
					`127.0.0.1:${port}`,
					headers
				);
				expect(response.status).toBe(404);
				expect(response.headers.location).toBeUndefined();
				expect(response.headers['x-routed-path']).toBeUndefined();
			}
		}
	);

	it.each(['127.0.0.1', 'localhost'])(
		'loads helper and service-worker modules from the app port on %s',
		async (host) => {
			for (const path of [
				'/wordpress-bridge.html',
				`/wordpress-bridge-${'a'.repeat(40)}.html`,
			]) {
				const helper = await get(path + '?scope=abc', `${host}:4400`);
				expect(helper.status).toBe(200);
				expect(helper.body).toContain(
					`src="http://${host}:5400/src/lib/wordpress-bridge.ts"`
				);
			}
			const worker = await get('/sw.js', `${host}:4400`);
			expect(worker.status).toBe(200);
			expect(worker.body).toBe(
				`import "http://${host}:5400/service-worker.ts?worker_file&type=module";`
			);
			expect(worker.headers['cache-control']).toBe('no-store');
		}
	);

	it('allows only marked thumbnail-worker loaders, not arbitrary local source', async () => {
		const path =
			'/node_modules/.vite/worker.js?playground-site-thumbnail-worker=1';
		expect((await get(path, '127.0.0.1:4400')).body).toBe(
			`importScripts("http://127.0.0.1:5400${path}");`
		);
		expect(
			(await get('/node_modules/.vite/worker.js', '127.0.0.1:4400'))
				.status
		).toBe(404);
		expect(
			(
				await get(
					'/api.html?playground-site-thumbnail-worker=1',
					'127.0.0.1:4400'
				)
			).status
		).toBe(404);
	});

	it('preserves single-origin routing for forwarded development hosts', async () => {
		expect(
			await get('/remote.html', 'example.app.github.dev')
		).toMatchObject({ status: 200, body: 'Vite app source' });
	});

	/** Send a browser-style Host header while listening on a private ephemeral port. */
	async function get(
		path: string,
		host: string,
		headers: IncomingHttpHeaders = {}
	) {
		return await new Promise<{
			status: number;
			body: string;
			headers: IncomingHttpHeaders;
		}>((resolve, reject) => {
			const req = request(
				{
					host: '127.0.0.1',
					port,
					path,
					headers: { ...headers, Host: host },
				},
				(res) => {
					let body = '';
					res.setEncoding('utf8');
					res.on('data', (chunk) => {
						body += chunk;
					});
					res.on('end', () =>
						resolve({
							status: res.statusCode!,
							body,
							headers: res.headers,
						})
					);
				}
			);
			req.on('error', reject);
			req.end();
		});
	}
});
