import { PHP } from '@php-wasm/universal';
import { phpVar } from '@php-wasm/util';
import { RecommendedPHPVersion } from '@wp-playground/common';
import { installTheme } from '../../lib/steps/install-theme';
import { PHPRequestHandler } from '@php-wasm/universal';
import { loadNodeRuntime } from '@php-wasm/node';
import { logger } from '@php-wasm/logger';

describe('Blueprint step installTheme', () => {
	let zipFileName = '';
	let zipFilePath = '';
	let rootPath = '';
	let themesPath = '';
	let php: PHP;
	let handler: PHPRequestHandler;
	beforeEach(async () => {
		handler = new PHPRequestHandler({
			phpFactory: async () =>
				new PHP(await loadNodeRuntime(RecommendedPHPVersion)),
			documentRoot: '/wordpress',
		});
		php = await handler.getPrimaryPhp();

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
			code: `<?php $zip = new ZipArchive(); $zip->open("${zipFilePath}", ZIPARCHIVE::CREATE); $zip->addFile("/${themeName}/index.php", "${themeName}/index.php"); $zip->close();`,
		});

		php.rmdir(`/${themeName}`);

		expect(php.fileExists(zipFilePath)).toBe(true);
	});

	afterEach(async () => {
		php.exit();
		await handler[Symbol.asyncDispose]();
	});

	const expectedThemeIndexPhpPath =
		'/wordpress/wp-content/themes/test-theme/index.php';

	it('should install a theme', async () => {
		await installTheme(php, {
			themeData: new File(
				[php.readFileAsBuffer(zipFilePath)],
				zipFileName
			),
			ifAlreadyInstalled: 'overwrite',
			options: {
				activate: false,
			},
		});
		expect(php.fileExists(expectedThemeIndexPhpPath)).toBe(true);
	});

	it('should install a theme using the deprecated themeData option', async () => {
		// @ts-ignore
		await installTheme(php, {
			themeData: new File(
				[php.readFileAsBuffer(zipFilePath)],
				zipFileName
			),
			ifAlreadyInstalled: 'overwrite',
			options: {
				activate: false,
			},
		});
		expect(php.fileExists(expectedThemeIndexPhpPath)).toBe(true);
	});

	it('should install a theme from a directory resource', async () => {
		await installTheme(php, {
			themeData: {
				name: 'test-theme',
				files: {
					'index.php': `/**\n * Theme Name: Test Theme`,
				},
			},
			ifAlreadyInstalled: 'overwrite',
			options: {
				activate: false,
			},
		});
		expect(php.listFiles(themesPath)).toContain('test-theme');
		expect(php.fileExists(expectedThemeIndexPhpPath)).toBe(true);
	});

	it('should reject directory theme names that are not path segments', async () => {
		await expect(
			installTheme(php, {
				themeData: {
					name: '../escape',
					files: {
						'index.php': `/**\n * Theme Name: Test Theme`,
					},
				},
				options: {
					activate: false,
				},
			})
		).rejects.toThrow(
			'Theme directory name must be a single path segment.'
		);

		expect(php.fileExists('/wordpress/wp-content/escape')).toBe(false);
	});

	it('should reject directory theme file paths that escape the theme directory', async () => {
		await expect(
			installTheme(php, {
				themeData: {
					name: 'test-theme',
					files: {
						'../escape.php': `/**\n * Theme Name: Test Theme`,
					},
				},
				options: {
					activate: false,
				},
			})
		).rejects.toThrow('Theme file paths must not escape');

		expect(php.fileExists('/wordpress/wp-content/escape.php')).toBe(false);
	});

	it('should reject theme targetFolderName values that are not path segments', async () => {
		await expect(
			installTheme(php, {
				themeData: new File(
					[php.readFileAsBuffer(zipFilePath)],
					zipFileName
				),
				options: {
					activate: false,
					targetFolderName: 'nested/theme',
				},
			})
		).rejects.toThrow(
			'Asset target folder name must be a single path segment.'
		);

		expect(php.fileExists(`${themesPath}/nested/theme`)).toBe(false);
	});

	it('should skip installation errors when onError is skip-theme', async () => {
		const loggerWarnSpy = vi
			.spyOn(logger, 'warn')
			.mockImplementation(() => {});
		try {
			await installTheme(php, {
				themeData: new File(['not a zip'], 'broken-theme.zip'),
				ifAlreadyInstalled: 'overwrite',
				options: {
					onError: 'skip-theme',
				},
			});

			expect(loggerWarnSpy).toHaveBeenCalledWith(
				expect.stringContaining(
					'Skipping theme installation for Broken theme after failure'
				)
			);
			expect(php.fileExists(expectedThemeIndexPhpPath)).toBe(false);
		} finally {
			loggerWarnSpy.mockRestore();
		}
	});

	it('should log fallback theme name when skipping unnamed installation errors', async () => {
		const loggerWarnSpy = vi
			.spyOn(logger, 'warn')
			.mockImplementation(() => {});
		try {
			await installTheme(php, {
				themeData: undefined as any,
				options: {
					onError: 'skip-theme',
				},
			});

			expect(loggerWarnSpy).toHaveBeenCalledWith(
				expect.stringContaining(
					'Skipping theme installation for unknown theme after failure'
				)
			);
		} finally {
			loggerWarnSpy.mockRestore();
		}
	});

	describe('ifAlreadyInstalled option', () => {
		beforeEach(async () => {
			await installTheme(php, {
				themeData: new File(
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
				themeData: new File(
					[php.readFileAsBuffer(zipFilePath)],
					zipFileName
				),
				ifAlreadyInstalled: 'overwrite',
				options: {
					activate: false,
				},
			});
			expect(php.fileExists(expectedThemeIndexPhpPath)).toBe(true);
		});

		it('ifAlreadyInstalled=skip should skip the theme if the theme already exists', async () => {
			await installTheme(php, {
				themeData: new File(
					[php.readFileAsBuffer(zipFilePath)],
					zipFileName
				),
				ifAlreadyInstalled: 'skip',
				options: {
					activate: false,
				},
			});
			expect(php.fileExists(expectedThemeIndexPhpPath)).toBe(true);
		});

		it('ifAlreadyInstalled=error should throw an error if the theme already exists', async () => {
			await expect(
				installTheme(php, {
					themeData: new File(
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

		it('should apply ifAlreadyInstalled to directory theme resources', async () => {
			await installTheme(php, {
				themeData: {
					name: 'test-theme',
					files: {
						'index.php': `/**\n * Theme Name: Skipped Theme`,
					},
				},
				ifAlreadyInstalled: 'skip',
				options: {
					activate: false,
				},
			});
			expect(php.readFileAsText(expectedThemeIndexPhpPath)).toContain(
				'Theme Name: Test Theme'
			);

			await installTheme(php, {
				themeData: {
					name: 'test-theme',
					files: {
						'index.php': `/**\n * Theme Name: Overwritten Theme`,
					},
				},
				ifAlreadyInstalled: 'overwrite',
				options: {
					activate: false,
				},
			});
			expect(php.readFileAsText(expectedThemeIndexPhpPath)).toContain(
				'Theme Name: Overwritten Theme'
			);

			await expect(
				installTheme(php, {
					themeData: {
						name: 'test-theme',
						files: {
							'index.php': `/**\n * Theme Name: Error Theme`,
						},
					},
					ifAlreadyInstalled: 'error',
					options: {
						activate: false,
					},
				})
			).rejects.toThrow(/already exists/);
		});

		it('should reject overwriting a symlinked theme directory', async () => {
			const outsidePath = '/outside-theme-target';
			php.rmdir(`${themesPath}/test-theme`, { recursive: true });
			php.mkdir(outsidePath);
			php.writeFile(`${outsidePath}/index.php`, 'keep me');
			php.symlink(outsidePath, `${themesPath}/test-theme`);

			await expect(
				installTheme(php, {
					themeData: new File(
						[php.readFileAsBuffer(zipFilePath)],
						zipFileName
					),
					ifAlreadyInstalled: 'overwrite',
					options: {
						activate: false,
					},
				})
			).rejects.toThrow(/symbolic link/);

			expect(php.readFileAsText(`${outsidePath}/index.php`)).toBe(
				'keep me'
			);
		});

		it('should reject skipping a symlinked theme directory', async () => {
			const outsidePath = '/outside-theme-target';
			php.rmdir(`${themesPath}/test-theme`, { recursive: true });
			php.mkdir(outsidePath);
			php.writeFile(`${outsidePath}/index.php`, 'keep me');
			php.symlink(outsidePath, `${themesPath}/test-theme`);

			await expect(
				installTheme(php, {
					themeData: new File(
						[php.readFileAsBuffer(zipFilePath)],
						zipFileName
					),
					ifAlreadyInstalled: 'skip',
					options: {
						activate: false,
					},
				})
			).rejects.toThrow(/symbolic link/);
		});

		it('should reject overwriting a broken symlinked theme directory', async () => {
			php.rmdir(`${themesPath}/test-theme`, { recursive: true });
			php.symlink('/missing-theme-target', `${themesPath}/test-theme`);

			await expect(
				installTheme(php, {
					themeData: new File(
						[php.readFileAsBuffer(zipFilePath)],
						zipFileName
					),
					ifAlreadyInstalled: 'overwrite',
					options: {
						activate: false,
					},
				})
			).rejects.toThrow(/symbolic link/);
		});
	});

	describe('targetFolderName option', () => {
		it('should install a theme to expected path', async () => {
			// Create a zip with unexpected paths.
			const unexpectedZipFileName = 'unexpected-test-theme.zip';
			const unexpectedZipFilePath = `/{$unexpectedZipFileName}`;
			await php.run({
				code: `<?php $zip = new ZipArchive();
							$zip->open(${phpVar(unexpectedZipFilePath)}, ZIPARCHIVE::CREATE);
							$zip->addFromString("unexpected-path/index.php","/**\n * Theme Name: Test Theme");
							$zip->close();`,
			});
			const zip = await php.readFileAsBuffer(unexpectedZipFilePath);
			php.unlink(unexpectedZipFilePath);

			// @ts-expect-error themeZipFile is deprecated but still supported at runtime.
			await installTheme(php, {
				themeZipFile: new File([zip], unexpectedZipFileName),
				ifAlreadyInstalled: 'overwrite',
				options: {
					activate: false,
					targetFolderName: 'test-expected-theme',
				},
			});
			expect(
				php.fileExists(
					`${rootPath}/wp-content/themes/test-expected-theme/`
				)
			).toBe(true);
		});
	});
});
