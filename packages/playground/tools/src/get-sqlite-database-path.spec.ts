import { loadNodeRuntime } from '@php-wasm/node';
import { RecommendedPHPVersion } from '@wp-playground/common';
import {
	bootRequestHandler,
	bootWordPress,
	bootWordPressAndRequestHandler,
} from '@wp-playground/wordpress';
import { dirname } from '@php-wasm/util';
import {
	getSqliteDriverModule,
	getWordPressModule,
} from '@wp-playground/wordpress-builds';
import { getSqliteDatabasePath } from './get-sqlite-database-path';

describe('getSqliteDatabasePath', () => {
	it('reads the active database from WordPress environment metadata', async () => {
		await using handler = await bootWordPressAndRequestHandler({
			createPhpRuntime: () => loadNodeRuntime(RecommendedPHPVersion),
			siteUrl: 'http://playground.test',
			wordPressZip: await getWordPressModule(),
			sqliteIntegrationPluginZip: await getSqliteDriverModule(),
			documentRoot: '/custom-root',
			dataSqlPath: '/custom/database.sqlite',
		});
		const php = await handler.getPrimaryPhp();
		const path = await getSqliteDatabasePath(php);
		expect(php.isFile(path)).toBe(true);
		expect(path).toBe('/custom/database.sqlite');
		await php.run({
			code: `<?php
require getenv('DOCUMENT_ROOT') . '/wp-load.php';
update_option('playground_database_path_test', 'active database');
`,
			env: { DOCUMENT_ROOT: php.documentRoot },
		});
		const response = await php.run({
			code: `<?php
$pdo = new PDO('sqlite:' . getenv('DATABASE_PATH'));
echo $pdo->query("SELECT option_value FROM wp_options WHERE option_name = 'playground_database_path_test'")->fetchColumn();
`,
			env: { DATABASE_PATH: path },
		});
		expect(response.errors).toBe('');
		expect(response.text).toBe('active database');
	}, 30_000);

	it.each([undefined, '/custom/database.sqlite'])(
		'keeps the database accessible after a failed boot with dataSqlPath=%s',
		async (dataSqlPath) => {
			const options = {
				createPhpRuntime: () => loadNodeRuntime(RecommendedPHPVersion),
				siteUrl: 'http://playground.test',
				wordPressZip: await getWordPressModule(),
				sqliteIntegrationPluginZip: await getSqliteDriverModule(),
				dataSqlPath,
			};
			await using saved = await bootWordPressAndRequestHandler(options);
			const source = await saved.getPrimaryPhp();
			const path = await getSqliteDatabasePath(source);
			const database = source.readFileAsBuffer(path);
			await using reopened = await bootRequestHandler(options);
			await expect(
				bootWordPress(reopened, {
					...options,
					wordpressInstallMode:
						'install-from-existing-files-if-needed',
					hooks: {
						beforeDatabaseSetup: async (php) => {
							php.mkdir(dirname(path));
							php.writeFile(path, database);
							php.mkdir('/wordpress/wp-content/mu-plugins');
							php.writeFile(
								'/wordpress/wp-content/mu-plugins/broken.php',
								'<?php throw new Exception("A saved plugin failed");'
							);
						},
					},
				})
			).rejects.toThrow('A saved plugin failed');

			const php = await reopened.getPrimaryPhp();
			expect(await getSqliteDatabasePath(php)).toBe(path);
			expect(php.readFileAsBuffer(path).byteLength).toBeGreaterThan(0);

			// An unrelated PHP request must not overwrite the saved database metadata.
			await php.run({ code: '<?php echo "No WordPress loaded";' });
			expect(await getSqliteDatabasePath(php)).toBe(path);
		},
		30_000
	);
});
