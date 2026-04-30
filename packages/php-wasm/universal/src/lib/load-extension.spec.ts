import { describe, expect, it } from 'vitest';

import {
	buildPHPExtensionInstallPlan,
	loadPHPExtension,
	PHP_EXTENSION_PRELOAD_DIR,
	PHP_EXTENSIONS_DIR,
	resolvePHPExtensionInstallPlan,
} from './load-extension';
import { PHP_INI_PATH } from './php';

describe('buildPHPExtensionInstallPlan', () => {
	it('loads regular extensions after startup by default', () => {
		const plan = buildPHPExtensionInstallPlan({
			name: 'example',
			soBytes: new Uint8Array([1, 2, 3]),
		});

		expect(plan.loadTiming).toBe('after-php-startup');
		expect(plan.soPath).toBe(`${PHP_EXTENSIONS_DIR}/example.so`);
		expect(plan.iniContent).toBe(
			`extension=${PHP_EXTENSIONS_DIR}/example.so`
		);
		expect(plan.preloadPath).toBe(
			`${PHP_EXTENSION_PRELOAD_DIR}/example.php`
		);
	});

	it('loads zend extensions before startup by default', () => {
		const plan = buildPHPExtensionInstallPlan({
			name: 'xdebug',
			soBytes: new Uint8Array([1, 2, 3]),
			loadWithIniDirective: 'zend_extension',
		});

		expect(plan.loadTiming).toBe('before-php-startup');
		expect(plan.iniContent).toBe(
			`zend_extension=${PHP_EXTENSIONS_DIR}/xdebug.so`
		);
		expect(plan.preloadPath).toBeUndefined();
	});

	it('rejects zend extensions after startup', () => {
		expect(() =>
			buildPHPExtensionInstallPlan({
				name: 'xdebug',
				soBytes: new Uint8Array([1, 2, 3]),
				loadTiming: 'after-php-startup',
				loadWithIniDirective: 'zend_extension',
			})
		).toThrow('Zend extensions must load before PHP startup.');
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
			loadTiming: 'before-php-startup',
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
		expect(plan.loadTiming).toBe('before-php-startup');
		expect(plan.soBytes).toEqual(artifactBytes);
		expect(plan.preloadPath).toBeUndefined();
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

describe('loadPHPExtension', () => {
	it('selects a manifest artifact and installs files for post-startup loading', async () => {
		const php = createFakePHP();
		const artifactBytes = new Uint8Array([4, 5, 6]);

		await loadPHPExtension(php as any, {
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

		expect(php.files.get(`${PHP_EXTENSIONS_DIR}/example.so`)).toEqual(
			artifactBytes
		);
		expect(php.files.get(`${PHP_EXTENSIONS_DIR}/example.ini`)).toBe(
			`extension=${PHP_EXTENSIONS_DIR}/example.so`
		);
		expect(
			String(php.files.get(`${PHP_EXTENSION_PRELOAD_DIR}/example.php`))
		).toContain("dl('example.so')");
		expect(php.files.get(PHP_INI_PATH)).toContain(
			`extension_dir=${PHP_EXTENSIONS_DIR}`
		);
		expect(php.files.get(PHP_INI_PATH)).toContain('enable_dl=On');
	});
});

function createFakePHP() {
	const files = new Map<string, string | Uint8Array>([
		[PHP_INI_PATH, 'memory_limit=256M\n'],
	]);
	const directories = new Set<string>(['/internal', '/internal/shared']);

	return {
		files,
		directories,
		async fileExists(path: string) {
			return files.has(path) || directories.has(path);
		},
		async mkdirTree(path: string) {
			directories.add(path);
		},
		async writeFile(path: string, data: string | Uint8Array) {
			files.set(path, data);
		},
		async readFileAsText(path: string) {
			const value = files.get(path);
			if (value instanceof Uint8Array) {
				return new TextDecoder().decode(value);
			}
			return value ?? '';
		},
	};
}
