export interface CacheEntry {
	responsePromise: Promise<Response>;
	unlockedBodyStream?: ReadableStream<Uint8Array>;
	nextResponse: () => Promise<Response>;
}

export interface MemoizedFetchOptions {
	/**
	 * Maximum number of URLs to cache. When exceeded, the oldest entries
	 * are evicted (LRU policy). Defaults to 25.
	 *
	 * This conservative default prevents excessive memory usage while still
	 * caching commonly accessed resources. Consider that each cached response
	 * holds a readable stream and response metadata.
	 */
	maxCacheSize?: number;
}

/**
 * Creates a fetch function that memoizes the response stream.
 * Calling it twice will return a response with the same status,
 * headers, and the body stream.
 * Memoization is keyed by URL. Method, headers etc are ignored.
 *
 * The cache uses an LRU eviction policy to prevent unbounded memory growth.
 * When the cache exceeds maxCacheSize, the oldest entries are removed.
 *
 * @param originalFetch The fetch function to memoize. Defaults to the global fetch.
 * @param options Configuration options for the memoized fetch.
 */
export function createMemoizedFetch(
	originalFetch: (
		input: RequestInfo | URL,
		init?: RequestInit
	) => Promise<Response> = fetch,
	options: MemoizedFetchOptions = {}
) {
	const { maxCacheSize = 25 } = options;

	// Use Map to preserve insertion order for LRU eviction
	const fetches = new Map<string, CacheEntry>();

	/**
	 * Evicts the oldest cache entries when the cache exceeds maxCacheSize.
	 * This implements a simple LRU policy based on insertion order.
	 */
	function evictOldestIfNeeded() {
		while (fetches.size > maxCacheSize) {
			const oldestKey = fetches.keys().next().value;
			if (oldestKey !== undefined) {
				fetches.delete(oldestKey);
			}
		}
	}

	/**
	 * Moves a key to the end of the Map to mark it as recently used.
	 */
	function markAsRecentlyUsed(url: string) {
		const entry = fetches.get(url);
		if (entry) {
			fetches.delete(url);
			fetches.set(url, entry);
		}
	}

	return async function memoizedFetch(url: string, options?: RequestInit) {
		if (!fetches.has(url)) {
			// Evict old entries before adding a new one
			evictOldestIfNeeded();

			const entry: CacheEntry = {
				responsePromise: originalFetch(url, options),
				async nextResponse() {
					// Wait for "result" to be set.
					const response = await entry.responsePromise;
					const currentEntry = fetches.get(url);
					if (!currentEntry) {
						// Entry was evicted, re-fetch
						throw new Error('Cache entry was evicted');
					}
					const [left, right] = currentEntry.unlockedBodyStream!.tee();
					currentEntry.unlockedBodyStream = left;
					return new Response(right, {
						status: response.status,
						statusText: response.statusText,
						headers: response.headers,
					});
				},
			};
			fetches.set(url, entry);
			const response = await entry.responsePromise;
			const currentEntry = fetches.get(url);
			if (currentEntry) {
				currentEntry.unlockedBodyStream = response.body!;
			}
		} else {
			// Mark as recently used to prevent eviction
			markAsRecentlyUsed(url);
		}

		const entry = fetches.get(url);
		if (!entry) {
			// Entry was evicted during async operation, retry
			return memoizedFetch(url, options);
		}
		return entry.nextResponse();
	};
}
