export async function skipBytesInByobStream(
	originalStream: ReadableStream<Uint8Array>,
	skipBytes: number
) {
	const newStream = new SeekableByobStream(originalStream);
	await newStream.seek(skipBytes);
	return newStream;
}

class SeekableByobStream {
	private originalStream: ReadableStream<Uint8Array>;
	private reader: ReadableStreamBYOBReader;
	private offset: number;
	private buffer: ArrayBuffer | null;
	private bufferOffset: number;

	constructor(originalStream: ReadableStream<Uint8Array>) {
		this.originalStream = originalStream;
		this.reader = originalStream.getReader({ mode: 'byob' });
		this.offset = 0;
		this.buffer = null;
		this.bufferOffset = 0;
	}

	async seek(position: number) {
		if (position < this.offset) {
			throw new Error('Cannot seek backwards');
		}

		const skipBytes = position - this.offset;

		if (this.buffer) {
			if (skipBytes < this.buffer.byteLength - this.bufferOffset) {
				// If we can skip within the current buffer
				this.bufferOffset += skipBytes;
				this.offset = position;
				return;
			} else {
				// Discard the current buffer
				this.offset += this.buffer.byteLength - this.bufferOffset;
				this.buffer = null;
				this.bufferOffset = 0;
			}
		}

		// Skip remaining bytes
		let remainingSkip = position - this.offset;
		while (remainingSkip > 0) {
			const readBuffer = new ArrayBuffer(Math.min(remainingSkip, 8192));
			const { done, value } = await this.reader.read(
				new Uint8Array(readBuffer)
			);

			if (done) {
				throw new Error('Unexpected end of stream');
			}

			const bytesRead = value.byteLength;
			remainingSkip -= bytesRead;
			this.offset += bytesRead;
		}
	}

	async read(
		view: Uint8Array
	): Promise<ReadableStreamReadResult<Uint8Array>> {
		if (!(view instanceof Uint8Array)) {
			throw new Error('View must be a Uint8Array');
		}

		if (this.buffer) {
			const availableBytes = this.buffer.byteLength - this.bufferOffset;
			const bytesToCopy = Math.min(availableBytes, view.byteLength);
			view.set(
				new Uint8Array(this.buffer, this.bufferOffset, bytesToCopy)
			);

			this.bufferOffset += bytesToCopy;
			this.offset += bytesToCopy;

			if (this.bufferOffset === this.buffer.byteLength) {
				this.buffer = null;
				this.bufferOffset = 0;
			}

			if (bytesToCopy === view.byteLength) {
				return { value: view, done: false };
			}

			// If we didn't fill the entire view, continue reading
			const remainingView = new Uint8Array(
				view.buffer,
				view.byteOffset + bytesToCopy,
				view.byteLength - bytesToCopy
			);
			const result = await this.read(remainingView);
			return { value: view, done: result.done };
		}

		const { value, done } = await this.reader.read(view);

		if (done) {
			return { value: undefined, done: true };
		}

		this.offset += value.byteLength;
		return { value, done: false };
	}

	getReader() {
		return {
			read: this.read.bind(this),
			releaseLock: () => {},
		};
	}

	pipeTo(dest: WritableStream<Uint8Array>) {
		return this.originalStream.pipeTo(dest);
	}

	pipeThrough<T extends ReadableStream<Uint8Array>>(transform: {
		writable: WritableStream<Uint8Array>;
		readable: T;
	}) {
		return this.originalStream.pipeThrough(transform);
	}

	tee() {
		return this.originalStream.tee();
	}

	get locked() {
		return this.originalStream.locked;
	}

	cancel(reason: any) {
		return this.reader.cancel(reason);
	}

	get closed() {
		return this.reader.closed;
	}
}
