import { NodePHP } from '@php-wasm/node';
import { splitShellCommand, wpCLI } from './wp-cli';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
	getSqliteDatabaseModule,
	getWordPressModule,
} from '@wp-playground/wordpress-builds';
import { BasePHP, PHPRequestHandler } from '@php-wasm/universal';
import { bootWordPress } from '@wp-playground/wordpress';
import { spawnSync } from 'child_process';

const phpVersion = '8.0';
describe('Blueprint step wpCLI', () => {
	let requestHandler: PHPRequestHandler<BasePHP>;

	beforeEach(async () => {
		spawnSync('php', ['-d', 'phar.readonly=0', 'repackage-wp-cli.php'], {
			cwd: join(__dirname, '../../test'),
		});
		requestHandler = await bootWordPress({
			siteUrl: 'http://127.0.0.1:8000',
			createPhpInstance() {
				return new NodePHP();
			},
			createPhpRuntime: async () => await NodePHP.loadRuntime(phpVersion),
			wordPressZip: getWordPressModule(),
			sqliteIntegrationPluginZip: getSqliteDatabaseModule(),
			sapiName: 'cli',
			createFiles: {
				'/tmp/wp-cli.phar': readFileSync(
					join(__dirname, '../../test/wp-cli.phar')
				),
			},
		});
	});

	it.only('should run wp-cli commands', async () => {
		const { php, reap } =
			await requestHandler.processManager.acquirePHPInstance();
		const result = await wpCLI(php, {
			command: 'wp --help', //post create --post_title='Test post' --post_excerpt='Some content' --no-color",
		});
		reap();
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
