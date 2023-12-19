/**
 * Concatenate all chunks into a single string.
 *
 * @returns A stream that will emit a single string entry before closing.
 */
export function concatString() {
	const chunks: string[] = [];
	return new TransformStream<string, string>({
		transform(chunk) {
			chunks.push(chunk);
		},

		flush(controller) {
			controller.enqueue(chunks.join(''));
		},
	});
}
