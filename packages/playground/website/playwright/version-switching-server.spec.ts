import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { request } from 'node:http';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { tmpdir } from 'node:os';
import { joinPaths } from '@php-wasm/util';
import { startVersionSwitchingServer } from './version-switching-server';

// Upgrade tests keep a browser open while this server changes which build it serves.
// Handle switch requests and cache overrides before serving files or invoking PHP;
// otherwise those handlers can hide the controls or replace the requested headers.
it('serves the selected release and keeps caching disabled when requested', async () => {
	const temporary = await mkdtemp(joinPaths(tmpdir(), 'playground-switch-'));
	const archived = joinPaths(temporary, 'old');
	const installed = joinPaths(temporary, 'new');
	const reservation = createServer().listen(0, '127.0.0.1');
	await once(reservation, 'listening');
	const { port } = reservation.address() as { port: number };
	await new Promise<void>((resolve) => reservation.close(() => resolve()));
	let server:
		| Awaited<ReturnType<typeof startVersionSwitchingServer>>
		| undefined;
	try {
		await mkdir(archived);
		await mkdir(joinPaths(installed, 'releases/new'), { recursive: true });
		await writeFile(joinPaths(archived, 'remote.html'), 'old');
		await writeFile(
			joinPaths(installed, 'custom-redirects.php'),
			'<?php http_response_code(404);'
		);
		await writeFile(joinPaths(installed, 'releases/new/main.js'), 'new');
		vi.stubEnv('PLAYWRIGHT_WORDPRESS_FRAME', '1');
		server = await startVersionSwitchingServer({
			port,
			oldVersionDirectory: archived,
			midVersionDirectory: archived,
			newVersionDirectory: installed,
		});
		const get = (path: string, host = 'playground.localhost') =>
			new Promise<{ status: number; cache: string; body: string }>(
				(resolve, reject) => {
					const outgoing = request(
						{
							hostname: '127.0.0.1',
							port,
							path,
							headers: { Host: host },
						},
						(response) => {
							let body = '';
							response.setEncoding('utf8');
							response.on('data', (chunk) => (body += chunk));
							response.on('end', () =>
								resolve({
									status: response.statusCode!,
									cache:
										response.headers['cache-control'] ?? '',
									body,
								})
							);
						}
					);
					outgoing.on('error', reject);
					outgoing.end();
				}
			);
		expect((await get('/remote.html')).body).toBe('old');
		expect((await get('/switch-versions/new')).status).toBe(200);
		server.setHttpCacheEnabled(false);
		const newAsset = await get('/releases/new/main.js');
		expect(newAsset.status).toBe(200);
		expect(newAsset.body).toBe('new');
		expect(newAsset.cache).toContain('no-store');
		expect((await get('/switch-versions/old')).status).toBe(200);
		const oldPage = await get('/remote.html');
		expect(oldPage.status).toBe(200);
		expect(oldPage.body).toBe('old');
		expect(oldPage.cache).toContain('no-store');
		expect(
			(await get('/switch-versions/new', 'untrusted.example')).status
		).toBe(404);
	} finally {
		server?.kill();
		vi.unstubAllEnvs();
		await rm(temporary, { recursive: true, force: true });
	}
});
