import { createNodeFsMountHandler, loadNodeRuntime } from '..';
import {
	__private__dont__use,
	ErrnoError,
	FSHelpers,
	PHP,
} from '@php-wasm/universal';
import { RecommendedPHPVersion } from '@wp-playground/common';
import path, { dirname } from 'path';
import fs from 'fs';

describe('Mounting', () => {
	let php: PHP;

	beforeEach(async () => {
		php = new PHP(
			await loadNodeRuntime(RecommendedPHPVersion, {
				followSymlinks: true,
			})
		);
	});
	afterEach(async () => {
		php.exit();
	});

	describe('Test mounted file operations', () => {
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

		it('Should throw an error when mounting to an existing file', async () => {
			const testFilePath = path.join(
				__dirname,
				'test-data',
				'long-post-body.txt'
			);

			await php.mount(
				'/single-file.txt',
				createNodeFsMountHandler(testFilePath)
			);

			try {
				await php.mount(
					'/single-file.txt',
					createNodeFsMountHandler(testFilePath)
				);
			} catch (e: any) {
				e = e as ErrnoError;
				expect(e.name).toBe('ErrnoError');
				expect(e.errno).toBe(10);
			}
		});

		it('Should be editable', async () => {
			const testFilePath = path.join(
				__dirname,
				'test-data',
				'long-post-body.txt'
			);
			await php.mount(
				'/single-file.txt',
				createNodeFsMountHandler(testFilePath)
			);

			const originalContent = await php.readFileAsText(
				'/single-file.txt'
			);
			await php.writeFile('/single-file.txt', 'new content');

			expect(await php.readFileAsText('/single-file.txt')).toBe(
				'new content'
			);

			await php.writeFile('/single-file.txt', originalContent);
			expect(await php.readFileAsText('/single-file.txt')).toBe(
				originalContent
			);
		});

		it('Should not be deletable', async () => {
			const testFilePath = path.join(
				__dirname,
				'test-data',
				'long-post-body.txt'
			);
			await php.mount(
				'/single-file.txt',
				createNodeFsMountHandler(testFilePath)
			);

			try {
				await php.unlink('/single-file.txt');
			} catch (e: any) {
				e = e as Error;
				expect(e.message).toContain(
					'Could not unlink "/single-file.txt": Device or resource busy.'
				);
			}
		});

		it('Should not be movable', async () => {
			const testFilePath = path.join(
				__dirname,
				'test-data',
				'long-post-body.txt'
			);
			await php.mount(
				'/single-file.txt',
				createNodeFsMountHandler(testFilePath)
			);

			try {
				await php.mv('/single-file.txt', '/single-file-moved.txt');
			} catch (e: any) {
				e = e as Error;
				expect(e.message).toContain(
					'Could not move /single-file.txt to /single-file-moved.txt: Device or resource busy.'
				);
			}
		});

		it('Should unmount a file and remove created node from VFS', async () => {
			const testFilePath = path.join(
				__dirname,
				'test-data',
				'long-post-body.txt'
			);

			const unmount = await php.mount(
				'/single-file.txt',
				createNodeFsMountHandler(testFilePath)
			);

			expect(php.isFile('/single-file.txt')).toBe(true);

			await unmount();
			expect(php.isFile('/single-file.txt')).toBe(false);
		});

		it('Should remount after unmounting', async () => {
			const testFilePath = path.join(
				__dirname,
				'test-data',
				'long-post-body.txt'
			);

			const unmount = await php.mount(
				'/single-file.txt',
				createNodeFsMountHandler(testFilePath)
			);

			await unmount();
			await php.mount(
				'/single-file.txt',
				createNodeFsMountHandler(testFilePath)
			);

			expect(php.isFile('/single-file.txt')).toBe(true);
			expect(await php.readFileAsText('/single-file.txt')).toBe(
				fs.readFileSync(testFilePath, 'utf8')
			);
		});

		it('Should unmount a file, but not remove the parent directory from VFS if it was created manually', async () => {
			const testFilePath = path.join(
				__dirname,
				'test-data',
				'long-post-body.txt'
			);

			const mountPoint = '/sub-dir/single-file.txt';

			await php.mkdir(dirname(mountPoint));

			const unmount = await php.mount(
				mountPoint,
				createNodeFsMountHandler(testFilePath)
			);

			expect(php.isFile(mountPoint)).toBe(true);

			await unmount();
			expect(php.isDir(dirname(mountPoint))).toBe(true);
		});
	});

	describe('Test mounted directory operations', () => {
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

		it('Should throw an error when mounting to an existing directory', async () => {
			const testDataPath = path.join(__dirname, 'test-data');
			await php.mount(
				'/nested-test',
				createNodeFsMountHandler(testDataPath)
			);

			try {
				await php.mount(
					'/nested-test',
					createNodeFsMountHandler(testDataPath)
				);
			} catch (e: any) {
				e = e as ErrnoError;
				expect(e.name).toBe('ErrnoError');
				expect(e.errno).toBe(10);
			}
		});

		describe('Should be editable', async () => {
			it('Should add a new directory', async () => {
				const testDataPath = path.join(__dirname, 'test-data');
				await php.mount(
					'/nested-test',
					createNodeFsMountHandler(testDataPath)
				);

				await php.mkdir('/nested-test/new-dir');
				expect(php.isDir('/nested-test/new-dir')).toBe(true);

				await php.rmdir('/nested-test/new-dir');
				expect(php.isDir('/nested-test/new-dir')).toBe(false);
			});

			it('Should move a directory', async () => {
				const testDataPath = path.join(__dirname, 'test-data');
				await php.mount(
					'/nested-test',
					createNodeFsMountHandler(testDataPath)
				);

				await php.mv(
					'/nested-test/nested-symlinked-folder',
					'/nested-test/new-dir'
				);
				expect(php.isDir('/nested-test/new-dir')).toBe(true);
				expect(php.isDir('/nested-test/nested-symlinked-folder')).toBe(
					false
				);

				await php.mv(
					'/nested-test/new-dir',
					'/nested-test/nested-symlinked-folder'
				);
				expect(php.isDir('/nested-test/new-dir')).toBe(false);
				expect(php.isDir('/nested-test/nested-symlinked-folder')).toBe(
					true
				);
			});

			it('Should remove a directory', async () => {
				const testDataPath = path.join(__dirname, 'test-data');
				await php.mount(
					'/nested-test',
					createNodeFsMountHandler(testDataPath)
				);

				const backupDir = path.join(
					__dirname,
					'test-data',
					'backup-nested-test'
				);
				await php.mkdir(backupDir);
				await FSHelpers.copyRecursive(
					php[__private__dont__use].FS,
					'/nested-test/nested-symlinked-folder',
					backupDir
				);

				await php.rmdir('/nested-test/nested-symlinked-folder');
				expect(php.isDir('/nested-test/nested-symlinked-folder')).toBe(
					false
				);

				await FSHelpers.copyRecursive(
					php[__private__dont__use].FS,
					backupDir,
					'/nested-test/nested-symlinked-folder'
				);
				expect(php.isDir('/nested-test/nested-symlinked-folder')).toBe(
					true
				);
			});

			it('Should add a new file', async () => {
				const testDataPath = path.join(__dirname, 'test-data');
				await php.mount(
					'/nested-test',
					createNodeFsMountHandler(testDataPath)
				);

				await php.writeFile(
					'/nested-test/nested-symlinked-folder/new-file.txt',
					'new file content'
				);

				expect(
					await php.readFileAsText(
						'/nested-test/nested-symlinked-folder/new-file.txt'
					)
				).toBe('new file content');

				await php.unlink(
					'/nested-test/nested-symlinked-folder/new-file.txt'
				);
				expect(
					php.isFile(
						'/nested-test/nested-symlinked-folder/new-file.txt'
					)
				).toBe(false);
			});

			it('Should edit a file', async () => {
				const testDataPath = path.join(__dirname, 'test-data');
				await php.mount(
					'/nested-test',
					createNodeFsMountHandler(testDataPath)
				);

				const fileContent = await php.readFileAsText(
					'/nested-test/nested-symlinked-folder/nested-document.txt'
				);

				await php.writeFile(
					'/nested-test/nested-symlinked-folder/nested-document.txt',
					'new file content'
				);

				expect(
					await php.readFileAsText(
						'/nested-test/nested-symlinked-folder/nested-document.txt'
					)
				).toBe('new file content');

				await php.writeFile(
					'/nested-test/nested-symlinked-folder/nested-document.txt',
					fileContent
				);
				expect(
					await php.readFileAsText(
						'/nested-test/nested-symlinked-folder/nested-document.txt'
					)
				).toBe(fileContent);
			});

			it('Should delete a file', async () => {
				const testDataPath = path.join(__dirname, 'test-data');
				await php.mount(
					'/nested-test',
					createNodeFsMountHandler(testDataPath)
				);

				const fileContent = await php.readFileAsText(
					'/nested-test/nested-symlinked-folder/nested-document.txt'
				);

				await php.unlink(
					'/nested-test/nested-symlinked-folder/nested-document.txt'
				);
				expect(
					php.isFile(
						'/nested-test/nested-symlinked-folder/nested-document.txt'
					)
				).toBe(false);

				await php.writeFile(
					'/nested-test/nested-symlinked-folder/nested-document.txt',
					fileContent
				);
				expect(
					await php.readFileAsText(
						'/nested-test/nested-symlinked-folder/nested-document.txt'
					)
				).toBe(fileContent);
			});
		});

		it('Should not be deletable', async () => {
			const testDataPath = path.join(__dirname, 'test-data');
			await php.mount(
				'/nested-test',
				createNodeFsMountHandler(testDataPath)
			);

			try {
				await php.rmdir('/nested-test');
			} catch (e: any) {
				e = e as Error;
				expect(e.message).toContain(
					'Could not remove directory "/nested-test": Device or resource busy.'
				);
			}
		});

		it('Should not be movable', async () => {
			const testDataPath = path.join(__dirname, 'test-data');
			await php.mount(
				'/nested-test',
				createNodeFsMountHandler(testDataPath)
			);

			try {
				await php.mv('/nested-test', '/nested-test-moved');
			} catch (e: any) {
				e = e as Error;
				expect(e.message).toContain(
					'Could not move /nested-test to /nested-test-moved: Device or resource busy.'
				);
			}
		});

		it('Should unmount a directory and remove created node from VFS', async () => {
			const testDataPath = path.join(__dirname, 'test-data');
			const unmount = await php.mount(
				'/nested-test',
				createNodeFsMountHandler(testDataPath)
			);

			expect(php.isDir('/nested-test')).toBe(true);

			await unmount();
			expect(php.isDir('/nested-test')).toBe(false);
		});

		it('Should unmount a directory, but not remove the parent directory from VFS if it was created manually', async () => {
			const testDataPath = path.join(__dirname, 'test-data');

			await php.mkdir('/nested-test');
			const unmount = await php.mount(
				'/nested-test',
				createNodeFsMountHandler(testDataPath)
			);

			expect(php.isDir('/nested-test')).toBe(true);

			await unmount();
			expect(php.isDir('/nested-test')).toBe(true);
		});

		it('Should remount after unmounting', async () => {
			const testDataPath = path.join(__dirname, 'test-data');
			const unmount = await php.mount(
				'/nested-test',
				createNodeFsMountHandler(testDataPath)
			);

			await unmount();
			await php.mount(
				'/nested-test',
				createNodeFsMountHandler(testDataPath)
			);

			expect(php.isDir('/nested-test')).toBe(true);
		});
	});
});
