import { NodePHP } from '@php-wasm/node';
import { RecommendedPHPVersion } from '@wp-playground/common';
import { rm } from './rm';

const docroot = '/php';
describe('Blueprint step rm()', () => {
	let php: NodePHP;
	beforeEach(async () => {
		php = await NodePHP.load(RecommendedPHPVersion);
		php.mkdir(docroot);
	});

	it('should remove a file', async () => {
		php.writeFile(`${docroot}/index.php`, `<?php echo 'Hello World';`);
		await rm(php, {
			path: `${docroot}/index.php`,
		});
		expect(php.fileExists(`${docroot}/index.php`)).toBe(false);
	});

	it('should fail when the file does not exist', async () => {
		await expect(
			rm(php, {
				path: `${docroot}/index.php`,
			})
		).rejects.toThrow(/There is no such file or directory/);
	});

	it('should fail when the file is a directory', async () => {
		php.mkdir(`${docroot}/dir`);
		await expect(
			rm(php, {
				path: `${docroot}/dir`,
			})
		).rejects.toThrow(/There is a directory under that path./);
	});
});
