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

		php.mkdir('/tmp/test-plugin');
		php.writeFile(
			'/tmp/test-plugin/index.php',
			`/**\n * Plugin Name: Test Plugin`
		);

		const zipFileName = 'test-plugin-0.0.1.zip';

		await php.run({
			code: `<?php $zip = new ZipArchive(); $zip->open("${zipFileName}", ZIPARCHIVE::CREATE); $zip->addFile("/tmp/test-plugin/index.php"); $zip->close();`,
		});

		php.rmdir('/tmp/test-plugin');

		// Note the package name is different from plugin folder name
		expect(php.fileExists(zipFileName)).toBe(true);

		await runBlueprintSteps(
			compileBlueprint({
				steps: [
					{
						step: 'installPlugin',
						pluginZipFile: {
							resource: 'vfs',
							path: zipFileName,
						},
					},
				],
			}),
			php
		);

		php.unlink(zipFileName);

		expect(
			php.fileExists(`${php.documentRoot}/wp-content/test-plugin`)
		).toBe(true);
	}, 30000);
});
