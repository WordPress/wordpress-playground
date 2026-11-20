import { readFileSync } from 'node:fs';
import type { UniversalPHP } from '@php-wasm/universal';
import { wpCLI } from '@wp-playground/blueprints';
import { describe, expect, it } from 'vitest';

import { runCLI } from '../../src/run-cli';

describe('--experimental-posix-kernel blueprint v1', () => {
	it('runs runPHP, writeFile, mkdir, and login steps against the kernel-resident WordPress', async () => {
		await using cliServer = await runCLI({
			command: 'server',
			'experimental-posix-kernel': true,
			port: 0,
			wp: 'latest',
			login: true,
			blueprint: {
				steps: [
					{
						step: 'mkdir',
						path: '/wordpress/wp-content/uploads/foo',
					},
					{
						step: 'writeFile',
						path: '/wordpress/wp-content/uploads/foo/bar.txt',
						data: 'baz',
					},
					{ step: 'runPHP', code: '<?php echo "RUNPHP_OK";' },
				],
			},
		});

		const response = await fetch(cliServer.serverUrl, {
			redirect: 'manual',
		});
		expect([200, 301, 302]).toContain(response.status);

		const markerResp = await fetch(
			new URL('/wp-content/uploads/foo/bar.txt', cliServer.serverUrl)
		);
		expect(markerResp.status).toBe(200);
		expect(await markerResp.text()).toBe('baz');
	}, 300_000);

	it('runs the wp-cli step under the kernel CLI SAPI', async () => {
		await using cliServer = await runCLI({
			command: 'server',
			'experimental-posix-kernel': true,
			port: 0,
			wp: 'latest',
		});
		await cliServer.playground.writeFile(
			'/tmp/wp-cli.phar',
			readFileSync(new URL('../fixtures/wp-cli.phar', import.meta.url))
		);

		const response = await wpCLI(
			cliServer.playground as unknown as UniversalPHP,
			{ command: 'wp option get blogname' }
		);

		expect(response.text.trim()).toBe('My WordPress Website');
		expect(response.errors).not.toContain('already defined');
	}, 300_000);
});
