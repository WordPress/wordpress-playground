import { NodePHP } from '@php-wasm/node';
import { RecommendedPHPVersion } from '@wp-playground/wordpress';
import { cp } from './cp';

describe('Blueprint step cp()', () => {
	let php: NodePHP;
	beforeEach(async () => {
		php = await NodePHP.load(RecommendedPHPVersion);
	});

	it('should copy a file', async () => {
		const docroot = php.documentRoot;
		php.writeFile(`/${docroot}/index.php`, `<?php echo 'Hello World';`);
		await cp(php, {
			fromPath: `/${docroot}/index.php`,
			toPath: `/${docroot}/index2.php`,
		});

		const response = await php.run({
			code: `<?php
				require '/index2.php';
			`,
		});
		expect(response.text).toBe('Hello World');
	});

	it('should fail when the source file does not exist', async () => {
		const docroot = php.documentRoot;
		await expect(
			cp(php, {
				fromPath: `/${docroot}/index.php`,
				toPath: `/${docroot}/index2.php`,
			})
		).rejects.toThrow(/ENOENT/);
	});

	it('should fail when the source file is a directory', async () => {
		const docroot = php.documentRoot;
		php.mkdir(`/${docroot}/dir`);
		await expect(
			cp(php, {
				fromPath: `/${docroot}/dir`,
				toPath: `/${docroot}/index2.php`,
			})
		).rejects.toThrow(/EISDIR/);
	});

	it('should overwrite the target file', async () => {
		const docroot = php.documentRoot;
		php.writeFile(`/${docroot}/index.php`, `<?php echo 'Hello World';`);
		php.writeFile(`/${docroot}/index2.php`, `<?php echo 'Goodbye World';`);
		await cp(php, {
			fromPath: `/${docroot}/index.php`,
			toPath: `/${docroot}/index2.php`,
		});

		const response = await php.run({
			code: `<?php
				require '/index2.php';
			`,
		});
		expect(response.text).toBe('Hello World');
	});
});
