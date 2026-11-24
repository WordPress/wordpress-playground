import {
	LatestSupportedPHPVersion,
	PHP,
	writeFiles,
} from '@php-wasm/universal';
import { loadNodeRuntime } from '../lib';

describe('writeFiles', () => {
	let php: PHP;
	beforeEach(async () => {
		php = new PHP(await loadNodeRuntime(LatestSupportedPHPVersion));
		php.mkdir('/test');
	});

	afterEach(async () => {
		php.exit();
	});

	it('removes the previous directory contents', async () => {
		await writeFiles(php, '/test', {});
		expect(php.listFiles('/test')).toHaveLength(0);
	});

	it('writes the new directory contents', async () => {
		await writeFiles(php, '/test', {
			'file.txt': 'file',
		});
		expect(php.listFiles('/test')).toEqual(['file.txt']);
	});

	it('handles subdirectories', async () => {
		// Ensure there are some pre-existing files
		php.writeFile('/test/file.txt', 'file');
		php.mkdir('/test/subdirectory1');
		php.writeFile('/test/subdirectory1/file1.1.txt', 'file1.1');
		php.writeFile('/test/subdirectory1/file1.2.txt', 'file1.2');
		php.mkdir('/test/subdirectory2');
		php.writeFile('/test/subdirectory2/file2.1.txt', 'file2.1');
		php.writeFile('/test/subdirectory2/file2.2.txt', 'file2.2');
		php.mkdir('/test/subdirectory2/subsub1');
		php.writeFile('/test/subdirectory2/subsub1/file.txt', 'file');
		php.mkdir('/test/subdirectory2/subsub2');

		await writeFiles(php, '/test', {
			'file.txt': 'file',
			'sub/file.txt': 'file',
			'sub1/sub2/file.txt': 'file',
			'subdirectory1/another-file.txt': 'file1.1',
		});
		expect(php.listFiles('/test')).toEqual([
			'file.txt',
			'subdirectory1',
			'subdirectory2',
			'sub',
			'sub1',
		]);
		expect(php.listFiles('/test/sub')).toEqual(['file.txt']);
		expect(php.listFiles('/test/sub1')).toEqual(['sub2']);
		expect(php.listFiles('/test/sub1/sub2')).toEqual(['file.txt']);
		expect(php.listFiles('/test/subdirectory1')).toEqual([
			'file1.1.txt',
			'file1.2.txt',
			'another-file.txt',
		]);
	});

	it('rejects file paths outside the target directory', async () => {
		await expect(
			writeFiles(php, '/test', {
				'../escape.txt': 'file',
			})
		).rejects.toThrow(
			'Invalid file tree path "../escape.txt": it must resolve inside "/test".'
		);

		expect(php.fileExists('/escape.txt')).toBe(false);
	});

	it.each(['', '.', '/absolute.txt'])(
		'rejects invalid file tree path "%s"',
		async (path) => {
			await expect(
				writeFiles(php, '/test', {
					[path]: 'file',
				})
			).rejects.toThrow(
				`Invalid file tree path ${JSON.stringify(
					path
				)}: it must resolve inside "/test".`
			);
		}
	);

	it('allows redundant path segments that stay inside the target directory', async () => {
		await writeFiles(php, '/test', {
			'sub/./file.txt': 'file',
			'sub//nested.txt': 'nested',
			'sub/../sibling.txt': 'sibling',
		});

		expect(php.readFileAsText('/test/sub/file.txt')).toBe('file');
		expect(php.readFileAsText('/test/sub/nested.txt')).toBe('nested');
		expect(php.readFileAsText('/test/sibling.txt')).toBe('sibling');
	});

	it('allows absolute file tree paths when writing from the filesystem root', async () => {
		await writeFiles(php, '/', {
			'/tmp/root-file.txt': 'file',
			'/./tmp/root-dot-file.txt': 'file',
		});

		expect(php.fileExists('/tmp/root-file.txt')).toBe(true);
		expect(php.fileExists('/tmp/root-dot-file.txt')).toBe(true);
	});

	it('validates paths before removing existing files', async () => {
		php.writeFile('/test/keep.txt', 'file');

		await expect(
			writeFiles(
				php,
				'/test',
				{
					'safe/nested': {
						'../../escape.txt': 'file',
					},
				},
				{ rmRoot: true }
			)
		).rejects.toThrow(
			'Invalid file tree path "../../escape.txt": it must resolve inside ' +
				'"/test/safe/nested".'
		);

		expect(php.fileExists('/test/keep.txt')).toBe(true);
		expect(php.fileExists('/escape.txt')).toBe(false);
	});

	it('removes any pre-existing when ran with rmRoot: true', async () => {
		php.writeFile('/test/file.txt', 'file');
		php.mkdir('/test/subdirectory1');
		php.writeFile('/test/subdirectory1/file1.1.txt', 'file1.1');
		php.writeFile('/test/subdirectory1/file1.2.txt', 'file1.2');
		php.mkdir('/test/subdirectory2');
		php.writeFile('/test/subdirectory2/file2.1.txt', 'file2.1');
		php.writeFile('/test/subdirectory2/file2.2.txt', 'file2.2');
		php.mkdir('/test/subdirectory2/subsub1');
		php.writeFile('/test/subdirectory2/subsub1/file.txt', 'file');
		php.mkdir('/test/subdirectory2/subsub2');

		await writeFiles(
			php,
			'/test',
			{
				'file.txt': 'file',
				'sub/file.txt': 'file',
				'sub1/sub2/file.txt': 'file',
			},
			{
				rmRoot: true,
			}
		);
		expect(php.listFiles('/test')).toEqual(['file.txt', 'sub', 'sub1']);
		expect(php.listFiles('/test/sub')).toEqual(['file.txt']);
		expect(php.listFiles('/test/sub1')).toEqual(['sub2']);
		expect(php.listFiles('/test/sub1/sub2')).toEqual(['file.txt']);
	});
});
