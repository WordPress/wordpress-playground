import { createNodeFsMountHandler, loadNodeRuntime } from '..';
import { __private__dont__use, PHP, FSHelpers } from '@php-wasm/universal';
import { type ErrnoError } from '@php-wasm/universal';
import { RecommendedPHPVersion } from '@wp-playground/common';
import path, { dirname } from 'path';
import fs from 'fs';
import os from 'os';

describe('Mounting', () => {
	let php: PHP;

	const testFilePath = path.join(
		__dirname,
		'test-data',
		'long-post-body.txt'
	);
	const testSymlinkedFilePath = path.join(
		__dirname,
		'test-data',
		'symlinked-long-post-body.txt'
	);
	const fileMountPoint = '/single-file.txt';

	const testDataPath = path.join(__dirname, 'test-data');
	const testSymlinkedDataPath = path.join(__dirname, 'symlinked-test-data');
	const directoryMountPoint = '/nested-test';

	beforeAll(async () => {
		fs.symlinkSync(testFilePath, testSymlinkedFilePath);
		fs.symlinkSync(testDataPath, testSymlinkedDataPath);
	});

	afterAll(async () => {
		fs.unlinkSync(testSymlinkedFilePath);
		fs.unlinkSync(testSymlinkedDataPath);
	});

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

	[
		{
			filePath: testFilePath,
			name: 'file',
		},
		{
			filePath: testSymlinkedFilePath,
			name: 'symlinked file',
		},
	].forEach(({ filePath, name }) => {
		describe(`Test mounted ${name} operations`, () => {
			it('Should mount a file with exact content match', async () => {
				await php.mount(
					fileMountPoint,
					createNodeFsMountHandler(filePath)
				);

				const vfsContent = await php.readFileAsText(fileMountPoint);
				const localContent = fs.readFileSync(filePath, 'utf8');
				expect(vfsContent).toEqual(localContent);
			});

			it('Should throw an error when mounting to an existing file', async () => {
				await php.mount(
					fileMountPoint,
					createNodeFsMountHandler(filePath)
				);

				try {
					await php.mount(
						fileMountPoint,
						createNodeFsMountHandler(filePath)
					);
				} catch (e: any) {
					const error = e as ErrnoError;
					expect(error.name).toBe('ErrnoError');
					expect(error.errno).toBe(10);
				}
			});

			it('Should edit mounted file', async () => {
				await php.mount(
					fileMountPoint,
					createNodeFsMountHandler(filePath)
				);

				const originalContent = await php.readFileAsText(
					fileMountPoint
				);
				await php.writeFile(fileMountPoint, 'new content');

				expect(await php.readFileAsText(fileMountPoint)).toBe(
					'new content'
				);

				await php.writeFile(fileMountPoint, originalContent);
				expect(await php.readFileAsText(fileMountPoint)).toBe(
					originalContent
				);
			});

			it('Should throw an error when trying to delete mounted file', async () => {
				await php.mount(
					fileMountPoint,
					createNodeFsMountHandler(filePath)
				);

				try {
					await php.unlink(fileMountPoint);
				} catch (e: any) {
					const error = e as Error;
					expect(error.message).toContain(
						`Could not unlink "${fileMountPoint}": Device or resource busy.`
					);
				}
			});

			it('Should throw an error when trying to move mounted file', async () => {
				await php.mount(
					fileMountPoint,
					createNodeFsMountHandler(filePath)
				);

				try {
					await php.mv(fileMountPoint, '/single-file-moved.txt');
				} catch (e: any) {
					const error = e as Error;
					expect(error.message).toContain(
						`Could not move ${fileMountPoint} to /single-file-moved.txt: Device or resource busy.`
					);
				}
			});

			it('Should create a file node, not a directory, when mounting a file', async () => {
				// This test addresses issue #503
				// Ensure the mount point doesn't exist yet
				expect(php.fileExists(fileMountPoint)).toBe(false);

				await php.mount(
					fileMountPoint,
					createNodeFsMountHandler(filePath)
				);

				// The mount point should be a file, not a directory
				expect(php.isFile(fileMountPoint)).toBe(true);
				expect(php.isDir(fileMountPoint)).toBe(false);
			});

			it('Should unmount mounted file and remove created node from VFS', async () => {
				const unmount = await php.mount(
					fileMountPoint,
					createNodeFsMountHandler(filePath)
				);

				expect(php.isFile(fileMountPoint)).toBe(true);

				unmount();
				expect(php.isFile(fileMountPoint)).toBe(false);
			});

			it('Should remount mounted file after unmounting', async () => {
				const unmount = await php.mount(
					fileMountPoint,
					createNodeFsMountHandler(filePath)
				);

				unmount();
				await php.mount(
					fileMountPoint,
					createNodeFsMountHandler(filePath)
				);

				expect(php.isFile(fileMountPoint)).toBe(true);
				expect(await php.readFileAsText(fileMountPoint)).toBe(
					fs.readFileSync(filePath, 'utf8')
				);
			});

			it('Should unmount mounted file, but not remove the parent directory from VFS if it was created manually', async () => {
				const mountPoint = '/sub-dir/single-file.txt';

				await php.mkdir(dirname(mountPoint));

				const unmount = await php.mount(
					mountPoint,
					createNodeFsMountHandler(filePath)
				);

				expect(php.isFile(mountPoint)).toBe(true);

				unmount();
				expect(php.isDir(dirname(mountPoint))).toBe(true);
			});
		});
	});

	[
		{
			directoryPath: testDataPath,
			name: 'directory',
		},
		{
			directoryPath: testSymlinkedDataPath,
			name: 'symlinked directory',
		},
	].forEach(({ directoryPath, name }) => {
		describe(`Test mounted ${name} operations`, () => {
			it('Should mount nested directories with recursive structure matching', async () => {
				await php.mount(
					directoryMountPoint,
					createNodeFsMountHandler(directoryPath)
				);

				// Recursively compare directory structure
				const compareDirectories = (
					vfsPath: string,
					localPath: string
				) => {
					if (!fs.existsSync(localPath)) return;

					const localFiles = fs.readdirSync(localPath);
					const vfsFiles = php.listFiles(vfsPath);
					expect(vfsFiles.sort()).toEqual(localFiles.sort());

					localFiles.forEach((file) => {
						const localFilePath = path.join(localPath, file);
						const vfsFilePath = `${vfsPath}/${file}`;
						const localStats = fs.statSync(localFilePath);

						expect(php.isFile(vfsFilePath)).toBe(
							localStats.isFile()
						);
						expect(php.isDir(vfsFilePath)).toBe(
							localStats.isDirectory()
						);

						if (localStats.isDirectory()) {
							compareDirectories(vfsFilePath, localFilePath);
						}
					});
				};

				compareDirectories(directoryMountPoint, directoryPath);

				// Test specific nested file content
				const nestedFilePath = `${directoryMountPoint}/nested-symlinked-folder/nested-document.txt`;
				const localNestedPath = path.join(
					directoryPath,
					'nested-symlinked-folder',
					'nested-document.txt'
				);

				if (fs.existsSync(localNestedPath)) {
					const vfsContent = await php.readFileAsText(nestedFilePath);
					const localContent = fs.readFileSync(
						localNestedPath,
						'utf8'
					);
					expect(vfsContent).toEqual(localContent);
				}
			});

			it('Should throw an error when mounting to an existing directory', async () => {
				await php.mount(
					directoryMountPoint,
					createNodeFsMountHandler(directoryPath)
				);

				try {
					await php.mount(
						directoryMountPoint,
						createNodeFsMountHandler(directoryPath)
					);
				} catch (e: any) {
					const error = e as ErrnoError;
					expect(error.name).toBe('ErrnoError');
					expect(error.errno).toBe(10);
				}
			});

			describe('Should edit mounted directory', async () => {
				it('Should add a new directory', async () => {
					await php.mount(
						directoryMountPoint,
						createNodeFsMountHandler(directoryPath)
					);

					await php.mkdir(`${directoryMountPoint}/new-dir`);
					expect(php.isDir(`${directoryMountPoint}/new-dir`)).toBe(
						true
					);

					await php.rmdir(`${directoryMountPoint}/new-dir`);
					expect(php.isDir(`${directoryMountPoint}/new-dir`)).toBe(
						false
					);
				});

				it('Should move a directory', async () => {
					await php.mount(
						directoryMountPoint,
						createNodeFsMountHandler(directoryPath)
					);

					await php.mv(
						`${directoryMountPoint}/nested-symlinked-folder`,
						`${directoryMountPoint}/new-dir`
					);
					expect(php.isDir(`${directoryMountPoint}/new-dir`)).toBe(
						true
					);
					expect(
						php.isDir(
							`${directoryMountPoint}/nested-symlinked-folder`
						)
					).toBe(false);

					await php.mv(
						`${directoryMountPoint}/new-dir`,
						`${directoryMountPoint}/nested-symlinked-folder`
					);
					expect(php.isDir(`${directoryMountPoint}/new-dir`)).toBe(
						false
					);
					expect(
						php.isDir(
							`${directoryMountPoint}/nested-symlinked-folder`
						)
					).toBe(true);
				});

				it('Should remove a directory', async () => {
					await php.mount(
						directoryMountPoint,
						createNodeFsMountHandler(directoryPath)
					);

					const backupDir = path.join(
						__dirname,
						'test-data',
						'backup-nested-test'
					);
					await php.mkdir(backupDir);
					await FSHelpers.copyRecursive(
						php[__private__dont__use].FS,
						`${directoryMountPoint}/nested-symlinked-folder`,
						backupDir
					);

					await php.rmdir(
						`${directoryMountPoint}/nested-symlinked-folder`
					);
					expect(
						php.isDir(
							`${directoryMountPoint}/nested-symlinked-folder`
						)
					).toBe(false);

					await FSHelpers.copyRecursive(
						php[__private__dont__use].FS,
						backupDir,
						`${directoryMountPoint}/nested-symlinked-folder`
					);
					expect(
						php.isDir(
							`${directoryMountPoint}/nested-symlinked-folder`
						)
					).toBe(true);
				});

				it('Should add a new file', async () => {
					await php.mount(
						directoryMountPoint,
						createNodeFsMountHandler(directoryPath)
					);

					await php.writeFile(
						`${directoryMountPoint}/nested-symlinked-folder/new-file.txt`,
						'new file content'
					);

					expect(
						await php.readFileAsText(
							`${directoryMountPoint}/nested-symlinked-folder/new-file.txt`
						)
					).toBe('new file content');

					await php.unlink(
						`${directoryMountPoint}/nested-symlinked-folder/new-file.txt`
					);
					expect(
						php.isFile(
							`${directoryMountPoint}/nested-symlinked-folder/new-file.txt`
						)
					).toBe(false);
				});

				it('Should edit a file', async () => {
					await php.mount(
						directoryMountPoint,
						createNodeFsMountHandler(directoryPath)
					);

					const fileContent = await php.readFileAsText(
						`${directoryMountPoint}/nested-symlinked-folder/nested-document.txt`
					);

					await php.writeFile(
						`${directoryMountPoint}/nested-symlinked-folder/nested-document.txt`,
						'new file content'
					);

					expect(
						await php.readFileAsText(
							`${directoryMountPoint}/nested-symlinked-folder/nested-document.txt`
						)
					).toBe('new file content');

					await php.writeFile(
						`${directoryMountPoint}/nested-symlinked-folder/nested-document.txt`,
						fileContent
					);
					expect(
						await php.readFileAsText(
							`${directoryMountPoint}/nested-symlinked-folder/nested-document.txt`
						)
					).toBe(fileContent);
				});

				it('Should delete a file', async () => {
					await php.mount(
						directoryMountPoint,
						createNodeFsMountHandler(directoryPath)
					);

					const fileContent = await php.readFileAsText(
						`${directoryMountPoint}/nested-symlinked-folder/nested-document.txt`
					);

					await php.unlink(
						`${directoryMountPoint}/nested-symlinked-folder/nested-document.txt`
					);
					expect(
						php.isFile(
							`${directoryMountPoint}/nested-symlinked-folder/nested-document.txt`
						)
					).toBe(false);

					await php.writeFile(
						`${directoryMountPoint}/nested-symlinked-folder/nested-document.txt`,
						fileContent
					);
					expect(
						await php.readFileAsText(
							`${directoryMountPoint}/nested-symlinked-folder/nested-document.txt`
						)
					).toBe(fileContent);
				});
			});

			it('Should throw an error when trying to delete mounted directory', async () => {
				await php.mount(
					directoryMountPoint,
					createNodeFsMountHandler(directoryPath)
				);

				try {
					await php.rmdir(directoryMountPoint);
				} catch (e: any) {
					const error = e as Error;
					expect(error.message).toContain(
						`Could not remove directory "${directoryMountPoint}": Device or resource busy.`
					);
				}
			});

			it('Should throw an error when trying to move mounted directory', async () => {
				await php.mount(
					directoryMountPoint,
					createNodeFsMountHandler(directoryPath)
				);

				try {
					await php.mv(directoryMountPoint, '/nested-test-moved');
				} catch (e: any) {
					const error = e as Error;
					expect(error.message).toContain(
						`Could not move ${directoryMountPoint} to /nested-test-moved: Device or resource busy.`
					);
				}
			});

			it('Should unmount mounted directory and remove created node from VFS', async () => {
				const unmount = await php.mount(
					directoryMountPoint,
					createNodeFsMountHandler(directoryPath)
				);

				expect(php.isDir(directoryMountPoint)).toBe(true);

				unmount();
				expect(php.isDir(directoryMountPoint)).toBe(false);
			});

			it('Should unmount mounted directory, but not remove the parent directory from VFS if it was created manually', async () => {
				await php.mkdir(directoryMountPoint);
				const unmount = await php.mount(
					directoryMountPoint,
					createNodeFsMountHandler(directoryPath)
				);

				expect(php.isDir(directoryMountPoint)).toBe(true);

				unmount();
				expect(php.isDir(directoryMountPoint)).toBe(true);
			});

			it('Should remount mounted directory after unmounting', async () => {
				const unmount = await php.mount(
					directoryMountPoint,
					createNodeFsMountHandler(directoryPath)
				);

				unmount();
				await php.mount(
					directoryMountPoint,
					createNodeFsMountHandler(directoryPath)
				);

				expect(php.isDir(directoryMountPoint)).toBe(true);
			});
		});
	});

	interface DirectoryTree {
		[key: string]: string | DirectoryTree;
	}

	function createFsFiles(root: string, tree: DirectoryTree) {
		for (const [key, value] of Object.entries(tree)) {
			if (typeof value === 'string') {
				fs.writeFileSync(path.join(root, key), value);
			} else {
				fs.mkdirSync(path.join(root, key));
				createFsFiles(path.join(root, key), value);
			}
		}
	}

	it('Should support nested directory mounts', async () => {
		const tempBase = fs.mkdtempSync(
			path.join(os.tmpdir(), 'playground-nested-')
		);
		createFsFiles(tempBase, {
			root: {
				'long-post-body.txt': 'long post body',
			},
			'overlay-1': {
				'hello.txt': 'hello from overlay',
				sub: {
					'inner.txt': 'inner',
				},
			},
			'overlay-2': {
				'greet.txt': 'hello from overlay2',
				deep: {
					'note.txt': 'deep note',
				},
			},
		});

		// Mount the base directory
		await php.mount(
			'/mount-test',
			createNodeFsMountHandler(`${tempBase}/root`)
		);

		try {
			expect(php.listFiles('/mount-test')).toEqual([
				'long-post-body.txt',
			]);

			// Mount the first overlay at a non-existing subpath – a new
			// directory will be created.
			await php.mount(
				`/mount-test/overlay-1`,
				createNodeFsMountHandler(`${tempBase}/overlay-1`)
			);
			expect(php.listFiles('/mount-test')).toEqual([
				'long-post-body.txt',
				'overlay-1',
			]);
			expect(php.listFiles('/mount-test/overlay-1')).toEqual([
				'hello.txt',
				'sub',
			]);

			// List a `sub` directory in the first overlay.
			expect(php.listFiles('/mount-test/overlay-1/sub')).toEqual([
				'inner.txt',
			]);

			// Now, let's mount the second overlay at the `sub` directory
			// we've just inspected...
			await php.mount(
				'/mount-test/overlay-1/sub',
				createNodeFsMountHandler(`${tempBase}/overlay-2`)
			);
			// ...and confirm listing the files shows the files from the second overlay.
			expect(php.listFiles('/mount-test/overlay-1/sub')).toEqual([
				'deep',
				'greet.txt',
			]);

			// Let's read one of the files just for good measure.
			expect(
				php.readFileAsText('/mount-test/overlay-1/sub/greet.txt')
			).toBe('hello from overlay2');
		} finally {
			fs.rmSync(tempBase, { recursive: true, force: true });
		}
	});
});
