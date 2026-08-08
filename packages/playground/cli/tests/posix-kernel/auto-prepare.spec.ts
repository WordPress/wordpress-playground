import { describe, expect, it } from 'vitest';

import { runCLI } from '../../src/run-cli';
import { stripLeadingDirPrefix } from '../../src/posix-kernel/prepare-wordpress';

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

describe('stripLeadingDirPrefix', () => {
	it('strips an exact prefix', () => {
		expect(stripLeadingDirPrefix('wordpress/index.php', 'wordpress')).toBe(
			'index.php'
		);
	});

	it('returns "" for the bare directory entry', () => {
		expect(stripLeadingDirPrefix('wordpress/', 'wordpress')).toBe('');
	});

	it('strips a versioned prefix (plugin-x.y.z/...)', () => {
		expect(
			stripLeadingDirPrefix(
				'sqlite-database-integration-2.1.16/load.php',
				'sqlite-database-integration'
			)
		).toBe('load.php');
	});

	it('returns null for paths outside the prefix', () => {
		expect(stripLeadingDirPrefix('other/foo.txt', 'wordpress')).toBeNull();
	});

	it('returns null for a similar-but-different prefix without trailing /', () => {
		expect(stripLeadingDirPrefix('wordpressX/foo', 'wordpress')).toBeNull();
	});

	it('returns null for a versioned root with no slash', () => {
		expect(stripLeadingDirPrefix('wordpress-1.0', 'wordpress')).toBeNull();
	});
});
