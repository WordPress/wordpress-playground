import { appendBytes } from '../utils/append-bytes';

describe('appendBytes', () => {
	it('Should append the specified number of bytes', async () => {
		const stream = new ReadableStream<Uint8Array>({
			type: 'bytes',
			start(controller) {
				controller.enqueue(new Uint8Array([1, 2, 3]));
				controller.close();
			},
		}).pipeThrough(appendBytes(new Uint8Array([4, 5])));

		const reader = stream.getReader();
		const result1 = await reader.read();
		expect(result1.value).toEqual(new Uint8Array([1, 2, 3]));
		expect(result1.done).toBe(false);

		const result2 = await reader.read();
		expect(result2.value).toEqual(new Uint8Array([4, 5]));
		expect(result2.done).toBe(false);

		const result3 = await reader.read();
		expect(result3.done).toBe(true);
	});
});
