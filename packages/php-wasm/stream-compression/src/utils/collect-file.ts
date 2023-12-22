import { collectBytes } from './collect-bytes';

/**
 * Collects the contents of the entire stream into a single File object.
 *
 * @param stream The stream to collect.
 * @param fileName The name of the file
 * @returns The string contents of the stream.
 */
export async function collectFile(
	fileName: string,
	stream: ReadableStream<Uint8Array>
) {
	// @TODO: use StreamingFile
	return new File([await collectBytes(stream)], fileName);
}
