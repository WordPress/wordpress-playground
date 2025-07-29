import { createNodeFsMountHandler, loadNodeRuntime } from '@php-wasm/node';
import { RecommendedPHPVersion } from '@wp-playground/common';
import {
	getWordPressModule,
	MinifiedWordPressVersions,
} from '@wp-playground/wordpress-builds';
import { mkdirSync, rmdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { bootWordPress } from '../boot';
import { getLoadedWordPressVersion } from '../version-detect';

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

	it("should not start WordPress when SQLite ZIP not specified and SQLite driver directory doesn't exist", async () => {
		await expect(async () => {
			await bootWordPress({
				createPhpRuntime: async () =>
					await loadNodeRuntime(RecommendedPHPVersion),
				siteUrl: 'http://playground-domain/',
				wordPressZip: await getWordPressModule(),
				sqliteIntegrationPluginZip: undefined,
			});
		}).rejects.toThrow(
			'SQLite installation has been skipped and no SQLite mu-plugin has been found.'
		);
	});

	it('hould install WordPress when SQL data path specified, even without SQLite ZIP path or SQLite driver directory', async () => {
		const handler = await bootWordPress({
			createPhpRuntime: async () =>
				await loadNodeRuntime(RecommendedPHPVersion),
			siteUrl: 'http://playground-domain/',
			wordPressZip: await getWordPressModule(),
			sqliteIntegrationPluginZip: undefined,
			dataSqlPath: '/wordpress/wp-content/database/.ht.sqlite',
		});

		const loadedWordPressVersion = await getLoadedWordPressVersion(handler);
		expect(loadedWordPressVersion).toBeTruthy();
		expect(Object.keys(MinifiedWordPressVersions)).toContain(
			loadedWordPressVersion
		);
	});

	it("should fail when the SQLite driver directory exists, but doesn't contain a valid driver", async () => {
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
		}).rejects.toThrow('Error connecting to the SQLite database.');
	});
});
