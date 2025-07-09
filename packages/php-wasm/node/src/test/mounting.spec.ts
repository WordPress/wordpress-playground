import { createNodeFsMountHandler, loadNodeRuntime } from '..';
import { PHP } from '@php-wasm/universal';
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
		await php.mount('/nested-test', createNodeFsMountHandler(testDataPath));

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
				expect(php.isDir(vfsFilePath)).toBe(localStats.isDirectory());

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

	it('Should mount a symlink', async () => {
		const symlinkPath = path.join(__dirname, 'test-data', 'symlink.txt');
		const symlinkTarget = path.join(
			__dirname,
			'test-data',
			'long-post-body.txt'
		);
		const vfsMountPoint = '/symlink.txt';
		try {
			fs.symlinkSync(symlinkTarget, symlinkPath, 'file');

			await php.mount(
				vfsMountPoint,
				createNodeFsMountHandler(symlinkPath)
			);

			expect(php.isFile(vfsMountPoint)).toBe(true);
			expect(php.readFileAsText(vfsMountPoint)).toEqual(
				fs.readFileSync(symlinkTarget, 'utf8')
			);
		} finally {
			fs.unlinkSync(symlinkPath);
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
});
