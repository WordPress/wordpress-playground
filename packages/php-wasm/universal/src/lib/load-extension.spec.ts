import { describe, expect, it } from 'vitest';

import {
	buildPHPExtensionInstallPlan,
	PHP_EXTENSIONS_DIR,
	resolvePHPExtensionInstallPlan,
} from './load-extension';

describe('buildPHPExtensionInstallPlan', () => {
	it('builds a regular extension startup plan', () => {
		const plan = buildPHPExtensionInstallPlan({
			name: 'example',
			soBytes: new Uint8Array([1, 2, 3]),
		});

		expect(plan.soPath).toBe(`${PHP_EXTENSIONS_DIR}/example.so`);
		expect(plan.iniContent).toBe(
			`extension=${PHP_EXTENSIONS_DIR}/example.so`
		);
	});

	it('builds a zend extension startup plan', () => {
		const plan = buildPHPExtensionInstallPlan({
			name: 'xdebug',
			soBytes: new Uint8Array([1, 2, 3]),
			loadWithIniDirective: 'zend_extension',
		});

		expect(plan.iniContent).toBe(
			`zend_extension=${PHP_EXTENSIONS_DIR}/xdebug.so`
		);
	});
});

describe('resolvePHPExtensionInstallPlan', () => {
	it('selects a manifest artifact before PHP startup', async () => {
		const artifactBytes = new Uint8Array([4, 5, 6]);
		const { plan, artifact } = await resolvePHPExtensionInstallPlan({
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

		expect(artifact?.file).toBe('example-php8.4-asyncify.so');
		expect(plan.soBytes).toEqual(artifactBytes);
	});

	it('supports deprecated manifest url alias', async () => {
		const artifactBytes = new Uint8Array([7, 8, 9]);
		const { plan } = await resolvePHPExtensionInstallPlan({
			source: {
				format: 'manifest',
				url: 'https://example.com/extensions/manifest.json',
			},
			phpVersion: '8.4',
			asyncMode: 'jspi',
			fetch: async (url) => {
				const requestUrl = String(url);
				if (requestUrl.endsWith('/manifest.json')) {
					return Response.json({
						name: 'example',
						artifacts: [
							{
								phpVersion: '8.4',
								asyncMode: 'jspi',
								file: 'example-php8.4-jspi.so',
							},
						],
					});
				}
				if (requestUrl.endsWith('/example-php8.4-jspi.so')) {
					return new Response(artifactBytes);
				}
				return new Response('Not found', { status: 404 });
			},
		});

		expect(plan.soBytes).toEqual(artifactBytes);
	});
});
