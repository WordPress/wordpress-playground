import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ProgressObserver, ProgressObserverEvent } from '@php-wasm/progress';
import { connectPlayground } from '@wp-playground/client';
import type { PlaygroundClient } from '@wp-playground/client';
import { remotePlaygroundOrigin } from './config';

export function useRerender() {
	const [, setTick] = useState(0);
	const tick = useCallback(() => {
		setTick((tick) => tick + 1);
	}, []);
	return tick;
}

export function useProgressObserver() {
	const observer = useMemo(() => new ProgressObserver(), []);
	const [progress, setProgress] = useState<ProgressObserverEvent>({
		mode: observer.mode,
		progress: observer.progress,
		caption: observer.caption,
	});

	useEffect(() => {
		const listener = function (e: CustomEvent<ProgressObserverEvent>) {
			setProgress(e.detail);
		} as EventListener;
		observer.addEventListener('progress', listener);
		return () => {
			observer.removeEventListener('progress', listener);
		};
	}, [observer]);

	return { observer, progress };
}

interface UsePlaygroundOptions {
	onConnected?: (playground: PlaygroundClient) => Promise<void>;
	onConnectionTimeout?: () => void;
	timeout?: number;
	php?: string;
	wp?: string;
}
export function usePlayground({
	onConnected,
	onConnectionTimeout,
	timeout = 1000,
	php,
	wp,
}: UsePlaygroundOptions) {
	const iframeRef = useRef<HTMLIFrameElement>(null);
	const iframe = iframeRef.current;
	const started = useRef(false);
	const [url, setUrl] = useState<string>();
	const [playground, setPlayground] = useState<PlaygroundClient>();
	const [awaitedIframe, setAwaitedIframe] = useState(false);

	useEffect(() => {
		if (started.current) {
			return;
		}
		if (!iframe) {
			// Iframe ref is likely not set on the initial render.
			// Re-render the current component to start the playground.
			if (!awaitedIframe) {
				setAwaitedIframe(true);
			}
			return;
		}
		started.current = true;

		let timeoutHandle: any;
		if (onConnectionTimeout) {
			timeoutHandle = setTimeout(onConnectionTimeout, timeout);
		}

		const inputQuery = new URL(document.location.href).searchParams as any;
		const params: Record<string, string> = {};
		if (inputQuery.has('php')) {
			params['php'] = inputQuery.get('php');
		}
		if (inputQuery.has('wp')) {
			params['wp'] = inputQuery.get('wp');
		}
		const qs = new URLSearchParams(params);
		connectPlayground(
			iframe!,
			`${remotePlaygroundOrigin}/remote.html?${qs}`
		).then(async (api) => {
			if (timeoutHandle) {
				clearTimeout(timeoutHandle);
			}
			api.onNavigation((url) => setUrl(url));
			await onConnected?.(api);
			await api.isReady();
			setPlayground(() => api);
		});
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [iframe, awaitedIframe]);

	return { playground, url, iframeRef };
}
