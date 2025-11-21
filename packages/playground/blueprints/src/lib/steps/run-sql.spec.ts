import type { PHP } from '@php-wasm/universal';
import { phpVars } from '@php-wasm/util';
import { runSql } from './run-sql';
import type { PHPRequestHandler } from '@php-wasm/universal';
import { loadNodeRuntime } from '@php-wasm/node';
import { RecommendedPHPVersion } from '@wp-playground/common';
import { bootWordPressAndRequestHandler } from '@wp-playground/wordpress';
import {
	getSqliteDriverModule,
	getWordPressModule,
} from '@wp-playground/wordpress-builds';

describe('Blueprint step runSql', () => {
	let php: PHP;
	let handler: PHPRequestHandler;
	const documentRoot = '/wordpress';

	const outputLogPath = `/tmp/sql-execution-log.json`;
	beforeEach(async () => {
		handler = await bootWordPressAndRequestHandler({
			createPhpRuntime: async () =>
				await loadNodeRuntime(RecommendedPHPVersion),
			siteUrl: 'http://playground-domain/',

			wordPressZip: await getWordPressModule(),
			sqliteIntegrationPluginZip: await getSqliteDriverModule(),
		});
		php = await handler.getPrimaryPhp();

		// Create an object that will log all function calls
		const js = phpVars({ documentRoot, outputLogPath });

		/**
		 * The run-sql step loads WordPress by including wp-load.php.
		 * We don't need the rest of WordPress for this test, so we
		 * create a minimal wp-load.php that just logs the sql queries.
		 */
		php.mkdir(`${documentRoot}/wp-content/mu-plugins`);
		php.writeFile(
			`${documentRoot}/wp-content/mu-plugins/logger.php`,
			`<?php
			error_reporting(E_ALL);
			ini_set('display_errors', '1');

			// Register a filter/hook to log every received SQL query.
			add_action('run_sql_step', function() {
				add_filter('query', function($query) {
					$entry = (object)[
						'type' => 'SQL_QUERY',
						'query' => $query,
					];

					file_put_contents(${js.outputLogPath}, json_encode($entry) . "\n", FILE_APPEND);
					return $query;
				});
			});
			
			file_put_contents(${js.outputLogPath}, '');
			`
		);
	});

	afterEach(async () => {
		php.exit();
		await handler[Symbol.asyncDispose]();
	});

	it('should split and "run" sql queries', async () => {
		// Test a single query
		const sqlResult = await runSql(php, {
			sql: new File(['SELECT * FROM wp_users;'], 'single-query.sql'),
		});

		// Debug: Check if there were any errors
		if (sqlResult.exitCode !== 0) {
			console.log('SQL execution failed:');
			console.log('Exit code:', sqlResult.exitCode);
			console.log('Stdout:', sqlResult.text);
			console.log('Stderr:', sqlResult.errors);
		}

		const result = php.readFileAsText(outputLogPath);
		expect(result).toBe(
			`{"type":"SQL_QUERY","query":"SELECT * FROM wp_users;"}\n`
		);
	});

	it('should split and "run" multiple sql queries', async () => {
		await runSql(php, {
			sql: new File(
				[
					['SELECT * FROM wp_users;', 'SELECT * FROM wp_posts;'].join(
						'\n'
					),
				],
				'multiple-queries.sql'
			),
		});

		const result = php.readFileAsText(outputLogPath);
		expect(result).toBe(
			`{"type":"SQL_QUERY","query":"SELECT * FROM wp_users;"}\n{"type":"SQL_QUERY","query":"\\nSELECT * FROM wp_posts;"}\n`
		);
	});

	it('should support inputs with empty lines and semicolon-only lines', async () => {
		await runSql(php, {
			sql: new File(
				[
					[
						'SELECT * FROM wp_users;',
						';',
						'',
						'SELECT * FROM wp_posts;',
						'',
					].join('\n'),
				],
				'no-trailing-newline.sql'
			),
		});

		const result = php.readFileAsText(outputLogPath);
		expect(result).toBe(
			`{"type":"SQL_QUERY","query":"SELECT * FROM wp_users;"}\n{"type":"SQL_QUERY","query":"\\n;"}\n{"type":"SQL_QUERY","query":"\\n\\nSELECT * FROM wp_posts;"}\n`
		);
	});

	it('should handle multiline queries', async () => {
		await runSql(php, {
			sql: new File(
				[
					[
						'CREATE TABLE test_table (',
						'  id INT PRIMARY KEY,',
						'  name VARCHAR(255),',
						'  created_at TIMESTAMP',
						');',
						'',
						'INSERT INTO test_table',
						'  (id, name, created_at)',
						'VALUES',
						'  (1, "John Doe", NOW());',
					].join('\n'),
				],
				'multiline-queries.sql'
			),
		});

		const result = php.readFileAsText(outputLogPath);
		expect(result).toBe(
			`{"type":"SQL_QUERY","query":"CREATE TABLE test_table (\\n  id INT PRIMARY KEY,\\n  name VARCHAR(255),\\n  created_at TIMESTAMP\\n);"}\n{"type":"SQL_QUERY","query":"\\n\\nINSERT INTO test_table\\n  (id, name, created_at)\\nVALUES\\n  (1, \\"John Doe\\", NOW());"}\n`
		);
	});

	it('should handle queries with SQL comments', async () => {
		await runSql(php, {
			sql: new File(
				[
					[
						'-- This is a comment',
						'SELECT * FROM wp_users;',
						'',
						'/* This is a',
						'   multiline comment */',
						'SELECT * FROM wp_posts;',
					].join('\n'),
				],
				'queries-with-comments.sql'
			),
		});

		const result = php.readFileAsText(outputLogPath);
		expect(result).toBe(
			`{"type":"SQL_QUERY","query":"-- This is a comment\\nSELECT * FROM wp_users;"}\n{"type":"SQL_QUERY","query":"\\n\\n\\/* This is a\\n   multiline comment *\\/\\nSELECT * FROM wp_posts;"}\n`
		);
	});

	it('should handle complex multiline query with subquery', async () => {
		await runSql(php, {
			sql: new File(
				[
					[
						'SELECT',
						'  u.id,',
						'  u.name,',
						'  (SELECT COUNT(*) FROM wp_posts WHERE author_id = u.id) as post_count',
						'FROM',
						'  wp_users u',
						'WHERE',
						'  u.status = "active"',
						'ORDER BY',
						'  u.name ASC;',
					].join('\n'),
				],
				'complex-multiline-query.sql'
			),
		});

		const result = php.readFileAsText(outputLogPath);
		expect(result).toBe(
			`{"type":"SQL_QUERY","query":"SELECT\\n  u.id,\\n  u.name,\\n  (SELECT COUNT(*) FROM wp_posts WHERE author_id = u.id) as post_count\\nFROM\\n  wp_users u\\nWHERE\\n  u.status = \\"active\\"\\nORDER BY\\n  u.name ASC;"}\n`
		);
	});
});
