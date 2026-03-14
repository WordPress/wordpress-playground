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

describe('MySQL proxy boot (PHP 5.6)', () => {
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
		'should boot WordPress via the MySQL binary protocol proxy',
		async () => {
			// Create a dedicated PHP instance for the SQLite query translator.
			// This uses PHP 8.x which supports the modern sqlite-database-integration.
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

			// Boot WordPress using PHP 5.6 connected to the MySQL proxy.
			// PHP 5.6 thinks it's talking to a real MySQL server.
			await using handler = await bootWordPressAndRequestHandler({
				createPhpRuntime: async () =>
					await loadNodeRuntime('5.6' as any),
				siteUrl: 'http://playground-domain/',
				wordPressZip: await getWordPressModule(),
				mysqlProxyPort: proxy.port,
			});

			// Verify WordPress booted by requesting the homepage
			const response = await handler.request({
				url: '/',
			});
			expect(response.httpStatusCode).toBe(200);
			expect(response.text).toContain('<html');
			expect(response.text).toContain('My WordPress Website');
		},
		{ timeout: 120_000 }
	);
});
