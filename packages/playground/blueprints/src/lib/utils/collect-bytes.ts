import { concatBytes } from './concat-bytes';
import { limitBytes } from './limit-bytes';

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
