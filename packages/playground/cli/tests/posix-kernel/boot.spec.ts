import { describe, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { runCLI } from '../../src/run-cli';

describe('--experimental-posix-kernel', () => {
	it('boots nginx + php-fpm in the kernel and serves a static PHP root', async () => {
		const docRoot = mkdtempSync(join(tmpdir(), 'posix-kernel-smoke-'));
		writeFileSync(
			join(docRoot, 'index.php'),
			`<?php echo 'hello from posix-kernel: ' . PHP_VERSION;`
		);

		await using cliServer = await runCLI({
			command: 'server',
			'experimental-posix-kernel': true,
			port: 0,
			mount: [{ hostPath: docRoot, vfsPath: '/wordpress' }],
		});

		const response = await fetch(cliServer.serverUrl);
		expect(response.status).toBe(200);
		const body = await response.text();
		expect(body).toContain('hello from posix-kernel');
	}, 300_000);

	it('does not serve files outside the document root', async () => {
		const docRoot = mkdtempSync(join(tmpdir(), 'posix-kernel-smoke-'));
		writeFileSync(join(docRoot, 'index.php'), `<?php echo 'foo';`);

		await using cliServer = await runCLI({
			command: 'server',
			'experimental-posix-kernel': true,
			port: 0,
			mount: [{ hostPath: docRoot, vfsPath: '/wordpress' }],
		});
		await cliServer.playground.writeFile('/tmp/bar.txt', 'baz');

		for (const path of ['/%2e%2e/tmp/bar.txt', '/..%2ftmp/bar.txt']) {
			const body = await getRawPath(cliServer.serverUrl, path);
			expect(body).not.toContain('baz');
		}
	}, 300_000);
});

function getRawPath(serverUrl: string, path: string): Promise<string> {
	const { hostname, port } = new URL(serverUrl);
	return new Promise((resolve, reject) => {
		http.get({ hostname, port, path }, (response) => {
			let body = '';
			response.setEncoding('utf8');
			response.on('data', (chunk) => (body += chunk));
			response.on('end', () => resolve(body));
		}).on('error', reject);
	});
}
