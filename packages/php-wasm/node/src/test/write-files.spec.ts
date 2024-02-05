import { LatestSupportedPHPVersion, writeFiles } from '@php-wasm/universal';
import { NodePHP } from '..';

describe('writeFiles', () => {
	let php: NodePHP;
	beforeEach(async () => {
		php = await NodePHP.load(LatestSupportedPHPVersion);
		php.mkdir('/test');
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
		await writeFiles(php, '/test', {
			'file.txt': 'file',
			'sub/file.txt': 'file',
			'sub1/sub2/file.txt': 'file',
		});
		expect(php.listFiles('/test')).toEqual(['file.txt', 'sub', 'sub1']);
		expect(php.listFiles('/test/sub')).toEqual(['file.txt']);
		expect(php.listFiles('/test/sub1')).toEqual(['sub2']);
		expect(php.listFiles('/test/sub1/sub2')).toEqual(['file.txt']);
	});
});
