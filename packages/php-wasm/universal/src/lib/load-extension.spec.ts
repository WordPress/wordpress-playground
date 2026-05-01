import { describe, expect, it } from 'vitest';

import { PHP_EXTENSIONS_DIR, resolvePHPExtension } from './load-extension';

describe('resolvePHPExtension', () => {
	it('resolves a regular extension for startup', async () => {
		const extension = await resolvePHPExtension({
			source: {
				format: 'so',
				name: 'example',
				bytes: new Uint8Array([1, 2, 3]),
			},
			phpVersion: '8.4',
		});

		expect(extension.soPath).toBe(`${PHP_EXTENSIONS_DIR}/example.so`);
		expect(extension.iniContent).toBe(
			`extension=${PHP_EXTENSIONS_DIR}/example.so`
		);
	});

	it('resolves a zend extension for startup', async () => {
		const extension = await resolvePHPExtension({
			source: {
				format: 'so',
				name: 'xdebug',
				bytes: new Uint8Array([1, 2, 3]),
			},
			phpVersion: '8.4',
			loadWithIniDirective: 'zend_extension',
		});

		expect(extension.iniContent).toBe(
			`zend_extension=${PHP_EXTENSIONS_DIR}/xdebug.so`
		);
	});

	it('rejects extension names that cannot be used as safe VFS basenames', async () => {
		await expect(
			resolvePHPExtension({
				source: {
					format: 'so',
					name: '../example',
					bytes: new Uint8Array([1, 2, 3]),
				},
				phpVersion: '8.4',
			})
		).rejects.toThrow('Invalid PHP extension name');
	});

	it('explains that direct URL sources require absolute URLs', async () => {
		await expect(
			resolvePHPExtension({
				source: {
					format: 'url',
					url: './example.so',
				},
				phpVersion: '8.4',
				fetch: async () => new Response(new Uint8Array([1, 2, 3])),
			})
		).rejects.toThrow('source.url must be an absolute URL');
	});

	it('selects a manifest artifact before PHP startup', async () => {
		const artifactBytes = new Uint8Array([4, 5, 6]);
		const extension = await resolvePHPExtension({
			source: {
				format: 'manifest',
				manifestUrl: 'https://example.com/extensions/manifest.json',
			},
			phpVersion: '8.4',
			fetch: async (url) => {
				const requestUrl = String(url);
				if (requestUrl.endsWith('/manifest.json')) {
					return Response.json({
						name: 'example',
						version: '1.0.0',
						artifacts: [
							{
								phpVersion: '8.4',
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

		expect(extension.soBytes).toEqual(artifactBytes);
	});

	it('rejects manifests that do not match the generated schema validator', async () => {
		await expect(
			resolvePHPExtension({
				source: {
					format: 'manifest',
					manifest: {
						name: 'example',
						artifacts: [
							{
								phpVersion: '8.4',
								asyncMode: 'asyncify',
								file: 'example-php8.4-asyncify.so',
							},
						],
					} as any,
					baseUrl: 'https://example.com/extensions/',
				},
				phpVersion: '8.4',
				fetch: async () => new Response(new Uint8Array([1, 2, 3])),
			})
		).rejects.toThrow('Invalid PHP extension manifest');
	});

	it('resolves manifest-declared sidecar files', async () => {
		const extension = await resolvePHPExtension({
			source: {
				format: 'manifest',
				manifestUrl: 'https://example.com/extensions/manifest.json',
			},
			phpVersion: '8.4',
			fetch: async (url) => {
				const requestUrl = String(url);
				if (requestUrl.endsWith('/manifest.json')) {
					return Response.json({
						name: 'example',
						artifacts: [
							{
								phpVersion: '8.4',
								file: 'example.so',
							},
						],
						extraFiles: {
							targetPath: '/internal/shared',
							directories: ['profiler-data'],
							files: [
								{
									path: 'profiler-web-ui/index.html',
									file: 'web-ui/index.html',
								},
								{
									path: 'profiler-web-ui/css/main.css',
									file: 'web-ui/css/main.css',
								},
							],
						},
					});
				}
				if (requestUrl.endsWith('/example.so')) {
					return new Response(new Uint8Array([1, 2, 3]));
				}
				if (requestUrl.endsWith('/web-ui/index.html')) {
					return new Response('<html></html>');
				}
				if (requestUrl.endsWith('/web-ui/css/main.css')) {
					return new Response('body { margin: 0; }');
				}
				return new Response('Not found', { status: 404 });
			},
		});

		expect(extension.extraFiles).toEqual({
			targetPath: '/internal/shared',
			files: {
				'profiler-data': {},
				'profiler-web-ui': {
					'index.html': new Uint8Array(
						new TextEncoder().encode('<html></html>')
					),
					css: {
						'main.css': new Uint8Array(
							new TextEncoder().encode('body { margin: 0; }')
						),
					},
				},
			},
		});
	});

	it('rejects manifest extra file paths that escape the target directory', async () => {
		await expect(
			resolvePHPExtension({
				source: {
					format: 'manifest',
					manifest: {
						name: 'example',
						artifacts: [
							{
								phpVersion: '8.4',
								file: 'example.so',
							},
						],
						extraFiles: {
							files: [
								{
									path: '../index.html',
									file: 'index.html',
								},
							],
						},
					},
					baseUrl: 'https://example.com/extensions/',
				},
				phpVersion: '8.4',
				fetch: async () => new Response(new Uint8Array([1, 2, 3])),
			})
		).rejects.toThrow('Invalid extension extra file path');
	});
});
