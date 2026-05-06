/**
 * `--experimental-posix-kernel` without `--mount`: the CLI must
 * download WordPress, drop in SQLite Database Integration, write
 * wp-config.php, and serve the installer.
 */

import { describe, expect, it } from 'vitest';

import { runCLI } from '../../src/run-cli';

describe('--experimental-posix-kernel auto-prepare WordPress', () => {
	it('downloads WordPress + SQLite and serves the installer when no /wordpress mount is given', async () => {
		await using cliServer = await runCLI({
			command: 'server',
			'experimental-posix-kernel': true,
			port: 0,
			wp: 'latest',
		});

		// Follow redirects: the first request triggers the kernel
		// handler's first-request cookie-clear middleware (302 to the
		// same URL). Reaching the front-page body proves PHP + SQLite
		// are alive on a freshly auto-prepared install.
		const response = await fetch(cliServer.serverUrl);
		expect(response.status).toBe(200);
		const body = await response.text();
		expect(body.toLowerCase()).toMatch(/wordpress|wp-/);
	}, 120_000);
});
