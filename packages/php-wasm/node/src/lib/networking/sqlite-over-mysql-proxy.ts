/**
 * Creates a MySQL wire protocol proxy that translates MySQL queries
 * to SQLite using the wordpress/sqlite-database-integration plugin.
 *
 * This enables PHP 5.6 (which has native MySQL support but can't run
 * the modern SQLite integration plugin) to use SQLite through the
 * MySQL binary protocol. A dedicated PHP 8.x instance runs the
 * query translation, while the main PHP 5.6 instance connects
 * to the proxy thinking it's a real MySQL server.
 *
 * Architecture:
 * ```
 * PHP 5.6 (WordPress) → MySQL protocol → TCP → this proxy
 *     → PHP 8.x (sqlite-database-integration) → SQLite
 * ```
 */

import type { PHP } from '@php-wasm/universal';
import { startMySQLProxy } from './mysql-proxy';
import type { MySQLProxyServer, QueryHandler, QueryResult } from './mysql-proxy';
import { MYSQL_TYPE_VAR_STRING } from './mysql-protocol';

export interface SqliteOverMySQLProxyOptions {
	/**
	 * A PHP instance (preferably PHP 8.x) with the
	 * sqlite-database-integration plugin already extracted into the
	 * filesystem at `sqlitePluginPath`.
	 */
	php: PHP;

	/**
	 * The filesystem path (inside the PHP WASM filesystem) where the
	 * sqlite-database-integration plugin is located.
	 * e.g. '/internal/shared/sqlite-database-integration'
	 */
	sqlitePluginPath: string;

	/**
	 * The filesystem path for the SQLite database file.
	 * e.g. '/wordpress/wp-content/database/.ht.sqlite'
	 */
	sqliteDatabasePath: string;

	/** Port to listen on. If 0 or omitted, a random free port is used. */
	port?: number;
}

/**
 * Starts a MySQL wire protocol proxy backed by SQLite.
 *
 * The proxy accepts MySQL client connections and translates
 * queries to SQLite using the sqlite-database-integration
 * translator running inside the provided PHP instance.
 *
 * @returns A proxy server object with the assigned port.
 */
export async function startSqliteOverMySQLProxy(
	options: SqliteOverMySQLProxyOptions
): Promise<MySQLProxyServer> {
	const queryHandler = createSqliteQueryHandler(
		options.php,
		options.sqlitePluginPath,
		options.sqliteDatabasePath
	);
	return await startMySQLProxy({
		queryHandler,
		port: options.port,
	});
}

/**
 * Creates a QueryHandler that executes MySQL queries through the
 * sqlite-database-integration translator. Each query is passed
 * to the PHP instance, which translates it to SQLite, executes
 * it, and returns structured results.
 */
