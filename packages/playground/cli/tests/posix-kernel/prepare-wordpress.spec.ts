import { PHPResponse } from '@php-wasm/universal';
import { describe, expect, it } from 'vitest';

import { ensureWordPressInstalled } from '../../src/posix-kernel/prepare-wordpress';
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
});
