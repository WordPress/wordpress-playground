import { useEffect, useMemo, useRef } from 'react';
import type { DependencyList } from 'react';

type DebouncedCallback<T extends (...args: any[]) => any> = {
	(...args: Parameters<T>): void;
	cancel: () => void;
	flush: () => ReturnType<T> | undefined;
};

/** Debounces a callback and exposes its pending call for cancellation or flushing. */
export function useDebouncedCallback<T extends (...args: any[]) => any>(
	callback: T,
	delay = 250,
	dependencies: DependencyList = []
): DebouncedCallback<T> {
	const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const callbackRef = useRef(callback);
	const pendingArgsRef = useRef<Parameters<T> | null>(null);
	const lastResultRef = useRef<ReturnType<T> | undefined>(undefined);

	// Keep callback ref up to date
	useEffect(() => {
		callbackRef.current = callback;
	}, [callback, ...dependencies]);

	const debouncedCallback = useMemo(() => {
		function cancel() {
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current);
				timeoutRef.current = null;
			}
			pendingArgsRef.current = null;
		}

		function debounced(...args: Parameters<T>) {
			cancel();
			pendingArgsRef.current = args;
			timeoutRef.current = setTimeout(() => {
				flush();
			}, delay);
		}

		/**
		 * Invokes the pending call immediately and returns its result, matching the
		 * conventional debounce API exposed by Lodash.
		 *
		 * @see https://lodash.com/docs/#debounce
		 */
		function flush(): ReturnType<T> | undefined {
			const args = pendingArgsRef.current;
			if (!args) {
				return lastResultRef.current;
			}
			cancel();
			lastResultRef.current = callbackRef.current(...args);
			return lastResultRef.current;
		}

		debounced.cancel = cancel;
		debounced.flush = flush;
		return debounced;
	}, [delay, ...dependencies]);

	// Cleanup on unmount without changing the debounced callback's identity.
	useEffect(() => debouncedCallback.cancel, [debouncedCallback]);

	return debouncedCallback;
}
