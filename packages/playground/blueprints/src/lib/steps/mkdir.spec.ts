import { NodePHP } from '@php-wasm/node';
import { RecommendedPHPVersion } from '@wp-playground/common';
import { mkdir } from './mkdir';

describe('Blueprint step mkdir', () => {
	let php: NodePHP;
	beforeEach(async () => {
		php = await NodePHP.load(RecommendedPHPVersion);
	});

	it('should create a directory', async () => {
		const directoryToCreate = '/php/dir';
		await mkdir(php, {
			path: directoryToCreate,
		});
		expect(php.isDir(directoryToCreate)).toBe(true);
	});

	it('should create a directory recursively', async () => {
		const directoryToCreate = '/php/dir/subDir';
		await mkdir(php, {
			path: directoryToCreate,
		});
		expect(php.isDir(directoryToCreate)).toBe(true);
	});

	it('should do nothing when asked to create a directory that is allready there', async () => {
		const existingDirectory = '/php/dir';
		php.mkdir(existingDirectory);

		const existingFile = '/php/dir/index.php';
		php.writeFile(existingFile, `<?php echo 'Hello World';`);

		mkdir(php, {
			path: existingDirectory,
		});

		expect(php.readFileAsText(existingFile)).toBe(
			`<?php echo 'Hello World';`
		);
	});
});
