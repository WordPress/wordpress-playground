import { NodePHP } from '@php-wasm/node';
import { runBlueprint } from './run';

const phpVersion = '8.0';
describe('Blueprints', () => {
	let php: NodePHP;
	beforeEach(async () => {
		php = await NodePHP.load(phpVersion, {
			requestHandler: {
				documentRoot: '/',
				isStaticFilePath: (path) => !path.endsWith('.php'),
			},
		});
	});

	it('should run a basic blueprint', async () => {
		await runBlueprint(php, {
			steps: [
				{
					step: 'writeFile',
					path: '/index.php',
					data: `<?php echo 'Hello World';`,
				},
			],
		});
		expect(php.fileExists('/index.php')).toBe(true);
		expect(php.readFileAsText('/index.php')).toBe(
			`<?php echo 'Hello World';`
		);
	});
});
