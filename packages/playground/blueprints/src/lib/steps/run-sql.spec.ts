import { NodePHP } from '@php-wasm/node';
import { compileBlueprint, runBlueprintSteps } from '../compile';
import { phpVars } from '@php-wasm/util';

const phpVersion = '8.0';
describe('Blueprint step runSql', () => {
	let php: NodePHP;

	beforeEach(async () => {
		php = await NodePHP.load(phpVersion, {
			requestHandler: {
				documentRoot: '/wordpress',
			},
		});
	});

	it('should split and "run" sql queries', async () => {
		const encoder = new TextEncoder();
		const docroot = '/wordpress';
		const sqlFilename = `/tmp/${crypto.randomUUID()}.sql`;
		const resFilename = `/tmp/${crypto.randomUUID()}.json`;
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
		await runBlueprintSteps(
			compileBlueprint({
				steps: [
					{
						step: 'runSql',
						sql: {
							resource: 'literal',
							contents: encoder.encode(`SELECT * FROM wp_users;`),
							name: 'single-query.sql',
						},
					},
				],
			}),
			php
		);
		const singleQueryResult = await php.readFileAsText(resFilename);
		const singleQueryExpect = `{"type":"CALL","function":"query","args":["SELECT * FROM wp_users;"]}\n`;
		expect(singleQueryResult).toBe(singleQueryExpect);

		// Test a multiple queries
		await runBlueprintSteps(
			compileBlueprint({
				steps: [
					{
						step: 'runSql',
						sql: {
							resource: 'literal',
							contents: encoder.encode(
								`SELECT * FROM wp_users;\nSELECT * FROM wp_posts;\n`
							),
							name: 'single-query.sql',
						},
					},
				],
			}),
			php
		);
		const multiQueryResult = await php.readFileAsText(resFilename);
		const multiQueryExpect = `{"type":"CALL","function":"query","args":["SELECT * FROM wp_users;\\n"]}\n{"type":"CALL","function":"query","args":["SELECT * FROM wp_posts;\\n"]}\n`;
		expect(multiQueryResult).toBe(multiQueryExpect);

		// Ensure it works the same if the last query is missing a trailing newline
		await runBlueprintSteps(
			compileBlueprint({
				steps: [
					{
						step: 'runSql',
						sql: {
							resource: 'literal',
							contents: encoder.encode(
								`SELECT * FROM wp_users;\nSELECT * FROM wp_posts;`
							),
							name: 'single-query.sql',
						},
					},
				],
			}),
			php
		);
		const noTrailingNewlineQueryResult = await php.readFileAsText(
			resFilename
		);
		const noTrailingNewlineQueryExpect = `{"type":"CALL","function":"query","args":["SELECT * FROM wp_users;\\n"]}\n{"type":"CALL","function":"query","args":["SELECT * FROM wp_posts;"]}\n`;
		expect(noTrailingNewlineQueryResult).toBe(noTrailingNewlineQueryExpect);
	});
});
