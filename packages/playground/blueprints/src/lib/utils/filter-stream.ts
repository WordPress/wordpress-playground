/**
 * Filter the stream based on a predicate.
 *
 * @param predicate The predicate to filter the stream with.
 * @returns A new stream that will only contain chunks that pass the predicate.
 */
export function filterStream<T>(predicate: (chunk: T) => boolean) {
	return new TransformStream<T, T>({
		transform(chunk, controller) {
			if (predicate(chunk)) {
				controller.enqueue(chunk);
			}
		},
	});
}
