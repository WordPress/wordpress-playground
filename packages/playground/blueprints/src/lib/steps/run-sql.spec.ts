import { NodePHP } from '@php-wasm/node';
import { phpVars, randomFilename } from '@php-wasm/util';
import { runSql } from './run-sql';
import { PHPRequestHandler } from '@php-wasm/universal';

const phpVersion = '8.0';
describe('Blueprint step runSql', () => {
	let php: NodePHP;
	let handler: PHPRequestHandler<NodePHP>;
	beforeEach(async () => {
		handler = new PHPRequestHandler({
			phpFactory: () => NodePHP.load(phpVersion),
			documentRoot: '/wordpress',
		});
		php = await handler.getPrimaryPhp();
	});

	it('should split and "run" sql queries', async () => {
		const docroot = '/wordpress';
		const sqlFilename = `/tmp/${randomFilename()}.sql`;
		const resFilename = `/tmp/${randomFilename()}.json`;
		const js = phpVars({ docroot, sqlFilename, resFilename });
		await php.mkdir(docroot);

		// Create an object that will log all function calls
		await php.writeFile(
			`${docroot}/wp-load.php`,
			`<?php
			class MockLogger
			{
				public function __call($function, $args)
				{
					$entry = (object)[
						'type' => 'CALL',
						'function' => $function,
						'args' => $args,
					];

					file_put_contents(${js.resFilename}, json_encode($entry) . "\n", FILE_APPEND);
				}
			}

			global $wpdb;
			$wpdb = new MockLogger();
			file_put_contents(${js.resFilename}, '');
			`
		);

		// Test a single query
		const mockFileSingle = new File(
			['SELECT * FROM wp_users;'],
			'single-query.sql'
		);

		await runSql(php, { sql: mockFileSingle });

		const singleQueryResult = await php.readFileAsText(resFilename);
		const singleQueryExpect = `{"type":"CALL","function":"query","args":["SELECT * FROM wp_users;"]}\n`;
		expect(singleQueryResult).toBe(singleQueryExpect);

		// Test a multiple queries
		const mockFileMultiple = new File(
			[`SELECT * FROM wp_users;\nSELECT * FROM wp_posts;\n`],
			'multiple-queries.sql'
		);

		await runSql(php, { sql: mockFileMultiple });

		const multiQueryResult = await php.readFileAsText(resFilename);
		const multiQueryExpect = `{"type":"CALL","function":"query","args":["SELECT * FROM wp_users;\\n"]}\n{"type":"CALL","function":"query","args":["SELECT * FROM wp_posts;\\n"]}\n`;
		expect(multiQueryResult).toBe(multiQueryExpect);

		// Ensure it works the same if the last query is missing a trailing newline
		const mockFileNoTrailingSpace = new File(
			[`SELECT * FROM wp_users;\nSELECT * FROM wp_posts;`],
			'no-trailing-newline.sql'
		);

		await runSql(php, { sql: mockFileNoTrailingSpace });
		const noTrailingNewlineQueryResult = await php.readFileAsText(
			resFilename
		);
		const noTrailingNewlineQueryExpect = `{"type":"CALL","function":"query","args":["SELECT * FROM wp_users;\\n"]}\n{"type":"CALL","function":"query","args":["SELECT * FROM wp_posts;"]}\n`;
		expect(noTrailingNewlineQueryResult).toBe(noTrailingNewlineQueryExpect);
	});
});
