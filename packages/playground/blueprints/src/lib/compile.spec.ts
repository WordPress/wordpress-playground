import { NodePHP } from '@php-wasm/node';
import { compileBlueprint, runBlueprintSteps } from './compile';
import { VFS_CONFIG_FILE_BASENAME } from './steps/common';
import { setPhpIniEntry } from './steps/client-methods';
import { defineWpConfigConsts } from './steps/define-wp-config-consts';

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
		await runBlueprintSteps(
			compileBlueprint({
				steps: [
					{
						step: 'writeFile',
						path: '/index.php',
						data: `<?php echo 'Hello World';`,
					},
				],
			}),
			php
		);
		expect(php.fileExists('/index.php')).toBe(true);
		expect(php.readFileAsText('/index.php')).toBe(
			`<?php echo 'Hello World';`
		);
	});

	it('should define the consts in a json and auto load the constants in VFS_CONFIG_FILE_BASENAME/wp-config.php file', async () => {
		// Define the constants to be tested
		const consts = {
			TEST_CONST: 'test_value',
			SITE_URL: 'http://test.url',
			WP_AUTO_UPDATE_CORE: false,
		};

		// Call the function with the constants and the playground client
		// Step1: define the constants
		const configFile = await defineWpConfigConsts(php, {
			consts,
			virtualize: true,
		});
		expect(configFile.startsWith(VFS_CONFIG_FILE_BASENAME)).toBe(true);
		expect(
			php.fileExists(`${VFS_CONFIG_FILE_BASENAME}/playground-consts.json`)
		).toBe(true);
		expect(
			php.fileExists(`${php.documentRoot}/playground-consts.json`)
		).toBe(false);

		// Assert execution of echo statements
		php.writeFile('/index.php', '<?php echo TEST_CONST;');
		let result = await php.request({ url: '/index.php' });
		expect(result.text).toBe('test_value');

		php.writeFile('/index.php', '<?php echo SITE_URL;');
		result = await php.request({ url: '/index.php' });
		expect(result.text).toBe('http://test.url');

		php.writeFile('/index.php', '<?php var_dump(WP_AUTO_UPDATE_CORE);');
		result = await php.request({ url: '/index.php' });
		expect(result.text.trim()).toBe('bool(false)');
	});
});
