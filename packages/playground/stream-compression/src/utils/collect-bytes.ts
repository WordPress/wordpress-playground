import { concatBytes } from './concat-bytes';
import { limitBytes } from './limit-bytes';

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
	if (bytes !== undefined) {
		stream = limitBytes(stream, bytes);
	}

	return await stream
		.pipeThrough(concatBytes(bytes))
		.getReader()
		.read()
		.then(({ value }) => value!);
}
