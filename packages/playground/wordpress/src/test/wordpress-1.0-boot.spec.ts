import {
	loadNodeRuntime,
	startSqliteOverMySQLProxy,
} from '@php-wasm/node';
import { PHP } from '@php-wasm/universal';
import { RecommendedPHPVersion } from '@wp-playground/common';
import {
	getSqliteDriverModule,
	getWordPressModule,
} from '@wp-playground/wordpress-builds';
import { unzipFile } from '@wp-playground/common';
import { bootWordPressAndRequestHandler } from '../boot';
import type { MySQLProxyServer } from '@php-wasm/node';

/**
 * This test downloads WordPress 1.0.2 from wordpress.org at runtime
 * because it is not bundled in the repository. It requires network
 * access and will fail in fully offline environments.
 */
describe('WordPress 1.0 boot (PHP 5.6 + MySQL proxy)', () => {
	let proxyPhp: PHP;
	let proxy: MySQLProxyServer;

	afterEach(async () => {
		if (proxy) {
			await proxy.close();
		}
		if (proxyPhp) {
			proxyPhp.exit();
		}
	});

	it(
		'should boot WordPress 1.0 via the MySQL binary protocol proxy',
		async () => {
			// Create a dedicated PHP instance for the SQLite query translator.
			// WordPress 1.0 uses the old mysql_* extension, but the queries
			// still go through the MySQL wire protocol to our proxy, which
			// translates them to SQLite via sqlite-database-integration
			// running on PHP 8.x.
			proxyPhp = new PHP(await loadNodeRuntime(RecommendedPHPVersion));

			// Extract the sqlite-database-integration plugin into the
			// proxy PHP instance's filesystem.
			const sqliteZip = await getSqliteDriverModule();
			proxyPhp.mkdir('/tmp/sqlite-database-integration');
			await unzipFile(
				proxyPhp,
				sqliteZip,
				'/tmp/sqlite-database-integration'
			);
			const extracted = proxyPhp.listFiles(
				'/tmp/sqlite-database-integration'
			);
			const pluginDir = `/tmp/sqlite-database-integration/${extracted[0]}`;
			proxyPhp.mv(
				pluginDir,
				'/internal/shared/sqlite-database-integration'
			);

			// Ensure the database directory exists in the proxy PHP instance
			proxyPhp.mkdir('/wordpress/wp-content/database');

			// Start the MySQL proxy backed by SQLite
			proxy = await startSqliteOverMySQLProxy({
				php: proxyPhp,
				sqlitePluginPath:
					'/internal/shared/sqlite-database-integration',
				sqliteDatabasePath:
					'/wordpress/wp-content/database/.ht.sqlite',
			});

			// Boot WordPress 1.0 using PHP 5.6 connected to the MySQL proxy.
			// WordPress 1.0 uses mysql_connect() to talk to what it thinks
			// is a real MySQL server. The legacy boot path detects the
			// absence of wp-load.php and runs the multi-step 1.x installer.
			await using handler = await bootWordPressAndRequestHandler({
				createPhpRuntime: async () =>
					await loadNodeRuntime('5.6' as any),
				siteUrl: 'http://playground-domain/',
				wordPressZip: await getWordPressModule('1.0'),
				mysqlProxyPort: proxy.port,
			});

			// Verify WordPress 1.0 booted by requesting the homepage.
			// WordPress 1.0 serves its content through index.php which
			// includes wp-blog-header.php.
			const response = await handler.request({
				url: '/',
			});
			expect(response.httpStatusCode).toBe(200);
			expect(response.text).toContain('<html');
			expect(response.text).toContain('WordPress');
		},
		{ timeout: 120_000 }
	);
});
