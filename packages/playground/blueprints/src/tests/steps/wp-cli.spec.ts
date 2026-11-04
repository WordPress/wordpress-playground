import type { PHP, SupportedPHPVersion } from '@php-wasm/universal';
import { splitShellCommand, wpCLI } from '../../lib/steps/wp-cli';
import { buildTestPhar } from '../build-test-phar';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
	getSqliteDriverModule,
	getWordPressModule,
} from '@wp-playground/wordpress-builds';
import { bootWordPressAndRequestHandler } from '@wp-playground/wordpress';
import { loadNodeRuntime } from '@php-wasm/node';
import { RecommendedPHPVersion } from '@wp-playground/common';

async function bootWordPressWithWpCli(
	phpVersion: SupportedPHPVersion,
	sapiName: string
) {
	const handler = await bootWordPressAndRequestHandler({
		createPhpRuntime: async () => await loadNodeRuntime(phpVersion),
		siteUrl: 'http://playground-domain/',
		sapiName,

		wordPressZip: await getWordPressModule(),
		sqliteIntegrationPluginZip: await getSqliteDriverModule(),
		createFiles: {
			'/tmp/wp-cli.phar': readFileSync(
				join(__dirname, '../fixtures/wp-cli.phar')
			),
		},
	});
	return await handler.getPrimaryPhp();
}

describe.each([
	{ phpVersion: '7.4', sapiName: 'cli-server' },
	{ phpVersion: '8.5', sapiName: 'cli-server' },
	{ phpVersion: '7.4', sapiName: 'cli' },
	{ phpVersion: '8.5', sapiName: 'cli' },
] as const)(
	'Blueprint step wpCLI on PHP $phpVersion, SAPI $sapiName',
	({ phpVersion, sapiName }) => {
		let php: PHP;

		beforeEach(async () => {
			php = await bootWordPressWithWpCli(phpVersion, sapiName);
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

		it('should give WP-CLI the phar path its path helpers read', async () => {
			await php.writeFile(
				'/tmp/phar-safe-path.php',
				`<?php echo WP_CLI\\Utils\\phar_safe_path('phar:///wordpress/x');`
			);

			const result = await wpCLI(php, {
				command: 'wp eval-file /tmp/phar-safe-path.php --no-color',
			});

			expect(result.text).toContain('phar://x');
			expect(result.text).not.toContain('/wordpress/x');
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
			expect(result.errors).toContain(
				'Case statements followed by a semicolon'
			);
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
			// Read through PHP: on PHP 8.5, a fresh instance's first WP-CLI run prints deprecations.
			const readBlogname = async () =>
				(
					await php.run({
						code: `<?php
						require '/wordpress/wp-load.php';
						echo get_option('blogname');
					`,
					})
				).text;
			const originalName = await readBlogname();
			expect(originalName).not.toBe('');

			await expect(
				wpCLI(php, {
					command: 'wp option update blogname --no-color',
				})
			).rejects.toThrow('does not support interactive input');

			expect(await readBlogname()).toBe(originalName);
		});

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

		it('should define WP_CLI and report the SAPI the instance reports', async () => {
			const instanceSapi = await php.run({
				code: '<?php echo PHP_SAPI;',
			});
			expect(instanceSapi.text).toBe(sapiName);

			const result = await wpCLI(php, {
				command: [
					'wp',
					'eval',
					'echo PHP_SAPI, "|", defined("WP_CLI") && WP_CLI ? "wp-cli" : "no wp-cli";',
					'--no-color',
				],
			});
			expect(result.text).toContain(`${sapiName}|wp-cli`);
		});
	}
);

describe('Blueprint step wpCLI with a custom wpCliPath', () => {
	let php: PHP;

	beforeEach(async () => {
		php = await bootWordPressWithWpCli(RecommendedPHPVersion, 'cli-server');
	});

	afterEach(() => {
		php.exit();
	});

	it('should boot a phar that keeps WP-CLI at its root', async () => {
		await php.writeFile(
			'/tmp/root-layout.phar',
			await buildTestPhar({ 'php/wp-cli.php': '<?php echo WP_CLI_ROOT;' })
		);
		const result = await wpCLI(php, {
			command: 'wp core version',
			wpCliPath: '/tmp/root-layout.phar',
		});
		expect(result.text).toBe('phar://wp-cli.phar');
	});

	it('should throw for a phar that does not contain WP-CLI', async () => {
		await php.writeFile(
			'/tmp/unrelated.phar',
			await buildTestPhar({ 'readme.txt': 'not WP-CLI' })
		);
		await expect(
			wpCLI(php, {
				command: 'wp core version',
				wpCliPath: '/tmp/unrelated.phar',
			})
		).rejects.toThrow('is not a WP-CLI phar');
	});

	it('should throw for a file that is not a phar', async () => {
		await php.writeFile('/tmp/not-an-archive.phar', 'not an archive');
		await expect(
			wpCLI(php, {
				command: 'wp core version',
				wpCliPath: '/tmp/not-an-archive.phar',
			})
		).rejects.toThrow('is not a WP-CLI phar');
	});
});

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
