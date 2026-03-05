import { PHP } from '@php-wasm/universal';
import { writeFiles } from './write-files';
import { PHPRequestHandler } from '@php-wasm/universal';
import { loadNodeRuntime } from '@php-wasm/node';
import { RecommendedPHPVersion } from '@wp-playground/common';

const phpVersion = RecommendedPHPVersion;
describe('writeFiles', () => {
	let php: PHP;
	let handler: PHPRequestHandler;
	beforeEach(async () => {
		handler = new PHPRequestHandler({
			phpFactory: async () => new PHP(await loadNodeRuntime(phpVersion)),
			documentRoot: '/wordpress',
		});
		php = await handler.getPrimaryPhp();
	});

	afterEach(async () => {
		php.exit();
		await handler[Symbol.asyncDispose]();
	});

	it('should write files to the document root', async () => {
		await writeFiles(php, {
			writeToPath: '/wordpress/wp-content/plugins/test-plugin',
			filesTree: {
				name: 'test-plugin',
				files: {
					'test.txt': 'Hello, world!',
				},
			},
		});
		expect(
			php.fileExists('/wordpress/wp-content/plugins/test-plugin/test.txt')
		).toBe(true);
	});
});
