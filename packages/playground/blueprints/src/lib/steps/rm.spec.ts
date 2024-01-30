import { NodePHP } from '@php-wasm/node';
import { RecommendedPHPVersion } from '@wp-playground/wordpress';
import { rm } from './rm';

describe('Blueprint step rm()', () => {
	let php: NodePHP;
	beforeEach(async () => {
		php = await NodePHP.load(RecommendedPHPVersion);
	});

	it('should remove a file', async () => {
		const docroot = php.documentRoot;
		php.writeFile(`/${docroot}/index.php`, `<?php echo 'Hello World';`);
		await rm(php, {
			path: `/${docroot}/index.php`,
		});

		await expect(
			php.run({
				code: `<?php
					require '/index.php';
				`,
			})
		).rejects.toThrow(/ENOENT/);
	});

	it('should fail when the file does not exist', async () => {
		const docroot = php.documentRoot;
		await expect(
			rm(php, {
				path: `/${docroot}/index.php`,
			})
		).rejects.toThrow(/ENOENT/);
	});

	it('should fail when the file is a directory', async () => {
		const docroot = php.documentRoot;
		php.mkdir(`/${docroot}/dir`);
		await expect(
			rm(php, {
				path: `/${docroot}/dir`,
			})
		).rejects.toThrow(/EISDIR/);
	});
});
