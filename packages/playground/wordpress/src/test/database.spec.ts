import { createNodeFsMountHandler, loadNodeRuntime } from '@php-wasm/node';
import { RecommendedPHPVersion } from '@wp-playground/common';
import {
	getSqliteDriverModule,
	getWordPressModule,
	MinifiedWordPressVersions,
} from '@wp-playground/wordpress-builds';
import { mkdirSync, readFileSync, rmdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { bootWordPressAndRequestHandler } from '../boot';
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

	it("should not start WordPress when SQLite ZIP not specified, the SQLite driver directory doesn't exist and MySQL can't be used", async () => {
		await expect(async () => {
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			await using handler = await bootWordPressAndRequestHandler({
				createPhpRuntime: async () =>
					await loadNodeRuntime(RecommendedPHPVersion),
				siteUrl: 'http://playground-domain/',
				wordPressZip: await getWordPressModule(),
				sqliteIntegrationPluginZip: undefined,
			});
		}).rejects.toThrow('Error connecting to the MySQL database.');
	});

	it(
		'should install WordPress when SQL data path specified, even without SQLite ZIP path or SQLite driver directory',
		async () => {
			await using handler = await bootWordPressAndRequestHandler({
				createPhpRuntime: async () =>
					await loadNodeRuntime(RecommendedPHPVersion),
				siteUrl: 'http://playground-domain/',
				wordPressZip: await getWordPressModule(),
				sqliteIntegrationPluginZip: await getSqliteDriverModule(),
				dataSqlPath: '/wordpress/wp-content/database/.ht.sqlite',
			});

			const loadedWordPressVersion =
				await getLoadedWordPressVersion(handler);
			expect(loadedWordPressVersion).toBeTruthy();
			expect(Object.keys(MinifiedWordPressVersions)).toContain(
				loadedWordPressVersion
			);
		},
		{ timeout: 30_000 }
	);

	it(
		'should not throw a pre-flight database error when SQLite is skipped and MySQL wp-config.php is provided',
		{ timeout: 30_000 },
		async () => {
			const wpConfigContent = readFileSync(
				join(__dirname, 'fixtures/wp-config-sample.php'),
				'utf-8'
			);
			const dbStubContent = readFileSync(
				join(__dirname, 'fixtures/mysql-db-stub.php'),
				'utf-8'
			);

			await expect(async () => {
				// eslint-disable-next-line @typescript-eslint/no-unused-vars
				await using handler = await bootWordPressAndRequestHandler({
					createPhpRuntime: async () =>
						await loadNodeRuntime(RecommendedPHPVersion),
					siteUrl: 'http://playground-domain/',
					wordPressZip: await getWordPressModule(),
					// Simulates --skip-sqlite-setup from the CLI
					sqliteIntegrationPluginZip: undefined,
					hooks: {
						beforeDatabaseSetup: async (php) => {
							php.writeFile(
								'/wordpress/wp-config.php',
								wpConfigContent
									.replace('database_name_here', 'foo')
									.replace('username_here', 'bar')
							);
							php.mkdir('/wordpress/wp-content');
							php.writeFile(
								'/wordpress/wp-content/db.php',
								dbStubContent
							);
						},
					},
				});
			}).rejects.not.toThrow('Error connecting to the MySQL database.');
		}
	);

	it("should fail when the SQLite driver directory exists, but doesn't contain a valid driver", async () => {
		await expect(async () => {
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			await using handler = await bootWordPressAndRequestHandler({
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
