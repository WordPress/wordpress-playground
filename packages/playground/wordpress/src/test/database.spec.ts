import { loadNodeRuntime } from '@php-wasm/node';
import { RecommendedPHPVersion } from '@wp-playground/common';
import { getWordPressModule } from '@wp-playground/wordpress-builds';
import { bootWordPress, isWordPressInstalled } from '../boot';
import { join } from 'path';
import { tmpdir } from 'os';
import { mkdirSync, rmdirSync } from 'fs';
import { createNodeFsMountHandler } from '@php-wasm/node';

describe('Test database', () => {
	let tempDir: string;

	beforeAll(() => {
		tempDir = join(tmpdir(), 'database-test');

		try {
			mkdirSync(
				join(
					tempDir,
					'wp-content',
					'mu-plugins',
					'sqlite-database-integration'
				),
				{ recursive: true }
			);
		} catch {
			// Ignore error if directory already exists
		}
	});

	afterAll(() => {
		rmdirSync(tempDir, { recursive: true });
	});

	it('should not start WordPress without a working driver module', async () => {
		await expect(async () => {
			await bootWordPress({
				createPhpRuntime: async () =>
					await loadNodeRuntime(RecommendedPHPVersion),
				siteUrl: 'http://playground-domain/',
				wordPressZip: await getWordPressModule(),
				sqliteIntegrationPluginZip: undefined,
			});
		}).rejects.toThrow('SQLite integration plugin is not installed.');
	});

	it('should not install WordPress with data but without a working driver module', async () => {
		await expect(async () => {
			await bootWordPress({
				createPhpRuntime: async () =>
					await loadNodeRuntime(RecommendedPHPVersion),
				siteUrl: 'http://playground-domain/',
				wordPressZip: await getWordPressModule(),
				sqliteIntegrationPluginZip: undefined,
				dataSqlPath: '/wordpress/wp-content/database/.ht.sqlite',
			});
		}).rejects.toThrow('SQLite integration plugin is not installed.');
	});

	it('should fail if the SQLite integration plugin is specified but not installed', async () => {
		await expect(async () => {
			await bootWordPress({
				createPhpRuntime: async () =>
					await loadNodeRuntime(RecommendedPHPVersion),
				siteUrl: 'http://playground-domain/',
				wordPressZip: await getWordPressModule(),
				sqliteIntegrationPluginZip: undefined,
				hooks: {
					beforeWordPressFiles: async (php) => {
						await php.mount(
							'/wordpress',
							createNodeFsMountHandler(tempDir)
						);
					},
				},
			});
		}).rejects.toThrow('WordPress installation has failed.');
	});
});
