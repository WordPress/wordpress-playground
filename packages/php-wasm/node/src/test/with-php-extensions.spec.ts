import { mkdir, mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import { PHP_EXTENSIONS_DIR } from '@php-wasm/universal';
import { withPHPExtensions } from '../lib/extensions/load-extensions';
import { normalizeNodeExtensionSource } from '../lib/extensions/node-extension-resources';

describe('withPHPExtensions', () => {
	it('resolves local manifest paths without a custom fetch implementation', async () => {
		const tempDir = await mkdtemp(
			path.join(tmpdir(), 'php-wasm-extension-')
		);
		try {
			const extensionBytes = new Uint8Array([1, 2, 3]);
			await mkdir(path.join(tempDir, 'web-ui', 'css'), {
				recursive: true,
			});
			await writeFile(path.join(tempDir, 'example.so'), extensionBytes);
			await writeFile(
				path.join(tempDir, 'web-ui', 'index.html'),
				'<html></html>'
			);
			await writeFile(
				path.join(tempDir, 'web-ui', 'css', 'main.css'),
				'body { margin: 0; }'
			);
			await writeFile(
				path.join(tempDir, 'manifest.json'),
				JSON.stringify({
					name: 'example',
					artifacts: [
						{
							phpVersion: '8.4',
							sourcePath: 'example.so',
						},
					],
					extraFiles: {
						vfsRoot: '/internal/shared',
						nodes: [
							{
								vfsPath: 'profiler-data',
								type: 'directory',
							},
							{
								vfsPath: 'profiler-web-ui/index.html',
								sourcePath: 'web-ui/index.html',
							},
							{
								vfsPath: 'profiler-web-ui/css/main.css',
								sourcePath: 'web-ui/css/main.css',
							},
						],
					},
				})
			);

			const options = await withPHPExtensions('8.4', 'jspi', {}, [
				{
					source: {
						format: 'manifest',
						manifestUrl: path.join(tempDir, 'manifest.json'),
					},
				},
			]);
			const fs = createFakeFS();

			expect(options.ENV?.['PHP_INI_SCAN_DIR']).toBe(PHP_EXTENSIONS_DIR);
			options.onRuntimeInitialized?.({ FS: fs } as any);

			expect(fs.files.get(`${PHP_EXTENSIONS_DIR}/example.so`)).toEqual(
				extensionBytes
			);
			expect(fs.files.get(`${PHP_EXTENSIONS_DIR}/example.ini`)).toBe(
				`extension=${PHP_EXTENSIONS_DIR}/example.so`
			);
			expect(fs.directories.has('/internal/shared/profiler-data')).toBe(
				true
			);
			expect(
				fs.files.get('/internal/shared/profiler-web-ui/index.html')
			).toEqual(
				new Uint8Array(new TextEncoder().encode('<html></html>'))
			);
			expect(
				fs.files.get('/internal/shared/profiler-web-ui/css/main.css')
			).toEqual(
				new Uint8Array(new TextEncoder().encode('body { margin: 0; }'))
			);
		} finally {
			await rm(tempDir, { recursive: true, force: true });
		}
	});

	it('rejects external extension sources for Asyncify runtimes', async () => {
		await expect(
			withPHPExtensions('8.4', 'asyncify', {}, [
				{
					name: 'example',
					source: {
						format: 'so',
						bytes: new Uint8Array([1, 2, 3]),
					},
				},
			])
		).rejects.toThrow('External PHP extensions require JSPI');
	});

	it('treats drive-letter-shaped strings as local paths, not URL schemes', () => {
		const source = normalizeNodeExtensionSource({
			format: 'manifest',
			manifestUrl: 'C:/extensions/example/manifest.json',
		});

		if (!('manifestUrl' in source)) {
			throw new Error('Expected a manifest URL source.');
		}
		expect(source.manifestUrl).toBeInstanceOf(URL);
		expect((source.manifestUrl as URL).protocol).toBe('file:');
	});
});

function createFakeFS() {
	const files = new Map<string, string | Uint8Array>();
	const directories = new Set<string>(['/internal', '/internal/shared']);

	return {
		files,
		directories,
		lookupPath(path: string) {
			if (files.has(path) || directories.has(path)) {
				return { node: {} };
			}
			throw new Error(`Path not found: ${path}`);
		},
		mkdirTree(path: string) {
			directories.add(path);
		},
		writeFile(path: string, data: string | Uint8Array) {
			files.set(path, data);
		},
	};
}
