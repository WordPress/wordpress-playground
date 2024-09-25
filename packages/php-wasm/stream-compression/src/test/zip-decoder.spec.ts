import { TeeStreamView, ConvenientStreamWrapper } from '../zip/zip-decoder';

describe('TeeStreamView', () => {
	it('Should tee a stream', async () => {
		const stream = new ReadableStream<Uint8Array>({
			type: 'bytes',
			start(controller) {
				controller.enqueue(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]));
				controller.close();
			},
		});

		const view = new TeeStreamView(stream, 10);
		const stream1 = await view.slice(3, 6);
		const stream2 = await view.slice(0, 3);
		const stream3 = await view.slice(3, 6);

		const result2 = await stream1.read();
		expect(result2).toEqual(new Uint8Array([4, 5, 6]));

		const result1 = await stream2.read();
		expect(result1).toEqual(new Uint8Array([1, 2, 3]));

		const result3 = await stream3.read();
		expect(result3).toEqual(new Uint8Array([4, 5, 6]));
	});
});

describe('ConvenientStreamWrapper', () => {
	it('Should skip the specified number of bytes', async () => {
		const stream = new ReadableStream<Uint8Array>({
			type: 'bytes',
			start(controller) {
				controller.enqueue(new Uint8Array([1, 2, 3, 4, 5]));
				controller.close();
			},
		});

		const wrapper = new ConvenientStreamWrapper(stream, 5);
		await wrapper.skip(2);
		expect(await wrapper.read(1)).toEqual(new Uint8Array([3]));
		expect(await wrapper.read(1)).toEqual(new Uint8Array([4]));
		expect(await wrapper.read(1)).toEqual(new Uint8Array([5]));
	});

	it('Should read up to the specified number of bytes', async () => {
		const stream = new ReadableStream<Uint8Array>({
			type: 'bytes',
			start(controller) {
				controller.enqueue(new Uint8Array([1, 2, 3, 4, 5]));
				controller.close();
			},
		});
		const wrapper = new ConvenientStreamWrapper(stream, 3);
		expect(await wrapper.read(10)).toEqual(new Uint8Array([1, 2, 3]));
		expect(await wrapper.read(10)).toEqual(new Uint8Array([]));
	});

	it('Should work with multiple pulls from the underlying stream', async () => {
		const pulls = [
			new Uint8Array([1, 2, 3, 4, 5]),
			new Uint8Array([6, 7, 8, 9, 10]),
			new Uint8Array([11, 12, 13, 14, 15]),
			new Uint8Array([16, 17, 18, 19, 20]),
			new Uint8Array([21, 22, 23, 24, 25]),
		];
		const stream = new ReadableStream<Uint8Array>({
			type: 'bytes',
			start(controller) {
				controller.enqueue(pulls.shift()!);
			},
			pull(controller) {
				if (pulls.length === 0) {
					controller.close();
					return;
				}
				controller.enqueue(pulls.shift()!);
			},
		});
		const wrapper = new ConvenientStreamWrapper(stream, 20);
		expect(await wrapper.read(6)).toEqual(
			new Uint8Array([1, 2, 3, 4, 5, 6])
		);
		await wrapper.skip(1);
		expect(await wrapper.read(6)).toEqual(
			new Uint8Array([8, 9, 10, 11, 12, 13])
		);
		await wrapper.skip(1);
		expect(await wrapper.read(100)).toEqual(
			new Uint8Array([15, 16, 17, 18, 19, 20, 21, 22])
		);
	});
});
