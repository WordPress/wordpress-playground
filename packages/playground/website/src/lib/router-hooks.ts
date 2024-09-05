import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearch, useLocation } from 'wouter';

export function useSearchParams() {
	const search = useSearch();
	const location = useCurrentUrl();
	const [, setLocation] = useLocation();
	return [
		useMemo(
			() => new URL('?' + search, window.location.href).searchParams,
			[search]
		),
		useCallback(
			(params: Record<string, string | undefined>) => {
				const currentUrl = new URL(location);
				Object.entries(params).forEach(([key, value]) => {
					if (value === undefined) {
						currentUrl.searchParams.delete(key);
					} else {
						currentUrl.searchParams.set(key, value);
					}
				});
				setLocation(currentUrl.toString());
			},
			[setLocation, location]
		),
	] as const;
}

/**
 * Wouter's useLocation hook doesn't reflect the search params or the fragment.
 * This hook does.
 *
 * The code below is copied from wouter's useLocation hook.
 * @see https://github.com/molefrog/wouter
 */

/**
 * History API docs @see https://developer.mozilla.org/en-US/docs/Web/API/History
 */
const eventPopstate = 'popstate';
const eventPushState = 'pushState';
const eventReplaceState = 'replaceState';
const eventHashchange = 'hashchange';
const events = [
	eventPopstate,
	eventPushState,
	eventReplaceState,
	eventHashchange,
];

const subscribeToLocationUpdates = (callback: () => void) => {
	for (const event of events) {
		window.addEventListener(event, callback);
	}
	return () => {
		for (const event of events) {
			window.removeEventListener(event, callback);
		}
	};
};

const patchKey = Symbol.for('wouter_v3');

// While History API does have `popstate` event, the only
// proper way to listen to changes via `push/replaceState`
// is to monkey-patch these methods.
//
// See https://stackoverflow.com/a/4585031
if (
	typeof window.history !== 'undefined' &&
	typeof window[patchKey as any] === 'undefined'
) {
	for (const type of [eventPushState, eventReplaceState]) {
		const original = window.history[type as keyof History];
		// TODO: we should be using unstable_batchedUpdates to avoid multiple re-renders,
		// however that will require an additional peer dependency on react-dom.
		// See: https://github.com/reactwg/react-18/discussions/86#discussioncomment-1567149
		// @ts-ignore
		window.history[type as keyof History] = function (...args: any[]) {
			const result = original.apply(this, args);
			const event = new Event(type);
			// @ts-ignore
			event.arguments = args;

			window.dispatchEvent(event);
			return result;
		};
	}

	// patch history object only once
	// See: https://github.com/molefrog/wouter/issues/167
	Object.defineProperty(window, patchKey, { value: true });
}

export function useCurrentUrl() {
	const [url, setUrl] = useState(window.location.href);
	useEffect(() => {
		const unsubscribe = subscribeToLocationUpdates(() => {
			setUrl(window.location.href);
		});
		return () => {
			unsubscribe();
		};
	}, []);
	return url;
}
