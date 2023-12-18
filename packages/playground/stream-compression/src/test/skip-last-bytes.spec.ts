import { skipLastBytes } from '../utils/skip-last-bytes';

describe('skipLastBytes', () => {
	it('Should skip the specified number of bytes', async () => {
		const stream = new ReadableStream<Uint8Array>({
			type: 'bytes',
			start(controller) {
				controller.enqueue(new Uint8Array([1, 2, 3, 4, 5]));
				controller.enqueue(new Uint8Array([6, 7]));
				controller.enqueue(new Uint8Array([8, 9]));
				controller.close();
			},
		}).pipeThrough(skipLastBytes(3, 9));

		const reader = stream.getReader();
		const result1 = await reader.read();
		expect(result1.value).toEqual(new Uint8Array([1, 2, 3, 4, 5]));
		expect(result1.done).toBe(false);

		const result2 = await reader.read();
		expect(result2.value).toEqual(new Uint8Array([6]));
		expect(result2.done).toBe(false);

		const result3 = await reader.read();
		expect(result3.done).toBe(true);
	});
});
