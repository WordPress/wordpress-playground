export interface CacheEntry {
	responsePromise: Promise<Response>;
	unlockedBodyStream?: ReadableStream<Uint8Array>;
	nextResponse: () => Promise<Response>;
}

/**
 * Creates a fetch function that memoizes the response stream.
 * Calling it twice will return a response with the same status,
 * headers, and the body stream.
 * Memoization is keyed by URL. Method, headers etc are ignored.
 *
 * @param originalFetch The fetch function to memoize. Defaults to the global fetch.
 */
export function createMemoizedFetch(
	originalFetch: (
		input: RequestInfo | URL,
		init?: RequestInit
	) => Promise<Response> = fetch
) {
	const fetches: Record<string, CacheEntry> = {};

	return async function memoizedFetch(url: string, options?: RequestInit) {
		if (!fetches[url]) {
			fetches[url] = {
				responsePromise: originalFetch(url, options),
				async nextResponse() {
					// Wait for "result" to be set.
					const response = await fetches[url].responsePromise;
					const [left, right] =
						fetches[url].unlockedBodyStream!.tee();
					fetches[url].unlockedBodyStream = left;
					return new Response(right, {
						status: response.status,
						statusText: response.statusText,
						headers: response.headers,
					});
				},
			};
			const response = await fetches[url].responsePromise;
			fetches[url].unlockedBodyStream = response.body!;
		}

		return fetches[url].nextResponse();
	};
}
