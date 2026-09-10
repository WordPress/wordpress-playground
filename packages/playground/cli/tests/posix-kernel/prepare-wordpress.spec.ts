import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PHPResponse } from '@php-wasm/universal';
import { describe, expect, it } from 'vitest';

import {
	ensureDbDropIn,
	ensureSqliteIntegrationPlugin,
	ensureWordPressInstalled,
} from '../../src/posix-kernel/prepare-wordpress';
import type { KernelLimitedPHPApi } from '../../src/posix-kernel/php-api';

function response(
	status: number,
	{ location, body }: { location?: string; body?: string } = {}
): PHPResponse {
	const headers: Record<string, string[]> = {};
	if (location) {
		headers['location'] = [location];
	}
	return new PHPResponse(
		status,
		headers,
		new TextEncoder().encode(body ?? '')
	);
}

function fakeApi(handler: (method: string, url: string) => PHPResponse) {
	const calls: Array<{ method: string; url: string }> = [];
	const api = {
		async request(request: { method?: string; url: string }) {
			const method = request.method ?? 'GET';
			calls.push({ method, url: request.url });
			return handler(method, request.url);
		},
	} as unknown as KernelLimitedPHPApi;
	return { api, calls };
}

describe('ensureWordPressInstalled gateway readiness', () => {
	it('retries a transient bad-gateway on the probe and the install POST', async () => {
		let probes = 0;
		let posts = 0;
		const { api, calls } = fakeApi((method) => {
			if (method === 'POST') {
				posts++;
				return posts === 1
					? response(502)
					: response(200, { body: 'Success' });
			}
			probes++;
			return probes === 1
				? response(502)
				: response(302, { location: '/wp-admin/install.php' });
		});

		await expect(ensureWordPressInstalled(api)).resolves.toBeUndefined();
		expect(probes).toBe(2);
		expect(posts).toBe(2);
		expect(calls[0]).toEqual({ method: 'GET', url: '/' });
	});

	it('surfaces a persistent bad-gateway on the install POST', async () => {
		const { api } = fakeApi((method) =>
			method === 'POST'
				? response(502)
				: response(302, { location: '/wp-admin/install.php' })
		);

		await expect(ensureWordPressInstalled(api)).rejects.toThrow('HTTP 502');
	});

	it('does not POST when the site is already installed', async () => {
		const { api, calls } = fakeApi(() => response(200));

		await expect(ensureWordPressInstalled(api)).resolves.toBeUndefined();
		expect(calls).toEqual([{ method: 'GET', url: '/' }]);
	});

	it('rejects an HTTP 500 on the initial probe', async () => {
		const { api } = fakeApi(() =>
			response(500, {
				body: 'Error establishing a database connection',
			})
		);

		await expect(ensureWordPressInstalled(api)).rejects.toThrow(
			'readiness probe failed: HTTP 500'
		);
	});

	it('rejects an HTTP 500 on the post-install recheck', async () => {
		let probes = 0;
		const { api } = fakeApi((method) => {
			if (method === 'POST') {
				return response(200, { body: 'installer output' });
			}
			probes++;
			return probes === 1
				? response(302, { location: '/wp-admin/install.php' })
				: response(500);
		});

		await expect(ensureWordPressInstalled(api)).rejects.toThrow(
			'post-install recheck failed: HTTP 500'
		);
	});
});

describe('ensureSqliteIntegrationPlugin', () => {
	it('extracts the bundled archive and creates the db.php drop-in', async () => {
		const wordPressRoot = mkdtempSync(join(tmpdir(), 'posix-sqlite-'));
		try {
			await ensureSqliteIntegrationPlugin(wordPressRoot);
			const pluginDir = join(
				wordPressRoot,
				'wp-content/plugins/sqlite-database-integration'
			);
			expect(existsSync(join(pluginDir, 'load.php'))).toBe(true);
			expect(existsSync(join(pluginDir, 'db.copy'))).toBe(true);

			ensureDbDropIn(wordPressRoot);
			expect(existsSync(join(wordPressRoot, 'wp-content/db.php'))).toBe(
				true
			);
		} finally {
			rmSync(wordPressRoot, { recursive: true, force: true });
		}
	});

	it('throws instead of creating an empty db-less site', () => {
		const wordPressRoot = mkdtempSync(join(tmpdir(), 'posix-sqlite-'));
		try {
			expect(() => ensureDbDropIn(wordPressRoot)).toThrow(
				'db.copy not found'
			);
		} finally {
			rmSync(wordPressRoot, { recursive: true, force: true });
		}
	});
});
