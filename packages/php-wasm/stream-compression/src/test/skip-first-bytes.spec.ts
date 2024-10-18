import { skipFirstBytes } from '../utils/skip-first-bytes';

describe('skipFirstBytes', () => {
	it('Should skip the specified number of bytes', async () => {
		const stream = new ReadableStream<Uint8Array>({
			type: 'bytes',
			start(controller) {
				controller.enqueue(new Uint8Array([1, 2, 3, 4, 5]));
				controller.close();
			},
		}).pipeThrough(skipFirstBytes(3));

		const reader = stream.getReader();
		const result1 = await reader.read();
		expect(Array.from(result1.value!)).toEqual(
			Array.from(new Uint8Array([4, 5]))
		);
		expect(result1.done).toBe(false);

		const result2 = await reader.read();
		expect(result2.done).toBe(true);
	});

	it('Should skip the specified number of bytes across multiple pulls', async () => {
		const stream = new ReadableStream<Uint8Array>({
			type: 'bytes',
			start(controller) {
				controller.enqueue(new Uint8Array([1]));
				controller.enqueue(new Uint8Array([2, 3]));
				controller.enqueue(new Uint8Array([4, 5, 6]));
				controller.close();
			},
		}).pipeThrough(skipFirstBytes(4));

		const reader = stream.getReader();
		const result1 = await reader.read();
		expect(Array.from(result1.value!)).toEqual(
			Array.from(new Uint8Array([5, 6]))
		);
		expect(result1.done).toBe(false);

		const result2 = await reader.read();
		expect(result2.done).toBe(true);
	});
});