function createSqliteQueryHandler(
	php: PHP,
	sqlitePluginPath: string,
	sqliteDatabasePath: string
): QueryHandler {
	let initialized = false;

	return async (query: string): Promise<QueryResult | null> => {
		if (!initialized) {
			await initializeDriver(php, sqlitePluginPath, sqliteDatabasePath);
			initialized = true;
		}

		// Write the query to a temp file to avoid escaping issues
		// with embedded quotes, backslashes, etc.
		php.writeFile('/tmp/mysql-proxy-query.sql', query);

		const result = await php.run({
			code: `<?php
				$driver = $GLOBALS['_mysql_proxy_driver'];
				$query = file_get_contents('/tmp/mysql-proxy-query.sql');

				try {
					$results = $driver->query($query);
					$columns = $driver->get_last_column_meta();

					if (is_int($results)) {
						$last_id = 0;
						try {
							$pdo = $driver->get_connection()->get_pdo();
							$last_id = (int) $pdo->lastInsertId();
						} catch (Throwable $e) {}
						echo json_encode(array(
							'type' => 'ok',
							'affected_rows' => $results,
							'last_insert_id' => $last_id,
						));
					} else if (is_array($results)) {
						$rows = array();
						foreach ($results as $row) {
							$rows[] = array_values((array) $row);
						}

						$col_info = array();
						if (is_array($columns)) {
							foreach ($columns as $col) {
								$name = 'unknown';
								if (isset($col['name'])) {
									$name = $col['name'];
								} elseif (isset($col['mysqli:name'])) {
									$name = $col['mysqli:name'];
								}
								$col_info[] = array('name' => $name);
							}
						}

						echo json_encode(array(
							'type' => 'result_set',
							'columns' => $col_info,
							'rows' => $rows,
						));
					} else {
						echo json_encode(array(
							'type' => 'ok',
							'affected_rows' => 0,
							'last_insert_id' => 0,
						));
					}
				} catch (Throwable $e) {
					echo json_encode(array(
						'type' => 'error',
						'code' => (int) $e->getCode(),
						'message' => $e->getMessage(),
					));
				}
			`,
		});

		const text = result.text.trim();
		if (!text) {
			// No output - likely an error that didn't produce JSON
			if (result.errors) {
				throw new Error(
					`PHP query execution error: ${result.errors}`
				);
			}
			return null;
		}

		let json: any;
		try {
			json = JSON.parse(text);
		} catch {
			throw new Error(
				`Invalid JSON from PHP query executor: ${text.substring(0, 500)}`
			);
		}

		if (json.type === 'error') {
			throw new Error(json.message || 'Query execution failed');
		}

		if (json.type === 'ok') {
			return {
				columns: [],
				rows: [],
				affectedRows: json.affected_rows ?? 0,
				lastInsertId: json.last_insert_id ?? 0,
			};
		}

		// result_set
		return {
			columns: (json.columns || []).map(
				(col: { name: string }) => ({
					name: col.name,
					type: MYSQL_TYPE_VAR_STRING,
					length: 255,
					flags: 0,
					decimals: 0,
				})
			),
			rows: (json.rows || []).map((row: any[]) =>
				row.map((cell) => (cell === null ? null : String(cell)))
			),
		};
	};
}

/**
 * Initializes the WP_SQLite_Driver in the PHP instance by
 * loading the sqlite-database-integration plugin and creating
 * a PDO connection to the SQLite database.
 */
async function initializeDriver(
	php: PHP,
	sqlitePluginPath: string,
	sqliteDatabasePath: string
): Promise<void> {
	// Ensure the database directory exists
	const dbDir = sqliteDatabasePath.substring(
		0,
		sqliteDatabasePath.lastIndexOf('/')
	);
	if (!php.isDir(dbDir)) {
		php.mkdir(dbDir);
	}

	const result = await php.run({
		code: `<?php
			// Load the standalone MySQL-on-SQLite driver
			$plugin_path = '${sqlitePluginPath}';
			$db_path = '${sqliteDatabasePath}';

			// The AST driver entry point
			$driver_file = $plugin_path . '/wp-pdo-mysql-on-sqlite.php';
			if (!file_exists($driver_file)) {
				echo json_encode(array(
					'error' => 'sqlite-database-integration not found at: ' . $driver_file
				));
				exit(1);
			}

			require_once $driver_file;

			$pdo = new PDO('sqlite:' . $db_path);
			$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
			$pdo->setAttribute(PDO::ATTR_TIMEOUT, 30);

			// Enable WAL mode for better concurrent access
			$pdo->exec('PRAGMA journal_mode=WAL');
			$pdo->exec('PRAGMA busy_timeout=30000');

			$GLOBALS['_mysql_proxy_driver'] = new WP_SQLite_Driver(
				new WP_SQLite_Connection(array('pdo' => $pdo)),
				'wordpress'
			);

			echo json_encode(array('status' => 'ok'));
		`,
	});

	const text = result.text.trim();
	if (!text) {
		throw new Error(
			`Failed to initialize SQLite driver. PHP errors: ${result.errors}`
		);
	}

	let json: any;
	try {
		json = JSON.parse(text);
	} catch {
		throw new Error(
			`Failed to parse initialization response: ${text}`
		);
	}

	if (json.error) {
		throw new Error(
			`Failed to initialize SQLite driver: ${json.error}`
		);
	}
}
