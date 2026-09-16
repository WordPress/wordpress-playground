import { describe, expect, it } from 'vitest';

import { runCLI } from '../../src/run-cli';
import { stripRootDir } from '../../src/posix-kernel/prepare-wordpress';

describe('--experimental-posix-kernel auto-prepare WordPress', () => {
	it('downloads WordPress + SQLite and serves the installer when no /wordpress mount is given', async () => {
		await using cliServer = await runCLI({
			command: 'server',
			'experimental-posix-kernel': true,
			port: 0,
			wp: 'latest',
		});

		const response = await fetch(cliServer.serverUrl);
		expect(response.status).toBe(200);
		const body = await response.text();
		expect(body.toLowerCase()).toMatch(/wordpress|wp-/);
	}, 300_000);
});

describe('stripRootDir', () => {
	it('strips the root directory whatever its name', () => {
		expect(stripRootDir('wordpress/index.php')).toBe('index.php');
		expect(
			stripRootDir('plugin-sqlite-database-integration/load.php')
		).toBe('load.php');
		expect(
			stripRootDir('sqlite-database-integration-2.1.16/load.php')
		).toBe('load.php');
	});

	it('returns "" for the bare root directory entry', () => {
		expect(stripRootDir('wordpress/')).toBe('');
	});

	it('keeps nested paths below the root', () => {
		expect(stripRootDir('wordpress/wp-content/index.php')).toBe(
			'wp-content/index.php'
		);
	});

	it('returns null for a rootless entry', () => {
		expect(stripRootDir('wordpress-1.0')).toBeNull();
	});
});
