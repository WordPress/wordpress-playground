import { ProgressObserver, ProgressObserverEvent } from '@wordpress/php-wasm';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { connectToPlayground } from './wp-client';
import { PlaygroundAPI } from './boot-playground';

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

export function usePlayground(
	onConnected?: (playground: PlaygroundAPI) => Promise<void>
) {
	const iframeRef = useRef<HTMLIFrameElement>(null);
	const iframe = iframeRef.current;
	const started = useRef(false);
	const [url, setUrl] = useState<string>();
	const [playground, setPlayground] = useState<PlaygroundAPI>();
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
		connectToPlayground(iframe!, '/').then(async (api) => {
			api.onNavigation((url) => setUrl(url));
			await onConnected?.(api);
			await api.isReady();
			setPlayground(() => api);
		});
	}, [iframe, awaitedIframe]);

	return { playground, url, iframeRef };
}
