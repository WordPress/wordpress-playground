import { NodePHP } from '@php-wasm/node';
import { splitShellCommand, wpCLI } from './wp-cli';
import { readFileSync } from 'fs';
import { join } from 'path';
import { unzip } from './unzip';
import { getWordPressModule } from '@wp-playground/wordpress-builds';

const phpVersion = '8.0';
describe('Blueprint step wpCLI', () => {
	let php: NodePHP;

	beforeEach(async () => {
		php = await NodePHP.load(phpVersion);
		php.setSapiName('cli');
		await unzip(php, {
			zipFile: await getWordPressModule(),
			extractToPath: '/wordpress',
		});
		const wpCliPath = join(__dirname, '../../test/wp-cli.phar');
		php.writeFile('/tmp/wp-cli.phar', readFileSync(wpCliPath));
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
