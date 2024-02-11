import { NodePHP } from '@php-wasm/node';
import { RecommendedPHPVersion } from '@wp-playground/wordpress';
import { mkdir } from './mkdir';

const docroot = '/php';
describe('Blueprint step mkdir', () => {
	let php: NodePHP;
	beforeEach(async () => {
		php = await NodePHP.load(RecommendedPHPVersion);
	});

	it('should create a directory', async () => {
		expect(php.fileExists(`/${docroot}`)).toBe(false);
		await mkdir(php, {
			path: `/${docroot}`,
		});
		expect(php.fileExists(`/${docroot}`)).toBe(true);
	});

	it('should create a directories recursively', async () => {
		expect(php.fileExists(`/${docroot}`)).toBe(false);
		await mkdir(php, {
			path: `/${docroot}/dir1`,
		});
		expect(php.fileExists(`/${docroot}`)).toBe(true);
		expect(php.fileExists(`/${docroot}/dir1`)).toBe(true);
	});

	it('should do nothing when asked to create a directory that is allready there', async () => {
		php.mkdir(`/${docroot}`);
		expect(php.fileExists(`/${docroot}`)).toBe(true);
		php.writeFile(`/${docroot}/index.php`, `<?php echo 'Hello World';`);
		expect(php.fileExists(`/${docroot}/index.php`)).toBe(true);
		mkdir(php, {
			path: `/${docroot}`,
		});
		expect(php.fileExists(`/${docroot}`)).toBe(true);
		expect(php.fileExists(`/${docroot}/index.php`)).toBe(true);
		expect(php.readFileAsText(`/${docroot}/index.php`)).toBe(
			`<?php echo 'Hello World';`
		);
	});

	it('should do something wierd OR allow for directory names with periods in them', async () => {
		mkdir(php, {
			path: `/${docroot}/index.php`,
		});
		expect(php.fileExists(`/${docroot}/index.php`)).toBe(true);
		mkdir(php, {
			path: `/${docroot}/index.php/dir11`,
		});
		expect(php.fileExists(`/${docroot}/index.php/dir11`)).toBe(true);
	});
});
