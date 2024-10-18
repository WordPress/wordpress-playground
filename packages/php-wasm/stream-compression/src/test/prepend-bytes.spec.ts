import { prependBytes } from '../utils/prepend-bytes';

describe('prependBytes', () => {
	it('Should prepend the specified number of bytes', async () => {
		const stream = new ReadableStream<Uint8Array>({
			type: 'bytes',
			start(controller) {
				controller.enqueue(new Uint8Array([4, 5]));
				controller.close();
			},
		}).pipeThrough(prependBytes(new Uint8Array([1, 2, 3])));

		const reader = stream.getReader();
		const result1 = await reader.read();
		expect(Array.from(result1.value!)).toEqual(
			Array.from(new Uint8Array([1, 2, 3]))
		);
		expect(result1.done).toBe(false);

		const result2 = await reader.read();
		expect(Array.from(result2.value!)).toEqual(
			Array.from(new Uint8Array([4, 5]))
		);
		expect(result2.done).toBe(false);

		const result3 = await reader.read();
		expect(result3.done).toBe(true);
	});
});
