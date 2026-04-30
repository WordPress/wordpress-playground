import { mkdtemp, rm, writeFile } from 'fs/promises';
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
			await writeFile(path.join(tempDir, 'example.so'), extensionBytes);
			await writeFile(
				path.join(tempDir, 'manifest.json'),
				JSON.stringify({
					name: 'example',
					artifacts: [
						{
							phpVersion: '8.4',
							asyncMode: 'jspi',
							file: 'example.so',
						},
					],
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
		} finally {
			await rm(tempDir, { recursive: true, force: true });
		}
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
