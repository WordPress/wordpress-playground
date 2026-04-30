import { describe, expect, it } from 'vitest';

import {
	PHP_EXTENSIONS_DIR,
	resolvePHPExtensionInstallPlan,
} from './load-extension';

describe('resolvePHPExtensionInstallPlan', () => {
	it('builds a regular extension startup plan', async () => {
		const plan = await resolvePHPExtensionInstallPlan({
			source: {
				format: 'so',
				name: 'example',
				bytes: new Uint8Array([1, 2, 3]),
			},
			phpVersion: '8.4',
			asyncMode: 'jspi',
		});

		expect(plan.soPath).toBe(`${PHP_EXTENSIONS_DIR}/example.so`);
		expect(plan.iniContent).toBe(
			`extension=${PHP_EXTENSIONS_DIR}/example.so`
		);
	});

	it('builds a zend extension startup plan', async () => {
		const plan = await resolvePHPExtensionInstallPlan({
			source: {
				format: 'so',
				name: 'xdebug',
				bytes: new Uint8Array([1, 2, 3]),
			},
			phpVersion: '8.4',
			asyncMode: 'jspi',
			loadWithIniDirective: 'zend_extension',
		});

		expect(plan.iniContent).toBe(
			`zend_extension=${PHP_EXTENSIONS_DIR}/xdebug.so`
		);
	});

	it('rejects extension names that cannot be used as safe VFS basenames', async () => {
		await expect(
			resolvePHPExtensionInstallPlan({
				source: {
					format: 'so',
					name: '../example',
					bytes: new Uint8Array([1, 2, 3]),
				},
				phpVersion: '8.4',
				asyncMode: 'jspi',
			})
		).rejects.toThrow('Invalid PHP extension name');
	});

	it('selects a manifest artifact before PHP startup', async () => {
		const artifactBytes = new Uint8Array([4, 5, 6]);
		const plan = await resolvePHPExtensionInstallPlan({
			source: {
				format: 'manifest',
				manifestUrl: 'https://example.com/extensions/manifest.json',
			},
			phpVersion: '8.4',
			asyncMode: 'asyncify',
			fetch: async (url) => {
				const requestUrl = String(url);
				if (requestUrl.endsWith('/manifest.json')) {
					return Response.json({
						name: 'example',
						version: '1.0.0',
						artifacts: [
							{
								phpVersion: '8.4',
								asyncMode: 'asyncify',
								file: 'example-php8.4-asyncify.so',
							},
						],
					});
				}
				if (requestUrl.endsWith('/example-php8.4-asyncify.so')) {
					return new Response(artifactBytes);
				}
				return new Response('Not found', { status: 404 });
			},
		});

		expect(plan.soBytes).toEqual(artifactBytes);
	});
});
