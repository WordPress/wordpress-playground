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
