import type { SiteAccessStore } from '../../src/webmcp-site-access-registry';

/**
 * An in-memory stand-in for the IndexedDB store: transactions run one at a
 * time, and a failed change leaves the stored value untouched.
 */
export function createMemorySiteAccessStore(): SiteAccessStore & {
	value: string | undefined;
} {
	let queue: Promise<unknown> = Promise.resolve();
	const store = {
		value: undefined as string | undefined,
		transact<T>(
			change: (stored: string | undefined) => { result: T; next: string }
		): Promise<T> {
			const run = queue.then(() => {
				const { result, next } = change(store.value);
				store.value = next;
				return result;
			});
			queue = run.catch(() => undefined);
			return run;
		},
	};
	return store;
}
