import { createNodeFsMountHandler, loadNodeRuntime } from '..';
import { __private__dont__use, PHP } from '@php-wasm/universal';
import { RecommendedPHPVersion } from '@wp-playground/common';
import path from 'path';
import fs from 'fs';

describe('Mounting', () => {
	let php: PHP;

	beforeEach(async () => {
		php = new PHP(await loadNodeRuntime(RecommendedPHPVersion));
	});
	afterEach(async () => {
		php.exit();
	});

	describe('Basic mounting functionality', () => {
		it('Should mount a file with exact content match', async () => {
			const testFilePath = path.join(
				__dirname,
				'test-data',
				'long-post-body.txt'
			);

			await php.mount(
				'/single-file.txt',
				createNodeFsMountHandler(testFilePath)
			);

			const vfsContent = await php.readFileAsText('/single-file.txt');
			const localContent = fs.readFileSync(testFilePath, 'utf8');
			expect(vfsContent).toEqual(localContent);
		});

		it('Should mount nested directories with recursive structure matching', async () => {
			const testDataPath = path.join(__dirname, 'test-data');
			await php.mount(
				'/nested-test',
				createNodeFsMountHandler(testDataPath)
			);

			// Recursively compare directory structure
			const compareDirectories = (vfsPath: string, localPath: string) => {
				if (!fs.existsSync(localPath)) return;

				const localFiles = fs.readdirSync(localPath);
				const vfsFiles = php.listFiles(vfsPath);
				expect(vfsFiles.sort()).toEqual(localFiles.sort());

				localFiles.forEach((file) => {
					const localFilePath = path.join(localPath, file);
					const vfsFilePath = `${vfsPath}/${file}`;
					const localStats = fs.statSync(localFilePath);

					expect(php.isFile(vfsFilePath)).toBe(localStats.isFile());
					expect(php.isDir(vfsFilePath)).toBe(
						localStats.isDirectory()
					);

					if (localStats.isDirectory()) {
						compareDirectories(vfsFilePath, localFilePath);
					}
				});
			};

			compareDirectories('/nested-test', testDataPath);

			// Test specific nested file content
			const nestedFilePath =
				'/nested-test/nested-symlinked-folder/nested-document.txt';
			const localNestedPath = path.join(
				testDataPath,
				'nested-symlinked-folder',
				'nested-document.txt'
			);

			if (fs.existsSync(localNestedPath)) {
				const vfsContent = await php.readFileAsText(nestedFilePath);
				const localContent = fs.readFileSync(localNestedPath, 'utf8');
				expect(vfsContent).toEqual(localContent);
			}
		});
	});

	describe('File types and system operations', () => {
		it('Should handle all file types with comprehensive FS comparison', async () => {
			const testDataPath = path.join(__dirname, 'test-data');
			await php.mount(
				'/comprehensive-test',
				createNodeFsMountHandler(testDataPath)
			);

			const localFiles = fs.readdirSync(testDataPath);

			for (const file of localFiles) {
				const localPath = path.join(testDataPath, file);
				const vfsPath = `/comprehensive-test/${file}`;
				const localStat = fs.statSync(localPath);

				if (localStat.isFile()) {
					// Test binary files (images)
					if (file.endsWith('.jpg') || file.endsWith('.png')) {
						const vfsBinary = await php.readFileAsBuffer(vfsPath);
						const localBinary = fs.readFileSync(localPath);
						expect(Buffer.from(vfsBinary)).toEqual(localBinary);
						expect(vfsBinary.length).toBe(localStat.size);
					}
					// Test text files (certificates, documents)
					else if (file.endsWith('.txt') || file.endsWith('.pem')) {
						const vfsText = await php.readFileAsText(vfsPath);
						const localText = fs.readFileSync(localPath, 'utf8');
						expect(vfsText).toEqual(localText);
						expect(vfsText.length).toBe(localStat.size);

						// Special certificate validation
						if (
							file.endsWith('.pem') &&
							localText.includes('-----BEGIN CERTIFICATE-----')
						) {
							expect(vfsText).toContain(
								'-----BEGIN CERTIFICATE-----'
							);
						}
					}

					// Test stat operations
					const phpStat = await php.run({
						code: `<?php
							$stat = stat('/comprehensive-test/${file}');
							echo json_encode([
								'size' => $stat['size'],
								'mode' => $stat['mode'],
								'mtime' => $stat['mtime'],
								'is_file' => is_file('/comprehensive-test/${file}'),
								'is_readable' => is_readable('/comprehensive-test/${file}'),
								'filesize' => filesize('/comprehensive-test/${file}')
							]);
						`,
					});

					const vfsStatResult = JSON.parse(phpStat.text);
					expect(vfsStatResult.size).toBe(localStat.size);
					expect(vfsStatResult.mtime).toBe(
						Math.floor(localStat.mtime.getTime() / 1000)
					);
					expect(vfsStatResult.is_file).toBe(true);
					expect(vfsStatResult.is_readable).toBe(true);
					expect(vfsStatResult.filesize).toBe(localStat.size);
				}
			}

			// Test directory listing through PHP
			const phpListing = await php.run({
				code: `<?php
					$files = scandir('/comprehensive-test');
					echo json_encode(array_filter($files, function($file) {
						return !in_array($file, ['.', '..']);
					}));
				`,
			});

			const vfsPhpFiles = JSON.parse(phpListing.text);
			expect(vfsPhpFiles.sort()).toEqual(localFiles.sort());
		});
	});
});
