import { FileEntry } from '@php-wasm/universal';
import { collectBytes } from './stream-utils';
import { zipFiles } from './compress';

describe('compressFiles', () => {
	it('Should compress a files into a zip archive', async () => {
		const files: FileEntry[] = [
			{
				path: 'wp-content/plugins/hello.php',
				isDirectory: false,
				bytes: async () => new Uint8Array([1, 2, 3, 4, 5]),
			},
			{
				path: 'wp-content/plugins/hello/hello.php',
				isDirectory: false,
				bytes: async () => new Uint8Array([1, 2, 3, 4, 5]),
			},
			{
				path: 'wp-content/plugins/hello/hello2.php',
				isDirectory: false,
				bytes: async () => new Uint8Array([1, 2, 3, 4, 5]),
			},
			{
				path: 'wp-content/plugins/hello/hello3.php',
				isDirectory: false,
				bytes: async () => new Uint8Array([1, 2, 3, 4, 5]),
			},
		];

		const zipBytes = await collectBytes(zipFiles(files[Symbol.iterator]()));
		const zipStream = new Blob([zipBytes!]).stream();

		const reader = zipStream.getReader();
		let i = 0;
		for (i = 0; i < files.length; i++) {
			const { value: file, done } = await reader.read();
			expect(file).toEqual(files[i]);
			expect(done).toBe(false);
		}
		expect(i).toBe(files.length);

		const { done } = await reader.read();
		expect(done).toBe(true);
	});
});
