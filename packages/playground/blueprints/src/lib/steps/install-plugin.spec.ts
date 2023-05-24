import { NodePHP } from '@php-wasm/node';
import { compileBlueprint, runBlueprintSteps } from '../compile';

const phpVersion = '8.0';
describe('Blueprint step installPlugin', () => {
	let php: NodePHP;
	beforeEach(async () => {
		php = await NodePHP.load(phpVersion, {
			requestHandler: {
				documentRoot: '/',
				isStaticFilePath: (path) => !path.endsWith('.php'),
			},
		});
	});

	it('should install a plugin', async () => {

		// Create test plugin

		php.mkdir('/test-plugin')
		php.writeFile('/test-plugin/index.php', `/**\n * Plugin Name: Test Plugin`);

		await php.run({
			code: `<?php $zip = new ZipArchive(); $zip->open("test-plugin.zip", ZIPARCHIVE::CREATE); $zip->addFile("/test-plugin/index.php"); $zip->close();`
		})

		php.rmdir('/test-plugin')

		expect(php.fileExists('/test-plugin.zip')).toBe(true);

		await runBlueprintSteps(
			compileBlueprint({
				steps: [
					{
						step: 'installPlugin',
						pluginZipFile: {
							resource: 'vfs',
							path: '/test-plugin.zip',
						},
					},
				],
			}),
			php
		);

		expect(php.fileExists(`${php.documentRoot}/wp-content/test-plugin`)).toBe(true);

	}, 30000);
});
