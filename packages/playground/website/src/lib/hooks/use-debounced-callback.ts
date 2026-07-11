import { useEffect, useMemo, useRef } from 'react';

type DebouncedCallback<T extends (...args: any[]) => any> = {
	(...args: Parameters<T>): void;
	flush: () => ReturnType<T> | undefined;
};

/** Debounces a callback and exposes its latest pending call for explicit flushes. */
export function useDebouncedCallback<T extends (...args: any[]) => any>(
	callback: T,
	delay = 250,
	dependencies: React.DependencyList = []
): DebouncedCallback<T> {
	const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const callbackRef = useRef(callback);
	const pendingArgsRef = useRef<Parameters<T> | null>(null);

	// Keep callback ref up to date
	useEffect(() => {
		callbackRef.current = callback;
	}, [callback, ...dependencies]);

	// Cancel the timer but retain the pending arguments so a consumer cleanup
	// can still flush the last call during the same unmount.
	useEffect(() => {
		return () => {
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current);
			}
		};
	}, []);

	return useMemo(() => {
		/** Replaces the pending call and restarts its delay. */
		function debounced(...args: Parameters<T>) {
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current);
			}
			pendingArgsRef.current = args;
			timeoutRef.current = setTimeout(() => {
				flush();
			}, delay);
		}

		/** Runs the latest scheduled call immediately, if one exists. */
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
