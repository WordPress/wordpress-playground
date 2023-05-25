import { NodePHP } from '@php-wasm/node';
import { compileBlueprint, runBlueprintSteps } from '../compile';

const phpVersion = '8.0';
describe('Blueprint step installPlugin', () => {
	let php: NodePHP;
	beforeEach(async () => {
		php = await NodePHP.load(phpVersion, {
			requestHandler: {
				documentRoot: '/wordpress',
				isStaticFilePath: (path) => !path.endsWith('.php'),
			},
		});
	});

	it('should install a plugin', async () => {
		// Create test plugin

		const pluginName = 'test-plugin';

		php.mkdir(`/${pluginName}`);
		php.writeFile(
			`/${pluginName}/index.php`,
			`/**\n * Plugin Name: Test Plugin`
		);

		// Note the package name is different from plugin folder name
		const zipFileName = `${pluginName}-0.0.1.zip`;

		await php.run({
			code: `<?php $zip = new ZipArchive(); $zip->open("${zipFileName}", ZIPARCHIVE::CREATE); $zip->addFile("/${pluginName}/index.php"); $zip->close();`,
		});

		php.rmdir(`/${pluginName}`);

		expect(php.fileExists(zipFileName)).toBe(true);

		// Create plugins folder
		const rootPath = await php.documentRoot;
		const pluginsPath = `${rootPath}/wp-content/plugins`;

		php.mkdir(pluginsPath);

		await runBlueprintSteps(
			compileBlueprint({
				steps: [
					{
						step: 'installPlugin',
						pluginZipFile: {
							resource: 'vfs',
							path: zipFileName,
						},
						options: {
							activate: false,
						},
					},
				],
			}),
			php
		);

		php.unlink(zipFileName);

		expect(php.fileExists(`${pluginsPath}/${pluginName}`)).toBe(true);
	}, 30000);
});
