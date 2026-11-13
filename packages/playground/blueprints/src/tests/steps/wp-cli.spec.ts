import type { PHP } from '@php-wasm/universal';
import { splitShellCommand, wpCLI } from '../../lib/steps/wp-cli';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
	getSqliteDriverModule,
	getWordPressModule,
} from '@wp-playground/wordpress-builds';
import { bootWordPressAndRequestHandler } from '@wp-playground/wordpress';
import { loadNodeRuntime } from '@php-wasm/node';
import { RecommendedPHPVersion } from '@wp-playground/common';

describe.each(['7.4', RecommendedPHPVersion] as const)(
	'Blueprint step wpCLI (PHP %s)',
	(phpVersion) => {
		let php: PHP;

		beforeEach(async () => {
			const handler = await bootWordPressAndRequestHandler({
				createPhpRuntime: async () => await loadNodeRuntime(phpVersion),
				siteUrl: 'http://playground-domain/',

				wordPressZip: await getWordPressModule(),
				sqliteIntegrationPluginZip: await getSqliteDriverModule(),
				createFiles: {
					'/tmp/wp-cli.phar': readFileSync(
						join(__dirname, '../fixtures/wp-cli.phar')
					),
				},
			});
			php = await handler.getPrimaryPhp();
		});

		afterEach(() => {
			php.exit();
		});

		it('should run wp-cli commands', async () => {
			const result = await wpCLI(php, {
				command:
					"wp post create --post_title='Test post' --post_excerpt='Some content' --no-color",
			});
			expect(result.text).toContain('Created post 4');
		});

		it('should succeed when there is STDERR output but exit code is 0', async () => {
			await php.writeFile(
				'/tmp/test-stderr.php',
				`<?php
			fwrite(STDERR, "PHP Deprecated: Case statements followed by a semicolon (;) are deprecated\\n");
			echo "Command succeeded";
			exit(0);
			?>`
			);

			const result = await wpCLI(php, {
				command: 'wp eval-file /tmp/test-stderr.php --no-color',
			});

			expect(result.exitCode).toBe(0);
			expect(result.errors).toContain('PHP Deprecated');
			expect(result.text).toContain('Command succeeded');
		});

		it('should fail when exit code is non-zero even with error message', async () => {
			await php.writeFile(
				'/tmp/test-failure.php',
				`<?php
			fwrite(STDERR, "Error: Command failed\\n");
			exit(1);
			?>`
			);

			await expect(
				wpCLI(php, {
					command: 'wp eval-file /tmp/test-failure.php --no-color',
				})
			).rejects.toThrow('Error: Command failed');
		});

		it('should reject STDIN reads before a command can mutate state', async () => {
			const originalName = await wpCLI(php, {
				command: 'wp option get blogname --no-color',
			});

			// Omitting the value makes WP-CLI read STDIN via get_value_from_arg_or_stdin().
			// https://github.com/wp-cli/entity-command/blob/45d4f3a77b7977fee4b4f7e183e692ab84bf7dd8/src/Option_Command.php#L413
			// Require a STDIN read error so an unrelated failure cannot satisfy the test.
			await expect(
				wpCLI(php, {
					command: 'wp option update blogname --no-color',
				})
			).rejects.toThrow(
				phpVersion === '7.4'
					? 'This WP-CLI command tried to read from STDIN'
					: 'fgets(): supplied resource is not a valid stream resource'
			);

			const currentName = await wpCLI(php, {
				command: 'wp option get blogname --no-color',
			});
			expect(currentName.text).toBe(originalName.text);
		});

		it.skipIf(phpVersion !== '7.4')(
			'should preserve warnings from other closed streams',
			async () => {
				php.writeFile(
					'/tmp/test-stream-warning.php',
					`<?php
				$stream = fopen('php://memory', 'r+');
				fclose($stream);
				fgets($stream);
				echo 'Command succeeded';`
				);

				const result = await wpCLI(php, {
					command:
						'wp eval-file /tmp/test-stream-warning.php --no-color',
				});

				expect(result.exitCode).toBe(0);
				expect(result.errors).toContain(
					'supplied resource is not a valid stream resource'
				);
				expect(result.text).toContain('Command succeeded');
			}
		);

		it('should run wp db query through $wpdb instead of the mysql binary', async () => {
			const result = await wpCLI(php, {
				command:
					'wp db query "SELECT COUNT(*) AS posts FROM wp_posts" --no-color',
			});
			expect(result.text).toContain('| posts |');

			await expect(
				wpCLI(php, {
					command:
						'wp db query "SELECT nope FROM wp_options" --no-color',
				})
			).rejects.toThrow('no such column: nope');
		});
	}
);

describe('splitShellCommand', () => {
	it('Should split a shell command into an array', () => {
		const command =
			'wp post create --post_title="Test post" --post_excerpt="Some content"';
		const result = splitShellCommand(command);
		expect(result).toEqual([
			'wp',
			'post',
			'create',
			'--post_title=Test post',
			'--post_excerpt=Some content',
		]);
	});

	it('Should treat multiple spaces as a single space', () => {
		const command = 'ls    --wordpress   --playground --is-great';
		const result = splitShellCommand(command);
		expect(result).toEqual([
			'ls',
			'--wordpress',
			'--playground',
			'--is-great',
		]);
	});
});
