import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import {
	cliExtensionArgsToExtensionsArray,
	readPHPExtensionConfig,
} from '../src/php-extensions';

describe('CLI PHP extensions', () => {
	test('converts built-in extension flags to runtime extension requests', () => {
		expect(
			cliExtensionArgsToExtensionsArray({
				intl: true,
				redis: true,
				memcached: true,
				xdebug: true,
			})
		).toEqual(['intl', 'redis', 'memcached', 'xdebug']);
	});

	test('converts --php-extension values to manifest extension requests', () => {
		expect(
			cliExtensionArgsToExtensionsArray({
				phpExtension: [
					'./dist/wp_mysql_parser/manifest.json',
					'https://example.com/spx/manifest.json',
				],
			})
		).toEqual([
			{
				source: {
					format: 'manifest',
					manifestUrl: './dist/wp_mysql_parser/manifest.json',
				},
			},
			{
				source: {
					format: 'manifest',
					manifestUrl: 'https://example.com/spx/manifest.json',
				},
			},
		]);
	});

	test('reads --php-extension-config JSON files', async () => {
		const tempDir = await mkdtemp(path.join(tmpdir(), 'php-extension-'));
		const configPath = path.join(tempDir, 'extension.json');
		await writeFile(
			configPath,
			JSON.stringify({
				name: 'sqlite_markdown',
				source: {
					format: 'url',
					url: './dist/sqlite_markdown-php8.4-jspi.so',
				},
				loadWithIniDirective: false,
			})
		);

		try {
			expect(readPHPExtensionConfig(configPath)).toEqual({
				name: 'sqlite_markdown',
				source: {
					format: 'url',
					url: './dist/sqlite_markdown-php8.4-jspi.so',
				},
				loadWithIniDirective: false,
			});
			expect(
				cliExtensionArgsToExtensionsArray({
					phpExtensionConfig: [configPath],
				})
			).toEqual([readPHPExtensionConfig(configPath)]);
		} finally {
			await rm(tempDir, { recursive: true, force: true });
		}
	});

	test('rejects config files without an external extension source', async () => {
		const tempDir = await mkdtemp(path.join(tmpdir(), 'php-extension-'));
		const configPath = path.join(tempDir, 'extension.json');
		await writeFile(configPath, JSON.stringify({ name: 'broken' }));

		try {
			expect(() => readPHPExtensionConfig(configPath)).toThrow(
				'Expected an object with a source field'
			);
		} finally {
			await rm(tempDir, { recursive: true, force: true });
		}
	});
});
