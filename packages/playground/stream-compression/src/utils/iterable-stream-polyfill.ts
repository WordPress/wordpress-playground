/**
 * Polyfill for ReadableStream[Symbol.asyncIterator]
 * This enables the use of for-await-of loops with ReadableStreams
 *
 * @example
 * ```ts
 * for await (const entry of stream) {
 * 	   // ...
 * }
 * ```
 */
// @ts-ignore
if (!ReadableStream.prototype[Symbol.asyncIterator]) {
	// @ts-ignore
	ReadableStream.prototype[Symbol.asyncIterator] = async function* () {
		const reader = this.getReader();
		try {
			while (true) {
				const { done, value } = await reader.read();
				if (done) {
					return;
				}
				yield value;
			}
		} finally {
			reader.releaseLock();
		}
	};
	// @ts-ignore
	ReadableStream.prototype.iterate =
		// @ts-ignore
		ReadableStream.prototype[Symbol.asyncIterator];
}

export type IterableReadableStream<R> = ReadableStream<R> & AsyncIterable<R>;
