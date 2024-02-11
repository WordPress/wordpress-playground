import { NodePHP } from '@php-wasm/node';
import { RecommendedPHPVersion } from '@wp-playground/wordpress';
import { rmdir } from './rmdir';

const docroot = '/php';
describe('Blueprint step rmdir()', () => {
	let php: NodePHP;
	beforeEach(async () => {
		php = await NodePHP.load(RecommendedPHPVersion);
		php.mkdir(docroot);
	});

	it('should remove a directory', async () => {
		php.mkdir(`/${docroot}/dir1`);
		await rmdir(php, {
			path: `/${docroot}/dir1`,
		});
		expect(php.fileExists(`/${docroot}/dir1`)).toBe(false);
	});

	it('should remove a directory with a subdirectory', async () => {
		php.mkdir(`/${docroot}/dir1`);
		php.mkdir(`/${docroot}/dir1/dir11`);
		await rmdir(php, {
			path: `/${docroot}/dir1`,
		});
		expect(php.fileExists(`/${docroot}/dir1/dir11`)).toBe(false);
		expect(php.fileExists(`/${docroot}/dir1`)).toBe(false);
	});

	it('should remove a directory with a file', async () => {
		php.mkdir(`/${docroot}/dir1`);
		php.writeFile(
			`/${docroot}/dir1/index.php`,
			`<?php echo 'Hello World';`
		);
		await rmdir(php, {
			path: `/${docroot}/dir1`,
		});
		expect(php.fileExists(`/${docroot}/dir1/index.php`)).toBe(false);
		expect(php.fileExists(`/${docroot}/dir1`)).toBe(false);
	});

	it('should fail when the directory does not exist', async () => {
		await expect(
			rmdir(php, {
				path: `/${docroot}/dir1`,
			})
		).rejects.toThrow(/There is no such file or directory/);
	});

	it('should fail when the directory is a file', async () => {
		php.writeFile(`/${docroot}/index.php`, `<?php echo 'Hello World';`);
		await expect(
			rmdir(php, {
				path: `/${docroot}/index.php`,
			})
		).rejects.toThrow(/Not a directory or a symbolic link to a directory./);
	});
});
