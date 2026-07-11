import { useEffect, useMemo, useRef } from 'react';
import type { DependencyList } from 'react';

type DebouncedCallback<T extends (...args: any[]) => any> = {
	(...args: Parameters<T>): void;
	flush: () => ReturnType<T> | undefined;
};

/** Debounces a callback and exposes its latest pending call for explicit flushes. */
export function useDebouncedCallback<T extends (...args: any[]) => any>(
	callback: T,
	delay = 250,
	dependencies: DependencyList = []
): DebouncedCallback<T> {
	const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const callbackRef = useRef(callback);
	const pendingArgsRef = useRef<Parameters<T> | null>(null);

	// Keep callback ref up to date
	useEffect(() => {
		callbackRef.current = callback;
	}, [callback, ...dependencies]);

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current);
			}
			pendingArgsRef.current = null;
		};
	}, []);

	return useMemo(() => {
		function debounced(...args: Parameters<T>) {
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current);
			}
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
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current);
				timeoutRef.current = null;
			}
			const args = pendingArgsRef.current;
			pendingArgsRef.current = null;
			if (!args) {
				return undefined;
			}
			return callbackRef.current(...args);
		}

		debounced.flush = flush;
		return debounced;
	}, [delay, ...dependencies]);
}
