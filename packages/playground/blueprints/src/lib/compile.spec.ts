import { NodePHP } from '@php-wasm/node';
import { compileBlueprint, runBlueprintSteps } from './compile';
import { defineVirtualWpConfigConsts } from './steps/define-virtual-wp-config-consts';
import { VFS_CONFIG_FILE_PATH } from './steps/common';
import { setPhpIniEntry } from './steps/client-methods';

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

	it('should define constants in the VFS_CONFIG_FILE_PATH php file', async () => {
		// Define the constants to be tested
		const consts = {
			TEST_CONST: 'test_value',
			SITE_URL: 'http://test.url',
			HOME_URL: 'http://test.url',
			WP_AUTO_UPDATE_CORE: false,
		};

		// Call the function with the constants and the playground client
		await defineVirtualWpConfigConsts(php, { consts });

		// Assert that the file was created
		expect(php.fileExists(VFS_CONFIG_FILE_PATH)).toBe(true);

		// Assert that the file content is as expected
		const fileContent = php.readFileAsText(VFS_CONFIG_FILE_PATH);
		expect(fileContent).toContain('define("TEST_CONST", "test_value");');
		expect(fileContent).toContain('define("SITE_URL", "http://test.url");');
		expect(fileContent).toContain('define("HOME_URL", "http://test.url");');
		expect(fileContent).toContain('define("WP_AUTO_UPDATE_CORE", false);');
	});

	it('should define and auto load the constants in the VFS_CONFIG_FILE_PATH php file', async () => {
		// Define the constants to be tested
		const consts = {
			TEST_CONST: 'test_value',
			SITE_URL: 'http://test.url',
		};

		// Call the function with the constants and the playground client
		// Step1: define the constants
		const configFile = await defineVirtualWpConfigConsts(php, { consts });
		// Step2: set the auto_prepend_file php.ini entry
		await setPhpIniEntry(php, {
			key: 'auto_prepend_file',
			value: configFile,
		});

		// Assert execution of echo statements
		php.writeFile('/index.php', '<?php echo TEST_CONST;');
		let result = await php.request({ url: '/index.php' });
		expect(result.text).toBe('test_value');

		php.writeFile('/index.php', '<?php echo SITE_URL;');
		result = await php.request({ url: '/index.php' });
		expect(result.text).toBe('http://test.url');
	});
});
