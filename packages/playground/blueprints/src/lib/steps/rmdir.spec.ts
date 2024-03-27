import { NodePHP } from '@php-wasm/node';
import { RecommendedPHPVersion } from '@wp-playground/wordpress';
import { rmdir } from './rmdir';

describe('Blueprint step rmdir()', () => {
	let php: NodePHP;
	beforeEach(async () => {
		php = await NodePHP.load(RecommendedPHPVersion);
		php.mkdir('/php');
	});

	it('should remove a directory', async () => {
		const directoryToRemove = '/php/dir';
		php.mkdir(directoryToRemove);
		await rmdir(php, {
			path: directoryToRemove,
		});
		expect(php.fileExists(directoryToRemove)).toBe(false);
	});

	it('should remove a directory with a subdirectory', async () => {
		const directoryToRemove = '/php/dir';
		php.mkdir('/php/dir/subDir');
		await rmdir(php, {
			path: directoryToRemove,
		});
		expect(php.fileExists(directoryToRemove)).toBe(false);
	});

	it('should remove a directory with a file', async () => {
		const directoryToRemove = '/php/dir';
		php.mkdir(directoryToRemove);
		php.writeFile(`/php/dir/file.php`, `<?php echo 'Hello World';`);
		await rmdir(php, {
			path: directoryToRemove,
		});
		expect(php.fileExists(directoryToRemove)).toBe(false);
	});

	it('should fail when the directory does not exist', async () => {
		await expect(
			rmdir(php, {
				path: '/php/dir',
			})
		).rejects.toThrow(/There is no such file or directory/);
	});

	it('should fail when the directory is a file', async () => {
		php.mkdir('/php/dir');
		php.writeFile(`/php/dir/index.php`, `<?php echo 'Hello World';`);
		await expect(
			rmdir(php, {
				path: '/php/dir/index.php',
			})
		).rejects.toThrow(/Not a directory or a symbolic link to a directory./);
	});
});
