import { NodePHP } from '@php-wasm/node';
import { RecommendedPHPVersion } from '@wp-playground/wordpress';
import { installTheme } from './install-theme';

describe('Blueprint step installTheme', () => {
	let php: NodePHP;
	let zipFileName = '';
	let zipFilePath = '';
	let rootPath = '';
	let themesPath = '';
	beforeEach(async () => {
		php = await NodePHP.load(RecommendedPHPVersion, {
			requestHandler: {
				documentRoot: '/wordpress',
			},
		});

		rootPath = php.documentRoot;
		themesPath = `${rootPath}/wp-content/themes`;
		php.mkdir(themesPath);

		// Create test theme
		const themeName = 'test-theme';

		php.mkdir(`/${themeName}`);
		php.writeFile(
			`/${themeName}/index.php`,
			`/**\n * Theme Name: Test Theme`
		);

		// Note the package name is different from theme folder name
		zipFileName = `${themeName}-0.0.1.zip`;
		zipFilePath = `${themesPath}/${zipFileName}`;

		await php.run({
			code: `<?php $zip = new ZipArchive(); $zip->open("${zipFilePath}", ZIPARCHIVE::CREATE); $zip->addFile("/${themeName}/index.php"); $zip->close();`,
		});

		php.rmdir(`/${themeName}`);

		expect(php.fileExists(zipFilePath)).toBe(true);
	});

	afterEach(() => {
		php.exit();
	});

	it('should install a theme', async () => {
		await installTheme(php, {
			themeZipFile: new File(
				[php.readFileAsBuffer(zipFilePath)],
				zipFileName
			),
			ifAlreadyInstalled: 'overwrite',
			options: {
				activate: false,
			},
		});
		expect(php.fileExists(zipFilePath)).toBe(true);
	});

	describe('ifAlreadyInstalled option', () => {
		beforeEach(async () => {
			await installTheme(php, {
				themeZipFile: new File(
					[php.readFileAsBuffer(zipFilePath)],
					zipFileName
				),
				ifAlreadyInstalled: 'error',
				options: {
					activate: false,
				},
			});
		});

		it('ifAlreadyInstalled=ovewrite should overwrite the theme if the theme already exists', async () => {
			await installTheme(php, {
				themeZipFile: new File(
					[php.readFileAsBuffer(zipFilePath)],
					zipFileName
				),
				ifAlreadyInstalled: 'overwrite',
				options: {
					activate: false,
				},
			});
			expect(php.fileExists(zipFilePath)).toBe(true);
		});

		it('ifAlreadyInstalled=skip should skip the theme if the theme already exists', async () => {
			await installTheme(php, {
				themeZipFile: new File(
					['invalid zip bytes, unpacking should not attempted'],
					zipFileName
				),
				ifAlreadyInstalled: 'skip',
				options: {
					activate: false,
				},
			});
			expect(php.fileExists(zipFilePath)).toBe(true);
		});

		it('ifAlreadyInstalled=error should throw an error if the theme already exists', async () => {
			await expect(
				installTheme(php, {
					themeZipFile: new File(
						[php.readFileAsBuffer(zipFilePath)],
						zipFileName
					),
					ifAlreadyInstalled: 'error',
					options: {
						activate: false,
					},
				})
			).rejects.toThrow();
		});
	});
});
