import { NodePHP } from '@php-wasm/node';
import { compileBlueprint, runBlueprintSteps } from '../compile';
import { RecommendedPHPVersion } from '@wp-playground/wordpress';

describe('Blueprint step installTheme', () => {
	let php: NodePHP;
	beforeEach(async () => {
		php = await NodePHP.load(RecommendedPHPVersion, {
			requestHandler: {
				documentRoot: '/wordpress',
			},
		});
	});

	it('should install a theme', async () => {
		// Create test theme

		const themeName = 'test-theme';

		php.mkdir(`/${themeName}`);
		php.writeFile(
			`/${themeName}/index.php`,
			`/**\n * Theme Name: Test Theme`
		);

		// Note the package name is different from theme folder name
		const zipFileName = `${themeName}-0.0.1.zip`;

		await php.run({
			code: `<?php 
			$zip = new ZipArchive();
			$zip->open("${zipFileName}", ZIPARCHIVE::CREATE); 
			$zip->addFile("/${themeName}/index.php"); 
			$zip->close();
			`,
		});

		php.rmdir(`/${themeName}`);

		expect(php.fileExists(zipFileName)).toBe(true);

		// Create themes folder
		const rootPath = php.documentRoot;
		const themesPath = `${rootPath}/wp-content/themes`;

		php.mkdir(themesPath);

		await runBlueprintSteps(
			compileBlueprint({
				steps: [
					{
						step: 'installTheme',
						themeZipFile: {
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

		expect(php.fileExists(`${themesPath}/${themeName}`)).toBe(true);
	});
});
