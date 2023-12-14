/**
 * Converts an iterator or iterable to a stream.
 *
 * @param iteratorOrIterable The iterator or iterable to convert.
 * @returns A stream that will yield the values from the iterator or iterable.
 */
export function iteratorToStream<T>(
	iteratorOrIterable:
		| AsyncIterator<T>
		| Iterator<T>
		| AsyncIterable<T>
		| Iterable<T>
): ReadableStream<T> {
	let iterator: AsyncIterator<T> | Iterator<T>;
	if (Symbol.asyncIterator in iteratorOrIterable) {
		iterator = iteratorOrIterable[Symbol.asyncIterator]();
	} else if (Symbol.iterator in iteratorOrIterable) {
		iterator = iteratorOrIterable[Symbol.iterator]();
	} else {
		iterator = iteratorOrIterable;
	}

	return new ReadableStream<T>({
		async pull(controller) {
			const { done, value } = await iterator.next();
			if (done) {
				controller.close();
				return;
			}
			controller.enqueue(value);
		},
	});
}
