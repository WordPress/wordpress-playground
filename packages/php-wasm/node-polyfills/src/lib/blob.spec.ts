import './blob';

describe('File class', () => {
	it('Should exist', () => {
		expect(File).not.toBe(undefined);
	});
});

describe('File.arrayBuffer() method', () => {
	it('should exist', async () => {
		expect(typeof File.prototype.arrayBuffer).toBe('function');
	});
	it('should resolve to a valid array buffer', async () => {
		const inputBytes = new Uint8Array([1, 2, 3, 4]);
		const file = new File([inputBytes], 'test');
		const outputBuffer = await file.arrayBuffer();
		const outputBytes = new Uint8Array(outputBuffer);
		expect(outputBytes).toEqual(inputBytes);
	});
});

describe('File.stream() method', () => {
	it('should exist', async () => {
		expect(typeof File.prototype.stream).toBe('function');
	});
	it('should returns a valid stream', async () => {
		const inputBytes = new Uint8Array([1, 2, 3, 4]);
		const file = new File([inputBytes], 'test');
		const stream = file.stream();
		const reader = stream.getReader();

		const firstRead = await reader.read();
		// Compare strings to avoid failures with Uint8Array comparison in jsdom environment.
		expect(firstRead.value?.toString()).toEqual(inputBytes.toString());
		expect(firstRead.done).toBe(false);

		const secondRead = await reader.read();
		expect(secondRead.done).toBe(true);
	});
	it('should be a valid BYOB stream that allows reading an arbitrary number of bytes', async () => {
		const inputBytes = new Uint8Array([1, 2, 3, 4]);
		const file = new File([inputBytes], 'test');
		const stream = file.stream();
		const reader = stream.getReader({ mode: 'byob' });

		const firstRead = await reader.read(new Uint8Array(3));
		// Compare strings to avoid failures with Uint8Array comparison in jsdom environment.
		expect(firstRead.value?.toString()).toEqual(
			inputBytes.slice(0, 3).toString()
		);
		expect(firstRead.done).toBe(false);

		const secondRead = await reader.read(new Uint8Array(2));
		// Compare strings to avoid failures with Uint8Array comparison in jsdom environment.
		expect(secondRead.value?.toString()).toEqual(
			inputBytes.slice(3).toString()
		);
		expect(secondRead.done).toBe(false);

		const thirdRead = await reader.read(new Uint8Array(2));
		expect(thirdRead.done).toBe(true);
	});
});
