import { collectBytes } from '../utils/collect-bytes';
import { encodeZip } from '../zip/encode-zip';
import { decodeZip } from '../zip/decode-zip';

describe('compressFiles', () => {
	it('Should compress files into a zip archive', async () => {
		const files: File[] = [
			new File(
				[new Uint8Array([1, 2, 3, 4, 5])],
				'wp-content/plugins/hello.php'
			),
			new File(
				[new Uint8Array([1, 2, 3, 4, 5])],
				'wp-content/plugins/hello/hello.php'
			),
			new File(
				[new Uint8Array([1, 2, 3, 4, 5])],
				'wp-content/plugins/hello/hello2.php'
			),
			new File(
				[new Uint8Array([1, 2, 3, 4, 5])],
				'wp-content/plugins/hello/hello3.php'
			),
		];

		const zipBytes = await collectBytes(
			encodeZip(files[Symbol.iterator]())
		);
		const zipStream = decodeZip(new Blob([zipBytes!]).stream());

		const reader = zipStream.getReader();
		let i = 0;
		for (i = 0; i < files.length; i++) {
			const { value: receivedFile, done } = await reader.read();
			const receivedBytes = new Uint8Array(
				await receivedFile!.arrayBuffer()
			);
			const expectedBytes = new Uint8Array(await files[i].arrayBuffer());
			expect(receivedBytes).toEqual(expectedBytes);
			expect(done).toBe(false);
		}
		expect(i).toBe(files.length);

		const { done } = await reader.read();
		expect(done).toBe(true);
	});
});
