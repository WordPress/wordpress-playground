import { describe, expect, it } from 'vitest';

import {
	PHP_EXTENSION_PRELOAD_DIR,
	PHP_EXTENSIONS_DIR,
} from '@php-wasm/universal';
import { loadPHPExtension } from './load-php-extension';

const PHP_INI_PATH = '/internal/shared/php.ini';

describe('loadPHPExtension Blueprint step', () => {
	it('loads a direct .so resource and a directory resource for extra files', async () => {
		const php = createFakePHP();
		const soBytes = new Uint8Array([1, 2, 3]);

		await loadPHPExtension(php as any, {
			source: new File([soBytes], 'example.so'),
			extraFiles: {
				name: 'example-assets',
				files: {
					'data.txt': 'sidecar',
				},
			},
			extraFilesPath: '/internal/shared/example-assets',
		});

		expect(php.files.get(`${PHP_EXTENSIONS_DIR}/example.so`)).toEqual(
			soBytes
		);
		expect(php.files.get(`${PHP_EXTENSIONS_DIR}/example.ini`)).toBe(
			`extension=${PHP_EXTENSIONS_DIR}/example.so`
		);
		expect(
			String(php.files.get(`${PHP_EXTENSION_PRELOAD_DIR}/example.php`))
		).toContain("dl('example.so')");
		expect(php.files.get('/internal/shared/example-assets/data.txt')).toBe(
			'sidecar'
		);
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
		async mkdir(path: string) {
			directories.add(path);
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
