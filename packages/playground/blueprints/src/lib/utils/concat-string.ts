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
