/**
 * Blueprint v1 steps run against the kernel-resident WordPress.
 * Exercises runPHP (run + stdout capture), writeFile + path
 * translation, mkdir, and login (defineConstant + mu-plugin).
 */

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
						path: '/wordpress/wp-content/uploads/slice3-marker',
					},
					{
						step: 'writeFile',
						path: '/wordpress/wp-content/uploads/slice3-marker/hello.txt',
						data: 'slice 3 lives',
					},
					{ step: 'runPHP', code: '<?php echo "RUNPHP_OK";' },
				],
			},
		});

		// WP still serves the installer (or front page if a previous
		// run cached a working install).
		const response = await fetch(cliServer.serverUrl, {
			redirect: 'manual',
		});
		expect([200, 301, 302]).toContain(response.status);

		// writeFile + mkdir must materialize on disk; nginx serves
		// wordPressRoot directly so we can read it back over HTTP.
		const markerResp = await fetch(
			new URL(
				'/wp-content/uploads/slice3-marker/hello.txt',
				cliServer.serverUrl
			)
		);
		expect(markerResp.status).toBe(200);
		expect(await markerResp.text()).toBe('slice 3 lives');
	}, 180_000);
});
