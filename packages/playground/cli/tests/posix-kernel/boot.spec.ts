/**
 * Smoke test for `--experimental-posix-kernel`. Boots a minimal PHP
 * document root through wasm-posix-kernel + nginx + PHP-FPM, fetches
 * '/', and asserts the response.
 */

import { describe, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
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
	}, 60_000);
});
