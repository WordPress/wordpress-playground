import { PHP } from '@php-wasm/universal';
import { phpVars } from '@php-wasm/util';
import { runSql } from './run-sql';
import { PHPRequestHandler } from '@php-wasm/universal';
import { loadNodeRuntime } from '@php-wasm/node';
import { RecommendedPHPVersion } from '@wp-playground/common';
import { readFileSync } from 'fs';
import { join } from 'path';

const phpVersion = RecommendedPHPVersion;
describe('Blueprint step runSql', () => {
	let php: PHP;
	let handler: PHPRequestHandler;
	const documentRoot = '/wordpress';

	const outputLogPath = `/tmp/sql-execution-log.json`;
	beforeEach(async () => {
		handler = new PHPRequestHandler({
			phpFactory: async () => new PHP(await loadNodeRuntime(phpVersion)),
			documentRoot,
		});
		php = await handler.getPrimaryPhp();
		php.mkdir(documentRoot);

		// Create the mu-plugins directory structure for sqlite-database-integration
		php.mkdir(`${documentRoot}/wp-content`);
		php.mkdir(`${documentRoot}/wp-content/mu-plugins`);
		php.mkdir(
			`${documentRoot}/wp-content/mu-plugins/sqlite-database-integration`
		);
		php.mkdir(
			`${documentRoot}/wp-content/mu-plugins/sqlite-database-integration/wp-includes`
		);
		php.mkdir(
			`${documentRoot}/wp-content/mu-plugins/sqlite-database-integration/wp-includes/parser`
		);
		php.mkdir(
			`${documentRoot}/wp-content/mu-plugins/sqlite-database-integration/wp-includes/mysql`
		);

		// Create an object that will log all function calls
		const js = phpVars({ documentRoot, outputLogPath });
		/**
		 * The run-sql step loads WordPress by including wp-load.php.
		 * We don't need the rest of WordPress for this test, so we
		 * create a minimal wp-load.php that just logs the sql queries.
		 */
		php.writeFile(
			`${documentRoot}/wp-load.php`,
			`<?php
			error_reporting(E_ALL);
			ini_set('display_errors', '1');

			class MockLogger
			{
				public function __call($function, $args)
				{
					$entry = (object)[
						'type' => 'CALL',
						'function' => $function,
						'args' => $args,
					];

					file_put_contents(${js.outputLogPath}, json_encode($entry) . "\n", FILE_APPEND);
				}
			}

			global $wpdb;
			$wpdb = new MockLogger();
			file_put_contents(${js.outputLogPath}, '');
			`
		);
	});

	afterEach(async () => {
		php.exit();
		await handler[Symbol.asyncDispose]();
	});

	it('should load lexer classes correctly', async () => {
		// Direct test of lexer to verify it works
		const test = await php.run({
			code: `<?php
			require_once '/wordpress/wp-load.php';
			require_once '/wordpress/wp-content/mu-plugins/sqlite-database-integration/wp-includes/parser/class-wp-parser-token.php';
			require_once '/wordpress/wp-content/mu-plugins/sqlite-database-integration/wp-includes/mysql/class-wp-mysql-token.php';
			require_once '/wordpress/wp-content/mu-plugins/sqlite-database-integration/wp-includes/mysql/class-wp-mysql-lexer.php';

			echo "Lexer loaded: " . (class_exists('WP_MySQL_Lexer') ? 'yes' : 'no') . "\\n";

			$lexer = new WP_MySQL_Lexer('SELECT * FROM wp_users;');
			$token = $lexer->get_token();
			echo "First token ID: " . ($token ? $token->id : 'null') . "\\n";
			echo "First token bytes: " . ($token ? $token->get_bytes() : 'null') . "\\n";
			`,
		});

		console.log('Lexer test output:', test.text);
		console.log('Lexer test errors:', test.errors);
		expect(test.exitCode).toBe(0);
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
			`{"type":"CALL","function":"query","args":["SELECT * FROM wp_users;"]}\n`
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
			`{"type":"CALL","function":"query","args":["SELECT * FROM wp_users;"]}\n{"type":"CALL","function":"query","args":["\\nSELECT * FROM wp_posts;"]}\n`
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
			`{"type":"CALL","function":"query","args":["SELECT * FROM wp_users;"]}\n{"type":"CALL","function":"query","args":["\\n;"]}\n{"type":"CALL","function":"query","args":["\\n\\nSELECT * FROM wp_posts;"]}\n`
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
			`{"type":"CALL","function":"query","args":["CREATE TABLE test_table (\\n  id INT PRIMARY KEY,\\n  name VARCHAR(255),\\n  created_at TIMESTAMP\\n);"]}\n{"type":"CALL","function":"query","args":["\\n\\nINSERT INTO test_table\\n  (id, name, created_at)\\nVALUES\\n  (1, \\"John Doe\\", NOW());"]}\n`
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
			`{"type":"CALL","function":"query","args":["-- This is a comment\\nSELECT * FROM wp_users;"]}\n{"type":"CALL","function":"query","args":["\\n\\n\\/* This is a\\n   multiline comment *\\/\\nSELECT * FROM wp_posts;"]}\n`
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
			`{"type":"CALL","function":"query","args":["SELECT\\n  u.id,\\n  u.name,\\n  (SELECT COUNT(*) FROM wp_posts WHERE author_id = u.id) as post_count\\nFROM\\n  wp_users u\\nWHERE\\n  u.status = \\"active\\"\\nORDER BY\\n  u.name ASC;"]}\n`
		);
	});
});
