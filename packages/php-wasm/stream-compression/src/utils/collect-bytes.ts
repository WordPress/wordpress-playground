import { concatBytes } from './concat-bytes';

/**
 * Collects the contents of the entire stream into a single Uint8Array.
 *
 * @param stream The stream to collect.
 * @param bytes Optional. The number of bytes to read from the stream.
 * @returns The string contents of the stream.
 */
export async function collectBytes(
	stream: ReadableStream<Uint8Array>,
	bytes?: number
) {
	if (bytes === 0) {
		return new Uint8Array();
	}

	// Concat all the chunks into a single Uint8Array:
	if (bytes === undefined) {
		return await stream
			.pipeThrough(concatBytes())
			.getReader()
			.read()
			.then(({ value }) => value!);
	}

	const reader = stream.getReader({ mode: 'byob' });
	let buffer = new ArrayBuffer(bytes);
	let offset = 0;
	while (offset < bytes) {
		const { value, done } = await reader.read(
			new Uint8Array(buffer, offset, bytes - offset)
		);
		if (value) {
			buffer = value!.buffer;
			offset += value!.length;
		}
		if (done) {
			break;
		}
	}
	reader.releaseLock();
	return new Uint8Array(buffer, 0, offset);
}

export async function collectAllBytes(stream: ReadableStream, bytes: number) {
	const reader = stream.getReader();
	const buffer = new ArrayBuffer(bytes);
	let offset = 0;
	while (true) {
		const { value, done } = await reader.read();
		if (value) {
			const array = new Uint8Array(buffer, offset, value!.byteLength);
			array.set(value!);
			offset += value!.byteLength;
		}
		if (done) {
			break;
		}
	}
	reader.releaseLock();
	return new Uint8Array(buffer, 0, Math.min(offset, buffer.byteLength));
}
