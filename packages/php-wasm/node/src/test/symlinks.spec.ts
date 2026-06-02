import { loadNodeRuntime } from '..';
import { PHP, setPhpIniEntries } from '@php-wasm/universal';
import fs from 'fs';
import path from 'path';
import { createNodeFsMountHandler } from '../lib/node-fs-mount';
import { RecommendedPHPVersion } from '@wp-playground/common';

const testSymlinks = [
	{
		name: 'Absolute symbolic symlink',
		sourcePath: path.join(__dirname, 'test-data', 'symlinked-folder'),
		symlinkPath: path.join(
			__dirname,
			'test-data',
			'folder-with-symlinks',
			'symlinked-folder'
		),
	},
	{
		name: 'Relative symbolic symlink',
		sourcePath: '../symlinked-folder',
		symlinkPath: path.join(
			__dirname,
			'test-data',
			'folder-with-symlinks',
			'symlinked-folder'
		),
	},
];

testSymlinks.forEach(({ name, sourcePath, symlinkPath }) => {
	describe(name, () => {
		let php: PHP;

		beforeEach(async () => {
			php = new PHP(
				await loadNodeRuntime(RecommendedPHPVersion, {
					followSymlinks: true,
				})
			);

			await setPhpIniEntries(php, {});

			const destinationPath = path.join(
				__dirname,
				'test-data',
				'folder-with-symlinks'
			);
			if (!fs.existsSync(destinationPath)) {
				fs.mkdirSync(destinationPath);
			}

			if (
				!fs.existsSync(
					path.join(__dirname, 'test-data', 'folder-with-symlinks')
				)
			) {
				fs.mkdirSync(
					path.join(__dirname, 'test-data', 'folder-with-symlinks')
				);
			}

			await php.mount(
				'/folder-with-symlinks',
				createNodeFsMountHandler(
					path.join(__dirname, 'test-data', 'folder-with-symlinks')
				)
			);

			if (!fs.existsSync(symlinkPath)) {
				fs.symlinkSync(sourcePath, symlinkPath);
			}
		});
		afterEach(async () => {
			if (fs.existsSync(symlinkPath)) {
				fs.unlinkSync(symlinkPath);
			}
			php.exit();
		});

		describe('Test symlinks', () => {
			it('Should read symlinked directory', async () => {
				const result = await php.listFiles(
					'/folder-with-symlinks/symlinked-folder'
				);
				expect(result).toEqual(['document.txt']);
			});
			it('Should read the symlinked document', async () => {
				const content = await php.readFileAsText(
					'/folder-with-symlinks/symlinked-folder/document.txt'
				);
				expect(content).toEqual('document content');
			});
			it('Should write to the symlinked document', async () => {
				const originalContent = await php.readFileAsText(
					'/folder-with-symlinks/symlinked-folder/document.txt'
				);
				await php.writeFile(
					'/folder-with-symlinks/symlinked-folder/document.txt',
					'new content'
				);
				const content = await php.readFileAsText(
					'/folder-with-symlinks/symlinked-folder/document.txt'
				);
				// Revert file change
				await php.writeFile(
					'/folder-with-symlinks/symlinked-folder/document.txt',
					originalContent
				);
				expect(content).toEqual('new content');
			});

			it('Should have access to nested symlinked document', async () => {
				const nestedSourcePath = path.join(
					'..',
					'nested-symlinked-folder'
				);
				const nestedSymlinkPath = path.join(
					__dirname,
					'test-data',
					'symlinked-folder',
					'nested-symlinked-folder'
				);
				try {
					if (!fs.existsSync(nestedSymlinkPath)) {
						fs.symlinkSync(nestedSourcePath, nestedSymlinkPath);
					}

					const result = await php.listFiles('/folder-with-symlinks');
					expect(result).toEqual(['symlinked-folder']);

					const nestedResult = await php.listFiles(
						'/folder-with-symlinks/symlinked-folder'
					);
					expect(nestedResult).toEqual([
						'document.txt',
						'nested-symlinked-folder',
					]);

					const nestedNestedResult = await php.listFiles(
						'/folder-with-symlinks/symlinked-folder/nested-symlinked-folder'
					);
					expect(nestedNestedResult).toEqual(['nested-document.txt']);

					const nestedNestedContent = await php.readFileAsText(
						'/folder-with-symlinks/symlinked-folder/nested-symlinked-folder/nested-document.txt'
					);
					expect(nestedNestedContent).toEqual(
						'nested document content'
					);
				} finally {
					fs.unlinkSync(nestedSymlinkPath);
				}
			});

			it('Should have access to a symlinked file', async () => {
				const sourcePath = path.join(
					'..',
					'nested-symlinked-folder',
					'nested-document.txt'
				);
				const symlinkPath = path.join(
					__dirname,
					'test-data',
					'symlinked-folder',
					'nested-symlinked-document.txt'
				);
				try {
					if (!fs.existsSync(symlinkPath)) {
						fs.symlinkSync(sourcePath, symlinkPath);
					}

					const result = await php.listFiles('/folder-with-symlinks');
					expect(result).toEqual(['symlinked-folder']);

					const nestedResult = await php.listFiles(
						'/folder-with-symlinks/symlinked-folder'
					);
					expect(nestedResult).toEqual([
						'document.txt',
						'nested-symlinked-document.txt',
					]);

					const nestedNestedContent = await php.readFileAsText(
						'/folder-with-symlinks/symlinked-folder/nested-symlinked-document.txt'
					);
					expect(nestedNestedContent).toEqual(
						'nested document content'
					);
				} finally {
					fs.unlinkSync(symlinkPath);
				}
			});

			it('Should access sibling files via __DIR__ inside a symlinked file', async () => {
				const sourcePath = path.join(
					'..',
					'nested-symlinked-folder',
					'nested-document.txt'
				);
				const symlinkPath = path.join(
					__dirname,
					'test-data',
					'symlinked-folder',
					'nested-symlinked-document.txt'
				);
				try {
					if (!fs.existsSync(symlinkPath)) {
						fs.symlinkSync(sourcePath, symlinkPath);
					}

					// Use PHP to require the symlinked file and check
					// that __DIR__ resolves to a directory where sibling
					// files are accessible — not an empty MEMFS dir.
					const result = await php.run({
						code: `<?php
							$dir = dirname(readlink('/folder-with-symlinks/symlinked-folder/nested-symlinked-document.txt'));
							echo json_encode(scandir($dir));
						`,
					});
					const files = JSON.parse(result.text);
					expect(files).toContain('nested-document.txt');
				} finally {
					fs.unlinkSync(symlinkPath);
				}
			});

			it('Should read link that crosses the FS root boundary', async () => {
				const sourcePath = path.join(
					'..',
					'..',
					'..',
					'..',
					'..',
					'..',
					'..',
					'package.json'
				);
				const symlinkPath = path.join(
					__dirname,
					'test-data',
					'folder-with-symlinks',
					'package.json'
				);
				try {
					if (!fs.existsSync(symlinkPath)) {
						fs.symlinkSync(sourcePath, symlinkPath);
					}

					const result = await php.listFiles('/folder-with-symlinks');
					expect(result).toEqual([
						'package.json',
						'symlinked-folder',
					]);

					const content = await php.readFileAsText(
						'/folder-with-symlinks/package.json'
					);
					expect(JSON.parse(content)).toHaveProperty(
						'name',
						'wp-playground'
					);
				} finally {
					fs.unlinkSync(symlinkPath);
				}
			});
			it('Should mount a symlinked directory that already exists on the filesystem', async () => {
				const nestedSourcePath = path.join(
					'..',
					'nested-symlinked-folder'
				);
				const nestedSymlinkPath = path.join(
					__dirname,
					'test-data',
					'symlinked-folder',
					'nested-symlinked-folder'
				);

				// Create the same directory in VFS before mounting
				await php.mkdir(nestedSymlinkPath);
				await php.writeFile(
					path.join(
						nestedSymlinkPath,
						'nested-symlinked-document.txt'
					),
					'Content generated by PHP'
				);
				try {
					if (!fs.existsSync(nestedSymlinkPath)) {
						fs.symlinkSync(nestedSourcePath, nestedSymlinkPath);
					}

					const result = await php.listFiles('/folder-with-symlinks');
					expect(result).toEqual(['symlinked-folder']);

					const nestedResult = await php.listFiles(
						'/folder-with-symlinks/symlinked-folder'
					);
					expect(nestedResult).toEqual([
						'document.txt',
						'nested-symlinked-folder',
					]);

					const nestedNestedResult = await php.listFiles(
						'/folder-with-symlinks/symlinked-folder/nested-symlinked-folder'
					);
					expect(nestedNestedResult).toEqual(['nested-document.txt']);

					const nestedNestedContent = await php.readFileAsText(
						'/folder-with-symlinks/symlinked-folder/nested-symlinked-folder/nested-document.txt'
					);
					expect(nestedNestedContent).toEqual(
						'nested document content'
					);

					const nestedNestedPhpContent = await php.readFileAsText(
						path.join(
							nestedSymlinkPath,
							'nested-symlinked-document.txt'
						)
					);
					expect(nestedNestedPhpContent).toEqual(
						'Content generated by PHP'
					);
				} finally {
					fs.unlinkSync(nestedSymlinkPath);
				}
			});

			it('Should fail on a invalid symlink', async () => {
				try {
					php.readlink('/invalid-symlink');
				} catch (error: any) {
					expect(error.errno).toBe(44);
					expect(error.name).toBe('ErrnoError');
				}
			});

			it('Should follow a symlink to a hard link', async () => {
				const sourcePath = path.join(
					__dirname,
					'test-data',
					'long-post-body.txt'
				);
				const hardlinkPath = path.join(
					__dirname,
					'test-data',
					'folder-with-symlinks',
					'symlinked-folder',
					'long-post-body.txt'
				);
				const symlinkPath = path.join(
					__dirname,
					'test-data',
					'folder-with-symlinks',
					'symlink-to-hardlinked-long-post-body.txt'
				);
				try {
					if (!fs.existsSync(hardlinkPath)) {
						fs.linkSync(sourcePath, hardlinkPath);
					}

					if (!fs.existsSync(symlinkPath)) {
						fs.symlinkSync(hardlinkPath, symlinkPath);
					}

					const result = await php.listFiles('/folder-with-symlinks');
					expect(result).toEqual([
						'symlink-to-hardlinked-long-post-body.txt',
						'symlinked-folder',
					]);

					const content = await php.readFileAsText(
						'/folder-with-symlinks/symlink-to-hardlinked-long-post-body.txt'
					);
					const longPostBodyLength =
						fs.readFileSync(sourcePath).length;
					expect(content).toHaveLength(longPostBodyLength);
				} finally {
					fs.rmSync(hardlinkPath);
					fs.unlinkSync(symlinkPath);
				}
			});
		});
	});
});
