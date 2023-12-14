import { concatString } from './concat-string';
import { limitBytes } from './limit-bytes';

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
