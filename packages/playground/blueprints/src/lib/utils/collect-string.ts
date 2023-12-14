import { concatString } from './concat-string';
import { limitBytes } from './limit-bytes';

/**
 * Collects the contents of the entire stream into a single string.
 *
 * @param stream The stream to collect.
 * @param bytes Optional. The number of bytes to read from the stream.
 * @returns The string contents of the stream.
 */
export async function collectString(
	stream: ReadableStream<Uint8Array>,
	bytes?: number
) {
	if (bytes !== undefined) {
		stream = limitBytes(stream, bytes);
	}

	return await stream
		.pipeThrough(new TextDecoderStream())
		.pipeThrough(concatString())
		.getReader()
		.read()
		.then(({ value }) => value);
}
