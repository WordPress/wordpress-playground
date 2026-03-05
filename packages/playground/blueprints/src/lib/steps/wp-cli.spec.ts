import type { PHP } from '@php-wasm/universal';
import { splitShellCommand, wpCLI } from './wp-cli';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
	getSqliteDriverModule,
	getWordPressModule,
} from '@wp-playground/wordpress-builds';
import { bootWordPressAndRequestHandler } from '@wp-playground/wordpress';
import { loadNodeRuntime } from '@php-wasm/node';
import { RecommendedPHPVersion } from '@wp-playground/common';

const phpVersion = RecommendedPHPVersion;
describe('Blueprint step wpCLI', () => {
	let php: PHP;

	beforeEach(async () => {
		const handler = await bootWordPressAndRequestHandler({
			createPhpRuntime: async () => await loadNodeRuntime(phpVersion),
			siteUrl: 'http://playground-domain/',
			sapiName: 'cli',

			wordPressZip: await getWordPressModule(),
			sqliteIntegrationPluginZip: await getSqliteDriverModule(),
			createFiles: {
				'/tmp/wp-cli.phar': readFileSync(
					join(__dirname, '../../../tests/fixtures/wp-cli.phar')
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
