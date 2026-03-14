import {
	PHP,
	setPhpIniEntries,
} from '@php-wasm/universal';
import { loadNodeRuntime } from '../lib';
import { startMySQLProxy, singleValueResult } from '../lib/networking/mysql-proxy';
import type { QueryResult, MySQLProxyServer } from '../lib/networking/mysql-proxy';
import { MYSQL_TYPE_VAR_STRING, MYSQL_TYPE_LONG } from '../lib/networking/mysql-protocol';

describe('MySQL Proxy', () => {
	let php: PHP;
	let proxy: MySQLProxyServer;

	afterEach(async () => {
		if (proxy) {
			await proxy.close();
		}
		if (php) {
			php.exit();
		}
	});

	it('should accept MySQL connections and respond to queries', async () => {
		const queryResults: Record<string, QueryResult | null> = {
			'SELECT 1 AS num': {
				columns: [
					{
						name: 'num',
						type: MYSQL_TYPE_LONG,
						length: 11,
						flags: 0,
						decimals: 0,
					},
				],
				rows: [['1']],
			},
		};

		proxy = await startMySQLProxy({
			queryHandler: async (query: string) => {
				// Handle SET and SELECT @@... queries silently
				if (
					query.toUpperCase().startsWith('SET ') ||
					query.includes('@@')
				) {
					return null;
				}
				const result = queryResults[query];
				if (!result) {
					throw new Error(`Unexpected query: ${query}`);
				}
				return result;
			},
		});

		php = new PHP(await loadNodeRuntime('8.3' as any));
		await setPhpIniEntries(php, { allow_url_fopen: '1' });

		const result = await php.run({
			code: `<?php
				$mysqli = new mysqli('127.0.0.1', 'root', '', 'test', ${proxy.port});
				if ($mysqli->connect_errno) {
					echo 'CONNECT_ERROR:' . $mysqli->connect_error;
					exit(1);
				}

				$result = $mysqli->query('SELECT 1 AS num');
				if (!$result) {
					echo 'QUERY_ERROR:' . $mysqli->error;
					exit(1);
				}

				$row = $result->fetch_assoc();
				echo json_encode($row);
				$mysqli->close();
			`,
		});

		expect(result.errors).toBeFalsy();
		const parsed = JSON.parse(result.text);
		expect(parsed).toEqual({ num: '1' });
	}, 30_000);

	it('should handle INSERT/UPDATE/DELETE with OK responses', async () => {
		proxy = await startMySQLProxy({
			queryHandler: async (query: string) => {
				if (
					query.toUpperCase().startsWith('SET ') ||
					query.includes('@@')
				) {
					return null;
				}
				if (query.toUpperCase().startsWith('CREATE ')) {
					return { columns: [], rows: [], affectedRows: 0 };
				}
				if (query.toUpperCase().startsWith('INSERT ')) {
					return {
						columns: [],
						rows: [],
						affectedRows: 1,
						lastInsertId: 42,
					};
				}
				return singleValueResult('result', 'ok');
			},
		});

		php = new PHP(await loadNodeRuntime('8.3' as any));
		await setPhpIniEntries(php, { allow_url_fopen: '1' });

		const result = await php.run({
			code: `<?php
				$mysqli = new mysqli('127.0.0.1', 'root', '', 'test', ${proxy.port});
				if ($mysqli->connect_errno) {
					echo 'CONNECT_ERROR:' . $mysqli->connect_error;
					exit(1);
				}

				$mysqli->query("CREATE TABLE test (id INT PRIMARY KEY, name TEXT)");
				$mysqli->query("INSERT INTO test VALUES (1, 'hello')");
				echo json_encode(array(
					'affected_rows' => $mysqli->affected_rows,
					'insert_id' => $mysqli->insert_id,
				));
				$mysqli->close();
			`,
		});

		expect(result.errors).toBeFalsy();
		const parsed = JSON.parse(result.text);
		expect(parsed.affected_rows).toBe(1);
		expect(parsed.insert_id).toBe(42);
	}, 30_000);

	it('should handle COM_PING', async () => {
		proxy = await startMySQLProxy({
			queryHandler: async () => null,
		});

		php = new PHP(await loadNodeRuntime('8.3' as any));
		await setPhpIniEntries(php, { allow_url_fopen: '1' });

		const result = await php.run({
			code: `<?php
				$mysqli = new mysqli('127.0.0.1', 'root', '', 'test', ${proxy.port});
				if ($mysqli->connect_errno) {
					echo 'CONNECT_ERROR:' . $mysqli->connect_error;
					exit(1);
				}

				echo $mysqli->ping() ? 'PONG' : 'FAILED';
				$mysqli->close();
			`,
		});

		expect(result.errors).toBeFalsy();
		expect(result.text).toBe('PONG');
	}, 30_000);

	it('should handle query errors gracefully', async () => {
		proxy = await startMySQLProxy({
			queryHandler: async (query: string) => {
				if (
					query.toUpperCase().startsWith('SET ') ||
					query.includes('@@')
				) {
					return null;
				}
				throw new Error('Simulated database error');
			},
		});

		php = new PHP(await loadNodeRuntime('8.3' as any));
		await setPhpIniEntries(php, { allow_url_fopen: '1' });

		const result = await php.run({
			code: `<?php
				$mysqli = new mysqli('127.0.0.1', 'root', '', 'test', ${proxy.port});
				if ($mysqli->connect_errno) {
					echo 'CONNECT_ERROR:' . $mysqli->connect_error;
					exit(1);
				}

				$result = $mysqli->query('SELECT * FROM nonexistent');
				echo $result === false ? 'ERROR_CAUGHT' : 'UNEXPECTED_SUCCESS';
				$mysqli->close();
			`,
		});

		expect(result.errors).toBeFalsy();
		expect(result.text).toBe('ERROR_CAUGHT');
	}, 30_000);

	it('should handle multi-row result sets', async () => {
		proxy = await startMySQLProxy({
			queryHandler: async (query: string) => {
				if (
					query.toUpperCase().startsWith('SET ') ||
					query.includes('@@')
				) {
					return null;
				}
				return {
					columns: [
						{
							name: 'id',
							type: MYSQL_TYPE_LONG,
							length: 11,
							flags: 0,
							decimals: 0,
						},
						{
							name: 'name',
							type: MYSQL_TYPE_VAR_STRING,
							length: 255,
							flags: 0,
							decimals: 0,
						},
					],
					rows: [
						['1', 'Alice'],
						['2', 'Bob'],
						['3', 'Charlie'],
					],
				};
			},
		});

		php = new PHP(await loadNodeRuntime('8.3' as any));
		await setPhpIniEntries(php, { allow_url_fopen: '1' });

		const result = await php.run({
			code: `<?php
				$mysqli = new mysqli('127.0.0.1', 'root', '', 'test', ${proxy.port});
				if ($mysqli->connect_errno) {
					echo 'CONNECT_ERROR:' . $mysqli->connect_error;
					exit(1);
				}

				$result = $mysqli->query('SELECT id, name FROM users');
				$rows = array();
				while ($row = $result->fetch_assoc()) {
					$rows[] = $row;
				}
				echo json_encode($rows);
				$mysqli->close();
			`,
		});

		expect(result.errors).toBeFalsy();
		const parsed = JSON.parse(result.text);
		expect(parsed).toHaveLength(3);
		expect(parsed[0]).toEqual({ id: '1', name: 'Alice' });
		expect(parsed[1]).toEqual({ id: '2', name: 'Bob' });
		expect(parsed[2]).toEqual({ id: '3', name: 'Charlie' });
	}, 30_000);
});
