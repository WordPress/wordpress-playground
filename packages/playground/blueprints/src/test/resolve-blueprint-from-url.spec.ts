import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { resolveBlueprintFromURL } from '../lib/resolve-blueprint-from-url';
import { getBlueprintDeclaration } from '../lib/v1/compile';
import { createServer, type Server } from 'http';

describe('resolveBlueprintFromURL', () => {
	let server: Server;
	let serverUrl: string;

	beforeAll(async () => {
		// Start a real HTTP server for testing
		await new Promise<void>((resolve) => {
			server = createServer((req, res) => {
				res.setHeader('Access-Control-Allow-Origin', '*');
				res.setHeader('Content-Type', 'application/json');

				if (req.url === '/blueprint.json') {
					res.writeHead(200);
					res.end(JSON.stringify({ landingPage: '/test' }));
				} else if (req.url === '/default.json') {
					res.writeHead(200);
					res.end(JSON.stringify({ landingPage: '/default' }));
				} else {
					res.writeHead(404);
					res.end('Not found');
				}
			});

			server.listen(0, () => {
				const address = server.address();
				if (address && typeof address === 'object') {
					serverUrl = `http://localhost:${address.port}`;
					resolve();
				}
			});
		});
	});

	afterAll(async () => {
		await new Promise<void>((resolve) => {
			server.close(() => resolve());
		});
	});

	it('should resolve blueprint from blueprint-url query param', async () => {
		const url = new URL(
			`https://example.com/?blueprint-url=${serverUrl}/blueprint.json`
		);
		const result = await resolveBlueprintFromURL(url);

		const blueprint = await getBlueprintDeclaration(result.blueprint);
		expect(blueprint).toEqual({ landingPage: '/test' });
		expect(result.source).toEqual({
			type: 'remote-url',
			url: `${serverUrl}/blueprint.json`,
		});
	});

	it('should resolve blueprint from URL hash fragment (JSON)', async () => {
		const blueprint = { landingPage: '/?p=4' };
		const url = new URL(
			`https://example.com/#${JSON.stringify(blueprint)}`
		);
		const result = await resolveBlueprintFromURL(url);

		expect(result.blueprint).toEqual(blueprint);
		expect(result.source).toEqual({ type: 'inline-string' });
	});

	it('should resolve blueprint from URL hash fragment (base64)', async () => {
		const blueprint = { landingPage: '/?p=4' };
		const base64 = Buffer.from(JSON.stringify(blueprint)).toString(
			'base64'
		);
		const url = new URL(`https://example.com/#${base64}`);
		const result = await resolveBlueprintFromURL(url);

		expect(result.blueprint).toEqual(blueprint);
		expect(result.source).toEqual({ type: 'inline-string' });
	});

	it('should create blueprint from query params (plugin)', async () => {
		const url = new URL(
			'https://example.com/?plugin=gutenberg&plugin=wp-api'
		);
		const result = await resolveBlueprintFromURL(url);

		expect((result.blueprint as any).plugins).toEqual([
			'gutenberg',
			'wp-api',
		]);
		expect(result.source).toEqual({ type: 'none' });
	});

	it('should create blueprint from query params (theme)', async () => {
		const url = new URL('https://example.com/?theme=twentytwentyfour');
		const result = await resolveBlueprintFromURL(url);

		expect((result.blueprint as any).steps).toHaveLength(1);
		expect((result.blueprint as any).steps![0]).toMatchObject({
			step: 'installTheme',
			themeData: {
				resource: 'wordpress.org/themes',
				slug: 'twentytwentyfour',
			},
			options: { activate: true },
		});
	});

	it('should create blueprint from query params (import-wxr)', async () => {
		const url = new URL(
			'https://example.com/?import-wxr=https://example.com/content.xml'
		);
		const result = await resolveBlueprintFromURL(url);

		expect((result.blueprint as any).steps).toContainEqual({
			step: 'importWxr',
			file: {
				resource: 'url',
				url: 'https://example.com/content.xml',
			},
		});
	});
});
